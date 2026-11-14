import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Role } from '@prisma/client';
import { env } from '../../config/env.config';
import { sessionCache } from '../../utils/session-cache.util';
import { STAFF_COOKIE_NAME } from '../../utils/cookie-auth.util';
import adminRoutes from '../../routes/admin.routes';
import collectionRoutes from '../../routes/collection.routes';
import orderRoutes from '../../routes/order.routes';
import personaRoutes from '../../routes/persona.routes';
import productRoutes from '../../routes/product.routes';
import * as adminController from '../../controllers/admin.controller';
import * as collectionController from '../../controllers/collection.controller';

function makeStaffCookie(id: number, role: Role): string {
  const pwdVer = `ver_${role.toLowerCase()}`;
  sessionCache.setStaffSession(id, {
    id,
    role,
    isActive: true,
    pwdVer,
  });
  const token = jwt.sign(
    { id, username: `test_${role.toLowerCase()}`, role, pwdVer },
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
): Promise<number> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Cookie: cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.status;
}

describe('Alineación RBAC del Rol FACTURACION y Cierre de Brechas de Rutas — Paso 2', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeAll(async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use('/api/admin', adminRoutes);
    testApp.use('/api/collections', collectionRoutes);
    testApp.use('/api/orders', orderRoutes);
    testApp.use('/api/personas', personaRoutes);
    testApp.use('/api/products', productRoutes);

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
    vi.restoreAllMocks();
  });

  it('Brecha 1: GET /api/admin/audit-logs/document/:entityType/:entityId permite solo ADMIN y FACTURACION (403 a VENDEDOR/DEPOSITO)', async () => {
    vi.spyOn(adminController, 'getDocumentAuditLogs').mockImplementation(async (_req, res) => {
      res.status(200).json({ ok: true, logs: [] });
    });

    const adminCookie = makeStaffCookie(1, Role.ADMIN);
    const factCookie = makeStaffCookie(2, Role.FACTURACION);
    const vendCookie = makeStaffCookie(3, Role.VENDEDOR);
    const depCookie = makeStaffCookie(4, Role.DEPOSITO);

    expect(await sendRequest(baseUrl, 'GET', '/api/admin/audit-logs/document/Order/1', adminCookie)).not.toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/admin/audit-logs/document/Order/1', factCookie)).not.toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/admin/audit-logs/document/Order/1', vendCookie)).toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/admin/audit-logs/document/Order/1', depCookie)).toBe(403);
  });

  it('Brecha 2: GET /api/collections/pending y POST /api/collections/register exigen rol explícito (403 a DEPOSITO)', async () => {
    vi.spyOn(collectionController, 'getPendingCollections').mockImplementation(async (_req, res) => {
      return res.status(200).json([]);
    });

    const factCookie = makeStaffCookie(2, Role.FACTURACION);
    const vendCookie = makeStaffCookie(3, Role.VENDEDOR);
    const depCookie = makeStaffCookie(4, Role.DEPOSITO);

    expect(await sendRequest(baseUrl, 'GET', '/api/collections/pending', factCookie)).not.toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/collections/pending', vendCookie)).not.toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/collections/pending', depCookie)).toBe(403);

    // POST /register con payload inválido: DEPOSITO cae antes en requireRole (403); FACTURACION/VENDEDOR pasan a Zod (400)
    expect(await sendRequest(baseUrl, 'POST', '/api/collections/register', depCookie, {})).toBe(403);
    expect(await sendRequest(baseUrl, 'POST', '/api/collections/register', factCookie, {})).toBe(400);
    expect(await sendRequest(baseUrl, 'POST', '/api/collections/register', vendCookie, {})).toBe(400);
  });

  it('FACTURACION puede crear/editar pedidos, cambiar estado, gestionar clientes/pagos y actualizar productos/precios sin 403', async () => {
    const factCookie = makeStaffCookie(2, Role.FACTURACION);
    const depCookie = makeStaffCookie(4, Role.DEPOSITO);

    // Pedidos
    expect(await sendRequest(baseUrl, 'POST', '/api/orders', factCookie, {})).toBe(400);
    expect(await sendRequest(baseUrl, 'PUT', '/api/orders/1', factCookie, {})).toBe(400);
    expect(await sendRequest(baseUrl, 'PUT', '/api/orders/1/status', factCookie, {})).toBe(400);

    // Clientes y cobranzas (DEPOSITO sigue bloqueado con 403)
    expect(await sendRequest(baseUrl, 'POST', '/api/personas', factCookie, {})).toBe(400);
    expect(await sendRequest(baseUrl, 'PUT', '/api/personas/1', factCookie, { name: 123 })).toBe(400);
    expect(await sendRequest(baseUrl, 'POST', '/api/personas/1/payments', factCookie, { amount: -10 })).toBe(400);
    expect(await sendRequest(baseUrl, 'POST', '/api/personas/1/payments', depCookie, {})).toBe(403);

    // Productos y listas de precios (DEPOSITO sigue bloqueado con 403)
    expect(await sendRequest(baseUrl, 'POST', '/api/products', factCookie, {})).toBe(400);
    expect(await sendRequest(baseUrl, 'PUT', '/api/products/1', factCookie, { name: 123 })).toBe(400);
    expect(await sendRequest(baseUrl, 'POST', '/api/products/import-prices', factCookie, {})).toBe(400);
    expect(await sendRequest(baseUrl, 'POST', '/api/products/bulk-update-prices', factCookie, {})).toBe(400);
    expect(await sendRequest(baseUrl, 'POST', '/api/products/import-prices', depCookie, {})).toBe(403);
  });

  it('Rutas exclusivas de ADMIN siguen bloqueadas (403) para FACTURACION', async () => {
    const factCookie = makeStaffCookie(2, Role.FACTURACION);

    expect(await sendRequest(baseUrl, 'GET', '/api/admin/users', factCookie)).toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/admin/config', factCookie)).toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/admin/audit-logs', factCookie)).toBe(403);
    expect(await sendRequest(baseUrl, 'GET', '/api/admin/reports', factCookie)).toBe(403);
    expect(await sendRequest(baseUrl, 'POST', '/api/products/stock/reconcile', factCookie, {})).toBe(403);
    expect(await sendRequest(baseUrl, 'DELETE', '/api/personas/1', factCookie)).toBe(403);
  });
});
