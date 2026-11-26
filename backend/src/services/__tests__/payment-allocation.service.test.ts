import { describe, expect, it, vi } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { PaymentAllocationService } from '../finance/payment-allocation.service';

describe('PaymentAllocationService', () => {
  const service = new PaymentAllocationService();

  it('allocateTransactionToOrders imputa en FIFO y guarda createMany', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const mockDb: any = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 87,
            invoiceNumber: '00001-00000005',
            totalAmount: { toString: () => '30692' },
            paymentAllocations: [],
            creditNotes: [],
          },
          {
            id: 89,
            invoiceNumber: '00001-00000007',
            totalAmount: { toString: () => '30692' },
            paymentAllocations: [],
            creditNotes: [],
          },
        ]),
      },
      paymentAllocation: { createMany },
      transaction: { findMany: vi.fn() },
    };

    const res = await service.allocateTransactionToOrders(mockDb, {
      transactionId: 500,
      personaId: 9104,
      amount: 50000,
    });

    expect(res.totalAllocated).toBe(50000);
    expect(res.unallocatedCredit).toBe(0);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { transactionId: 500, orderId: 87, amount: 30692 },
        { transactionId: 500, orderId: 89, amount: 19308 },
      ],
      skipDuplicates: true,
    });
  });

  it('applyAvailableCreditToOrder aplica automáticamente saldo a favor previo a nueva factura', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockDb: any = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 120,
          status: OrderStatus.DELIVERED,
          totalAmount: { toString: () => '40000' },
          paymentAllocations: [],
          creditNotes: [],
        }),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 301,
            amount: { toString: () => '50000' },
            paymentAllocations: [{ amount: { toString: () => '35000' } }], // $15.000 a favor
          },
        ]),
      },
      paymentAllocation: { createMany },
    };

    const res = await service.applyAvailableCreditToOrder(mockDb, {
      orderId: 120,
      personaId: 9104,
    });

    expect(res.totalApplied).toBe(15000);
    expect(res.remainingOrderPending).toBe(25000);
    expect(res.orderStatus).toBe('PARTIAL');
    expect(createMany).toHaveBeenCalledWith({
      data: [{ transactionId: 301, orderId: 120, amount: 15000 }],
      skipDuplicates: true,
    });
  });

  it('getOrderPendingAmount devuelve 0 cuando la factura ya está 100% imputada', async () => {
    const mockDb: any = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 81,
          totalAmount: { toString: () => '30692' },
          paymentAllocations: [{ amount: { toString: () => '30692' } }],
          creditNotes: [],
        }),
      },
      paymentAllocation: {},
      transaction: {},
    };

    const pending = await service.getOrderPendingAmount(81, mockDb);
    expect(pending).toBe(0);
  });

  it('getClientPendingInvoicesWithAllocations devuelve solo pendientes reales y saldo a favor', async () => {
    const mockDb: any = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 87,
            invoiceNumber: '00001-00000005',
            billingType: 'OFFICIAL',
            invoiceType: 'FACTURA_B',
            totalAmount: { toString: () => '30692' },
            paymentAllocations: [{ amount: { toString: () => '30692' } }],
            creditNotes: [],
            createdAt: new Date('2026-11-16'),
          },
          {
            id: 91,
            invoiceNumber: 'INT-00091',
            billingType: 'INTERNAL',
            invoiceType: 'REMITO_X',
            totalAmount: { toString: () => '44624' },
            paymentAllocations: [{ amount: { toString: () => '25480' } }],
            creditNotes: [],
            createdAt: new Date('2026-11-20'),
          },
          {
            id: 84,
            invoiceNumber: '00001-00000009',
            billingType: 'OFFICIAL',
            invoiceType: 'FACTURA_B',
            totalAmount: { toString: () => '30692' },
            paymentAllocations: [],
            creditNotes: [],
            createdAt: new Date('2026-11-20'),
          },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 900,
            amount: { toString: () => '30692' },
            paymentAllocations: [{ amount: { toString: () => '30692' } }],
          },
        ]),
      },
      paymentAllocation: {},
    };

    const result = await service.getClientPendingInvoicesWithAllocations(9104, mockDb);
    expect(result.invoices).toHaveLength(2);
    expect(result.invoices[0]).toMatchObject({
      id: 91,
      invoiceNumber: 'INT-00091',
      pendingAmount: 19144,
      status: 'PARTIAL',
    });
    expect(result.invoices[1]).toMatchObject({
      id: 84,
      invoiceNumber: '00001-00000009',
      pendingAmount: 30692,
      status: 'PENDING',
    });
    expect(result.totalPendingOnInvoices).toBe(49836);
    expect(result.totalAvailableCredit).toBe(0);
    expect(result.netBalance).toBe(49836);
  });

  it('applyAvailableCreditToOrder no aplica como saldo a favor un cobro que canceló Saldo inicial (OPENING_BALANCE)', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const mockDb: any = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 3,
          status: OrderStatus.DELIVERED,
          totalAmount: { toString: () => '100000' },
          paymentAllocations: [],
          creditNotes: [],
        }),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 700,
            amount: { toString: () => '231321' },
            paymentAllocations: [], // Cubrió Saldo inicial sin Order
          },
        ]),
      },
      accountLedger: {
        findMany: vi.fn().mockResolvedValue([
          {
            entryType: 'DEBIT',
            transactionId: null,
            amount: { toString: () => '231321' },
          },
        ]),
      },
      paymentAllocation: { createMany },
    };

    const res = await service.applyAvailableCreditToOrder(mockDb, {
      orderId: 3,
      personaId: 10838,
    });

    expect(res.totalApplied).toBe(0);
    expect(res.remainingOrderPending).toBe(100000);
    expect(res.orderStatus).toBe('PENDING');
    expect(createMany).not.toHaveBeenCalled();
  });
});
