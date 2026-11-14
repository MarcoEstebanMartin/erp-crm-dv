import prisma from '../../utils/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { logAudit } from '../../utils/audit';
import {
  computePasswordVersion,
  isSystemUsername,
  sessionCache,
} from '../../utils/session-cache.util';

const USER_PUBLIC_SELECT = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

const SYSTEM_PROTECTED_ERROR =
  'Las cuentas automáticas del sistema (OFICINA / Tienda Online) están protegidas y no pueden modificarse ni eliminarse.';

const USER_HISTORY_DELETE_ERROR =
  'No se puede eliminar definitivamente a este usuario porque registra historial contable, clientes asignados o auditoría. Usá "Desactivar" para bloquear su acceso conservando la trazabilidad.';

export class AdminUsersSubService {
  private async ensureNotLastActiveAdmin(user: {
    role: Role;
    isActive: boolean;
  }): Promise<void> {
    if (user.role === Role.ADMIN && user.isActive) {
      const activeAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, isActive: true },
      });
      if (activeAdmins <= 1) {
        throw new Error('Debe quedar al menos un Administrador General activo en el sistema.');
      }
    }
  }

  async getUserPasswordVersion(id: number): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { passwordHash: true },
    });
    return user?.passwordHash ? computePasswordVersion(user.passwordHash) : null;
  }

  /**
   * Obtener logs de auditoría paginados.
   */
  async getAuditLogs(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener logs de auditoría para un documento o entidad específica.
   */
  async getDocumentAuditLogs(entityType: string, entityId: number) {
    return prisma.auditLog.findMany({
      where: {
        entityType,
        entityId: Number(entityId),
      },
      include: {
        user: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Obtener listado de usuarios con fecha de último acceso registrado.
   */
  async getUsers() {
    const users = await prisma.user.findMany({
      select: USER_PUBLIC_SELECT,
      orderBy: { username: 'asc' },
    });

    const loginLogs =
      typeof prisma.auditLog?.groupBy === 'function'
        ? await prisma.auditLog
            .groupBy({
              by: ['userId'],
              where: { action: 'LOGIN', status: 'SUCCESS' },
              _max: { createdAt: true },
            })
            .catch(() => [])
        : [];

    const lastLoginByUserId = new Map<number, Date | null>(
      loginLogs.map((entry) => [entry.userId, entry._max.createdAt ?? null]),
    );

    return users.map((user) => ({
      ...user,
      lastLoginAt: lastLoginByUserId.get(user.id) ?? null,
    }));
  }

  /**
   * Crear un nuevo usuario.
   */
  async createUser(
    data: { username: string; password: string; role: Role },
    adminId?: number,
  ) {
    const cleanUsername = String(data.username || '').trim();
    if (cleanUsername.length < 3) {
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
    }
    if (isSystemUsername(cleanUsername)) {
      throw new Error('Ese nombre está reservado para cuentas automáticas del sistema.');
    }
    const cleanPassword = String(data.password || '').trim();
    if (cleanPassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    const existing = await prisma.user.findFirst({
      where: { username: { equals: cleanUsername, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new Error('El nombre de usuario ya está registrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(cleanPassword, salt);

    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        passwordHash,
        role: data.role,
      },
      select: USER_PUBLIC_SELECT,
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: newUser.id,
        newValues: {
          username: newUser.username,
          role: newUser.role,
        },
      });
    }

    return newUser;
  }

  /**
   * Habilitar/Deshabilitar usuario.
   */
  async toggleUserStatus(id: number, adminId?: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('Usuario no encontrado.');

    if (isSystemUsername(user.username)) {
      throw new Error(SYSTEM_PROTECTED_ERROR);
    }

    if (user.id === adminId) {
      throw new Error('No podés desactivar tu propio usuario administrador.');
    }

    await this.ensureNotLastActiveAdmin(user);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, isActive: true },
    });
    sessionCache.invalidateStaffSession(user.id);

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'TOGGLE_USER_STATUS',
        entityType: 'User',
        entityId: user.id,
        oldValues: { username: user.username, isActive: user.isActive },
        newValues: { username: updated.username, isActive: updated.isActive },
      });
    }

    return updated;
  }

  /**
   * Actualizar nombre de usuario, rol y/o contraseña.
   */
  async updateUser(
    id: number,
    data: { username?: string; role?: Role; password?: string },
    adminId?: number,
  ) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('Usuario no encontrado.');

    if (isSystemUsername(user.username)) {
      throw new Error(SYSTEM_PROTECTED_ERROR);
    }

    const updateData: { username?: string; role?: Role; passwordHash?: string } = {};

    if (data.username !== undefined) {
      const cleanUsername = data.username.trim();
      if (cleanUsername !== '' && cleanUsername !== user.username) {
        if (cleanUsername.length < 3) {
          throw new Error('El nombre de usuario debe tener al menos 3 caracteres.');
        }
        if (isSystemUsername(cleanUsername)) {
          throw new Error('Ese nombre está reservado para cuentas automáticas del sistema.');
        }
        const existing = await prisma.user.findFirst({
          where: {
            username: { equals: cleanUsername, mode: 'insensitive' },
            NOT: { id: user.id },
          },
          select: { id: true },
        });
        if (existing) {
          throw new Error('El nombre de usuario ya está registrado.');
        }
        updateData.username = cleanUsername;
      }
    }

    if (data.role && data.role !== user.role) {
      if (user.id === adminId) {
        throw new Error('No podés cambiar el rol de tu propio usuario en sesión.');
      }
      await this.ensureNotLastActiveAdmin(user);
      updateData.role = data.role;
    }

    if (data.password !== undefined && data.password !== '') {
      const cleanPassword = data.password.trim();
      if (cleanPassword.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
      }
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(cleanPassword, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_PUBLIC_SELECT,
    });
    sessionCache.invalidateStaffSession(id);

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'UPDATE_USER',
        entityType: 'User',
        entityId: user.id,
        oldValues: { username: user.username, role: user.role },
        newValues: {
          username: updated.username,
          role: updated.role,
          passwordChanged: Boolean(updateData.passwordHash),
        },
      });
    }

    return updated;
  }

  /**
   * Eliminar usuario por username o ID (solo si no posee historial vinculado).
   */
  async deleteUser(usernameOrId: string | number, adminId?: number) {
    const raw = String(usernameOrId).trim();
    const isNumericId = typeof usernameOrId === 'number' || /^\d+$/.test(raw);
    const user = isNumericId
      ? await prisma.user.findUnique({ where: { id: Number(raw) } })
      : await prisma.user.findFirst({
          where: { username: { equals: raw, mode: 'insensitive' } },
        });

    if (!user) throw new Error('Usuario no encontrado.');

    if (isSystemUsername(user.username)) {
      throw new Error(SYSTEM_PROTECTED_ERROR);
    }

    if (user.id === adminId) {
      throw new Error('No podés eliminar tu propio usuario administrador en sesión.');
    }

    await this.ensureNotLastActiveAdmin(user);

    const usage = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        employee: { select: { id: true } },
        _count: {
          select: {
            orders: true,
            transactions: true,
            stockMovements: true,
            auditLogs: true,
            personas: true,
            cashDrawers: true,
            creditNotes: true,
            saleRoutes: true,
            routeVisits: true,
            expenses: true,
            crmConversations: true,
            weeklySchedules: true,
            accountLedgerEntries: true,
            warehouseCellsUpdated: true,
          },
        },
      },
    });
    const totalLinked =
      (usage?.employee ? 1 : 0) +
      Object.values(usage?._count ?? {}).reduce((sum, n) => sum + Number(n || 0), 0);
    if (totalLinked > 0) {
      throw new Error(USER_HISTORY_DELETE_ERROR);
    }

    try {
      await prisma.user.delete({ where: { id: user.id } });
    } catch (err: any) {
      if (err?.code === 'P2003') {
        throw new Error(USER_HISTORY_DELETE_ERROR);
      }
      throw err;
    }
    sessionCache.invalidateStaffSession(user.id);

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'DELETE_USER',
        entityType: 'User',
        entityId: user.id,
        oldValues: { username: user.username, role: user.role },
      });
    }

    return { success: true, username: user.username };
  }
}

export const adminUsersSubService = new AdminUsersSubService();
