import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingType, OrderStatus, PaymentMethod } from '@prisma/client';
import prisma from '../../utils/prisma';
import { fieldReceiptsService } from '../fieldReceipts.service';

function createOrderRow(id: number, invoiceNumber: string, total: string) {
  return {
    id,
    invoiceNumber,
    billingType: 'INTERNAL',
    invoiceType: 'REMITO_X',
    status: OrderStatus.DELIVERED,
    totalAmount: { toString: () => total },
    paymentAllocations: [],
    creditNotes: [],
    createdAt: new Date(`2026-11-${10 + (id % 15)}T12:00:00Z`),
  };
}

describe('Imputación de facturas y Saldo anterior en Recibos en Calle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('syncReceipt en efectivo pagando $50.000 de Saldo anterior NO imputa sobre la factura pendiente', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockTx: any = {
      fieldReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 501, ...args.data })),
        update: vi.fn().mockResolvedValue({ id: 501 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 501,
          receiptNumber: 'REC-C-0000501',
          transactionId: 901,
          totalAmount: 50000,
          payments: [],
        }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({
          id: 40,
          isClient: true,
          name: 'Cliente Saldo Anterior',
          outstandingBalance: '80000.00', // $50.000 saldo anterior + $30.000 factura
        }),
        update: vi.fn().mockResolvedValue({ id: 40, outstandingBalance: '30000.00' }),
      },
      order: {
        findMany: vi.fn().mockResolvedValue([createOrderRow(201, 'INT-00201', '30000')]),
      },
      paymentAllocation: { createMany },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 901, movementId: 901 }),
      },
      collectorSettlement: {
        findFirst: vi.fn().mockResolvedValue({ id: 7, collectorUserId: 66, status: 'OPEN' }),
        update: vi.fn().mockResolvedValue({ id: 7 }),
      },
      fieldReceiptPayment: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      accountLedger: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.syncReceipt(66, {
      provisionalCode: 'PROV-UNBILLED-ONLY',
      personaId: 40,
      billingType: 'INTERNAL',
      capturedAt: '2026-11-27T14:00:00Z',
      allowCreditOnAccount: false,
      applyToUnbilledBalance: true,
      payments: [{ paymentMethod: 'CASH', amount: 50000, isEcheq: false }],
    });

    expect(createMany).not.toHaveBeenCalled();
  });

  it('syncReceipt pagando $60.000 con Saldo anterior + factura 202 cubre $50.000 de saldo anterior y $10.000 en la 202', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockTx: any = {
      fieldReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 502, ...args.data })),
        update: vi.fn().mockResolvedValue({ id: 502 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 502,
          receiptNumber: 'REC-C-0000502',
          transactionId: 902,
          totalAmount: 60000,
          payments: [],
        }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({
          id: 40,
          isClient: true,
          name: 'Cliente Mixto Saldo',
          outstandingBalance: '110000.00', // $50.000 saldo anterior + $30.000 (201) + $30.000 (202)
        }),
        update: vi.fn().mockResolvedValue({ id: 40, outstandingBalance: '50000.00' }),
      },
      order: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            createOrderRow(201, 'INT-00201', '30000'),
            createOrderRow(202, 'INT-00202', '30000'),
          ]),
      },
      paymentAllocation: { createMany },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 902, movementId: 902 }),
      },
      collectorSettlement: {
        findFirst: vi.fn().mockResolvedValue({ id: 7, collectorUserId: 66, status: 'OPEN' }),
        update: vi.fn().mockResolvedValue({ id: 7 }),
      },
      fieldReceiptPayment: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      accountLedger: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.syncReceipt(66, {
      provisionalCode: 'PROV-UNBILLED-PLUS-202',
      personaId: 40,
      billingType: 'INTERNAL',
      capturedAt: '2026-11-27T14:05:00Z',
      allowCreditOnAccount: false,
      applyToUnbilledBalance: true,
      orderIds: [202],
      payments: [{ paymentMethod: 'CASH', amount: 60000, isEcheq: false }],
    });

    expect(createMany).toHaveBeenCalledWith({
      data: [{ transactionId: 902, orderId: 202, amount: 10000 }],
      skipDuplicates: true,
    });
  });

  it('syncReceipt eligiendo factura 202 (sin Saldo anterior) imputa a 202 antes que a 201', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockTx: any = {
      fieldReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 503, ...args.data })),
        update: vi.fn().mockResolvedValue({ id: 503 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 503,
          receiptNumber: 'REC-C-0000503',
          transactionId: 903,
          totalAmount: 30000,
          payments: [],
        }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({
          id: 40,
          isClient: true,
          name: 'Cliente Facturas',
          outstandingBalance: '60000.00',
        }),
        update: vi.fn().mockResolvedValue({ id: 40, outstandingBalance: '30000.00' }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 202,
          invoiceNumber: 'INT-00202',
          totalAmount: '30000',
          status: OrderStatus.DELIVERED,
        }),
        findMany: vi
          .fn()
          .mockResolvedValue([
            createOrderRow(201, 'INT-00201', '30000'),
            createOrderRow(202, 'INT-00202', '30000'),
          ]),
      },
      paymentAllocation: { createMany },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: vi.fn().mockResolvedValue({ id: 903, movementId: 903 }),
      },
      collectorSettlement: {
        findFirst: vi.fn().mockResolvedValue({ id: 7, collectorUserId: 66, status: 'OPEN' }),
        update: vi.fn().mockResolvedValue({ id: 7 }),
      },
      fieldReceiptPayment: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      accountLedger: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.syncReceipt(66, {
      provisionalCode: 'PROV-EXPLICIT-202',
      personaId: 40,
      billingType: 'INTERNAL',
      capturedAt: '2026-11-27T14:10:00Z',
      allowCreditOnAccount: false,
      applyToUnbilledBalance: false,
      orderId: 202,
      orderIds: [202],
      payments: [{ paymentMethod: 'CASH', amount: 30000, isEcheq: false }],
    });

    expect(createMany).toHaveBeenCalledWith({
      data: [{ transactionId: 903, orderId: 202, amount: 30000 }],
      skipDuplicates: true,
    });
  });

  it('syncReceipt con 100% transferencia guarda allocationPreference y verifyTransferPayment(CLEAR) la respeta al acreditar', async () => {
    const receiptCreates: any[] = [];
    const createMany = vi.fn().mockResolvedValue({ count: 1 });

    const syncMockTx: any = {
      fieldReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => {
          receiptCreates.push(args);
          return Promise.resolve({ id: 600, ...args.data });
        }),
        findMany: vi.fn().mockResolvedValue([]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 600,
          receiptNumber: null,
          transactionId: null,
          status: 'PENDING_VERIFICATION',
          totalAmount: 30000,
          payments: [],
          persona: { id: 40, name: 'Cliente Transferencia', phone: null, outstandingBalance: '60000.00' },
          collector: { id: 66, username: 'diego' },
        }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({
          id: 40,
          isClient: true,
          name: 'Cliente Transferencia',
          outstandingBalance: '60000.00',
        }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 202,
          invoiceNumber: 'INT-00202',
          totalAmount: '30000',
          status: OrderStatus.DELIVERED,
        }),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      collectorSettlement: {
        findFirst: vi.fn().mockResolvedValue({ id: 7, collectorUserId: 66, status: 'OPEN' }),
        update: vi.fn().mockResolvedValue({ id: 7 }),
      },
      fieldReceiptPayment: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb(syncMockTx));

    await fieldReceiptsService.syncReceipt(66, {
      provisionalCode: 'PROV-TRANSFER-PREF',
      personaId: 40,
      billingType: 'INTERNAL',
      capturedAt: '2026-11-27T14:15:00Z',
      allowCreditOnAccount: false,
      applyToUnbilledBalance: false,
      orderId: 202,
      orderIds: [202],
      payments: [{ paymentMethod: 'BANK_TRANSFER', amount: 30000, bankAccountId: 22, isEcheq: false }],
    });

    const savedPreference = receiptCreates[0].data.allocationPreference;
    expect(savedPreference).toEqual({ orderId: 202, orderIds: [202] });

    const clearMockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      fieldReceiptPayment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 88,
          fieldReceiptId: 600,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          amount: '30000.00',
          status: 'PENDING_BANK',
          bankAccountId: 22,
          fieldReceipt: {
            id: 600,
            receiptNumber: null,
            transactionId: null,
            personaId: 40,
            collectorUserId: 66,
            billingType: BillingType.INTERNAL,
            status: 'PENDING_VERIFICATION',
            settlementId: 7,
            allocationPreference: savedPreference,
            payments: [
              {
                id: 88,
                paymentMethod: PaymentMethod.BANK_TRANSFER,
                amount: '30000.00',
                status: 'PENDING_BANK',
              },
            ],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 88 }),
      },
      bankAccount: { update: vi.fn().mockResolvedValue({ id: 22 }) },
      transaction: { create: vi.fn().mockResolvedValue({ id: 950 }) },
      order: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            createOrderRow(201, 'INT-00201', '30000'),
            createOrderRow(202, 'INT-00202', '30000'),
          ]),
      },
      paymentAllocation: { createMany },
      persona: {
        findUnique: vi.fn().mockResolvedValue({ id: 40, outstandingBalance: '60000.00' }),
        update: vi.fn().mockResolvedValue({ id: 40, outstandingBalance: '30000.00' }),
      },
      accountLedger: { create: vi.fn().mockResolvedValue({ id: 1 }) },
      fieldReceipt: {
        update: vi.fn().mockResolvedValue({ id: 600 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ id: 600, receiptNumber: 'REC-C-0000600', payments: [] }),
      },
      collectorSettlement: { update: vi.fn().mockResolvedValue({ id: 7 }) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb(clearMockTx));

    await fieldReceiptsService.verifyTransferPayment(88, 73, {
      action: 'CLEAR',
      bankAccountId: 22,
    });

    expect(createMany).toHaveBeenCalledWith({
      data: [{ transactionId: 950, orderId: 202, amount: 30000 }],
      skipDuplicates: true,
    });
  });
});
