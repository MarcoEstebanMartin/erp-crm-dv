import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreditNoteStatus, Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import * as auditModule from '../../utils/audit';
import { creditNoteService } from '../credit-notes/credit-note.service';
import { purchaseOrderService } from '../purchases/purchase-order.service';
import { supplierInvoiceService } from '../billing/supplier-invoice.service';

describe('Servicios de Notas de Crédito, Compras y Facturas de Proveedor (ACID + Secuencias)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
  });

  it('createCreditNote (ADMIN Interna) numera con NCI-{movementId}, devuelve lotes proporcionalmente y baja deuda en 1 transacción', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 20,
      name: 'Autoservicio Belgrano',
      cuit: '30-71112222-3',
    } as any);
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
      id: 99,
      billingType: 'INTERNAL',
    } as any);
    vi.spyOn(prisma.product, 'findUnique').mockResolvedValue({
      id: 5,
      isPesable: false,
      approximateWeight: 1,
    } as any);

    const lotUpdates: any[] = [];
    let updatedNumber: string | null = null;

    const mockTx: any = {
      creditNote: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 70, movementId: 318, ...data }),
        ),
        update: vi.fn().mockImplementation(({ data }) => {
          updatedNumber = data.creditNoteNumber;
          return Promise.resolve({ id: 70, movementId: 318, ...data });
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: 70,
            movementId: 318,
            creditNoteNumber: updatedNumber,
            status: CreditNoteStatus.APPROVED,
            totalAmount: 6000,
          }),
        ),
      },
      creditNoteItem: { create: vi.fn().mockResolvedValue({}) },
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 5 }),
        update: vi.fn().mockResolvedValue({}),
      },
      orderItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: 501,
          orderItemLots: [{ productLotId: 11, quantity: 3 }],
        }),
      },
      productLot: {
        update: vi.fn().mockImplementation((args) => {
          lotUpdates.push(args);
          return Promise.resolve({});
        }),
      },
      stockMovement: { create: vi.fn().mockResolvedValue({}) },
      persona: { update: vi.fn().mockResolvedValue({ outstandingBalance: '14000.00' }) },
      accountLedger: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    };

    const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await creditNoteService.createCreditNote({
      userId: 1,
      userRole: Role.ADMIN,
      personaId: 20,
      orderId: 99,
      reason: 'DEVOLUCION',
      items: [{ productId: 5, quantity: 2, unitPrice: 3000 }],
    });

    expect(txSpy).toHaveBeenCalledTimes(1);
    expect(result.creditNoteNumber).toBe('NCI-00318');
    expect(lotUpdates).toEqual([{ where: { id: 11 }, data: { stock: { increment: 2 } } }]);
    expect(mockTx.persona.update).toHaveBeenCalledWith({
      where: { id: 20 },
      data: { outstandingBalance: { decrement: 6000 } },
    });
    expect(mockTx.accountLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personaId: 20,
          entryType: 'CREDIT',
          sourceType: 'CREDIT_NOTE',
          amount: 6000,
          balanceAfter: 14000,
          creditNoteId: 70,
        }),
      }),
    );
  });

  it('createPurchaseOrder envía únicamente columnas válidas de PurchaseOrderItem y preserva decimales de costo', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({ id: 8, isProvider: true } as any);

    let capturedCreateArgs: any = null;
    const mockTx: any = {
      purchaseOrder: {
        create: vi.fn().mockImplementation((args) => {
          capturedCreateArgs = args;
          return Promise.resolve({ id: 12, ...args.data });
        }),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await purchaseOrderService.createPurchaseOrder({
      userId: 1,
      personaId: 8,
      items: [{ productId: 3, quantity: 4, costPrice: 1250.75 }],
    });

    const createdItem = capturedCreateArgs.data.items.create[0];
    expect(createdItem).toEqual({
      productId: 3,
      quantity: 4,
      costPrice: 1250.75,
      subtotal: 5003,
    });
    expect(createdItem.productIdRef).toBeUndefined();
  });

  it('deleteSupplierInvoice bloquea facturas pagadas y revierte lote exacto por productLotId cuando está pendiente', async () => {
    vi.spyOn(prisma.supplierInvoice, 'findUnique').mockResolvedValueOnce({
      id: 44,
      personaId: 8,
      invoiceNumber: '0001-00009999',
      status: 'PARTIALLY_PAID',
      paidAmount: '5000.00',
      totalAmount: '20000.00',
    } as any);

    await expect(
      supplierInvoiceService.deleteSupplierInvoice({ userId: 1, invoiceId: 44 }),
    ).rejects.toThrow(/pagada parcialmente/i);

    vi.spyOn(prisma.supplierInvoice, 'findUnique').mockResolvedValueOnce({
      id: 45,
      personaId: 8,
      invoiceNumber: '0001-00010000',
      status: 'PENDING',
      paidAmount: '0.00',
      totalAmount: '24200.00',
    } as any);

    const mockTx: any = {
      persona: { update: vi.fn().mockResolvedValue({ outstandingBalance: '0.00' }) },
      accountLedger: { create: vi.fn().mockResolvedValue({ id: 2 }) },
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([
          { id: 800, productId: 3, quantity: 10, productLotId: 77 },
        ]),
        delete: vi.fn().mockResolvedValue({}),
      },
      product: { update: vi.fn().mockResolvedValue({}) },
      productLot: {
        findUnique: vi.fn().mockResolvedValue({ id: 77 }),
        update: vi.fn().mockResolvedValue({}),
      },
      taxWithholding: { deleteMany: vi.fn().mockResolvedValue({}) },
      supplierInvoice: { delete: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await supplierInvoiceService.deleteSupplierInvoice({ userId: 1, invoiceId: 45 });

    expect(mockTx.persona.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { outstandingBalance: { increment: 24200 } },
    });
    expect(mockTx.accountLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          personaId: 8,
          entryType: 'DEBIT',
          sourceType: 'SUPPLIER_INVOICE_REVERSAL',
          amount: 24200,
          balanceAfter: 0,
        }),
      }),
    );
    expect(mockTx.productLot.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { stock: { decrement: 10 } },
    });
    expect(mockTx.supplierInvoice.delete).toHaveBeenCalledWith({ where: { id: 45 } });
  });
});
