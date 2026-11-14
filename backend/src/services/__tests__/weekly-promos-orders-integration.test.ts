import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingType, MovementType, OrderStatus, Role } from '@prisma/client';

vi.mock('../../utils/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../afip.service', () => ({
  emitirFacturaAFIP: vi.fn(),
}));

vi.mock('../store/store-auth.service', () => ({
  getTiendaOnlineUser: vi.fn().mockResolvedValue({ id: 90, username: 'tienda_online' }),
}));

vi.mock('../orders/order-tax.helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../orders/order-tax.helpers')>();
  return {
    ...actual,
    recordInvoicePerceptions: vi.fn().mockResolvedValue(undefined),
    resolveAndSettleOrderPayment: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    persona: { findUnique: vi.fn() },
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: { findMany: vi.fn() },
    weeklyPromo: { findMany: vi.fn() },
    perceptionType: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../utils/prisma';
import { OrderService } from '../order.service';
import { OrderEditService } from '../orders/order-edit.service';
import { prepareInvoiceSplitItems } from '../orders/order-billing.helpers';
import { DirectInvoiceService } from '../directInvoice.service';
import { StoreOrderService } from '../store/store-order.service';

const activePersona = {
  id: 100,
  name: 'Despensa Central',
  sellerId: 10,
  priceList: 'A',
  discount: 0,
  maxUnpaidInvoices: 0,
  creditLimit: 500000,
  outstandingBalance: 0,
  isActive: true,
  isClient: true,
  cuit: '',
  iibbAliquot: 0,
  province: 'Buenos Aires',
  address: 'Pringles 100',
};

const now = new Date();
const startPast = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const endFuture = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

describe('Integración Ofertas Semanales en Pedidos, Edición, Facturación y Tienda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OrderService: aplica BUY_X_GET_Y (3+1 Gratis), descuenta 4 de stock, crea 2 StockMovements y deduplica reintento 4G', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(activePersona);
    (prisma.order.findFirst as any).mockResolvedValue(null);

    const promo3Plus1 = {
      id: 7,
      name: '3+1 Gratis · Gaseosa Cola 2.25L',
      type: 'BUY_X_GET_Y',
      isActive: true,
      startDate: startPast,
      endDate: endFuture,
      items: [{ productId: 11, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
    };

    const gaseosa = {
      id: 11,
      sku: 'G-11',
      name: 'Gaseosa Cola 2.25L',
      listPrice: 2800,
      listPriceB: 0,
      listPriceC: 0,
      costPrice: 1800,
      stock: 15,
      minOrderQuantity: 1,
      isPesable: false,
      rubroId: 2,
      rubro: { id: 2, name: 'BEBIDAS' },
    };

    const orderItemCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const stockMovCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const productUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

    const mockTx = {
      product: { findMany: vi.fn().mockResolvedValue([gaseosa]), updateMany: productUpdateMany },
      discountRule: { findMany: vi.fn().mockResolvedValue([]) },
      weeklyPromo: { findMany: vi.fn().mockResolvedValue([promo3Plus1]) },
      order: { create: vi.fn().mockResolvedValue({ id: 501, status: OrderStatus.PENDING }) },
      orderItem: { createMany: orderItemCreateMany },
      stockMovement: { createMany: stockMovCreateMany },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    const order = await OrderService.createOrder({
      sellerId: 10,
      userRole: Role.VENDEDOR,
      personaId: 100,
      items: [{ productId: 11, quantity: 3 }],
    });

    expect(order.id).toBe(501);
    expect(mockTx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 8400 }),
      }),
    );
    expect(orderItemCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ productId: 11, quantity: 3, unitPrice: 2800, subtotal: 8400 }),
        expect.objectContaining({
          productId: 11,
          quantity: 1,
          unitPrice: 0,
          subtotal: 0,
          discountPctSnapshot: 100,
        }),
      ],
    });
    expect(productUpdateMany).toHaveBeenCalledTimes(1);
    expect(productUpdateMany).toHaveBeenCalledWith({
      where: { id: 11, stock: { gte: 4 } },
      data: { stock: { decrement: 4 } },
    });
    expect(stockMovCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ productId: 11, quantity: -3, referenceId: 'ORDER-501', type: MovementType.OUT }),
        expect.objectContaining({ productId: 11, quantity: -1, referenceId: 'ORDER-501', type: MovementType.OUT }),
      ],
    });

    // Reintento móvil dentro de 2 minutos sobre el pedido ya creado (que en DB tiene 2 renglones: 3 pago + 1 gratis)
    (prisma.order.findFirst as any).mockResolvedValue({
      id: 501,
      status: OrderStatus.PENDING,
      items: [
        { productId: 11, quantity: 3, unitPrice: 2800, discountPctSnapshot: 0 },
        { productId: 11, quantity: 1, unitPrice: 0, discountPctSnapshot: 100 },
      ],
    });
    (prisma.$transaction as any).mockClear();

    const deduplicated = await OrderService.createOrder({
      sellerId: 10,
      userRole: Role.VENDEDOR,
      personaId: 100,
      items: [{ productId: 11, quantity: 3 }],
    });
    expect(deduplicated.id).toBe(501);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('OrderService: rechaza pedido 3+1 cuando hay stock para pagar 3 pero no para entregar la 4ª sin cargo', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(activePersona);
    (prisma.order.findFirst as any).mockResolvedValue(null);

    const promo3Plus1 = {
      id: 7,
      name: '3+1 Gratis',
      type: 'BUY_X_GET_Y',
      isActive: true,
      startDate: startPast,
      endDate: endFuture,
      items: [{ productId: 11, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
    };

    const gaseosaStock3 = {
      id: 11,
      name: 'Gaseosa Cola 2.25L',
      listPrice: 2800,
      costPrice: 1800,
      stock: 3,
      minOrderQuantity: 1,
      isPesable: false,
      rubro: { id: 2, name: 'BEBIDAS' },
    };

    const mockTx = {
      product: { findMany: vi.fn().mockResolvedValue([gaseosaStock3]) },
      discountRule: { findMany: vi.fn().mockResolvedValue([]) },
      weeklyPromo: { findMany: vi.fn().mockResolvedValue([promo3Plus1]) },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      OrderService.createOrder({
        sellerId: 10,
        userRole: Role.VENDEDOR,
        personaId: 100,
        items: [{ productId: 11, quantity: 3 }],
      }),
    ).rejects.toThrow('incluyendo unidades sin cargo de promoción (Disponible: 3, Requerido: 4)');
  });

  it('OrderEditService: restaura unidades pagas + bonificadas y recalcula combo/3+1 limpiamente', async () => {
    (prisma.order.findUnique as any).mockResolvedValue({
      id: 88,
      personaId: 100,
      sellerId: 10,
      billingType: BillingType.INTERNAL,
      status: OrderStatus.PENDING,
      totalAmount: 8400,
      items: [
        { productId: 11, quantity: 3, unitPrice: 2800, discountPctSnapshot: 0 },
        { productId: 11, quantity: 1, unitPrice: 0, discountPctSnapshot: 100 },
      ],
    });

    const promo3Plus1 = {
      id: 7,
      name: '3+1 Gratis',
      type: 'BUY_X_GET_Y',
      isActive: true,
      startDate: startPast,
      endDate: endFuture,
      items: [{ productId: 11, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
    };
    const gaseosaAfterRestore = {
      id: 11,
      name: 'Gaseosa Cola 2.25L',
      listPrice: 2800,
      costPrice: 1800,
      stock: 20,
      minOrderQuantity: 1,
      isPesable: false,
      rubro: { id: 2, name: 'BEBIDAS' },
    };

    const productUpdate = vi.fn().mockResolvedValue({});
    const productUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const orderUpdate = vi.fn().mockResolvedValue({ id: 88, totalAmount: 16800, items: [] });
    const stockMovCreateMany = vi.fn().mockResolvedValue({ count: 2 });

    const mockTx = {
      product: {
        update: productUpdate,
        findMany: vi.fn().mockResolvedValue([gaseosaAfterRestore]),
        updateMany: productUpdateMany,
      },
      persona: { findUnique: vi.fn().mockResolvedValue(activePersona) },
      discountRule: { findMany: vi.fn().mockResolvedValue([]) },
      weeklyPromo: { findMany: vi.fn().mockResolvedValue([promo3Plus1]) },
      orderItem: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      order: { update: orderUpdate },
      stockMovement: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }), createMany: stockMovCreateMany },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await OrderEditService.updateOrder({
      orderId: 88,
      userId: 10,
      userRole: Role.VENDEDOR,
      items: [
        { productId: 11, quantity: 6 },
        { productId: 11, quantity: 1, isPromoBonus: true } as any,
      ],
    });

    // Restauró 3 y 1 del pedido original
    expect(productUpdate).toHaveBeenCalledTimes(2);
    // Recalculó 6 pagas + 2 sin cargo = 8 unidades descontadas
    expect(productUpdateMany).toHaveBeenCalledWith({
      where: { id: 11, stock: { gte: 8 } },
      data: { stock: { decrement: 8 } },
    });
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAmount: 16800 }),
      }),
    );
  });

  it('prepareInvoiceSplitItems: preserva precios de oferta semanal (incl. pesaje exacto) y renglón $0 sin cobrarlo', () => {
    const prodQueso = {
      id: 20,
      name: 'Queso Promo',
      listPrice: 5000,
      listPriceB: 0,
      listPriceC: 0,
      costPrice: 3200,
      isPesable: true,
      rubroId: 1,
    };
    const prodGaseosa = {
      id: 11,
      name: 'Gaseosa Cola',
      listPrice: 2800,
      listPriceB: 0,
      listPriceC: 0,
      costPrice: 1800,
      isPesable: false,
      rubroId: 2,
    };

    const result = prepareInvoiceSplitItems({
      orderItems: [
        {
          id: 1,
          productId: 20,
          quantity: 1,
          weight: 2.5,
          unitPrice: 4000,
          unitCostSnapshot: 3200,
          listPriceSnapshot: 4000,
          discountPctSnapshot: 0,
          product: prodQueso,
        },
        {
          id: 2,
          productId: 11,
          quantity: 1,
          weight: null,
          unitPrice: 0,
          unitCostSnapshot: 1800,
          listPriceSnapshot: 2800,
          discountPctSnapshot: 100,
          product: prodGaseosa,
        },
      ],
      dbProducts: [prodQueso, prodGaseosa],
      persona: activePersona,
      dbRules: [],
      splitConfigs: [],
      billingType: BillingType.INTERNAL,
    });

    expect(result.oficialItemsData[0]).toMatchObject({
      productId: 20,
      unitPrice: 4000,
      subtotal: 10000,
    });
    expect(result.oficialItemsData[1]).toMatchObject({
      productId: 11,
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
      discountPctSnapshot: 100,
    });

    const splitResult = prepareInvoiceSplitItems({
      orderItems: [
        {
          id: 2,
          productId: 11,
          quantity: 4,
          weight: null,
          unitPrice: 0,
          unitCostSnapshot: 1800,
          listPriceSnapshot: 2800,
          discountPctSnapshot: 100,
          product: prodGaseosa,
        },
      ],
      dbProducts: [prodGaseosa],
      persona: activePersona,
      dbRules: [],
      splitConfigs: [{ personaId: 100, rubroId: 2, percentageOfficial: 50, percentageInternal: 50 }],
      billingType: BillingType.OFFICIAL,
    });
    expect(splitResult.hasSplit).toBe(true);
    expect(splitResult.oficialItemsData[0]).toMatchObject({ quantity: 2, unitPrice: 0, subtotal: 0, discountPctSnapshot: 100 });
    expect(splitResult.internoItemsData[0]).toMatchObject({ quantity: 2, unitPrice: 0, subtotal: 0, discountPctSnapshot: 100 });
  });

  it('DirectInvoiceService: aplica promo N+M en factura directa, asigna lotes FIFO para pagas y bonificadas', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(activePersona);
    const gaseosa = {
      id: 11,
      name: 'Gaseosa Cola 2.25L',
      listPrice: 2800,
      listPriceB: 0,
      listPriceC: 0,
      costPrice: 1800,
      stock: 30,
      isPesable: false,
    };
    const promo3Plus1 = {
      id: 7,
      name: '3+1 Gratis',
      type: 'BUY_X_GET_Y',
      isActive: true,
      startDate: startPast,
      endDate: endFuture,
      items: [{ productId: 11, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
    };

    (prisma.product.findMany as any).mockResolvedValue([gaseosa]);
    (prisma.weeklyPromo.findMany as any).mockResolvedValue([promo3Plus1]);

    const productUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const orderItemCreate = vi
      .fn()
      .mockResolvedValueOnce({ id: 901 })
      .mockResolvedValueOnce({ id: 902 });
    const stockMovCreate = vi.fn().mockResolvedValue({});
    const lotFindMany = vi.fn().mockResolvedValue([{ id: 55, stock: 30 }]);
    const lotUpdate = vi.fn().mockResolvedValue({});
    const orderItemLotCreate = vi.fn().mockResolvedValue({});

    const mockTx = {
      product: { updateMany: productUpdateMany },
      orderItem: { create: orderItemCreate },
      stockMovement: { create: stockMovCreate },
      productLot: { findMany: lotFindMany, update: lotUpdate },
      orderItemLot: { create: orderItemLotCreate },
      order: {
        create: vi.fn().mockResolvedValue({ id: 700, billingType: BillingType.INTERNAL }),
        update: vi.fn().mockResolvedValue({ id: 700, invoiceNumber: 'INT-00700' }),
        findUnique: vi.fn().mockResolvedValue({ id: 700, invoiceNumber: 'INT-00700', items: [] }),
      },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await DirectInvoiceService.createDirectInvoice({
      adminId: 1,
      userRole: Role.ADMIN,
      personaId: 100,
      billingType: BillingType.INTERNAL,
      items: [{ productId: 11, quantity: 3 }],
    });

    expect(productUpdateMany).toHaveBeenCalledWith({
      where: { id: 11, stock: { gte: 4 } },
      data: { stock: { decrement: 4 } },
    });
    expect(orderItemCreate).toHaveBeenCalledTimes(2);
    expect(orderItemLotCreate).toHaveBeenNthCalledWith(1, {
      data: { orderItemId: 901, productLotId: 55, quantity: 3 },
    });
    expect(orderItemLotCreate).toHaveBeenNthCalledWith(2, {
      data: { orderItemId: 902, productLotId: 55, quantity: 1 },
    });
  });

  it('StoreOrderService: evalúa Combo y actualiza bultosCount y stock en tienda web', async () => {
    (prisma.persona.findUnique as any).mockResolvedValue(activePersona);

    const jamon = {
      id: 20,
      name: 'Jamón Cocido',
      listPrice: 4900,
      listPriceB: 0,
      listPriceC: 0,
      costPrice: 3000,
      stock: 20,
      unitsPerBox: 2,
      minOrderQuantity: 1,
      isPesable: false,
      offerCampaignItems: [],
      rubro: { id: 1, name: 'FIAMBRES' },
    };
    const queso = {
      id: 21,
      name: 'Queso Barra',
      listPrice: 4400,
      listPriceB: 0,
      listPriceC: 0,
      costPrice: 2800,
      stock: 20,
      unitsPerBox: 1,
      minOrderQuantity: 1,
      isPesable: false,
      offerCampaignItems: [],
      rubro: { id: 1, name: 'FIAMBRES' },
    };

    const comboPromo = {
      id: 12,
      name: 'Combo Picada',
      type: 'COMBO',
      isActive: true,
      startDate: startPast,
      endDate: endFuture,
      items: [
        { productId: 20, minQuantity: 2, freeQuantity: 0, promoUnitPrice: 4200 },
        { productId: 21, minQuantity: 1, freeQuantity: 0, promoUnitPrice: 3800 },
      ],
    };

    const orderCreate = vi.fn().mockResolvedValue({ id: 910, totalAmount: 12200, items: [] });
    const mockTx = {
      product: {
        findMany: vi.fn().mockResolvedValue([jamon, queso]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      discountRule: { findMany: vi.fn().mockResolvedValue([]) },
      weeklyPromo: { findMany: vi.fn().mockResolvedValue([comboPromo]) },
      order: { create: orderCreate },
      stockMovement: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    (prisma.$transaction as any).mockImplementation(async (cb: any) => cb(mockTx));

    await StoreOrderService.createStoreOrder({
      personaId: 100,
      items: [
        { productId: 20, quantity: 2 },
        { productId: 21, quantity: 1 },
      ],
    });

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 12200,
          bultosCount: 2,
          items: {
            create: [
              expect.objectContaining({ productId: 20, quantity: 2, unitPrice: 4200, subtotal: 8400 }),
              expect.objectContaining({ productId: 21, quantity: 1, unitPrice: 3800, subtotal: 3800 }),
            ],
          },
        }),
      }),
    );
  });
});
