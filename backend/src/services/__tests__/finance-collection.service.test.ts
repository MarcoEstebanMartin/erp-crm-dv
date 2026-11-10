import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import * as auditModule from '../../utils/audit';
import { cashDrawerService } from '../finance/cash-drawer.service';
import { receiptService } from '../collections/receipt.service';
import { rendicionService } from '../collections/rendicion.service';
import { expenseService } from '../expenses/expense.service';

describe('Servicios Financieros, Cobranzas y Gastos (Integridad Atómica y Seguridad)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
  });

  it('closeDrawer imputa recibos atómicamente: normaliza sucursal A/X, genera REC-XXXXX y descuenta saldo del cliente', async () => {
    const personaUpdates: any[] = [];
    const createdTransactions: any[] = [];

    const mockTx: any = {
      cashDrawer: {
        findUnique: vi.fn().mockResolvedValue({
          id: 7,
          branch: 'REPARTIDOR',
          openingBalance: '5000.00',
          status: 'OPEN',
          routeNote: null,
          notes: null,
        }),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 7, ...data })),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 1, name: 'Banco Nación' }),
        update: vi.fn().mockResolvedValue({}),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({ id: 42, name: 'Despensa San Martín' }),
        update: vi.fn().mockImplementation((args) => {
          personaUpdates.push(args);
          return Promise.resolve({ id: 42, outstandingBalance: '0.00' });
        }),
      },
      accountLedger: {
        create: vi.fn().mockResolvedValue({ id: 501 }),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }) => {
          const rec = { id: 901, movementId: 145, ...data };
          createdTransactions.push(rec);
          return Promise.resolve(rec);
        }),
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockImplementation(() => Promise.resolve(createdTransactions)),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const closed = await cashDrawerService.closeDrawer({
      userId: 1,
      drawerId: 7,
      realBalance: 17500,
      receipts: [
        {
          clientId: 42,
          amount: 12500,
          billingType: 'A', // enviado desde ArqueoCajaModal como 'A'
          paymentMethod: 'CASH',
        },
      ],
    });

    expect(createdTransactions).toHaveLength(1);
    expect(createdTransactions[0].billingType).toBe(BillingType.OFFICIAL);
    expect(mockTx.transaction.update).toHaveBeenCalledWith({
      where: { id: 901 },
      data: { receiptNumber: 'REC-00145' },
    });
    expect(personaUpdates).toEqual([
      {
        where: { id: 42 },
        data: { outstandingBalance: { decrement: 12500 } },
      },
    ]);
    expect(mockTx.accountLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personaId: 42,
          entryType: 'CREDIT',
          sourceType: 'COLLECTION_RECEIPT',
          amount: 12500,
          balanceAfter: 0,
          transactionId: 901,
        }),
      }),
    );
    // 5000 apertura + 12500 recibo efectivo = 17500 teórico
    expect(closed.closingBalance).toBe(17500);
    expect(closed.realBalance).toBe(17500);
  });

  it('getReceipt aplica selección explícita segura sin exponer passwordHash ni webPin', async () => {
    const findUniqueSpy = vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
      id: 55,
      type: TransactionType.INCOME,
      amount: '8400.00',
      receiptNumber: 'REC-00055',
      paymentMethod: PaymentMethod.CASH,
      billingType: BillingType.INTERNAL,
      verified: true,
      persona: { id: 10, code: 'C010', name: 'Kiosco Central', cuit: '20-12345678-9', address: 'Mitre 100', city: 'Villegas' },
      user: { id: 2, username: 'preventa1' },
    } as any);

    const receipt = await receiptService.getReceipt(55);

    expect(findUniqueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 55 },
        include: {
          persona: {
            select: {
              id: true,
              code: true,
              name: true,
              cuit: true,
              address: true,
              city: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      }),
    );
    expect((receipt.user as any).passwordHash).toBeUndefined();
    expect((receipt.persona as any).webPin).toBeUndefined();
  });

  it('verifyRendicion ejecuta la creación de caja cerrada y acreditación bancaria dentro de una única transacción atómica', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 4, username: 'juan_vendedor' } as any);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([
      {
        id: 201,
        movementId: 201,
        receiptNumber: 'REC-00201',
        amount: '15000.00',
        paymentMethod: PaymentMethod.CASH,
        billingType: BillingType.INTERNAL,
        createdAt: new Date('2026-11-10T10:00:00Z'),
        order: null,
        persona: { id: 12, name: 'Almacén Norte', phone: null },
      },
      {
        id: 202,
        movementId: 202,
        receiptNumber: 'REC-00202',
        amount: '25000.00',
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        billingType: BillingType.OFFICIAL,
        bankAccountId: 3,
        createdAt: new Date('2026-11-10T10:05:00Z'),
        order: null,
        persona: { id: 13, name: 'Super Sur', phone: null },
      },
    ] as any);

    const mockTx: any = {
      cashDrawer: {
        create: vi.fn().mockResolvedValue({ id: 88, status: 'CLOSED' }),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 3 }),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await rendicionService.verifyRendicion({
      adminId: 1,
      sellerId: 4,
      realCash: 15000,
      realChecks: 0,
      hostOrigin: 'http://localhost:3000',
    });

    expect(txSpy).toHaveBeenCalledTimes(1);
    expect(mockTx.cashDrawer.create).toHaveBeenCalledOnce();
    expect(mockTx.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { balance: { increment: 25000 } },
    });
    expect(result.difference).toBe(0);
    expect(result.verifiedReceipts).toHaveLength(2);
  });

  it('createExpense persiste el cashDrawerId resuelto automáticamente cuando no viene explícito en el body', async () => {
    let savedExpenseData: any = null;

    const mockTx: any = {
      cashDrawer: {
        findFirst: vi.fn().mockResolvedValue({ id: 19, branch: 'CONSOLIDADA', status: 'OPEN' }),
        findUnique: vi.fn().mockResolvedValue({ id: 19, branch: 'CONSOLIDADA', status: 'OPEN' }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: 500 }),
      },
      expense: {
        create: vi.fn().mockImplementation(({ data }) => {
          savedExpenseData = data;
          return Promise.resolve({ id: 77, ...data });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await expenseService.createExpense({
      userId: 1,
      amount: 4500,
      categoryId: 2,
      description: 'Compra de resmas A4',
      paymentMethod: PaymentMethod.CASH,
      cashDrawerId: null, // omitido en request
    });

    expect(savedExpenseData.cashDrawerId).toBe(19);
    expect(savedExpenseData.transactionId).toBe(500);
  });
});
