import {
  evictRequestIdempotencyKey,
  resolveRequestIdempotencyKey,
} from '../idempotencyClient';
import {
  purgeLegacyCompanyLocalStorage,
} from '../companyProfile';
import { setRuntimeGoogleMapsApiKey } from '../googleMapsLoader';

/**
 * Sincroniza la configuración del servidor en localStorage y runtime (incluyendo Google Maps API Key).
 */
export function syncServerConfig(cfg: any): void {
  if (!cfg) return;
  purgeLegacyCompanyLocalStorage();
  localStorage.setItem('auth_config', JSON.stringify(cfg));
  setRuntimeGoogleMapsApiKey(cfg?.googleMapsApiKey);
}

// Usa ruta relativa para unificar origen en producción (Railway) y proxy local en desarrollo (Vite/LAN)
export const API_BASE_URL = '/api';

export interface AuditLogQueryFilters {
  search?: string;
  userId?: number | '';
  module?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

// La sesión viaja protegida por Cookie HttpOnly (inmune a robo XSS en localStorage)
export function getHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

export async function request(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const serializedBody = typeof options.body === 'string' ? options.body : undefined;
  const skipIdempotency = path.startsWith('/auth/');

  const incomingHeaders = (options.headers as Record<string, string> | undefined) || {};
  const explicitIdemKey = incomingHeaders['Idempotency-Key'];

  const isMutatingMethod =
    method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  const extraHeaders: Record<string, string> = {};
  if (isMutatingMethod && !skipIdempotency && !explicitIdemKey) {
    extraHeaders['Idempotency-Key'] = resolveRequestIdempotencyKey(
      method,
      path,
      serializedBody,
    );
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      ...getHeaders(),
      ...extraHeaders,
      ...incomingHeaders
    }
  });

  if (
    !response.ok &&
    response.status >= 400 &&
    response.status !== 409 &&
    isMutatingMethod &&
    !explicitIdemKey
  ) {
    evictRequestIdempotencyKey(method, path, serializedBody);
  }

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Sesión expirada. Por favor iniciá sesión nuevamente.');
  }

  const text = await response.text();
  let json: any = {};
  if (text && text.trim()) {
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = {};
    }
  }
  if (json.status === 'error') {
    if (json.message && (json.message.includes('Token') || json.message.includes('expirado'))) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    const details = Array.isArray(json.errors)
      ? ': ' + json.errors.map((e: any) => `${e.field.replace('body.', '')} (${e.message})`).join(', ')
      : '';
    throw new Error(`${json.message}${details}`);
  }
  if (!response.ok) {
    throw new Error(json?.message || json?.error || `Error HTTP ${response.status}`);
  }
  return json.data !== undefined ? json.data : json;
}

// Comprobar la conexión con el servidor
export async function testServerConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}
