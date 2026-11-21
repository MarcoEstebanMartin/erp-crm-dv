import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingType, PaymentMethod, Role, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import { rendicionService } from '../collections/rendicion.service';
import { fieldReceiptsService } from '../fieldReceipts.service';
import { transactionAdminService } from '../finance/transaction-admin.service';
import { receiptService } from '../collections/receipt.service';

describe('Deduplicación y sincronización de Recibos en Calle vs Rendiciones', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rendicionService.getPendingRendiciones excluye transacciones espejo con fieldReceipt', async () => {
    const txFindManySpy = vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.collectorSettlement, 'findMany').mockResolvedValue([]);

    await rendicionService.getPendingRendiciones();

    expect(txFindManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: TransactionType.INCOME,
          verified: false,
          fieldReceipt: { is: null },
        },
      }),
    );
  });

  it('rendicionService.verifyRendicion excluye transacciones con fieldReceipt en sellerId y routeId', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 66, username: 'diego' } as any);
    vi.spyOn(prisma.deliveryRoute, 'findUnique').mockResolvedValue({
      id: 4,
      driverName: 'Miguel Alberca',
    } as any);
    const txFindManySpy = vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    await expect(
      rendicionService.verifyRendicion({
        adminId: 1,
        sellerId: 66,
        realCash: 0,
        realChecks: 0,
        hostOrigin: 'http://localhost:3001',
      }),
    ).rejects.toThrow('No hay transacciones pendientes para verificar');

    expect(txFindManySpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 66,
          type: TransactionType.INCOME,
          verified: false,
          fieldReceipt: { is: null },
        }),
      }),
    );

    await expect(
      rendicionService.verifyRendicion({
        adminId: 1,
        routeId: 4,
        realCash: 0,
        realChecks: 0,
        hostOrigin: 'http://localhost:3001',
      }),
    ).rejects.toThrow('No hay transacciones pendientes para verificar');

    expect(txFindManySpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          type: TransactionType.INCOME,
          verified: false,
          fieldReceipt: { is: null },
          order: { deliveryRouteId: 4 },
        }),
      }),
    );
  });

  it('syncReceipt con 100% transferencia no emite recibo oficial, no crea Transaction ni descuenta AccountLedger', async () => {
    const receiptCreates: any[] = [];
    const txCreates: any[] = [];
    const ledgerCreates: any[] = [];

    const mockTx: any = {
      fieldReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => {
          receiptCreates.push(args);
          return Promise.resolve({ id: 12, ...args.data });
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 12,
            status: 'PENDING_VERIFICATION',
            payments: [{ paymentMethod: PaymentMethod.BANK_TRANSFER, amount: '535560.00', status: 'PENDING_BANK' }],
          },
        ]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 12,
          receiptNumber: null,
          transactionId: null,
          status: 'PENDING_VERIFICATION',
          totalAmount: 535560,
          payments: [{ id: 22, paymentMethod: PaymentMethod.BANK_TRANSFER, amount: 535560, status: 'PENDING_BANK' }],
          persona: { id: 8785, name: 'MARTIN MARCO ESTEBAN', phone: null, outstandingBalance: '535560.00' },
          collector: { id: 66, username: 'diego' },
        }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({ id: 8785, isClient: true, name: 'MARTIN MARCO ESTEBAN', outstandingBalance: '535560.00' }),
        update: vi.fn(),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => {
          txCreates.push(args);
          return Promise.resolve({ id: 99, movementId: 99 });
        }),
      },
      collectorSettlement: {
        findFirst: vi.fn().mockResolvedValue({ id: 2, collectorUserId: 66, status: 'OPEN' }),
        update: vi.fn().mockResolvedValue({ id: 2 }),
      },
      fieldReceiptPayment: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation((args) => {
          ledgerCreates.push(args);
          return Promise.resolve({ id: 1 });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await fieldReceiptsService.syncReceipt(66, {
      provisionalCode: 'PROV-TRANSFER-ONLY',
      personaId: 8785,
      billingType: 'INTERNAL',
      capturedAt: '2026-11-20T12:00:00Z',
      allowCreditOnAccount: false,
      payments: [{ paymentMethod: 'BANK_TRANSFER', amount: 535560, bankAccountId: 22, isEcheq: false }],
    });

    expect(receiptCreates).toHaveLength(1);
    expect(receiptCreates[0].data.status).toBe('PENDING_VERIFICATION');
    expect(txCreates).toHaveLength(0);
    expect(ledgerCreates).toHaveLength(0);
    expect(mockTx.persona.update).not.toHaveBeenCalled();
    expect(result.receipt.receiptNumber).toBeNull();
    expect(result.receipt.transactionId).toBeNull();
  });

  it('syncReceipt mixto ($10.000 efectivo + $20.000 transferencia) emite recibo y descuenta solo $10.000', async () => {
    const receiptCreates: any[] = [];
    const txCreates: any[] = [];
    const ledgerCreates: any[] = [];

    const mockTx: any = {
      fieldReceipt: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => {
          receiptCreates.push(args);
          return Promise.resolve({ id: 15, ...args.data });
        }),
        update: vi.fn().mockResolvedValue({ id: 15, receiptNumber: 'REC-C-0000015', transactionId: 105 }),
        findMany: vi.fn().mockResolvedValue([]),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 15,
          receiptNumber: 'REC-C-0000015',
          transactionId: 105,
          totalAmount: 10000,
          payments: [],
        }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({ id: 8785, isClient: true, name: 'Cliente Mixto', outstandingBalance: '50000.00' }),
        update: vi.fn().mockResolvedValue({ id: 8785, outstandingBalance: '40000.00' }),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation((args) => {
          txCreates.push(args);
          return Promise.resolve({ id: 105, movementId: 105 });
        }),
      },
      collectorSettlement: {
        findFirst: vi.fn().mockResolvedValue({ id: 2, collectorUserId: 66, status: 'OPEN' }),
        update: vi.fn().mockResolvedValue({ id: 2 }),
      },
      fieldReceiptPayment: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation((args) => {
          ledgerCreates.push(args);
          return Promise.resolve({ id: 1 });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.syncReceipt(66, {
      provisionalCode: 'PROV-MIXED-001',
      personaId: 8785,
      billingType: 'INTERNAL',
      capturedAt: '2026-11-20T12:00:00Z',
      allowCreditOnAccount: false,
      payments: [
        { paymentMethod: 'CASH', amount: 10000, isEcheq: false },
        { paymentMethod: 'BANK_TRANSFER', amount: 20000, bankAccountId: 22, isEcheq: false },
      ],
    });

    expect(receiptCreates[0].data.totalAmount).toBe(10000);
    expect(txCreates).toHaveLength(1);
    expect(txCreates[0].data).toMatchObject({
      paymentMethod: PaymentMethod.CASH,
      amount: 10000,
      receiptNumber: 'REC-C-0000015',
      verified: false,
    });
    expect(ledgerCreates).toHaveLength(1);
    expect(ledgerCreates[0].data).toMatchObject({
      entryType: 'CREDIT',
      amount: 10000,
      reference: 'REC-C-0000015',
      transactionId: 105,
    });
  });

  it('verifyTransferPayment(CLEAR) sobre transferencia pura acredita banco, descuenta deuda y emite REC-C definitivo', async () => {
    const fieldReceiptUpdates: any[] = [];
    const txCreates: any[] = [];
    const bankUpdates: any[] = [];
    const ledgerCreates: any[] = [];

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 2 }]),
      fieldReceiptPayment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 2,
          fieldReceiptId: 2,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          amount: '535560.00',
          status: 'PENDING_BANK',
          bankAccountId: 22,
          fieldReceipt: {
            id: 2,
            personaId: 8785,
            collectorUserId: 66,
            settlementId: 2,
            status: 'PENDING_VERIFICATION',
            billingType: BillingType.INTERNAL,
            receiptNumber: null,
            transactionId: null,
            provisionalCode: 'PROV-2',
            payments: [
              {
                id: 2,
                paymentMethod: PaymentMethod.BANK_TRANSFER,
                amount: '535560.00',
                status: 'PENDING_BANK',
                bankAccountId: 22,
              },
            ],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 2, status: 'CLEARED' }),
      },
      bankAccount: {
        update: vi.fn().mockImplementation((args) => {
          bankUpdates.push(args);
          return Promise.resolve({ id: 22 });
        }),
      },
      persona: {
        update: vi.fn().mockResolvedValue({ id: 8785, outstandingBalance: '0.00' }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation((args) => {
          ledgerCreates.push(args);
          return Promise.resolve({ id: 106 });
        }),
      },
      fieldReceipt: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 2,
            status: 'VERIFIED',
            payments: [
              {
                paymentMethod: PaymentMethod.BANK_TRANSFER,
                amount: '535560.00',
                status: 'CLEARED',
              },
            ],
          },
        ]),
        update: vi.fn().mockImplementation((args) => {
          fieldReceiptUpdates.push(args);
          return Promise.resolve({ id: 2 });
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 2,
          receiptNumber: 'REC-C-0000002',
          status: 'VERIFIED',
          transactionId: 62,
          payments: [
            {
              id: 2,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              amount: '535560.00',
              status: 'CLEARED',
              bankAccountId: 22,
            },
          ],
        }),
      },
      collectorSettlement: {
        update: vi.fn().mockResolvedValue({ id: 2 }),
      },
      transaction: {
        create: vi.fn().mockImplementation((args) => {
          txCreates.push(args);
          return Promise.resolve({ id: 62, ...args.data });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.verifyTransferPayment(2, 73, {
      action: 'CLEAR',
      bankAccountId: 22,
    });

    expect(bankUpdates).toEqual([
      { where: { id: 22 }, data: { balance: { increment: 535560 } } },
    ]);
    expect(txCreates).toHaveLength(1);
    expect(txCreates[0].data).toMatchObject({
      personaId: 8785,
      userId: 66,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amount: 535560,
      receiptNumber: 'REC-C-0000002',
      bankAccountId: 22,
      verified: true,
      verifiedById: 73,
    });
    expect(ledgerCreates).toHaveLength(1);
    expect(ledgerCreates[0].data).toMatchObject({
      personaId: 8785,
      entryType: 'CREDIT',
      amount: 535560,
      reference: 'REC-C-0000002',
      transactionId: 62,
    });
    expect(fieldReceiptUpdates[0]).toEqual({
      where: { id: 2 },
      data: {
        totalAmount: 535560,
        receiptNumber: 'REC-C-0000002',
        transactionId: 62,
        status: 'VERIFIED',
      },
    });
  });

  it('verifyTransferPayment(REJECT) sobre transferencia pura marca REJECTED sin tocar AccountLedger, Transaction ni Banco', async () => {
    const ledgerCreates: any[] = [];
    const txDeletes: any[] = [];

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 2 }]),
      fieldReceiptPayment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 2,
          fieldReceiptId: 2,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          amount: '535560.00',
          status: 'PENDING_BANK',
          bankAccountId: 22,
          fieldReceipt: {
            id: 2,
            personaId: 8785,
            settlementId: 2,
            status: 'PENDING_VERIFICATION',
            billingType: BillingType.INTERNAL,
            receiptNumber: null,
            transactionId: null,
            provisionalCode: 'PROV-2',
            payments: [
              {
                id: 2,
                paymentMethod: PaymentMethod.BANK_TRANSFER,
                amount: '535560.00',
                status: 'PENDING_BANK',
                bankAccountId: 22,
              },
            ],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 2, status: 'REJECTED' }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation((args) => {
          ledgerCreates.push(args);
          return Promise.resolve({ id: 1 });
        }),
      },
      bankAccount: {
        update: vi.fn(),
      },
      fieldReceipt: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 2,
            status: 'PENDING_VERIFICATION',
            payments: [
              {
                paymentMethod: PaymentMethod.BANK_TRANSFER,
                amount: '535560.00',
                status: 'REJECTED',
              },
            ],
          },
        ]),
        update: vi.fn().mockResolvedValue({ id: 2 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 2,
          status: 'PENDING_VERIFICATION',
          transactionId: null,
          payments: [
            {
              id: 2,
              paymentMethod: PaymentMethod.BANK_TRANSFER,
              amount: '535560.00',
              status: 'REJECTED',
              bankAccountId: 22,
            },
          ],
        }),
      },
      collectorSettlement: {
        update: vi.fn().mockResolvedValue({ id: 2 }),
      },
      transaction: {
        deleteMany: vi.fn().mockImplementation((args) => {
          txDeletes.push(args);
          return Promise.resolve({ count: 0 });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.verifyTransferPayment(2, 73, {
      action: 'REJECT',
      rejectionReason: 'Comprobante falso',
    });

    expect(ledgerCreates).toHaveLength(0);
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
    expect(txDeletes).toHaveLength(0);
    expect(mockTx.fieldReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2 },
        data: expect.objectContaining({
          status: 'VOIDED',
          voidReason: 'Todos los medios de pago fueron rechazados',
          voidedByUserId: 73,
        }),
      }),
    );
  });

  it('rejectCheckPayment sobre recibo de cheque puro borra Transaction espejo y marca FieldReceipt como VOIDED', async () => {
    const receiptUpdates: any[] = [];
    const txDeletes: any[] = [];

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 30 }]),
      fieldReceiptPayment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 30,
          fieldReceiptId: 30,
          paymentMethod: PaymentMethod.CHECK,
          amount: '45000.00',
          status: 'IN_TRANSIT',
          checkNumber: '998877',
          fieldReceipt: {
            id: 30,
            personaId: 8785,
            settlementId: 5,
            status: 'ISSUED',
            billingType: BillingType.INTERNAL,
            receiptNumber: 'REC-C-0000030',
            transactionId: 300,
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 30, status: 'REJECTED' }),
      },
      accountLedger: {
        create: vi.fn().mockResolvedValue({ id: 90 }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({ id: 8785, outstandingBalance: 45000 }),
        update: vi.fn().mockResolvedValue({ id: 8785, outstandingBalance: 90000 }),
      },
      fieldReceipt: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 30,
            status: 'ISSUED',
            payments: [{ paymentMethod: PaymentMethod.CHECK, amount: '45000.00', status: 'REJECTED' }],
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: 30,
          status: 'ISSUED',
          transactionId: 300,
          receiptNumber: 'REC-C-0000030',
          totalAmount: '45000.00',
          payments: [
            {
              id: 30,
              paymentMethod: PaymentMethod.CHECK,
              amount: '45000.00',
              status: 'REJECTED',
              bankAccountId: null,
            },
          ],
        }),
        update: vi.fn().mockImplementation((args) => {
          receiptUpdates.push(args);
          return Promise.resolve({ id: 30 });
        }),
      },
      collectorSettlement: {
        update: vi.fn().mockResolvedValue({ id: 5 }),
      },
      transaction: {
        deleteMany: vi.fn().mockImplementation((args) => {
          txDeletes.push(args);
          return Promise.resolve({ count: 1 });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.rejectCheckPayment(30, 73, 'Sin fondos');

    expect(txDeletes).toEqual([{ where: { id: 300 } }]);
    expect(receiptUpdates).toContainEqual(
      expect.objectContaining({
        where: { id: 30 },
        data: expect.objectContaining({
          status: 'VOIDED',
          voidReason: 'Todos los medios de pago fueron rechazados',
          voidedByUserId: 73,
        }),
      }),
    );
  });

  it('voidFieldReceipt sobre recibo mixto con transferencia PENDING_BANK revierte solo lo efectivamente acreditado', async () => {
    const ledgerCreates: any[] = [];
    const txDeletes: any[] = [];

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 15 }]),
      fieldReceipt: {
        findUnique: vi.fn().mockResolvedValue({
          id: 15,
          personaId: 8785,
          billingType: BillingType.INTERNAL,
          receiptNumber: 'REC-C-0000015',
          provisionalCode: 'PROV-15',
          transactionId: 105,
          settlementId: 2,
          status: 'PENDING_VERIFICATION',
          payments: [
            { id: 1, paymentMethod: PaymentMethod.CASH, amount: '10000.00', status: 'IN_TRANSIT', bankAccountId: null },
            { id: 2, paymentMethod: PaymentMethod.BANK_TRANSFER, amount: '20000.00', status: 'PENDING_BANK', bankAccountId: 22 },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 15, status: 'VOIDED', payments: [] }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      persona: {
        update: vi.fn().mockResolvedValue({ id: 8785, outstandingBalance: '50000.00' }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation((args) => {
          ledgerCreates.push(args);
          return Promise.resolve({ id: 1 });
        }),
      },
      bankAccount: { update: vi.fn() },
      transaction: {
        deleteMany: vi.fn().mockImplementation((args) => {
          txDeletes.push(args);
          return Promise.resolve({ count: 1 });
        }),
      },
      collectorSettlement: { update: vi.fn().mockResolvedValue({ id: 2 }) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.voidFieldReceipt(15, 73, 'Error de carga');

    expect(ledgerCreates).toHaveLength(1);
    expect(ledgerCreates[0].data).toMatchObject({
      entryType: 'DEBIT',
      amount: 10000,
    });
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
    expect(txDeletes).toEqual([
      { where: { id: 105 } },
      { where: { receiptNumber: { startsWith: 'REC-C-0000015-T' } } },
    ]);
  });

  it('receiptService.listReceipts excluye transacciones nacidas de FieldReceipt', async () => {
    const findManySpy = vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([]);

    await receiptService.listReceipts(50);

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          type: TransactionType.INCOME,
          personaId: { not: null },
          fieldReceipt: { is: null },
          OR: [
            { receiptNumber: null },
            { NOT: { receiptNumber: { startsWith: 'REC-C-' } } },
          ],
        },
      }),
    );
  });

  it('approveSettlement crea CashDrawer cerrado, vincula cashDrawerId, marca Transaction espejo verified=true y bloquea doble aprobación', async () => {
    const drawerCreates: any[] = [];
    const txUpdateManyCalls: any[] = [];
    const txUpdates: any[] = [];

    const mockTx: any = {
      collectorSettlement: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          collectorUserId: 66,
          deliveryRouteId: null,
          status: 'OPEN',
          createdAt: new Date('2026-11-20T10:00:00Z'),
          collector: { id: 66, username: 'diego', role: 'VENDEDOR' },
          deliveryRoute: null,
          receipts: [
            {
              id: 10,
              status: 'ISSUED',
              deliveryRouteId: null,
              transactionId: 90,
              capturedAt: new Date('2026-11-20T10:05:00Z'),
              payments: [
                {
                  id: 100,
                  paymentMethod: PaymentMethod.CASH,
                  amount: '15000.00',
                  status: 'IN_TRANSIT',
                  bankAccountId: null,
                },
              ],
            },
          ],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 5,
          expectedCash: '15000.00',
          expectedChecksAmount: '0.00',
        }),
        update: vi.fn().mockResolvedValue({ id: 5, status: 'APPROVED' }),
      },
      fieldReceipt: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 10,
            status: 'ISSUED',
            payments: [
              { paymentMethod: PaymentMethod.CASH, amount: '15000.00', status: 'IN_TRANSIT' },
            ],
          },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: 10,
          status: 'ISSUED',
          transactionId: 90,
          payments: [
            {
              id: 100,
              paymentMethod: PaymentMethod.CASH,
              amount: '15000.00',
              status: 'CLEARED',
              bankAccountId: null,
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: 10, status: 'VERIFIED' }),
      },
      fieldReceiptPayment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      cashDrawer: {
        create: vi.fn().mockImplementation((args) => {
          drawerCreates.push(args);
          return Promise.resolve({ id: 44, ...args.data });
        }),
      },
      transaction: {
        updateMany: vi.fn().mockImplementation((args) => {
          txUpdateManyCalls.push(args);
          return Promise.resolve({ count: 1 });
        }),
        update: vi.fn().mockImplementation((args) => {
          txUpdates.push(args);
          return Promise.resolve({ id: 90, verified: true });
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.approveSettlement(5, 73, { declaredCash: 15000 });

    expect(drawerCreates).toHaveLength(1);
    expect(drawerCreates[0].data).toMatchObject({
      userId: 73,
      branch: 'VENDEDOR: DIEGO',
      drawerType: 'VENDEDOR',
      openingBalance: 0,
      closingBalance: 15000,
      realBalance: 15000,
      status: 'CLOSED',
    });
    expect(txUpdateManyCalls).toEqual([
      {
        where: { id: { in: [90] }, cashDrawerId: null },
        data: { cashDrawerId: 44 },
      },
    ]);
    expect(txUpdates).toEqual([
      {
        where: { id: 90 },
        data: {
          verified: true,
          verifiedById: 73,
          verifiedAt: expect.any(Date),
          amount: 15000,
        },
      },
    ]);

    // Bloqueo contra doble cierre si ya estaba APPROVED o DISCREPANCY
    for (const closedStatus of ['APPROVED', 'DISCREPANCY']) {
      mockTx.collectorSettlement.findUnique.mockResolvedValueOnce({
        id: 5,
        status: closedStatus,
        receipts: [],
      });
      await expect(
        fieldReceiptsService.approveSettlement(5, 73, { declaredCash: 15000 }),
      ).rejects.toMatchObject({ statusCode: 409 });
    }
  });

  it('transactionAdminService.verifyTransaction y receiptService.deleteReceipt rechazan con 409 si pertenece a FieldReceipt', async () => {
    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValueOnce({
      id: 62,
      fieldReceipt: { id: 2, receiptNumber: 'REC-C-0000002' },
    } as any);

    await expect(
      transactionAdminService.verifyTransaction({ userId: 73, txId: 62, verified: true }),
    ).rejects.toMatchObject({ statusCode: 409 });

    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValueOnce({
      id: 62,
      type: TransactionType.INCOME,
      amount: '535560.00',
      persona: { id: 8785, name: 'Cliente' },
      fieldReceipt: { id: 2, receiptNumber: 'REC-C-0000002' },
    } as any);

    await expect(
      receiptService.deleteReceipt({ adminId: 73, userRole: Role.ADMIN, receiptId: 62 }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
