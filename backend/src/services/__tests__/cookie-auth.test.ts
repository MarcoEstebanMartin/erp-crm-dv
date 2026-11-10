import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { authenticateJWT } from '../../middlewares/auth';
import { authenticateStoreClientJWT } from '../../middlewares/storeAuth.middleware';
import { logout } from '../../controllers/auth.controller';
import { logoutStoreClient } from '../../controllers/store.controller';
import { sessionCache } from '../../utils/session-cache.util';
import {
  parseCookies,
  setStaffSessionCookie,
  setStoreSessionCookie,
  STAFF_COOKIE_NAME,
  STORE_COOKIE_NAME,
} from '../../utils/cookie-auth.util';

describe('Paso S2 — Sesiones Ultraseguras con Cookies HttpOnly y Anti-CSRF', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionCache.clear();
  });

  it('Parsea cookies RFC-6265 correctamente y emite flags HttpOnly, SameSite=lax y Secure dinámico', () => {
    const parsed = parseCookies('foo=bar; dv_staff_session=jwt.abc.123; theme=dark%20mode');
    expect(parsed).toEqual({
      foo: 'bar',
      dv_staff_session: 'jwt.abc.123',
      theme: 'dark mode',
    });

    const cookieSpyHttp = vi.fn();
    setStaffSessionCookie(
      { secure: false, headers: {} } as any,
      { cookie: cookieSpyHttp } as any,
      'token_wifi_local',
    );
    expect(cookieSpyHttp).toHaveBeenCalledWith(
      STAFF_COOKIE_NAME,
      'token_wifi_local',
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/api',
      }),
    );

    const cookieSpyHttps = vi.fn();
    setStoreSessionCookie(
      { secure: false, headers: { 'x-forwarded-proto': 'https' } } as any,
      { cookie: cookieSpyHttps } as any,
      'token_https_prod',
    );
    expect(cookieSpyHttps).toHaveBeenCalledWith(
      STORE_COOKIE_NAME,
      'token_https_prod',
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api',
      }),
    );
  });

  it('Autentica personal interno desde Cookie HttpOnly (ignorando Bearer null) y bloquea CSRF cross-site en POST', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 12,
      isActive: true,
      role: Role.FACTURACION,
    } as any);

    const token = jwt.sign(
      { id: 12, username: 'caja1', role: Role.FACTURACION },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    // Petición legítima same-origin con Cookie HttpOnly
    const okReq: any = {
      method: 'POST',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${token}`,
        authorization: 'Bearer null',
        'sec-fetch-site': 'same-origin',
      },
    };
    const okRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const okNext = vi.fn();

    await authenticateJWT(okReq, okRes, okNext);
    expect(okNext).toHaveBeenCalledOnce();
    expect(okReq.user.role).toBe(Role.FACTURACION);

    // Ataque CSRF desde un sitio externo malicioso (Sec-Fetch-Site: cross-site)
    const csrfReq: any = {
      method: 'POST',
      headers: {
        cookie: `${STAFF_COOKIE_NAME}=${token}`,
        origin: 'https://sitio-malicioso.evil',
        'sec-fetch-site': 'cross-site',
      },
    };
    const csrfRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const csrfNext = vi.fn();

    await authenticateJWT(csrfReq, csrfRes, csrfNext);
    expect(csrfNext).not.toHaveBeenCalled();
    expect(csrfRes.status).toHaveBeenCalledWith(403);
    expect(csrfRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CSRF_BLOCKED' }),
    );
  });

  it('Autentica clientes B2B por Cookie HttpOnly en Tienda y limpia cookie + caché en logout', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 42,
      isActive: true,
      isClient: true,
      priceList: 'A',
    } as any);

    const storeToken = jwt.sign(
      { personaId: 42, role: 'CLIENTE' },
      env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const storeReq: any = {
      method: 'GET',
      headers: { cookie: `${STORE_COOKIE_NAME}=${storeToken}` },
      params: { personaId: '42' },
      body: {},
    };
    const storeRes: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const storeNext = vi.fn();

    await authenticateStoreClientJWT(storeReq, storeRes, storeNext);
    expect(storeNext).toHaveBeenCalledOnce();
    expect(storeReq.storeClient).toEqual({ personaId: 42, priceList: 'A' });
    expect(sessionCache.getStoreClientSession(42)).not.toBeNull();

    // Logout de tienda borra cookie y desaloja caché en memoria instantáneamente
    const clearCookieSpy = vi.fn();
    await logoutStoreClient(
      { headers: { cookie: `${STORE_COOKIE_NAME}=${storeToken}` }, secure: false } as any,
      { clearCookie: clearCookieSpy, status: vi.fn().mockReturnThis(), json: vi.fn() } as any,
    );
    expect(clearCookieSpy).toHaveBeenCalledWith(
      STORE_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, path: '/api' }),
    );
    expect(sessionCache.getStoreClientSession(42)).toBeNull();

    // Logout de staff también borra cookie y desaloja caché
    sessionCache.setStaffSession(12, { id: 12, role: Role.ADMIN, isActive: true });
    const staffToken = jwt.sign({ id: 12, username: 'admin', role: Role.ADMIN }, env.JWT_SECRET);
    const clearStaffSpy = vi.fn();
    await logout(
      { headers: { cookie: `${STAFF_COOKIE_NAME}=${staffToken}` }, secure: false } as any,
      { clearCookie: clearStaffSpy, status: vi.fn().mockReturnThis(), json: vi.fn() } as any,
    );
    expect(clearStaffSpy).toHaveBeenCalledWith(
      STAFF_COOKIE_NAME,
      expect.objectContaining({ httpOnly: true, path: '/api' }),
    );
    expect(sessionCache.getStaffSession(12)).toBeNull();
  });
});
