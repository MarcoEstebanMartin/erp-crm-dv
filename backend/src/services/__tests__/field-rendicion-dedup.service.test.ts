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

  it('verifyTransferPayment(CLEAR) marca FieldReceipt VERIFIED y sincroniza Transaction espejo con verified=true', async () => {
    const fieldReceiptUpdates: any[] = [];
    const txUpdates: any[] = [];
    const bankUpdates: any[] = [];

    const mockTx: any = {
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
            receiptNumber: 'REC-C-0000002',
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
        update: vi.fn().mockImplementation((args) => {
          txUpdates.push(args);
          return Promise.resolve({ id: 62, verified: true });
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
    expect(fieldReceiptUpdates[0]).toEqual({
      where: { id: 2 },
      data: { status: 'VERIFIED' },
    });
    expect(txUpdates).toHaveLength(1);
    expect(txUpdates[0]).toEqual({
      where: { id: 62 },
      data: {
        verified: true,
        verifiedById: 73,
        verifiedAt: expect.any(Date),
        amount: 535560,
        bankAccountId: 22,
      },
    });
  });

  it('verifyTransferPayment(REJECT) como único pago desvincula y borra la Transaction espejo', async () => {
    const fieldReceiptUpdates: any[] = [];
    const txDeletes: any[] = [];

    const mockTx: any = {
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
            receiptNumber: 'REC-C-0000002',
            provisionalCode: 'PROV-2',
            payments: [],
          },
        }),
        update: vi.fn().mockResolvedValue({ id: 2, status: 'REJECTED' }),
      },
      persona: {
        update: vi.fn().mockResolvedValue({ id: 8785, outstandingBalance: '535560.00' }),
      },
      accountLedger: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
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
        update: vi.fn().mockImplementation((args) => {
          fieldReceiptUpdates.push(args);
          return Promise.resolve({ id: 2 });
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 2,
          status: 'PENDING_VERIFICATION',
          transactionId: 62,
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
          return Promise.resolve({ count: 1 });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await fieldReceiptsService.verifyTransferPayment(2, 73, {
      action: 'REJECT',
      rejectionReason: 'Comprobante falso',
    });

    expect(fieldReceiptUpdates).toContainEqual({
      where: { id: 2 },
      data: { transactionId: null },
    });
    expect(txDeletes).toEqual([{ where: { id: 62 } }]);
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
