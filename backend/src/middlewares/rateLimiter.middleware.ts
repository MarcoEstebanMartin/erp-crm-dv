import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * Cleanup de registros expirados cada 5 minutos para evitar fugas de memoria
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max, message = 'Demasiadas peticiones desde esta dirección IP. Por favor intentá más tarde.' } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown_ip';
    const key = `${req.path}_${clientIp}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);

    if (!record || now > record.resetTime) {
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      next();
      return;
    }

    if (record.count >= max) {
      res.status(429).json({
        status: 'error',
        message,
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
      return;
    }

    record.count += 1;
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
