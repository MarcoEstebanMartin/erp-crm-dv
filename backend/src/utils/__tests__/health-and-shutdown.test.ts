import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDatabaseHealth,
  createHealthCheckHandler,
  setServerShuttingDown,
} from '../health-check.util';
import { createGracefulShutdown } from '../graceful-shutdown.util';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('Health Check Real (/api/health)', () => {
  beforeEach(() => {
    setServerShuttingDown(false);
  });

  it('devuelve 200 OK y database.status="up" cuando SELECT 1 responde bien', async () => {
    const handler = createHealthCheckHandler({
      pingFn: async () => [{ '?column?': 1 }],
    });
    const res = createMockResponse();

    await handler({} as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.database.status).toBe('up');
    expect(typeof res.body.database.latencyMs).toBe('number');
    expect(res.body.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('devuelve 503 y database.status="down" cuando PostgreSQL falla', async () => {
    const handler = createHealthCheckHandler({
      pingFn: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    const res = createMockResponse();

    await handler({} as any, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('error');
    expect(res.body.database.status).toBe('down');
  });

  it('devuelve ok=false si el ping excede el timeout configurado', async () => {
    const result = await checkDatabaseHealth(
      () => new Promise(() => undefined),
      25,
    );

    expect(result.ok).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('devuelve 503 con status="draining" cuando el servidor está en Graceful Shutdown', async () => {
    const pingFn = vi.fn(async () => 1);
    const handler = createHealthCheckHandler({
      pingFn,
      isShuttingDownFn: () => true,
    });
    const res = createMockResponse();

    await handler({} as any, res);

    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('draining');
    expect(pingFn).not.toHaveBeenCalled();
  });
});

describe('Graceful Shutdown', () => {
  it('detiene tareas en segundo plano, cierra HTTP, desconecta DB y sale con código 0', async () => {
    const order: string[] = [];
    const server = {
      close: vi.fn((cb?: (err?: Error) => void) => {
        order.push('http-close');
        cb?.();
      }),
    };
    const disconnectDb = vi.fn(async () => {
      order.push('db-disconnect');
    });
    const onShuttingDown = vi.fn(() => {
      order.push('mark-draining');
    });
    const stopBackgroundJobs = vi.fn(() => {
      order.push('stop-jobs');
    });
    const exit = vi.fn();

    const shutdown = createGracefulShutdown({
      server,
      disconnectDb,
      onShuttingDown,
      stopBackgroundJobs,
      exit,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    await shutdown('SIGTERM');

    expect(order).toEqual(['mark-draining', 'stop-jobs', 'http-close', 'db-disconnect']);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('es idempotente si llegan dos señales seguidas (no cierra dos veces)', async () => {
    let closeCallback: ((err?: Error) => void) | undefined;
    const server = {
      close: vi.fn((cb?: (err?: Error) => void) => {
        closeCallback = cb;
      }),
    };
    const disconnectDb = vi.fn(async () => undefined);
    const exit = vi.fn();

    const shutdown = createGracefulShutdown({
      server,
      disconnectDb,
      exit,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    const p1 = shutdown('SIGTERM');
    const p2 = shutdown('SIGINT');
    closeCallback?.();
    await Promise.all([p1, p2]);

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(disconnectDb).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('fuerza salida con código 1 si server.close se cuelga más allá del timeout', async () => {
    const server = {
      close: vi.fn(() => undefined), // Nunca invoca callback
    };
    const disconnectDb = vi.fn(async () => undefined);
    const exit = vi.fn();

    const shutdown = createGracefulShutdown({
      server,
      disconnectDb,
      timeoutMs: 30,
      exit,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    await shutdown('SIGTERM');

    expect(disconnectDb).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
