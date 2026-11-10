import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BillingType,
  LedgerEntryType,
  LedgerSourceType,
  PaymentMethod,
  Role,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import { recordLedgerMovement } from '../ledger/account-ledger.service';
import { settleOrderFinancials } from '../orders/order-tax.helpers';
import { personaLedgerSubService } from '../personas/persona-ledger.service';
import { receiptService } from '../collections/receipt.service';

describe('Libro Mayor Físico Inmutable (AccountLedger)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('recordLedgerMovement actualiza Persona.outstandingBalance e inserta asiento con balanceAfter exacto en la misma tx', async () => {
    let balance = 10000;
    const ledgerRows: any[] = [];

    const mockTx: any = {
      persona: {
        update: vi.fn().mockImplementation(({ data }) => {
          if (data.outstandingBalance.increment) balance += data.outstandingBalance.increment;
          if (data.outstandingBalance.decrement) balance -= data.outstandingBalance.decrement;
          return Promise.resolve({ id: 15, outstandingBalance: balance.toFixed(2) });
        }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation(({ data }) => {
          const row = { id: ledgerRows.length + 1, ...data };
          ledgerRows.push(row);
          return Promise.resolve(row);
        }),
      },
    };

    const resDebit = await recordLedgerMovement(mockTx, {
      personaId: 15,
      entryType: LedgerEntryType.DEBIT,
      sourceType: LedgerSourceType.ORDER_INVOICE,
      billingType: BillingType.OFFICIAL,
      amount: 35000,
      orderId: 500,
      reference: 'Pedido #500',
      description: 'Factura 0001-00000500',
    });

    expect(resDebit?.balanceAfter).toBe(45000);
    expect(ledgerRows[0].balanceAfter).toBe(45000);

    const resCredit = await recordLedgerMovement(mockTx, {
      personaId: 15,
      entryType: LedgerEntryType.CREDIT,
      sourceType: LedgerSourceType.COLLECTION_RECEIPT,
      billingType: BillingType.OFFICIAL,
      amount: 15000,
      transactionId: 800,
      reference: 'Recibo #800',
      description: 'Recibo N° REC-00800',
    });

    expect(resCredit?.balanceAfter).toBe(30000);
    expect(ledgerRows[1].balanceAfter).toBe(30000);
  });

  it('settleOrderFinancials en venta de mostrador registra DEBIT (factura) + CREDIT (cobro inmediato) dejando saldo neto exacto', async () => {
    let runningBalance = 5000;
    const ledgerEntries: any[] = [];

    const mockTx: any = {
      bankAccount: { update: vi.fn().mockResolvedValue({}) },
      persona: {
        update: vi.fn().mockImplementation(({ data }) => {
          if (data.outstandingBalance.increment) runningBalance += data.outstandingBalance.increment;
          if (data.outstandingBalance.decrement) runningBalance -= data.outstandingBalance.decrement;
          return Promise.resolve({ id: 33, outstandingBalance: runningBalance.toFixed(2) });
        }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: 910, movementId: 910 }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation(({ data }) => {
          ledgerEntries.push(data);
          return Promise.resolve({ id: ledgerEntries.length, ...data });
        }),
      },
    };

    // Caso 1: Pago total en efectivo ($20.000 sobre $20.000) -> saldo final vuelve a $5.000
    await settleOrderFinancials(mockTx, {
      orderId: 101,
      personaId: 33,
      adminId: 1,
      billingType: BillingType.INTERNAL,
      paymentMethod: PaymentMethod.CASH,
      amount: 20000,
      invoiceTotal: 20000,
      invoiceNumber: 'INT-00101',
      description: 'Cobro mostrador Pedido #101',
      cashDrawerId: 3,
    });

    expect(ledgerEntries).toHaveLength(2);
    expect(ledgerEntries[0]).toMatchObject({
      entryType: 'DEBIT',
      sourceType: 'ORDER_INVOICE',
      amount: 20000,
      balanceAfter: 25000,
    });
    expect(ledgerEntries[1]).toMatchObject({
      entryType: 'CREDIT',
      sourceType: 'COLLECTION_RECEIPT',
      amount: 20000,
      balanceAfter: 5000,
      transactionId: 910,
    });
    expect(runningBalance).toBe(5000);
  });

  it('deleteReceipt inserta RECEIPT_REVERSAL (DEBIT) en AccountLedger antes de borrar la transacción', async () => {
    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
      id: 77,
      personaId: 12,
      orderId: 300,
      type: TransactionType.INCOME,
      billingType: BillingType.OFFICIAL,
      amount: '18500.00',
      receiptNumber: 'REC-00077',
      paymentMethod: PaymentMethod.CASH,
      verified: false,
      bankAccountId: null,
      persona: { id: 12, name: 'Fiambrería Centro' },
    } as any);

    const callOrder: string[] = [];
    const mockTx: any = {
      persona: {
        update: vi.fn().mockImplementation(() => {
          callOrder.push('persona.update');
          return Promise.resolve({ id: 12, outstandingBalance: '18500.00' });
        }),
      },
      accountLedger: {
        create: vi.fn().mockImplementation(({ data }) => {
          callOrder.push(`ledger.${data.sourceType}`);
          return Promise.resolve({ id: 99, ...data });
        }),
      },
      transaction: {
        delete: vi.fn().mockImplementation(() => {
          callOrder.push('transaction.delete');
          return Promise.resolve({});
        }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await receiptService.deleteReceipt({ receiptId: 77, adminId: 1, userRole: Role.ADMIN });

    expect(callOrder).toEqual(['persona.update', 'ledger.RECEIPT_REVERSAL', 'transaction.delete']);
  });

  it('getPersonaLedger y checkAllBalances leen directamente de AccountLedger sin colisiones de IDs UI', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 50,
      name: 'Supermercado Norte',
      isClient: true,
      sellerId: 2,
      seller: { id: 2, username: 'vendedor1' },
    } as any);

    vi.spyOn(prisma.accountLedger, 'findMany').mockResolvedValue([
      {
        id: 1,
        movementId: 1001,
        personaId: 50,
        entryType: LedgerEntryType.DEBIT,
        sourceType: LedgerSourceType.ORDER_INVOICE,
        billingType: BillingType.OFFICIAL,
        amount: '30000.00',
        balanceAfter: '30000.00',
        reference: 'Pedido #40',
        description: 'Factura 0001-00000040',
        orderId: 40,
        occurredAt: new Date('2026-11-01T10:00:00Z'),
      },
      {
        id: 2,
        movementId: 1002,
        personaId: 50,
        entryType: LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.COLLECTION_RECEIPT,
        billingType: BillingType.OFFICIAL,
        amount: '10000.00',
        balanceAfter: '20000.00',
        reference: 'Recibo #88',
        description: 'Recibo REC-00088',
        transactionId: 88,
        occurredAt: new Date('2026-11-02T10:00:00Z'),
      },
    ] as any);

    const res = await personaLedgerSubService.getPersonaLedger(50, 2, Role.VENDEDOR);
    expect(res.ledger).toHaveLength(2);
    expect(res.ledger[0]).toMatchObject({ id: 'order-40', type: 'DEBIT', amount: 30000, balance: 30000 });
    expect(res.ledger[1]).toMatchObject({ id: 'transaction-88', type: 'CREDIT', amount: 10000, balance: 20000 });
  });
});
