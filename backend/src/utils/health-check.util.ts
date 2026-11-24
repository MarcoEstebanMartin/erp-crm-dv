import { Request, Response } from 'express';
import prisma from './prisma';

export const DEFAULT_HEALTH_DB_TIMEOUT_MS = 3_000;

let serverShuttingDown = false;

export function isServerShuttingDown(): boolean {
  return serverShuttingDown;
}

export function setServerShuttingDown(value: boolean): void {
  serverShuttingDown = value;
}

export interface DatabaseHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export type DatabasePingFn = () => Promise<unknown>;

/**
 * Ejecuta un ping real a PostgreSQL (SELECT 1) con timeout acotado
 * para detectar cortes de base de datos sin bloquear el healthcheck.
 */
export async function checkDatabaseHealth(
  pingFn: DatabasePingFn = () => prisma.$queryRaw`SELECT 1`,
  timeoutMs: number = DEFAULT_HEALTH_DB_TIMEOUT_MS,
): Promise<DatabaseHealthResult> {
  const startedAt = Date.now();
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    await Promise.race([
      Promise.resolve().then(() => pingFn()),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Database healthcheck timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        timeoutHandle.unref?.();
      }),
    ]);

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err?.message || 'Database ping failed',
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export interface HealthCheckHandlerOptions {
  pingFn?: DatabasePingFn;
  timeoutMs?: number;
  isShuttingDownFn?: () => boolean;
}

/**
 * Handler Express para GET /api/health.
 * - 200 OK si la app está activa y PostgreSQL responde a SELECT 1.
 * - 503 Service Unavailable si el servidor está cerrando (draining) o la DB no responde.
 */
export function createHealthCheckHandler(options: HealthCheckHandlerOptions = {}) {
  const {
    pingFn,
    timeoutMs = DEFAULT_HEALTH_DB_TIMEOUT_MS,
    isShuttingDownFn = isServerShuttingDown,
  } = options;

  return async (_req: Request, res: Response): Promise<void> => {
    const timestamp = new Date().toISOString();
    const uptimeSeconds = Math.floor(process.uptime());

    if (isShuttingDownFn()) {
      res.status(503).json({
        status: 'draining',
        message: 'ERP-CRM Backend is shutting down gracefully',
        uptimeSeconds,
        timestamp,
      });
      return;
    }

    const db = await checkDatabaseHealth(pingFn, timeoutMs);

    if (!db.ok) {
      res.status(503).json({
        status: 'error',
        message: 'ERP-CRM Backend database connectivity degraded',
        database: {
          status: 'down',
          latencyMs: db.latencyMs,
        },
        uptimeSeconds,
        timestamp,
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      message: 'ERP-CRM Backend is running smoothly',
      database: {
        status: 'up',
        latencyMs: db.latencyMs,
      },
      uptimeSeconds,
      timestamp,
    });
  };
}
