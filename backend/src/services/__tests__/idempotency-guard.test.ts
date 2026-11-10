import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clearIdempotencyStore,
  idempotencyGuard,
} from '../../middlewares/idempotency.middleware';

function buildMockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    headers,
    setHeader: vi.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    status: vi.fn(function (this: any, code: number) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function (this: any, body: any) {
      res.sentBody = body;
      return res;
    }),
    on: vi.fn(),
  };
  return res;
}

describe('Paso S4 — Escudo Bancario Anti-Doble Clic e Idempotencia (Idempotency-Key)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearIdempotencyStore();
  });

  it('Ejecuta un pedido 1 sola vez ante reintentos 4G con la misma Idempotency-Key y devuelve X-Idempotency-Replayed', () => {
    let controllerExecutions = 0;
    const orderPayload = {
      personaId: 18,
      items: [{ productId: 45, quantity: 3 }],
      total: 48000,
    };

    const runOrderPost = () => {
      const req: any = {
        method: 'POST',
        baseUrl: '/api/orders',
        path: '/',
        user: { id: 7 },
        headers: { 'idempotency-key': 'order-uuid-4g-retry-0001' },
        body: orderPayload,
      };
      const res = buildMockRes();
      const next = vi.fn(() => {
        controllerExecutions++;
        res.status(201).json({ status: 'success', data: { orderId: 901, total: 48000 } });
      });
      idempotencyGuard(req, res, next);
      return { res, next };
    };

    const first = runOrderPost();
    const retry = runOrderPost();

    expect(controllerExecutions).toBe(1);
    expect(first.res.statusCode).toBe(201);
    expect(first.res.headers['X-Idempotency-Replayed']).toBeUndefined();

    // El reintento devuelve exactamente el mismo pedido #901 sin volver a descontar stock ni crear duplicado
    expect(retry.next).not.toHaveBeenCalled();
    expect(retry.res.statusCode).toBe(201);
    expect(retry.res.sentBody).toEqual({
      status: 'success',
      data: { orderId: 901, total: 48000 },
    });
    expect(retry.res.headers['X-Idempotency-Replayed']).toBe('true');
  });

  it('Bloquea con 409 IDEMPOTENT_IN_PROGRESS un segundo clic mientras AFIP está procesando la primera solicitud', () => {
    const req1: any = {
      method: 'POST',
      baseUrl: '/api/orders',
      path: '/55/request-cae',
      user: { id: 1 },
      headers: { 'idempotency-key': 'cae-request-order-55-key' },
      body: { invoiceType: 'FACTURA_A' },
    };
    const res1 = buildMockRes();
    const next1 = vi.fn(); // Simula petición en vuelo (aún no llamó res1.json)

    idempotencyGuard(req1, res1, next1);
    expect(next1).toHaveBeenCalledOnce();

    // Segundo clic 80ms después mientras AFIP sigue respondiendo
    const req2: any = {
      method: 'POST',
      baseUrl: '/api/orders',
      path: '/55/request-cae',
      user: { id: 1 },
      headers: { 'idempotency-key': 'cae-request-order-55-key' },
      body: { invoiceType: 'FACTURA_A' },
    };
    const res2 = buildMockRes();
    const next2 = vi.fn();

    idempotencyGuard(req2, res2, next2);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(409);
    expect(res2.sentBody.code).toBe('IDEMPOTENT_IN_PROGRESS');
  });

  it('Rechaza con 422 si se reutiliza la misma Idempotency-Key con un monto distinto', () => {
    const makePaymentReq = (amount: number) => ({
      method: 'POST',
      baseUrl: '/api/collections',
      path: '/register',
      user: { id: 3 },
      headers: { 'idempotency-key': 'cobro-calle-uuid-8899' },
      body: { personaId: 12, amount, paymentMethod: 'CASH' },
    });

    const res1 = buildMockRes();
    idempotencyGuard(makePaymentReq(15000) as any, res1, () => {
      res1.status(201).json({ receiptNumber: 'REC-00100' });
    });

    const res2 = buildMockRes();
    const next2 = vi.fn();
    idempotencyGuard(makePaymentReq(95000) as any, res2, next2);

    expect(next2).not.toHaveBeenCalled();
    expect(res2.statusCode).toBe(422);
    expect(res2.sentBody.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
  });

  it('Libera el bloqueo si una petición falla (400) y deduplica automáticamente por huella SHA-256 sin cabecera', () => {
    let attempts = 0;
    const makeRawExpenseReq = () => ({
      method: 'POST',
      baseUrl: '/api/expenses',
      path: '/',
      user: { id: 1 },
      headers: {}, // Sin cabecera Idempotency-Key -> activa huella automática SHA-256 de 3s
      body: { description: 'Gasoil Camión Iveco', amount: 85000, categoryId: 4 },
    });

    // Intento 1 falla con 400 (ej. caja cerrada) -> no debe quedar bloqueado
    const failRes = buildMockRes();
    idempotencyGuard(makeRawExpenseReq() as any, failRes, () => {
      attempts++;
      failRes.status(400).json({ status: 'error', message: 'Caja cerrada' });
    });
    expect(attempts).toBe(1);

    // Intento 2 (tras abrir caja) pasa limpio y queda protegido contra doble clic inmediato
    const okRes = buildMockRes();
    idempotencyGuard(makeRawExpenseReq() as any, okRes, () => {
      attempts++;
      okRes.status(201).json({ status: 'success', expenseId: 301 });
    });
    expect(attempts).toBe(2);

    // Doble clic involuntario 100ms después sin cabecera -> devuelve el mismo gasto #301 sin duplicar
    const doubleClickRes = buildMockRes();
    const nextDoubleClick = vi.fn();
    idempotencyGuard(makeRawExpenseReq() as any, doubleClickRes, nextDoubleClick);

    expect(attempts).toBe(2);
    expect(nextDoubleClick).not.toHaveBeenCalled();
    expect(doubleClickRes.statusCode).toBe(201);
    expect(doubleClickRes.sentBody).toEqual({ status: 'success', expenseId: 301 });
    expect(doubleClickRes.headers['X-Idempotency-Replayed']).toBe('true');
  });
});
