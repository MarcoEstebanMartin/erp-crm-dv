import { Request, Response } from 'express';
import { env } from '../config/env.config';

export const STAFF_COOKIE_NAME = 'dv_staff_session';
export const STORE_COOKIE_NAME = 'dv_store_session';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type TokenSource = 'cookie' | 'bearer';

export interface ExtractedToken {
  token: string;
  source: TokenSource;
}

/**
 * Parsea la cabecera Cookie estándar RFC-6265 sin dependencias externas.
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || !cookieHeader.trim()) return result;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx <= 0) continue;
    const rawKey = pair.slice(0, eqIdx).trim();
    const rawVal = pair.slice(eqIdx + 1).trim();
    if (!rawKey) continue;
    try {
      result[rawKey] = decodeURIComponent(rawVal);
    } catch {
      result[rawKey] = rawVal;
    }
  }
  return result;
}

/**
 * Detecta si la conexión es HTTPS (directa o detrás de Nginx/Cloudflare/Ngrok) o modo producción.
 * Permite operar por HTTP en red WiFi local de desarrollo sin rechazar la cookie en celulares.
 */
export function isSecureRequest(req: Request): boolean {
  if (env.NODE_ENV === 'production') return true;
  if (req.secure) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

export function setStaffSessionCookie(req: Request, res: Response, token: string): void {
  if (typeof res.cookie !== 'function') return;
  res.cookie(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/api',
    maxAge: THIRTY_DAYS_MS,
  });
}

export function clearStaffSessionCookie(req: Request, res: Response): void {
  if (typeof res.clearCookie !== 'function') return;
  res.clearCookie(STAFF_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/api',
  });
}

export function setStoreSessionCookie(req: Request, res: Response, token: string): void {
  if (typeof res.cookie !== 'function') return;
  res.cookie(STORE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/api',
    maxAge: THIRTY_DAYS_MS,
  });
}

export function clearStoreSessionCookie(req: Request, res: Response): void {
  if (typeof res.clearCookie !== 'function') return;
  res.clearCookie(STORE_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/api',
  });
}

function extractValidBearer(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const candidate = authHeader.slice(7).trim();
  if (!candidate || candidate === 'null' || candidate === 'undefined') return null;
  return candidate;
}

export function extractStaffToken(req: Request): ExtractedToken | null {
  const cookies = parseCookies(req.headers?.cookie);
  if (cookies[STAFF_COOKIE_NAME]) {
    return { token: cookies[STAFF_COOKIE_NAME], source: 'cookie' };
  }
  const bearer = extractValidBearer(req.headers?.authorization);
  if (bearer) {
    return { token: bearer, source: 'bearer' };
  }
  return null;
}

export function extractStoreToken(req: Request): ExtractedToken | null {
  const cookies = parseCookies(req.headers?.cookie);
  if (cookies[STORE_COOKIE_NAME]) {
    return { token: cookies[STORE_COOKIE_NAME], source: 'cookie' };
  }
  const bearer = extractValidBearer(req.headers?.authorization);
  if (bearer) {
    return { token: bearer, source: 'bearer' };
  }
  // Soporte administrativo: personal interno logueado con cookie de staff auditando tienda
  if (cookies[STAFF_COOKIE_NAME]) {
    return { token: cookies[STAFF_COOKIE_NAME], source: 'cookie' };
  }
  return null;
}

/**
 * Defensa en profundidad contra CSRF cuando la sesión viaja por Cookie HttpOnly.
 * Bloquea mutaciones cross-site salvo que el Origin esté explícitamente autorizado en CORS_ORIGIN.
 */
export function isCrossSiteCookieMutationBlocked(
  req: Request,
  source: TokenSource,
): boolean {
  if (source !== 'cookie') return false;
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false;

  const secFetchSite = String(req.headers?.['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite !== 'cross-site') return false;

  const requestOrigin = String(req.headers?.origin || '').trim();
  if (!requestOrigin) return true;

  if (Array.isArray(env.CORS_ORIGIN)) {
    return !env.CORS_ORIGIN.includes(requestOrigin);
  }
  if (typeof env.CORS_ORIGIN === 'string' && env.CORS_ORIGIN !== '*') {
    return env.CORS_ORIGIN !== requestOrigin;
  }
  return true;
}
