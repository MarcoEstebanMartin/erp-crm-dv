import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingType, CreditNoteStatus, OrderStatus, Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import { computeEligibleOrderSummary } from '../credit-notes/credit-note-eligible-orders.helper';
import { creditNoteService } from '../credit-notes/credit-note.service';
import { createCreditNoteSchema } from '../../validators/creditNote.validator';

describe('Notas de Crédito: regla ARCA (factura obligatoria) y cálculo de facturas elegibles', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rechaza en validador Zod y en servicio emitir una NC Oficial sin factura asociada (ARCA)', async () => {
    const zodResult = createCreditNoteSchema.safeParse({
      body: {
        personaId: 10,
        orderId: null,
        billingType: 'OFFICIAL',
        reason: 'DEVOLUCION',
        items: [{ productId: 1, quantity: 1, unitPrice: 5000 }],
      },
    });
    expect(zodResult.success).toBe(false);

    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 10,
      name: 'Cliente Oficial',
      cuit: '30-71112222-3',
    } as any);

    await expect(
      creditNoteService.createCreditNote({
        userId: 1,
        userRole: Role.ADMIN,
        personaId: 10,
        orderId: null,
        billingType: BillingType.OFFICIAL,
        reason: 'DEVOLUCION',
        items: [{ productId: 1, quantity: 1, unitPrice: 5000 }],
      }),
    ).rejects.toThrow(/obligatorio seleccionar una factura oficial/i);
  });

  it('permite en validador Zod emitir una NC Interna libre sin factura asociada', () => {
    const zodResult = createCreditNoteSchema.safeParse({
      body: {
        personaId: 10,
        orderId: null,
        billingType: 'INTERNAL',
        reason: 'DESCUENTO',
        items: [{ productId: 1, quantity: 1, unitPrice: 2500 }],
      },
    });
    expect(zodResult.success).toBe(true);
  });

  it('computeEligibleOrderSummary excluye facturas anuladas, oficiales sin CAE o 100% acreditadas', () => {
    const cancelled = computeEligibleOrderSummary(
      { id: 1, status: OrderStatus.CANCELLED, billingType: BillingType.INTERNAL, totalAmount: '10000.00', items: [] },
      [],
    );
    expect(cancelled).toBeNull();

    const officialNoCae = computeEligibleOrderSummary(
      { id: 2, status: OrderStatus.DELIVERED, billingType: BillingType.OFFICIAL, cae: null, totalAmount: '10000.00', items: [] },
      [],
    );
    expect(officialNoCae).toBeNull();

    const fullyCredited = computeEligibleOrderSummary(
      { id: 3, status: OrderStatus.DELIVERED, billingType: BillingType.OFFICIAL, cae: '74123456789012', totalAmount: '10000.00', items: [] },
      [{ status: CreditNoteStatus.APPROVED, totalAmount: '10000.00', reason: 'DEVOLUCION', items: [] }],
    );
    expect(fullyCredited).toBeNull();
  });

  it('computeEligibleOrderSummary descuenta NC parciales (aprobadas/pendientes) y cantidades ya devueltas', () => {
    const order = {
      id: 50,
      invoiceNumber: '0001-00001234',
      invoiceType: 'FACTURA_A',
      billingType: BillingType.OFFICIAL,
      cae: '74123456789012',
      createdAt: new Date('2026-11-20T12:00:00Z'),
      invoicedAt: new Date('2026-11-20T12:05:00Z'),
      status: OrderStatus.DELIVERED,
      totalAmount: '25000.00',
      items: [
        {
          productId: 100,
          quantity: 5,
          weight: null,
          unitPrice: '3000.00',
          subtotal: '15000.00',
          product: { id: 100, name: 'Queso Cremoso', sku: 'QC-01', isPesable: false, approximateWeight: 1 },
        },
        {
          productId: 200,
          quantity: 2,
          weight: null,
          unitPrice: '5000.00',
          subtotal: '10000.00',
          product: { id: 200, name: 'Jamón Cocido', sku: 'JC-01', isPesable: false, approximateWeight: 1 },
        },
      ],
    };

    const existingNotes = [
      {
        status: CreditNoteStatus.APPROVED,
        totalAmount: '6000.00',
        reason: 'DEVOLUCION',
        items: [{ productId: 100, quantity: 2 }],
      },
      {
        status: CreditNoteStatus.REJECTED,
        totalAmount: '15000.00',
        reason: 'DEVOLUCION',
        items: [{ productId: 100, quantity: 5 }],
      },
      {
        status: CreditNoteStatus.PENDING_APPROVAL,
        totalAmount: '2000.00',
        reason: 'DESCUENTO',
        items: [{ productId: 200, quantity: 1 }],
      },
    ];

    const summary = computeEligibleOrderSummary(order, existingNotes);
    expect(summary).not.toBeNull();
    expect(summary!.totalAmount).toBe(25000);
    expect(summary!.alreadyCreditedAmount).toBe(8000);
    expect(summary!.remainingCreditableAmount).toBe(17000);
    expect(summary!.items[0]).toMatchObject({
      productId: 100,
      orderQuantity: 5,
      alreadyReturnedQuantity: 2,
      remainingReturnableQuantity: 3,
      unitPrice: 3000,
    });
    // La NC pendiente fue DESCUENTO (no DEVOLUCION), así que las 2 unidades siguen devolvibles
    expect(summary!.items[1]).toMatchObject({
      productId: 200,
      orderQuantity: 2,
      alreadyReturnedQuantity: 0,
      remainingReturnableQuantity: 2,
      unitPrice: 5000,
    });
  });
});
