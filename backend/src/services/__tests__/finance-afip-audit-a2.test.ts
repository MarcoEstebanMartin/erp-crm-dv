import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BillingType,
  CreditNoteStatus,
  InvoiceType,
  OrderStatus,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import * as afipService from '../afip.service';
import * as auditModule from '../../utils/audit';
import { routeSettlementService } from '../logistics/route-settlement.service';
import { prepareInvoiceSplitItems } from '../orders/order-billing.helpers';
import { executeDeferredCaeRequest } from '../orders/order-cae-deferred.helper';
import { creditNoteApprovalService } from '../credit-notes/credit-note-approval.service';

describe('Paso A2 — Blindaje Finanzas y AFIP (Reparto/IVA, Split Pesables y Locks de CAE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
  });

  it('settleDeliveryRoute clasifica DNI de 8 dígitos como FACTURA_B (docType 96) y persiste invoicedAt, netAmount y taxAmount', async () => {
    vi.spyOn(prisma.deliveryRoute, 'findUnique').mockResolvedValue({
      id: 91,
      driverName: 'Gemini Reparto',
      status: 'IN_TRANSIT',
      orders: [
        {
          id: 501,
          personaId: 33,
          status: OrderStatus.PREPARED,
          billingType: BillingType.OFFICIAL,
          totalAmount: '12100.00',
          invoiceNumber: null,
          persona: {
            id: 33,
            name: 'Cliente DNI',
            cuit: '34567890',
            iibbAliquot: 0,
            province: 'Buenos Aires',
            address: 'Calle 1',
          },
          transactions: [],
        },
      ],
      fieldReceipts: [],
    } as any);

    const afipSpy = vi.spyOn(afipService, 'emitirFacturaAFIP').mockResolvedValue({
      invoiceNumber: '0002-00000123',
      cae: '75123456789012',
      caeDueDate: new Date('2026-12-01'),
    } as any);

    const orderUpdateSpy = vi.fn().mockResolvedValue({});
    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      deliveryRoute: {
        findUnique: vi.fn().mockResolvedValue({ status: 'IN_TRANSIT' }),
        update: vi.fn().mockResolvedValue({ id: 91, status: 'COMPLETED' }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue({
          status: OrderStatus.PREPARED,
          deliveredAt: null,
          invoiceNumber: null,
        }),
        update: orderUpdateSpy,
      },
      persona: {
        update: vi.fn().mockResolvedValue({ id: 33, outstandingBalance: '12100.00' }),
      },
      accountLedger: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await routeSettlementService.settleDeliveryRoute({
      routeId: 91,
      userId: 1,
      settlements: [{ orderId: 501, paymentMethod: 'CREDITO' }],
    });

    expect(afipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceType: 'B',
        clientDocType: 96,
        clientCuit: '34567890',
        total: 12100,
      }),
    );

    expect(orderUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 501 },
        data: expect.objectContaining({
          invoiceType: InvoiceType.FACTURA_B,
          invoiceNumber: '0002-00000123',
          cae: '75123456789012',
          netAmount: 10000,
          taxAmount: 2100,
          invoicedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('prepareInvoiceSplitItems conserva el 100% del peso en productos pesables de 1 sola unidad', () => {
    const res = prepareInvoiceSplitItems({
      orderItems: [
        {
          id: 10,
          productId: 7,
          quantity: 1,
          weight: 4.5,
          product: { rubroId: 2 },
        },
      ],
      dbProducts: [
        {
          id: 7,
          rubroId: 2,
          isPesable: true,
          listPrice: 10000,
          costPrice: 6000,
          priceA: 10000,
        },
      ],
      persona: { priceList: 'A', discount: 0 },
      dbRules: [],
      splitConfigs: [{ rubroId: 2, percentageOfficial: 50, percentageInternal: 50 }],
      billingType: BillingType.OFFICIAL,
    });

    expect(res.oficialItemsData).toHaveLength(1);
    expect(res.internoItemsData).toHaveLength(0);
    expect(res.oficialItemsData[0].weight).toBe(4.5);
    expect(res.oficialItemsData[0].subtotal).toBe(45000);
  });

  it('executeDeferredCaeRequest rechaza pedidos CANCELLED y serializa llamadas concurrentes para evitar doble CAE', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValueOnce({
      id: 600,
      status: OrderStatus.CANCELLED,
      billingType: BillingType.OFFICIAL,
      cae: null,
      persona: { cuit: '20123456789' },
    } as any);

    await expect(executeDeferredCaeRequest(600)).rejects.toThrow(/anulado/i);

    let assignedCae: string | null = null;
    vi.spyOn(prisma.order, 'findUnique').mockImplementation((async () => ({
      id: 601,
      status: OrderStatus.DELIVERED,
      billingType: BillingType.OFFICIAL,
      invoiceType: InvoiceType.FACTURA_B,
      cae: assignedCae,
      totalAmount: 5000,
      netAmount: 4132.23,
      taxAmount: 867.77,
      percepcionAmount: 0,
      percepcionIvaAmount: 0,
      persona: { cuit: null },
    })) as any);

    const afipSpy = vi.spyOn(afipService, 'emitirFacturaAFIP').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return {
        invoiceNumber: '0002-00000999',
        cae: '75999999999999',
        caeDueDate: new Date('2026-12-10'),
      } as any;
    });

    vi.spyOn(prisma.order, 'update').mockImplementation((async () => {
      assignedCae = '75999999999999';
      return { id: 601, cae: assignedCae };
    }) as any);

    const [r1, r2] = await Promise.allSettled([
      executeDeferredCaeRequest(601),
      executeDeferredCaeRequest(601),
    ]);

    expect(afipSpy).toHaveBeenCalledTimes(1);
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('rejected');
  });

  it('approveCreditNote serializa aprobaciones concurrentes del mismo ID para evitar doble NC en AFIP', async () => {
    let status: CreditNoteStatus = CreditNoteStatus.PENDING_APPROVAL;

    vi.spyOn(prisma.creditNote, 'findUnique').mockImplementation((async () => ({
      id: 88,
      movementId: 500,
      status,
      billingType: BillingType.OFFICIAL,
      creditNoteType: 'NOTA_CREDITO_B',
      reason: 'DESCUENTO',
      personaId: 10,
      orderId: null,
      totalAmount: '1210.00',
      netAmount: '1000.00',
      taxAmount: '210.00',
      persona: { id: 10, cuit: null },
      items: [],
    })) as any);

    const afipNcSpy = vi.spyOn(afipService, 'emitirNotaCreditoAFIP').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return {
        invoiceNumber: '0002-00000044',
        cae: '75444444444444',
        caeDueDate: new Date('2026-12-15'),
      } as any;
    });

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      creditNote: {
        findUnique: vi.fn().mockImplementation(async () => ({ id: 88, status })),
        update: vi.fn().mockImplementation(async () => {
          status = CreditNoteStatus.APPROVED;
          return { id: 88, status };
        }),
      },
      persona: {
        update: vi.fn().mockResolvedValue({ id: 10, outstandingBalance: '0.00' }),
      },
      accountLedger: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const [a1, a2] = await Promise.allSettled([
      creditNoteApprovalService.approveCreditNote({ id: 88, adminId: 1 }),
      creditNoteApprovalService.approveCreditNote({ id: 88, adminId: 1 }),
    ]);

    expect(afipNcSpy).toHaveBeenCalledTimes(1);
    expect(a1.status).toBe('fulfilled');
    expect(a2.status).toBe('rejected');
  });
});
