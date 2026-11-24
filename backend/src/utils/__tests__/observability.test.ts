import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  redactSensitiveFields,
  registerExternalErrorReporter,
  reportUnhandledError,
  structuredLog,
} from '../structured-logger.util';
import {
  createRequestObservabilityMiddleware,
  resolveRequestId,
} from '../../middlewares/request-observability.middleware';
import { errorHandler } from '../../middlewares/errorHandler.middleware';

describe('Paso 3.1 — Observabilidad Estructurada, X-Request-Id y Slow Request Alert', () => {
  afterEach(() => {
    registerExternalErrorReporter(null);
  });

  it('redacta campos sensibles en logs estructurados JSON', () => {
    const safe = redactSensitiveFields({
      userId: 5,
      password: 'mi-clave-secreta',
      token: 'jwt-123',
      path: '/api/orders',
    });
    expect(safe).toEqual({
      userId: 5,
      password: '[REDACTED]',
      token: '[REDACTED]',
      path: '/api/orders',
    });

    const sink = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const line = structuredLog('info', 'test.event', { userId: 5, secret: 'abc' }, sink);
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe('test.event');
    expect(parsed.secret).toBe('[REDACTED]');
    expect(sink.info).toHaveBeenCalledOnce();
  });

  it('respeta X-Request-Id entrante válido y genera uno nuevo si falta o es inválido', () => {
    expect(resolveRequestId('req-123456')).toBe('req-123456');
    const generated = resolveRequestId('invalido con espacios!');
    expect(generated.length).toBe(12);
  });

  it('emite alerta JSON http.slow_request cuando supera el umbral y guarda silencio en requests rápidos', () => {
    let clockNs = 0n;
    const sink = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const middleware = createRequestObservabilityMiddleware({
      slowThresholdMs: 500,
      logSink: sink,
      nowNs: () => clockNs,
    });

    const runRequest = (elapsedMs: number, statusCode = 200) => {
      clockNs = 1_000_000_000n;
      let finishCb: (() => void) | undefined;
      const headers: Record<string, string> = {};
      const req: any = {
        method: 'GET',
        originalUrl: '/api/orders?page=1',
        headers: {},
        user: { id: 7, role: 'ADMIN' },
      };
      const res: any = {
        statusCode,
        headersSent: false,
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
        writeHead: vi.fn(),
        on: (ev: string, cb: () => void) => {
          if (ev === 'finish') finishCb = cb;
        },
      };
      const next = vi.fn();
      middleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
      expect(headers['X-Request-Id']).toBeDefined();

      clockNs += BigInt(elapsedMs) * 1_000_000n;
      res.writeHead(statusCode);
      expect(headers['X-Response-Time']).toBe(`${elapsedMs}ms`);
      finishCb?.();
    };

    // Request rápido (120 ms) -> silencio total
    runRequest(120, 200);
    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.error).not.toHaveBeenCalled();

    // Request lento (1350 ms) -> alerta warn estructurada
    runRequest(1350, 200);
    expect(sink.warn).toHaveBeenCalledTimes(1);
    const parsedWarn = JSON.parse(sink.warn.mock.calls[0][0]);
    expect(parsedWarn.event).toBe('http.slow_request');
    expect(parsedWarn.durationMs).toBe(1350);
    expect(parsedWarn.path).toBe('/api/orders');
    expect(parsedWarn.userId).toBe(7);
  });

  it('propaga requestId en respuestas 500 del errorHandler e invoca el reporter externo si está registrado', () => {
    const externalReporter = vi.fn();
    registerExternalErrorReporter(externalReporter);

    const req: any = {
      method: 'POST',
      originalUrl: '/api/orders',
      requestId: 'trace-998877',
      user: { id: 12 },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    errorHandler(new Error('Fallo inesperado de prueba'), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        requestId: 'trace-998877',
      }),
    );
    expect(externalReporter).toHaveBeenCalledOnce();
    consoleErrSpy.mockRestore();
  });

  it('aísla fallos dentro del reporter externo para nunca romper el manejo de errores', () => {
    registerExternalErrorReporter(() => {
      throw new Error('Reporter down');
    });
    const sink = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    expect(() => reportUnhandledError(new Error('Boom'), { requestId: 'r1' }, sink)).not.toThrow();
    expect(sink.error).toHaveBeenCalledOnce();
  });
});
