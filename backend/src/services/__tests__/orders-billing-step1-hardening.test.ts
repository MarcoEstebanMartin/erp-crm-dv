import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BillingType, CreditNoteStatus, InvoiceType, OrderStatus, Role, SalesChannel } from '@prisma/client';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    order: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    persona: { findUnique: vi.fn() },
    product: { findMany: vi.fn() },
    discountRule: { findMany: vi.fn() },
    splitBillingConfig: { findMany: vi.fn() },
    perceptionType: { findUnique: vi.fn() },
    weeklyPromo: { findMany: vi.fn() },
    creditNote: { findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    systemSetting: { findUnique: vi.fn() },
  },
}));

vi.mock('../../utils/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../orders/web-order-status-bridge.service', () => ({
  notifyWebOrderStatusForErpOrder: vi.fn(),
}));

import prisma from '../../utils/prisma';
import * as afipService from '../afip.service';
import { OrderScaleService } from '../orders/order-scale.service';
import { OrderBillingService } from '../orders/order-billing.service';
import { executeDeferredCaeRequest } from '../orders/order-cae-deferred.helper';
import { validateCreditNoteAgainstLinkedOrder } from '../credit-notes/credit-note-stock.helper';
import { DirectInvoiceService } from '../directInvoice.service';

describe('Paso 1 — Blindaje de Stock de Lotes FEFO, Transacciones y AFIP/ARCA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.weeklyPromo.findMany as any).mockResolvedValue([]);
    (prisma.perceptionType.findUnique as any).mockResolvedValue(null);
    (prisma.splitBillingConfig.findMany as any).mockResolvedValue([]);
    (prisma.discountRule.findMany as any).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('OrderScaleService.confirmArmado asigna lotes FEFO en split de 2 lotes sin inflar Kardex y evita doble descuento', async () => {
    const lotUpdates: Array<{ id: number; decrement?: number; increment?: number }> = [];
    const createdItemLots: Array<{ orderItemId: number; productLotId: number; quantity: number }> = [];
    const updatedMovements: Array<any> = [];
    const createdMovements: Array<any> = [];

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 501,
          sellerId: 7,
          status: OrderStatus.PENDING,
          totalAmount: 10000,
          items: [
            {
              id: 801,
              productId: 10,
              quantity: 5,
              weight: 5,
              unitPrice: 2000,
              subtotal: 10000,
              orderItemLots: [],
              product: { id: 10, name: 'Queso Cremoso', isPesable: true, approximateWeight: 1 },
            },
            {
              id: 802,
              productId: 11,
              quantity: 2,
              weight: null,
              unitPrice: 1500,
              subtotal: 3000,
              orderItemLots: [{ id: 99, productLotId: 201, quantity: 2 }],
              product: { id: 11, name: 'Manteca', isPesable: false },
            },
          ],
        }),
        update: vi.fn().mockImplementation(async ({ data }: any) => ({
          id: 501,
          ...data,
          items: [],
          persona: { id: 1, name: 'Cliente' },
        })),
      },
      product: { update: vi.fn().mockResolvedValue({}) },
      orderItem: { update: vi.fn().mockResolvedValue({}) },
      productLot: {
        findMany: vi.fn().mockResolvedValue([
          { id: 102, lotNumber: 'L-B', expirationDate: '2026-12-10T00:00:00Z', location: 'A-1', stock: 4 },
          { id: 101, lotNumber: 'L-A', expirationDate: '2026-12-01T00:00:00Z', location: 'S/U', stock: 3 },
        ]),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => {
          lotUpdates.push({ id: where.id, ...data.stock });
          return {};
        }),
      },
      orderItemLot: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          createdItemLots.push(data);
          return { id: 1, ...data };
        }),
      },
      stockMovement: {
        findFirst: vi.fn().mockResolvedValue({ id: 700, productId: 10, quantity: -5, referenceId: 'ORDER-501', productLotId: null }),
        update: vi.fn().mockImplementation(async (arg: any) => {
          updatedMovements.push(arg);
          return {};
        }),
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          createdMovements.push(data);
          return { id: 701, ...data };
        }),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await OrderScaleService.confirmArmado(501, [{ orderItemId: 801, weight: 4.8 }]);

    // Producto 10 necesitaba 5u y se repartió FEFO: 3u del lote 101 (más próximo + S/U) y 2u del lote 102
    expect(lotUpdates).toEqual([
      { id: 101, decrement: 3 },
      { id: 102, decrement: 2 },
    ]);
    // Producto 11 ya tenía orderItemLots y no cambió cantidad -> NO se volvió a descontar lote
    expect(createdItemLots).toEqual([
      { orderItemId: 801, productLotId: 101, quantity: 3 },
      { orderItemId: 801, productLotId: 102, quantity: 2 },
    ]);
    // Kardex sin inflación: actualiza ORDER-501 original a -3u (lote 101) y crea solo -2u adicionales (lote 102) => suma = -5u
    expect(updatedMovements).toHaveLength(1);
    expect(updatedMovements[0].data.quantity).toBe(-3);
    expect(updatedMovements[0].data.productLotId).toBe(101);
    expect(createdMovements).toHaveLength(1);
    expect(createdMovements[0].quantity).toBe(-2);
    expect(createdMovements[0].productLotId).toBe(102);
  });

  it('OrderBillingService.invoiceOrder no dispara falsa "ALERTA AFIP" al fallar una factura INTERNAL', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 601,
      personaId: 1,
      sellerId: 2,
      status: OrderStatus.PREPARED,
      totalAmount: 10000,
      persona: { id: 1, name: 'Cliente X', cuit: '', priceList: 'A', outstandingBalance: 0 },
      items: [
        {
          id: 901,
          productId: 20,
          quantity: 2,
          weight: null,
          unitPrice: 5000,
          subtotal: 10000,
          orderItemLots: [{ id: 1, productLotId: 50, quantity: 2 }],
          product: { id: 20, name: 'Dulce', rubroId: 1, costPrice: 3000, listPrice: 5000, isPesable: false },
        },
      ],
    });
    (prisma.product.findMany as any).mockResolvedValue([
      { id: 20, name: 'Dulce', rubroId: 1, costPrice: 3000, listPrice: 5000, isPesable: false },
    ]);
    (prisma.$transaction as any).mockRejectedValue(new Error('DB deadlock simulado'));

    await expect(
      OrderBillingService.invoiceOrder({
        orderId: 601,
        adminId: 1,
        userRole: Role.ADMIN,
        billingType: BillingType.INTERNAL,
      }),
    ).rejects.toThrow('DB deadlock simulado');

    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('OrderBillingService.invoiceOrder en Factura B guarda isFacturaAOfficial=false y retorna order post-tx actualizado', async () => {
    const orderUpdateCalls: any[] = [];
    const ledgerCalls: any[] = [];

    (prisma.order.update as any).mockResolvedValue({});
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 602,
      personaId: 2,
      sellerId: 2,
      status: OrderStatus.PREPARED,
      totalAmount: 12105,
      persona: {
        id: 2,
        name: 'Consumidor Final',
        cuit: '30123456',
        iibbAliquot: 3,
        priceList: 'A',
        outstandingBalance: 0,
      },
      items: [
        {
          id: 902,
          productId: 21,
          quantity: 1,
          weight: null,
          unitPrice: 12105,
          subtotal: 12105,
          orderItemLots: [{ id: 2, productLotId: 51, quantity: 1 }],
          product: { id: 21, name: 'Queso Sardo', rubroId: 1, costPrice: 8000, listPrice: 12105, isPesable: false },
        },
      ],
    });
    (prisma.product.findMany as any).mockResolvedValue([
      { id: 21, name: 'Queso Sardo', rubroId: 1, costPrice: 8000, listPrice: 12105, isPesable: false },
    ]);

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUnique: vi.fn().mockResolvedValue({ status: OrderStatus.PREPARED }),
        update: vi.fn().mockImplementation(async ({ data }: any) => {
          orderUpdateCalls.push(data);
          return {
            id: 602,
            ...data,
            persona: { id: 2, name: 'Consumidor Final' },
            items: [],
          };
        }),
      },
      orderItem: { update: vi.fn().mockResolvedValue({}) },
      persona: { update: vi.fn().mockResolvedValue({ outstandingBalance: 12105 }) },
      accountLedger: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          ledgerCalls.push(data);
          return data;
        }),
      },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const res = await OrderBillingService.invoiceOrder({
      orderId: 602,
      adminId: 1,
      userRole: Role.ADMIN,
      billingType: BillingType.OFFICIAL,
    });

    expect(res.order.status).toBe(OrderStatus.DELIVERED);
    expect(res.order.cae).toBeTruthy();
    // Factura B (DNI 8 dígitos): netAmount y taxAmount redondeados a pesos enteros (isFacturaAOfficial=false) y cero percepciones
    expect(orderUpdateCalls[0].invoiceType).toBe(InvoiceType.FACTURA_B);
    expect(orderUpdateCalls[0].netAmount).toBe(10004);
    expect(orderUpdateCalls[0].taxAmount).toBe(2101);
    expect(orderUpdateCalls[0].percepcionAmount).toBe(0);
    expect(ledgerCalls).toHaveLength(1);
  });

  it('executeDeferredCaeRequest envía DocTipo 99 / DocNro "0" para Consumidor Final y omite desglose A en Factura B', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 700,
      billingType: BillingType.OFFICIAL,
      invoiceType: InvoiceType.FACTURA_B,
      cae: null,
      totalAmount: 15000,
      netAmount: 12397,
      taxAmount: 2603,
      percepcionAmount: 0,
      percepcionIvaAmount: 0,
      persona: { id: 3, name: 'Cliente CF', cuit: '' },
    });
    (prisma.order.update as any).mockResolvedValue({ id: 700, cae: '9999123456781', invoiceNumber: '00001-00000010' });

    const afipSpy = vi.spyOn(afipService, 'emitirFacturaAFIP').mockResolvedValue({
      invoiceNumber: '00001-00000010',
      cae: '9999123456781',
      caeDueDate: new Date('2026-11-24T00:00:00Z'),
      puntoVenta: 1,
    });

    await executeDeferredCaeRequest(700);

    expect(afipSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        clientDocType: 99,
        clientCuit: '0',
        invoiceType: 'B',
        total: 15000,
        neto: undefined,
        iva: undefined,
      }),
    );
  });

  it('validateCreditNoteAgainstLinkedOrder bloquea excesos monetarios acumulados y de unidades devueltas por SKU', async () => {
    const linkedOrder = {
      id: 800,
      personaId: 10,
      status: OrderStatus.DELIVERED,
      billingType: BillingType.OFFICIAL,
      cae: '74123456789012',
      totalAmount: 10000,
      items: [{ productId: 5, quantity: 4 }],
    };

    const dbClient = {
      creditNote: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            status: CreditNoteStatus.APPROVED,
            reason: 'DEVOLUCION',
            totalAmount: 6000,
            items: [{ productId: 5, quantity: 3 }],
          },
        ]),
      },
    };

    // Excede total monetario (6000 previo + 4500 nuevo > 10000)
    await expect(
      validateCreditNoteAgainstLinkedOrder(dbClient, {
        orderId: 800,
        personaId: 10,
        reason: 'DESCUENTO',
        newLines: [{ productId: 5, quantity: 1, weight: null }],
        newTotalAmount: 4500,
        preloadedLinkedOrder: linkedOrder,
      }),
    ).rejects.toThrow(/supera el total del comprobante original/i);

    // Excede cantidad por SKU en devolución (3 previas + 2 nuevas > 4 facturadas)
    await expect(
      validateCreditNoteAgainstLinkedOrder(dbClient, {
        orderId: 800,
        personaId: 10,
        reason: 'DEVOLUCION',
        newLines: [{ productId: 5, quantity: 2, weight: null }],
        newTotalAmount: 3000,
        preloadedLinkedOrder: linkedOrder,
      }),
    ).rejects.toThrow(/supera las unidades facturadas pendientes de devolución/i);
  });

  it('DirectInvoiceService.createDirectInvoice aplica DiscountRule por especificidad dentro de $transaction con trazabilidad de lotes', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue({
      id: 40,
      name: 'Mayorista Norte',
      cuit: '',
      priceList: 'A',
      discount: 0,
      creditLimit: 0,
      outstandingBalance: 0,
      maxUnpaidInvoices: 0,
      iibbAliquot: 0,
    });
    (prisma.product.findMany as any).mockResolvedValue([
      { id: 30, name: 'Queso Crema', rubroId: 9, costPrice: 1000, listPrice: 2000, stock: 50, isPesable: false },
    ]);
    (prisma.discountRule.findMany as any).mockResolvedValue([
      { id: 1, name: 'Regla 10% Cliente Producto', personaId: 40, productId: 30, rubroId: null, priceList: null, billingType: null, discount: 10 },
    ]);

    const createdItems: any[] = [];
    const createdMovements: any[] = [];

    (prisma.order.update as any).mockResolvedValue({});

    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 30, name: 'Queso Crema', stock: 50 }]),
        update: vi.fn().mockResolvedValue({ stock: 47 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: 950, ...data })),
        update: vi.fn().mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data })),
        findUnique: vi.fn().mockResolvedValue({ id: 950, totalAmount: 5400, items: [], persona: { id: 40 } }),
      },
      orderItem: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          createdItems.push(data);
          return { id: 990, ...data };
        }),
      },
      productLot: {
        findMany: vi.fn().mockResolvedValue([{ id: 301, lotNumber: 'L-1', expirationDate: '2026-12-31', location: 'S/U', stock: 20 }]),
        update: vi.fn().mockResolvedValue({}),
      },
      orderItemLot: { create: vi.fn().mockResolvedValue({}) },
      stockMovement: {
        create: vi.fn().mockImplementation(async ({ data }: any) => {
          createdMovements.push(data);
          return data;
        }),
      },
      persona: { update: vi.fn().mockResolvedValue({ outstandingBalance: 5400 }) },
      accountLedger: { create: vi.fn().mockResolvedValue({}) },
    };

    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await DirectInvoiceService.createDirectInvoice({
      adminId: 1,
      userRole: Role.ADMIN,
      personaId: 40,
      billingType: BillingType.INTERNAL,
      salesChannel: SalesChannel.MOSTRADOR,
      items: [{ productId: 30, quantity: 3 }],
    });

    // 2000 con 10% de DiscountRule => unitPrice 1800, 3u => 5400
    expect(createdItems[0].unitPrice).toBe(1800);
    expect(createdItems[0].discountPctSnapshot).toBe(10);
    expect(createdItems[0].subtotal).toBe(5400);
    expect(createdMovements[0].productLotId).toBe(301);
  });
});
