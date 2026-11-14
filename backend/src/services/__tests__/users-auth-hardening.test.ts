import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { authenticateJWT } from '../../middlewares/auth';
import { login, getMe, changeOwnPassword } from '../../controllers/auth.controller';
import { adminUsersSubService } from '../admin/admin-users.service';
import {
  computePasswordVersion,
  sessionCache,
} from '../../utils/session-cache.util';
import { STAFF_COOKIE_NAME } from '../../utils/cookie-auth.util';

describe('Blindaje de Usuarios, Roles y Sesiones — Paso 1', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionCache.clear();
  });

  it('Permite login normalizado sin sensibilidad a mayúsculas/espacios y bloquea cuentas del sistema (OFICINA / tienda_online)', async () => {
    const passwordHash = await bcrypt.hash('claveSegura123', 4);
    const findFirstSpy = vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
      id: 14,
      username: 'diego',
      passwordHash,
      role: Role.VENDEDOR,
      isActive: true,
    } as any);

    const req: any = {
      body: { username: '  Diego  ', password: 'claveSegura123' },
      secure: false,
      headers: {},
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      cookie: vi.fn(),
    };

    await login(req, res);

    expect(findFirstSpy).toHaveBeenCalledWith({
      where: { username: { equals: 'Diego', mode: 'insensitive' } },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.user).toEqual({
      id: 14,
      username: 'diego',
      role: Role.VENDEDOR,
    });
    expect((payload.data.user as any).permissions).toBeUndefined();

    const decodedToken = jwt.verify(payload.data.token, env.JWT_SECRET) as any;
    expect(decodedToken.pwdVer).toBe(computePasswordVersion(passwordHash));
    expect(decodedToken.permissions).toBeUndefined();
    expect(sessionCache.getStaffSession(14)?.pwdVer).toBe(decodedToken.pwdVer);

    // Bloqueo inmediato para cuentas virtuales del sistema
    findFirstSpy.mockClear();
    for (const sysName of ['OFICINA', 'oficina', 'tienda_online', '  TIENDA_ONLINE  ']) {
      const sysReq: any = {
        body: { username: sysName, password: 'cualquierPassword123' },
        secure: false,
        headers: {},
      };
      const sysRes: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        cookie: vi.fn(),
      };
      await login(sysReq, sysRes);
      expect(sysRes.status).toHaveBeenCalledWith(401);
      expect(sysRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Credenciales inválidas.' }),
      );
    }
    expect(findFirstSpy).not.toHaveBeenCalled();
  });

  it('Revoca sesiones abiertas inmediatamente (cache hit y cache miss) cuando cambia la contraseña (pwdVer)', async () => {
    const oldHash = '$2a$10$oldPasswordHashExample1234567890123456789012';
    const newHash = '$2a$10$newPasswordHashExample1234567890123456789012';
    const oldPwdVer = computePasswordVersion(oldHash);
    const newPwdVer = computePasswordVersion(newHash);

    const oldToken = jwt.sign(
      { id: 25, username: 'dario', role: Role.FACTURACION, pwdVer: oldPwdVer },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Escenario A: sesión cacheada ya posee nuevo pwdVer
    sessionCache.setStaffSession(25, {
      id: 25,
      role: Role.FACTURACION,
      isActive: true,
      pwdVer: newPwdVer,
    });

    const hitReq: any = {
      method: 'GET',
      headers: { cookie: `${STAFF_COOKIE_NAME}=${oldToken}` },
      secure: false,
    };
    const hitRes: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      clearCookie: vi.fn(),
    };
    const hitNext = vi.fn();

    await authenticateJWT(hitReq, hitRes, hitNext);
    expect(hitNext).not.toHaveBeenCalled();
    expect(hitRes.status).toHaveBeenCalledWith(401);
    expect(hitRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SESSION_REVOKED' }),
    );
    expect(hitRes.clearCookie).toHaveBeenCalledWith(
      STAFF_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, path: '/api' }),
    );

    // Escenario B: caché invalidado -> consulta PostgreSQL con el nuevo passwordHash
    sessionCache.invalidateStaffSession(25);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      id: 25,
      username: 'dario',
      role: Role.FACTURACION,
      isActive: true,
      passwordHash: newHash,
    } as any);

    const missReq: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${oldToken}` },
      secure: false,
    };
    const missRes: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      clearCookie: vi.fn(),
    };
    const missNext = vi.fn();

    await authenticateJWT(missReq, missRes, missNext);
    expect(missNext).not.toHaveBeenCalled();
    expect(missRes.status).toHaveBeenCalledWith(401);
    expect(missRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SESSION_REVOKED' }),
    );

    // Bloqueo también en getMe si intenta consultar cuenta del sistema
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      id: 99,
      username: 'OFICINA',
      role: Role.VENDEDOR,
      isActive: true,
      createdAt: new Date(),
    } as any);
    const meRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await getMe({ user: { id: 99, username: 'OFICINA', role: Role.VENDEDOR } } as any, meRes);
    expect(meRes.status).toHaveBeenCalledWith(404);
  });

  it('Protege cuentas del sistema, auto-degradación de rol, último ADMIN activo y claves cortas', async () => {
    const findUniqueSpy = vi.spyOn(prisma.user, 'findUnique');
    const findFirstSpy = vi.spyOn(prisma.user, 'findFirst');
    const countSpy = vi.spyOn(prisma.user, 'count');
    const updateSpy = vi.spyOn(prisma.user, 'update');

    // 1. Cuentas del sistema protegidas contra edición, toggle y borrado
    findUniqueSpy.mockResolvedValue({
      id: 50,
      username: 'OFICINA',
      role: Role.VENDEDOR,
      isActive: true,
    } as any);
    await expect(
      adminUsersSubService.updateUser(50, { role: Role.ADMIN }, 1),
    ).rejects.toThrow(/protegidas/i);
    await expect(adminUsersSubService.toggleUserStatus(50, 1)).rejects.toThrow(/protegidas/i);

    findFirstSpy.mockResolvedValueOnce({
      id: 51,
      username: 'tienda_online',
      role: Role.VENDEDOR,
      isActive: true,
    } as any);
    await expect(adminUsersSubService.deleteUser('tienda_online', 1)).rejects.toThrow(
      /protegidas/i,
    );

    // 2. Auto-degradación de rol bloqueada
    findUniqueSpy.mockResolvedValueOnce({
      id: 1,
      username: 'esteban',
      role: Role.ADMIN,
      isActive: true,
    } as any);
    await expect(
      adminUsersSubService.updateUser(1, { role: Role.VENDEDOR }, 1),
    ).rejects.toThrow(/propio usuario/i);

    // 3. Bloqueo sobre último ADMIN activo (count === 1)
    findUniqueSpy.mockResolvedValueOnce({
      id: 2,
      username: 'pablo',
      role: Role.ADMIN,
      isActive: true,
    } as any);
    countSpy.mockResolvedValueOnce(1);
    await expect(adminUsersSubService.toggleUserStatus(2, 1)).rejects.toThrow(
      /al menos un Administrador General/i,
    );

    findUniqueSpy.mockResolvedValueOnce({
      id: 2,
      username: 'pablo',
      role: Role.ADMIN,
      isActive: true,
    } as any);
    countSpy.mockResolvedValueOnce(1);
    await expect(
      adminUsersSubService.updateUser(2, { role: Role.FACTURACION }, 1),
    ).rejects.toThrow(/al menos un Administrador General/i);

    // Permitido si hay 2+ ADMIN activos
    findUniqueSpy.mockResolvedValueOnce({
      id: 2,
      username: 'pablo',
      role: Role.ADMIN,
      isActive: true,
    } as any);
    countSpy.mockResolvedValueOnce(2);
    updateSpy.mockResolvedValueOnce({
      id: 2,
      username: 'pablo',
      role: Role.FACTURACION,
      isActive: true,
      createdAt: new Date(),
    } as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);
    const updatedOk = await adminUsersSubService.updateUser(
      2,
      { role: Role.FACTURACION },
      1,
    );
    expect(updatedOk.role).toBe(Role.FACTURACION);

    // 4. Contraseñas cortas rechazadas explícitamente (no ignoradas) y duplicado case-insensitive bloqueado
    findFirstSpy.mockResolvedValueOnce({ id: 14 } as any);
    await expect(
      adminUsersSubService.createUser(
        { username: 'Diego', password: 'password123', role: Role.VENDEDOR },
        1,
      ),
    ).rejects.toThrow(/ya está registrado/i);

    findUniqueSpy.mockResolvedValueOnce({
      id: 14,
      username: 'diego',
      role: Role.VENDEDOR,
      isActive: true,
    } as any);
    await expect(
      adminUsersSubService.updateUser(14, { password: '123' }, 1),
    ).rejects.toThrow(/al menos 6 caracteres/i);
  });

  it('Impide borrado físico cuando hay historial/auditoría sugiriendo Desactivar, y permite borrar cuentas sin historial', async () => {
    const deleteSpy = vi.spyOn(prisma.user, 'delete');
    const findFirstSpy = vi.spyOn(prisma.user, 'findFirst');
    const findUniqueSpy = vi.spyOn(prisma.user, 'findUnique');

    // Usuario con 3 pedidos y 12 logs de auditoría -> bloqueo amigable sin tocar prisma.user.delete
    findFirstSpy.mockResolvedValueOnce({
      id: 30,
      username: 'fabian',
      role: Role.VENDEDOR,
      isActive: true,
    } as any);
    findUniqueSpy.mockResolvedValueOnce({
      employee: null,
      _count: {
        orders: 3,
        transactions: 0,
        stockMovements: 0,
        auditLogs: 12,
        personas: 1,
        cashDrawers: 0,
        creditNotes: 0,
        saleRoutes: 0,
        routeVisits: 0,
        expenses: 0,
        crmConversations: 0,
        weeklySchedules: 0,
        accountLedgerEntries: 0,
        warehouseCellsUpdated: 0,
      },
    } as any);

    await expect(adminUsersSubService.deleteUser('fabian', 1)).rejects.toThrow(
      /Usá "Desactivar"/,
    );
    expect(deleteSpy).not.toHaveBeenCalled();

    // Usuario nuevo sin movimientos ni auditoría -> eliminación limpia permitida
    findFirstSpy.mockResolvedValueOnce({
      id: 91,
      username: 'prueba_sin_uso',
      role: Role.DEPOSITO,
      isActive: true,
    } as any);
    findUniqueSpy.mockResolvedValueOnce({
      employee: null,
      _count: {
        orders: 0,
        transactions: 0,
        stockMovements: 0,
        auditLogs: 0,
        personas: 0,
        cashDrawers: 0,
        creditNotes: 0,
        saleRoutes: 0,
        routeVisits: 0,
        expenses: 0,
        crmConversations: 0,
        weeklySchedules: 0,
        accountLedgerEntries: 0,
        warehouseCellsUpdated: 0,
      },
    } as any);
    deleteSpy.mockResolvedValueOnce({ id: 91 } as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValueOnce({ id: 500 } as any);

    const res = await adminUsersSubService.deleteUser('prueba_sin_uso', 1);
    expect(res).toEqual({ success: true, username: 'prueba_sin_uso' });
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 91 } });
  });

  it('Registra auditoría de LOGIN / LOGIN_FAILED y expone lastLoginAt en getUsers', async () => {
    const passwordHash = await bcrypt.hash('claveValida99', 4);
    vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
      id: 22,
      username: 'dario',
      passwordHash,
      role: Role.FACTURACION,
      isActive: true,
    } as any);
    const auditCreateSpy = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 901 } as any);

    // Intento fallido -> LOGIN_FAILED
    const badRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
    await login({ body: { username: 'dario', password: 'incorrecta' }, secure: false, headers: {}, ip: '192.168.1.50' } as any, badRes);
    expect(badRes.status).toHaveBeenCalledWith(401);
    expect(auditCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 22,
          action: 'LOGIN_FAILED',
          status: 'WARNING',
        }),
      }),
    );

    // Intento exitoso -> LOGIN
    auditCreateSpy.mockClear();
    const okRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
    await login({ body: { username: 'dario', password: 'claveValida99' }, secure: false, headers: {}, ip: '192.168.1.50' } as any, okRes);
    expect(okRes.status).toHaveBeenCalledWith(200);
    expect(auditCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 22,
          action: 'LOGIN',
          status: 'SUCCESS',
        }),
      }),
    );

    // getUsers incluye lastLoginAt
    const lastDate = new Date('2026-11-14T15:00:00.000Z');
    vi.spyOn(prisma.user, 'findMany').mockResolvedValue([
      { id: 22, username: 'dario', role: Role.FACTURACION, isActive: true, createdAt: lastDate },
      { id: 23, username: 'nuevo', role: Role.DEPOSITO, isActive: true, createdAt: lastDate },
    ] as any);
    vi.spyOn(prisma.auditLog, 'groupBy').mockResolvedValue([
      { userId: 22, _max: { createdAt: lastDate } },
    ] as any);

    const users = await adminUsersSubService.getUsers();
    expect(users.find((u) => u.id === 22)?.lastLoginAt).toEqual(lastDate);
    expect(users.find((u) => u.id === 23)?.lastLoginAt).toBeNull();
  });

  it('Restringe cambio de contraseña propia a ADMIN, verifica clave actual, mantiene sesión viva y revoca pwdVer anterior', async () => {
    const oldHash = await bcrypt.hash('claveActual123', 4);
    const oldPwdVer = computePasswordVersion(oldHash);

    const findUniqueSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 1,
      username: 'esteban',
      passwordHash: oldHash,
      role: Role.ADMIN,
      isActive: true,
    } as any);
    const updateSpy = vi.spyOn(prisma.user, 'update').mockResolvedValue({ id: 1 } as any);
    const auditCreateSpy = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 902 } as any);

    // Rol no administrador -> 403 sin tocar base de datos
    const nonAdminRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
    await changeOwnPassword(
      { user: { id: 30, username: 'agustin', role: Role.FACTURACION }, body: { currentPassword: 'claveActual123', newPassword: 'nuevaClave99' }, secure: false, headers: {} } as any,
      nonAdminRes,
    );
    expect(nonAdminRes.status).toHaveBeenCalledWith(403);
    expect(findUniqueSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();

    // Contraseña actual incorrecta (ADMIN) -> 401
    const wrongRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
    await changeOwnPassword(
      { user: { id: 1, username: 'esteban', role: Role.ADMIN }, body: { currentPassword: 'mal', newPassword: 'nuevaClave99' }, secure: false, headers: {} } as any,
      wrongRes,
    );
    expect(wrongRes.status).toHaveBeenCalledWith(401);
    expect(updateSpy).not.toHaveBeenCalled();

    // Cambio válido (ADMIN) -> actualiza hash, cookie, sessionCache y registra CHANGE_OWN_PASSWORD
    const okRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn(), cookie: vi.fn() };
    await changeOwnPassword(
      { user: { id: 1, username: 'esteban', role: Role.ADMIN }, body: { currentPassword: 'claveActual123', newPassword: 'nuevaClave99' }, secure: false, headers: {}, ip: '127.0.0.1' } as any,
      okRes,
    );

    expect(okRes.status).toHaveBeenCalledWith(200);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const cached = sessionCache.getStaffSession(1);
    expect(cached?.pwdVer).toBeDefined();
    expect(cached?.pwdVer).not.toBe(oldPwdVer);
    expect(auditCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 1,
          action: 'CHANGE_OWN_PASSWORD',
          status: 'SUCCESS',
        }),
      }),
    );
  });
});
