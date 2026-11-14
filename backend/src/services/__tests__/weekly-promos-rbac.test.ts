import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Role } from '@prisma/client';
import { env } from '../../config/env.config';
import { sessionCache } from '../../utils/session-cache.util';
import { STAFF_COOKIE_NAME } from '../../utils/cookie-auth.util';
import { clearIdempotencyStore } from '../../middlewares/idempotency.middleware';
import prisma from '../../utils/prisma';
import weeklyPromoRoutes from '../../routes/weeklyPromo.routes';
import { weeklyPromoService } from '../weekly-promo.service';

function makeStaffCookie(id: number, username: string, role: Role): string {
  const pwdVer = `ver_${id}_${role.toLowerCase()}`;
  sessionCache.setStaffSession(id, {
    id,
    role,
    isActive: true,
    pwdVer,
  });
  const token = jwt.sign(
    { id, username, role, pwdVer },
    env.JWT_SECRET,
    { expiresIn: '1h' },
  );
  return `${STAFF_COOKIE_NAME}=${token}`;
}

async function sendRequest(
  baseUrl: string,
  method: string,
  path: string,
  cookie: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

describe('RBAC Ofertas Semanales (/api/weekly-promos)', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/weekly-promos', weeklyPromoRoutes);

    await new Promise<void>((resolve) => {
      server = testApp.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    sessionCache.clear();
    clearIdempotencyStore();
    vi.restoreAllMocks();
  });

  const validOfferPayload = {
    type: 'OFFER_PRICE',
    startDate: '2026-11-14',
    endDate: '2026-11-21',
    items: [{ productId: 101, minQuantity: 1, freeQuantity: 0, promoUnitPrice: 2500 }],
  };

  it('permite GET, POST, PATCH y DELETE solo a admin y dario (ADMIN o FACTURACION)', async () => {
    vi.spyOn(weeklyPromoService, 'listAllPromos').mockResolvedValue([]);
    vi.spyOn(weeklyPromoService, 'createPromo').mockResolvedValue({ id: 1 } as never);
    vi.spyOn(weeklyPromoService, 'togglePromoActive').mockResolvedValue({ id: 1, isActive: false } as never);
    vi.spyOn(weeklyPromoService, 'deletePromo').mockResolvedValue({ deletedId: 1 } as never);

    const adminCookie = makeStaffCookie(1, 'admin', Role.ADMIN);
    const darioCookie = makeStaffCookie(2, 'Dario', Role.FACTURACION);

    expect((await sendRequest(baseUrl, 'GET', '/api/weekly-promos', adminCookie)).status).toBe(200);
    expect((await sendRequest(baseUrl, 'GET', '/api/weekly-promos', darioCookie)).status).toBe(200);

    expect((await sendRequest(baseUrl, 'POST', '/api/weekly-promos', adminCookie, validOfferPayload)).status).toBe(201);
    expect((await sendRequest(baseUrl, 'POST', '/api/weekly-promos', darioCookie, validOfferPayload)).status).toBe(201);

    expect((await sendRequest(baseUrl, 'PATCH', '/api/weekly-promos/1/toggle', adminCookie)).status).toBe(200);
    expect((await sendRequest(baseUrl, 'PATCH', '/api/weekly-promos/1/toggle', darioCookie)).status).toBe(200);

    expect((await sendRequest(baseUrl, 'DELETE', '/api/weekly-promos/1', adminCookie)).status).toBe(200);
    expect((await sendRequest(baseUrl, 'DELETE', '/api/weekly-promos/1', darioCookie)).status).toBe(200);
  });

  it('bloquea con 403 a otro usuario ADMIN (agustin), a VENDEDOR y a DEPOSITO en gestión', async () => {
    const createSpy = vi.spyOn(weeklyPromoService, 'createPromo').mockResolvedValue({ id: 99 } as never);

    const agustinCookie = makeStaffCookie(3, 'agustin', Role.ADMIN);
    const vendedorCookie = makeStaffCookie(4, 'diego', Role.VENDEDOR);
    const depositoCookie = makeStaffCookie(5, 'miguel', Role.DEPOSITO);

    for (const cookie of [agustinCookie, vendedorCookie, depositoCookie]) {
      expect((await sendRequest(baseUrl, 'GET', '/api/weekly-promos', cookie)).status).toBe(403);
      expect((await sendRequest(baseUrl, 'POST', '/api/weekly-promos', cookie, validOfferPayload)).status).toBe(403);
      expect((await sendRequest(baseUrl, 'PATCH', '/api/weekly-promos/1/toggle', cookie)).status).toBe(403);
      expect((await sendRequest(baseUrl, 'DELETE', '/api/weekly-promos/1', cookie)).status).toBe(403);
    }

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('permite GET /active a VENDEDOR, FACTURACION y ADMIN, pero bloquea 403 a DEPOSITO', async () => {
    vi.spyOn(weeklyPromoService, 'listActivePromos').mockResolvedValue([]);

    const vendedorCookie = makeStaffCookie(4, 'diego', Role.VENDEDOR);
    const factCookie = makeStaffCookie(2, 'otro_fact', Role.FACTURACION);
    const agustinCookie = makeStaffCookie(3, 'agustin', Role.ADMIN);
    const depositoCookie = makeStaffCookie(5, 'miguel', Role.DEPOSITO);

    expect((await sendRequest(baseUrl, 'GET', '/api/weekly-promos/active', vendedorCookie)).status).toBe(200);
    expect((await sendRequest(baseUrl, 'GET', '/api/weekly-promos/active', factCookie)).status).toBe(200);
    expect((await sendRequest(baseUrl, 'GET', '/api/weekly-promos/active', agustinCookie)).status).toBe(200);
    expect((await sendRequest(baseUrl, 'GET', '/api/weekly-promos/active', depositoCookie)).status).toBe(403);
  });

  it('resuelve username por base de datos si falta en el JWT', async () => {
    vi.spyOn(weeklyPromoService, 'listAllPromos').mockResolvedValue([]);
    const findUserSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
      username: 'dario',
      role: Role.ADMIN,
      isActive: true,
    } as never);

    const legacyCookie = makeStaffCookie(12, '', Role.ADMIN);
    const res = await sendRequest(baseUrl, 'GET', '/api/weekly-promos', legacyCookie);
    expect(res.status).toBe(200);
    expect(findUserSpy).toHaveBeenCalledTimes(1);
  });
});
