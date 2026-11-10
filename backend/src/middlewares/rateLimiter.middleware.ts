import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const MAX_RATE_LIMIT_KEYS = 10_000;
const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Cleanup de registros expirados cada 5 minutos para evitar fugas de memoria.
 * Se aplica .unref() para no bloquear el cierre limpio del proceso o los tests.
 */
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Resuelve la IP real del cliente delegando exclusivamente en req.ip (validado por Express trust proxy)
 * o la dirección real del socket TCP. Ignora cabeceras X-Forwarded-For crudas no verificadas
 * para impedir evasión de límite de intentos (IP Spoofing).
 */
export function resolveClientIp(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown_ip';
  return ip.trim() || 'unknown_ip';
}

function ensureCapacity(now: number): void {
  if (rateLimitMap.size < MAX_RATE_LIMIT_KEYS) return;

  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }

  if (rateLimitMap.size >= MAX_RATE_LIMIT_KEYS) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (oldestKey !== undefined) {
      rateLimitMap.delete(oldestKey);
    }
  }
}

export function clearRateLimiterStore(): void {
  rateLimitMap.clear();
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    max,
    message = 'Demasiadas peticiones desde esta dirección IP. Por favor intentá más tarde.',
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = resolveClientIp(req);
    const key = `${req.baseUrl || ''}${req.path}_${clientIp}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      ensureCapacity(now);
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, max - 1)));
      next();
      return;
    }

    if (record.count >= max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        status: 'error',
        message,
        retryAfterSeconds,
      });
      return;
    }

    record.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - record.count)));
    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15, // máximo 15 intentos por 15 min
  message: 'Demasiados intentos de inicio de sesión. Por favor esperá 15 minutos antes de reintentar.',
});

export const publicApiRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 30, // máximo 30 peticiones por minuto
  message: 'Límite de peticiones excedido para la API pública.',
});
