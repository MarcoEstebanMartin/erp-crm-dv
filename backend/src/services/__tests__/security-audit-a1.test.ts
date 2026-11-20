import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import type { Response, NextFunction } from 'express';
import { env } from '../../config/env.config';
import prisma from '../../utils/prisma';
import { computePasswordVersion, sessionCache } from '../../utils/session-cache.util';
import { authenticateJWT, verifyStaffJwtToken } from '../../middlewares/auth';
import { authenticateStoreClientJWT } from '../../middlewares/storeAuth.middleware';
import { approveOrderDraft } from '../../controllers/crm_whatsapp.controller';
import { OrderService } from '../order.service';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, any>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    clearCookie() {
      return this;
    },
    setHeader(k: string, v: any) {
      this.headers[k] = v;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: any };
}

describe('Paso A1 — Blindaje de Seguridad Crítica (JWT, pwdVer, Embedded Store y CRM Drafts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionCache.clear();
  });

  it('authenticateJWT rechaza JWT de cliente de tienda (CLIENTE sin id) con 401', async () => {
    const storeClientToken = jwt.sign(
      { personaId: 42, role: 'CLIENTE', priceList: 'A' },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const req: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${storeClientToken}` },
    };
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body?.code).toBe('TOKEN_INVALID');
  });

  it('authenticateJWT rechaza enlace mágico (magic_login) con 401', async () => {
    const magicToken = jwt.sign(
      { personaId: 42, type: 'magic_login' },
      env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const req: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${magicToken}` },
    };
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body?.code).toBe('TOKEN_INVALID');
  });

  it('authenticateStoreClientJWT rechaza JWT de ADMIN revocado por cambio de contraseña y no envenena sessionCache', async () => {
    const oldHash = '$2a$10$oldhashvalue123456789012345678901234567890123456789012';
    const newHash = '$2a$10$newhashvalue987654321098765432109876543210987654321098';
    const revokedToken = jwt.sign(
      {
        id: 77,
        username: 'Gemini',
        role: Role.ADMIN,
        pwdVer: computePasswordVersion(oldHash),
        scope: 'staff',
      },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 77,
      isActive: true,
      role: Role.ADMIN,
      passwordHash: newHash,
      username: 'Gemini',
    } as any);

    const req: any = {
      method: 'GET',
      headers: { authorization: `Bearer ${revokedToken}` },
      params: {},
      body: {},
    };
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    await authenticateStoreClientJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body?.code).toBe('SESSION_REVOKED');
    expect(sessionCache.getStaffSession(77)).toBeNull();
  });

  it('verifyStaffJwtToken rechaza headers falsos ("x") y tokens CLIENTE, aceptando solo JWT staff firmado', () => {
    expect(verifyStaffJwtToken('x')).toBeNull();

    const clientToken = jwt.sign({ personaId: 10, role: 'CLIENTE' }, env.JWT_SECRET);
    expect(verifyStaffJwtToken(clientToken)).toBeNull();

    const staffToken = jwt.sign(
      { id: 1, username: 'Gemini', role: Role.ADMIN, scope: 'staff' },
      env.JWT_SECRET,
    );
    const verified = verifyStaffJwtToken(staffToken);
    expect(verified?.id).toBe(1);
    expect(verified?.role).toBe(Role.ADMIN);
  });

  it('approveOrderDraft ignora unitPrice/subtotal manipulados, delega a OrderService y bloquea doble aprobación concurrente', async () => {
    vi.spyOn(prisma.crmOrderDraft, 'findUnique').mockResolvedValue({
      id: 50,
      status: 'PENDING',
      personaId: 12,
      itemsJson: '[]',
      totalEstimated: 1000,
      conversation: { id: 5, personaId: 12 },
    } as any);

    const claimSpy = vi
      .spyOn(prisma.crmOrderDraft, 'updateMany')
      .mockResolvedValueOnce({ count: 1 } as any)
      .mockResolvedValueOnce({ count: 0 } as any);

    const createOrderSpy = vi.spyOn(OrderService, 'createOrder').mockResolvedValue({
      id: 999,
      totalAmount: 15000,
    } as any);

    vi.spyOn(prisma.crmOrderDraft, 'update').mockResolvedValue({ id: 50, status: 'APPROVED' } as any);

    const req: any = {
      params: { draftId: '50' },
      user: { id: 3, username: 'Gemini Ventas', role: Role.VENDEDOR },
      body: {
        items: [{ productId: 101, quantity: 2, unitPrice: 1, subtotal: 2 }],
      },
    };
    const res1 = createMockRes();
    await approveOrderDraft(req, res1);

    expect(res1.statusCode).toBe(200);
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    const dtoPassed = createOrderSpy.mock.calls[0][0];
    expect(dtoPassed.items).toEqual([{ productId: 101, quantity: 2, weight: undefined }]);
    expect((dtoPassed.items[0] as any).unitPrice).toBeUndefined();

    // Segunda ejecución concurrente: updateMany devuelve count: 0 -> 409
    const res2 = createMockRes();
    await approveOrderDraft(req, res2);
    expect(claimSpy).toHaveBeenCalledTimes(2);
    expect(res2.statusCode).toBe(409);
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
  });
});
