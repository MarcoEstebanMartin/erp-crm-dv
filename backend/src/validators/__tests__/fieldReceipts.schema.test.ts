import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { validateRequest } from '../../middlewares/validateRequest';
import {
  approveSettlementSchema,
  rejectCheckSchema,
  syncFieldReceiptSchema,
  verifyTransferSchema,
  voidFieldReceiptSchema,
} from '../fieldReceipts.schema';

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, status, json };
}

describe('fieldReceipts.schema + validateRequest', () => {
  it('acepta un cobro en efectivo con campos opcionales en null enviado por FieldCollectModal', async () => {
    const middleware = validateRequest(syncFieldReceiptSchema);
    const req = {
      body: {
        provisionalCode: 'PROV-12-1732046400-ABCD',
        personaId: 42,
        deliveryRouteId: null,
        billingType: 'INTERNAL',
        notes: null,
        capturedAt: '2026-11-19T17:00:00.000Z',
        allowCreditOnAccount: true,
        payments: [
          {
            paymentMethod: 'CASH',
            amount: 15000,
            bankAccountId: null,
            transferReference: null,
            proofImageUrl: null,
            checkBank: null,
            checkNumber: null,
            checkDueDate: null,
            checkFrontImageUrl: null,
            isEcheq: false,
          },
        ],
      },
      query: {},
      params: {},
    } as unknown as Request;
    const { res, status } = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it('acepta un cobro con cheque válido (fecha YYYY-MM-DD)', async () => {
    const middleware = validateRequest(syncFieldReceiptSchema);
    const req = {
      body: {
        provisionalCode: 'PROV-12-1732046401-EFGH',
        personaId: 42,
        deliveryRouteId: null,
        billingType: 'INTERNAL',
        notes: 'Pago parcial',
        capturedAt: '2026-11-19T17:05:00.000Z',
        payments: [
          {
            paymentMethod: 'CHECK',
            amount: 25000,
            bankAccountId: null,
            transferReference: null,
            proofImageUrl: null,
            checkBank: 'Banco Macro',
            checkNumber: '12345678',
            checkDueDate: '2026-12-15',
            checkFrontImageUrl: null,
            isEcheq: true,
          },
        ],
      },
      query: {},
      params: {},
    } as unknown as Request;
    const { res, status } = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it('rechaza un cheque sin datos obligatorios con HTTP 400', async () => {
    const middleware = validateRequest(syncFieldReceiptSchema);
    const req = {
      body: {
        provisionalCode: 'PROV-12-1732046402-IJKL',
        personaId: 42,
        capturedAt: '2026-11-19T17:05:00.000Z',
        payments: [{ paymentMethod: 'CHECK', amount: 10000 }],
      },
      query: {},
      params: {},
    } as unknown as Request;
    const { res, status } = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('acepta preferencias opcionales de imputación (orderId, orderIds, applyToUnbilledBalance)', async () => {
    const middleware = validateRequest(syncFieldReceiptSchema);
    const req = {
      body: {
        provisionalCode: 'PROV-12-1732046409-ALLOC',
        personaId: 42,
        billingType: 'INTERNAL',
        capturedAt: '2026-11-27T17:00:00.000Z',
        orderId: 202,
        orderIds: [202, 205],
        applyToUnbilledBalance: true,
        payments: [{ paymentMethod: 'CASH', amount: 30000 }],
      },
      query: {},
      params: {},
    } as unknown as Request;
    const { res, status } = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
    expect(req.body.orderId).toBe(202);
    expect(req.body.orderIds).toEqual([202, 205]);
    expect(req.body.applyToUnbilledBalance).toBe(true);
  });

  it('valida los schemas de rendición, verificación de transferencia, rechazo de cheque y anulación', async () => {
    const cases = [
      { schema: approveSettlementSchema, body: { declaredCash: 15000, notes: 'OK' } },
      { schema: verifyTransferSchema, body: { action: 'CLEAR', bankAccountId: 3 } },
      { schema: rejectCheckSchema, body: { rejectionReason: 'Sin fondos' } },
      { schema: voidFieldReceiptSchema, body: { voidReason: 'Duplicado por error' } },
    ];

    for (const c of cases) {
      const middleware = validateRequest(c.schema);
      const req = { body: c.body, query: {}, params: {} } as unknown as Request;
      const { res, status } = createMockRes();
      const next = vi.fn() as unknown as NextFunction;
      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(status).not.toHaveBeenCalled();
    }
  });
});
