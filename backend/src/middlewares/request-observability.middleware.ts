import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { structuredLog } from '../utils/structured-logger.util';

export const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1_000;
const SAFE_REQUEST_ID_REGEX = /^[A-Za-z0-9\-_.:]{6,64}$/;

export interface RequestObservabilityOptions {
  slowThresholdMs?: number;
  logSink?: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void };
  nowNs?: () => bigint;
}

export function resolveRequestId(incomingHeader: unknown): string {
  if (typeof incomingHeader === 'string') {
    const trimmed = incomingHeader.trim();
    if (SAFE_REQUEST_ID_REGEX.test(trimmed)) {
      return trimmed;
    }
  }
  return crypto.randomUUID().slice(0, 12);
}

/**
 * Middleware de observabilidad HTTP de bajo costo:
 * - Asigna X-Request-Id único por petición (correlación de logs y soporte técnico).
 * - Inyecta X-Response-Time real medido con alta resolución.
 * - Emite alerta JSON estructurada únicamente si la petición es lenta (>= 1000 ms) o falla con 5xx.
 */
export function createRequestObservabilityMiddleware(options: RequestObservabilityOptions = {}) {
  const envThreshold = Number(process.env.SLOW_REQUEST_THRESHOLD_MS);
  const slowThresholdMs =
    options.slowThresholdMs ??
    (Number.isFinite(envThreshold) && envThreshold >= 50
      ? Math.floor(envThreshold)
      : DEFAULT_SLOW_REQUEST_THRESHOLD_MS);
  const nowNs = options.nowNs ?? (() => process.hrtime.bigint());

  return (req: Request, res: Response, next: NextFunction): void => {
    const startNs = nowNs();
    const requestId = resolveRequestId(req.headers?.['x-request-id']);
    (req as any).requestId = requestId;

    if (typeof res.setHeader === 'function') {
      res.setHeader('X-Request-Id', requestId);
    }

    const computeDurationMs = () => Number(nowNs() - startNs) / 1_000_000;

    if (typeof res.writeHead === 'function') {
      const originalWriteHead = res.writeHead;
      res.writeHead = function (...args: any[]) {
        if (!res.headersSent) {
          const durationMs = Math.max(0, Math.round(computeDurationMs()));
          res.setHeader('X-Response-Time', `${durationMs}ms`);
        }
        return originalWriteHead.apply(this, args as any);
      };
    }

    if (typeof res.on === 'function') {
      res.on('finish', () => {
        const durationMs = Math.max(0, Math.round(computeDurationMs()));
        const statusCode = res.statusCode || 200;
        const actorReq = req as any;
        const userId = actorReq.user?.id ?? undefined;
        const userRole = actorReq.user?.role ?? undefined;
        const cleanPath = (req.originalUrl || req.url || req.path || '').split('?')[0];

        if (statusCode >= 500) {
          structuredLog(
            'error',
            'http.server_error',
            { requestId, method: req.method, path: cleanPath, statusCode, durationMs, userId, userRole },
            options.logSink,
          );
        } else if (durationMs >= slowThresholdMs) {
          structuredLog(
            'warn',
            'http.slow_request',
            {
              requestId,
              method: req.method,
              path: cleanPath,
              statusCode,
              durationMs,
              thresholdMs: slowThresholdMs,
              userId,
              userRole,
            },
            options.logSink,
          );
        }
      });
    }

    next();
  };
}
