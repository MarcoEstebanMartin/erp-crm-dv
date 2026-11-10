import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import { env, parseTrustProxy, validateEnvConfig } from '../../config/env.config';
import { authenticateJWT } from '../../middlewares/auth';
import {
  clearRateLimiterStore,
  createRateLimiter,
  resolveClientIp,
} from '../../middlewares/rateLimiter.middleware';
import { securityHeadersMiddleware } from '../../middlewares/securityHeaders.middleware';
import { sessionCache } from '../../utils/session-cache.util';
import { adminUsersSubService } from '../admin/admin-users.service';

describe('Paso 1 — Blindaje de Perímetro HTTP, Anti-Spoofing y Caché de Sesión', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionCache.clear();
    clearRateLimiterStore();
  });

  it('Rechaza arrancar en producción si CORS_ORIGIN está vacío o en comodín "*"', () => {
    expect(() =>
      validateEnvConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'super_secret_key_for_test_123456',
      }),
    ).toThrow(/FATAL SEGURIDAD PRODUCCIÓN/);

    expect(() =>
      validateEnvConfig({
        NODE_ENV: 'production',
        JWT_SECRET: 'super_secret_key_for_test_123456',
        CORS_ORIGIN: '*',
      }),
    ).toThrow(/FATAL SEGURIDAD PRODUCCIÓN/);

    const validProd = validateEnvConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'super_secret_key_for_test_123456',
      CORS_ORIGIN: 'https://sistema.donvenancio.com.ar, https://tienda.donvenancio.com.ar',
      TRUST_PROXY: '1',
    });

    expect(validProd.CORS_ORIGIN).toEqual([
      'https://sistema.donvenancio.com.ar',
      'https://tienda.donvenancio.com.ar',
    ]);
    expect(validProd.TRUST_PROXY).toBe(1);
    expect(parseTrustProxy(undefined)).toBe('loopback');
  });

  it('Bloquea evasión de Rate Limiter aunque un atacante falsifique cabeceras X-Forwarded-For rotativas', () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 3,
      message: 'Bloqueado por fuerza bruta',
    });

    const runAttempt = (spoofedForwardedFor: string) => {
      const req: any = {
        baseUrl: '/api/auth',
        path: '/login',
        ip: '181.45.22.99', // IP real resuelta por Express trust proxy
        headers: { 'x-forwarded-for': spoofedForwardedFor },
        socket: { remoteAddress: '181.45.22.99' },
      };
      const headersSent: Record<string, string> = {};
      const res: any = {
        setHeader: (k: string, v: string) => {
          headersSent[k] = v;
        },
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();
      limiter(req, res, next);
      return { req, res, next, headersSent };
    };

    expect(resolveClientIp({ ip: '181.45.22.99', headers: { 'x-forwarded-for': '9.9.9.9' } } as any)).toBe(
      '181.45.22.99',
    );

    const a1 = runAttempt('10.0.0.1');
    const a2 = runAttempt('10.0.0.2');
    const a3 = runAttempt('10.0.0.3');
    const a4 = runAttempt('10.0.0.4'); // 4to intento desde la misma IP real con distinto X-Forwarded-For falso

    expect(a1.next).toHaveBeenCalledOnce();
    expect(a2.next).toHaveBeenCalledOnce();
    expect(a3.next).toHaveBeenCalledOnce();
    expect(a4.next).not.toHaveBeenCalled();
    expect(a4.res.status).toHaveBeenCalledWith(429);
    expect(a4.headersSent['Retry-After']).toBeDefined();
  });

  it('Sirve sesiones activas desde memoria (1 sola query a DB en ráfaga) y revoca en 0ms al desactivar usuario', async () => {
    const findUniqueSpy = vi
      .spyOn(prisma.user, 'findUnique')
      .mockResolvedValue({ id: 77, isActive: true, role: Role.VENDEDOR } as any);

    const token = jwt.sign(
      { id: 77, username: 'vendedor_ruta', role: Role.VENDEDOR },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const makeAuthCall = async () => {
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();
      await authenticateJWT(req, res, next);
      return { req, res, next };
    };

    // 5 peticiones simultáneas/consecutivas de una pantalla solo golpean PostgreSQL 1 vez
    for (let i = 0; i < 5; i++) {
      const call = await makeAuthCall();
      expect(call.next).toHaveBeenCalledOnce();
      expect(call.req.user.role).toBe(Role.VENDEDOR);
    }
    expect(findUniqueSpy).toHaveBeenCalledTimes(1);

    // Un administrador desactiva al usuario #77 -> invalida el caché en el acto
    vi.spyOn(prisma.user, 'update').mockResolvedValue({
      id: 77,
      username: 'vendedor_ruta',
      isActive: false,
    } as any);
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 999 } as any);
    await adminUsersSubService.toggleUserStatus(77, 1);

    // En el milisegundo siguiente, la petición del usuario desactivado consulta DB y recibe 401 inmediato
    findUniqueSpy.mockResolvedValueOnce({ id: 77, isActive: false, role: Role.VENDEDOR } as any);
    const blockedCall = await makeAuthCall();

    expect(blockedCall.next).not.toHaveBeenCalled();
    expect(blockedCall.res.status).toHaveBeenCalledWith(401);
    expect(blockedCall.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'USER_INACTIVE' }),
    );
  });

  it('Aplica Content-Security-Policy estricta en /api/* y cabeceras anti-clickjacking', () => {
    const headers: Record<string, string> = {};
    const req: any = { path: '/api/orders' };
    const res: any = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    };
    const next = vi.fn();

    securityHeadersMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Content-Security-Policy']).toContain("default-src 'none'");
    expect(headers['Permissions-Policy']).toContain('geolocation=(self)');
  });
});
