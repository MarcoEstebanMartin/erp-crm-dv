import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BillingType,
  CreditNoteStatus,
  MovementType,
  OrderStatus,
  Role,
} from '@prisma/client';

const mockSharedProdDbHolder: { client: any } = { client: null };

vi.mock('../orders/web-order-status-bridge.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../orders/web-order-status-bridge.service')>();
  return {
    ...actual,
    getSharedProductionDbClient: vi.fn(() => mockSharedProdDbHolder.client),
    notifyWebOrderStatusForErpOrder: vi.fn(),
  };
});

import prisma from '../../utils/prisma';
import { appCache } from '../../utils/cache';
import {
  ensureFefoLotsForOrderItem,
  isLotExpired,
  processOrderPreparedLotAssignments,
} from '../orders/order-lot-picking.helper';
import { assignFifoLotsToOrderItem } from '../orders/order-billing.helpers';
import { OrderStatusService } from '../orders/order-status.service';
import { OrderEditService } from '../orders/order-edit.service';
import { commitSingleWebOrderAtomically } from '../orders/web-order-commit.helper';
import { productionOrderSyncService } from '../orders/production-order-sync.service';
import { productWmsSubService } from '../catalog/product-wms.service';
import { productReconciliationSubService } from '../catalog/product-reconciliation.service';
import { OrderService } from '../order.service';
import { OrderBillingService } from '../orders/order-billing.service';
import { DirectInvoiceService } from '../directInvoice.service';
import { purchaseOrderService } from '../purchases/purchase-order.service';
import { purchaseDocumentService } from '../purchases/purchase-document.service';
import { supplierInvoiceService } from '../billing/supplier-invoice.service';
import { creditNoteService } from '../credit-notes/credit-note.service';
import { creditNoteApprovalService } from '../credit-notes/credit-note-approval.service';
import { StoreOrderService } from '../store/store-order.service';
import {
  confirmArmado,
  createDirectInvoice,
  createOrder,
  invoiceOrder,
  updateOrder,
  updateOrderStatus,
} from '../../controllers/order.controller';
import {
  confirmDocument,
  receivePurchaseOrder,
} from '../../controllers/purchase.controller';
import {
  createSupplierInvoice,
  deleteSupplierInvoice,
} from '../../controllers/billing.controller';
import {
  approveCreditNote,
  createCreditNote,
} from '../../controllers/creditNote.controller';
import { createStoreOrder } from '../../controllers/store.controller';

const SENTINEL = new Date('2036-12-31T00:00:00Z');
const EXPIRED_DATE = new Date('2025-01-15T00:00:00Z');
const FUTURE_NEAR = new Date('2027-02-01T00:00:00Z');
const FUTURE_FAR = new Date('2027-08-01T00:00:00Z');

function makeMockRes() {
  const res: any = {
    statusCode: 200,
    payload: null,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.payload = body;
      return res;
    }),
  };
  return res;
}

describe('Paso 1 — Blindaje Crítico de Stock, FEFO, Concurrencia, WMS y Caché', () => {
  const prevIgnoreStock = process.env.IGNORE_STOCK_CHECK;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.IGNORE_STOCK_CHECK = 'false';
    mockSharedProdDbHolder.client = null;
    appCache.clear();
    vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 1 } as any);
  });

  afterEach(() => {
    process.env.IGNORE_STOCK_CHECK = prevIgnoreStock;
  });

  it('1. isLotExpired, ensureFefoLotsForOrderItem y assignFifoLotsToOrderItem excluyen lotes vencidos del auto-FEFO', async () => {
    const ref = new Date('2026-11-19T12:00:00Z');
    expect(isLotExpired(null, ref)).toBe(false);
    expect(isLotExpired(undefined, ref)).toBe(false);
    expect(isLotExpired(SENTINEL, ref)).toBe(false);
    expect(isLotExpired('2026-11-20T00:00:00Z', ref)).toBe(false);
    expect(isLotExpired('2026-11-19T00:00:00Z', ref)).toBe(true);
    expect(isLotExpired('2026-11-18T00:00:00Z', ref)).toBe(true);

    // ensureFefoLotsForOrderItem saltea el lote vencido (id 1) y asigna del vigente (id 2)
    const lotUpdates: any[] = [];
    const itemLotCreates: any[] = [];
    const txValid: any = {
      productLot: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, productId: 10, lotNumber: 'L-VENC', expirationDate: EXPIRED_DATE, location: 'S/U', stock: 10 },
          { id: 2, productId: 10, lotNumber: 'L-OK', expirationDate: FUTURE_NEAR, location: 'S/U', stock: 6 },
        ]),
        update: vi.fn().mockImplementation(async (args) => lotUpdates.push(args)),
      },
      orderItemLot: {
        create: vi.fn().mockImplementation(async (args) => itemLotCreates.push(args)),
      },
      stockMovement: {
        findFirst: vi.fn().mockResolvedValue({ id: 50, productId: 10, quantity: -4, productLotId: null }),
        update: vi.fn().mockResolvedValue({}),
      },
    };

    const allocs = await ensureFefoLotsForOrderItem(txValid, {
      orderId: 99,
      orderItemId: 500,
      productId: 10,
      quantity: 4,
      sellerId: 1,
    });
    expect(allocs).toHaveLength(1);
    expect(allocs[0].lot.id).toBe(2);
    expect(lotUpdates).toEqual([{ where: { id: 2 }, data: { stock: { decrement: 4 } } }]);
    expect(itemLotCreates).toEqual([{ data: { orderItemId: 500, productLotId: 2, quantity: 4 } }]);

    // Si solo quedan lotes vencidos, ensureFefoLotsForOrderItem lanza error claro
    const txOnlyExpired: any = {
      productLot: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, productId: 10, lotNumber: 'L-VENC', expirationDate: EXPIRED_DATE, location: 'S/U', stock: 10 },
        ]),
        update: vi.fn(),
      },
      orderItemLot: { create: vi.fn() },
    };
    await expect(
      ensureFefoLotsForOrderItem(txOnlyExpired, {
        orderId: 99,
        orderItemId: 500,
        productId: 10,
        quantity: 2,
        sellerId: 1,
      }),
    ).rejects.toThrow(/lotes vencidos que no pueden despacharse/i);

    // assignFifoLotsToOrderItem saltea el lote vencido (id 1) y asigna del vigente (id 2)
    const directLotUpdates: any[] = [];
    const txDirectValid: any = {
      productLot: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, lotNumber: 'L-VENC', expirationDate: EXPIRED_DATE, location: 'S/U', stock: 8 },
          { id: 2, lotNumber: 'L-OK', expirationDate: FUTURE_FAR, location: 'D1-R01-C01-A', stock: 5 },
        ]),
        update: vi.fn().mockImplementation(async (args) => directLotUpdates.push(args)),
      },
      orderItemLot: { create: vi.fn().mockResolvedValue({}) },
    };
    const directAllocs = await assignFifoLotsToOrderItem(txDirectValid, 800, 10, 3);
    expect(directAllocs).toEqual([{ productLotId: 2, quantity: 3 }]);
    expect(directLotUpdates).toEqual([{ where: { id: 2 }, data: { stock: { decrement: 3 } } }]);

    // assignFifoLotsToOrderItem falla si solo existen vencidos
    const txDirectExpired: any = {
      productLot: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, lotNumber: 'L-VENC', expirationDate: EXPIRED_DATE, location: 'S/U', stock: 8 },
        ]),
        update: vi.fn(),
      },
      orderItemLot: { create: vi.fn() },
    };
    await expect(assignFifoLotsToOrderItem(txDirectExpired, 801, 10, 2)).rejects.toThrow(
      /No hay stock vigente \(no vencido\)/i,
    );
  });

  it('2. processOrderPreparedLotAssignments rechaza lotes vencidos, de otro producto o sin stock suficiente', async () => {
    const baseTx = (lotRecord: any) => ({
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 701,
            productId: 10,
            quantity: 3,
            unitPrice: 1000,
            subtotal: 3000,
            weight: null,
            product: { id: 10, name: 'Queso Tybo', isPesable: false },
          },
        ]),
      },
      productLot: {
        findUnique: vi.fn().mockResolvedValue(lotRecord),
      },
    });

    await expect(
      processOrderPreparedLotAssignments(
        baseTx({ id: 11, productId: 10, lotNumber: 'L-VENC', expirationDate: EXPIRED_DATE, stock: 5 }) as any,
        { orderId: 1, sellerId: 1, userId: 1, lotAssignments: { 701: [{ lotId: 11, quantity: 2 }] } },
      ),
    ).rejects.toThrow(/está vencido y no puede despacharse/i);

    await expect(
      processOrderPreparedLotAssignments(
        baseTx({ id: 12, productId: 999, lotNumber: 'L-OTRO', expirationDate: FUTURE_NEAR, stock: 5 }) as any,
        { orderId: 1, sellerId: 1, userId: 1, lotAssignments: { 701: [{ lotId: 12, quantity: 2 }] } },
      ),
    ).rejects.toThrow(/no pertenece al producto/i);

    await expect(
      processOrderPreparedLotAssignments(
        baseTx({ id: 13, productId: 10, lotNumber: 'L-CORTO', expirationDate: FUTURE_NEAR, stock: 1 }) as any,
        { orderId: 1, sellerId: 1, userId: 1, lotAssignments: { 701: [{ lotId: 13, quantity: 3 }] } },
      ),
    ).rejects.toThrow(/Stock insuficiente en el lote/i);
  });

  it('3. OrderStatusService adquiere FOR UPDATE sobre productos en PREPARED/CANCELLED y registra StockMovement por lote al cancelar', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
      id: 400,
      personaId: 1,
      sellerId: 2,
      status: OrderStatus.PREPARING,
      billingType: BillingType.INTERNAL,
      totalAmount: 5000,
      bultosDetails: null,
    } as any);

    const queriesExecuted: string[] = [];
    const txPrepared: any = {
      $queryRaw: vi.fn().mockImplementation(async (sqlObj: any) => {
        const text = Array.isArray(sqlObj?.strings) ? sqlObj.strings.join('?') : String(sqlObj);
        queriesExecuted.push(text);
        return [{ id: 1 }];
      }),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 400,
          personaId: 1,
          sellerId: 2,
          status: OrderStatus.PREPARING,
          totalAmount: 5000,
          bultosDetails: null,
        }),
        update: vi.fn().mockResolvedValue({ id: 400, status: OrderStatus.PREPARED, totalAmount: 5000 }),
      },
      orderItem: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ productId: 50 }, { productId: 30 }])
          .mockResolvedValueOnce([
            {
              id: 801,
              productId: 50,
              quantity: 2,
              unitPrice: 2500,
              subtotal: 5000,
              weight: null,
              product: { id: 50, name: 'Manteca', isPesable: false },
            },
          ]),
        update: vi.fn().mockResolvedValue({}),
      },
      productLot: {
        findUnique: vi.fn().mockResolvedValue({
          id: 90,
          productId: 50,
          lotNumber: 'L-OK',
          expirationDate: FUTURE_NEAR,
          stock: 5,
          location: 'S/U',
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      orderItemLot: { create: vi.fn().mockResolvedValue({}) },
      stockMovement: {
        findFirst: vi.fn().mockResolvedValue({ id: 700, productId: 50, quantity: -2, productLotId: null }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txPrepared));

    await OrderStatusService.updateOrderStatus({
      orderId: 400,
      userId: 1,
      userRole: Role.ADMIN,
      status: OrderStatus.PREPARED,
      lotAssignments: { 801: [{ lotId: 90, quantity: 2 }] },
    });

    expect(queriesExecuted.some((q) => q.includes('FROM "Order"') && q.includes('FOR UPDATE'))).toBe(true);
    expect(queriesExecuted.some((q) => q.includes('FROM "Product"') && q.includes('FOR UPDATE'))).toBe(true);

    // Ahora cancelar pedido PREPARED: bloquea productos, restaura lotes y crea StockMovement.IN con productLotId
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
      id: 401,
      personaId: 1,
      sellerId: 2,
      status: OrderStatus.PREPARED,
      billingType: BillingType.INTERNAL,
      totalAmount: 5000,
      bultosDetails: null,
    } as any);

    const cancelQueries: string[] = [];
    const cancelMovements: any[] = [];
    const cancelLotUpdates: any[] = [];
    const txCancel: any = {
      $queryRaw: vi.fn().mockImplementation(async (sqlObj: any) => {
        cancelQueries.push(Array.isArray(sqlObj?.strings) ? sqlObj.strings.join('?') : String(sqlObj));
        return [{ id: 1 }];
      }),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 401,
          personaId: 1,
          sellerId: 2,
          status: OrderStatus.PREPARED,
          billingType: BillingType.INTERNAL,
          totalAmount: 5000,
          bultosDetails: null,
        }),
        update: vi.fn().mockResolvedValue({ id: 401, status: OrderStatus.CANCELLED, totalAmount: 5000 }),
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 805,
            productId: 50,
            quantity: 5,
            orderItemLots: [
              { id: 1, productLotId: 90, quantity: 3 },
              { id: 2, productLotId: 91, quantity: 2 },
            ],
          },
        ]),
      },
      product: { update: vi.fn().mockResolvedValue({}) },
      productLot: {
        update: vi.fn().mockImplementation(async (args) => cancelLotUpdates.push(args)),
      },
      orderItemLot: { deleteMany: vi.fn().mockResolvedValue({}) },
      stockMovement: {
        create: vi.fn().mockImplementation(async ({ data }) => cancelMovements.push(data)),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txCancel));

    await OrderStatusService.updateOrderStatus({
      orderId: 401,
      userId: 1,
      userRole: Role.ADMIN,
      status: OrderStatus.CANCELLED,
    });

    expect(cancelQueries.some((q) => q.includes('FROM "Product"') && q.includes('FOR UPDATE'))).toBe(true);
    expect(cancelLotUpdates).toEqual([
      { where: { id: 90 }, data: { stock: { increment: 3 } } },
      { where: { id: 91 }, data: { stock: { increment: 2 } } },
    ]);
    expect(cancelMovements).toHaveLength(2);
    expect(cancelMovements[0]).toMatchObject({ type: MovementType.IN, productLotId: 90, quantity: 3 });
    expect(cancelMovements[1]).toMatchObject({ type: MovementType.IN, productLotId: 91, quantity: 2 });
  });

  it('4. OrderEditService bloquea Order y Product con FOR UPDATE y limpia movimientos WEB-ORDER-* al editar', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
      id: 88,
      personaId: 10,
      sellerId: 5,
      billingType: BillingType.INTERNAL,
      status: OrderStatus.PENDING,
      totalAmount: 2000,
      items: [{ productId: 11, quantity: 1 }],
    } as any);

    const editQueries: string[] = [];
    const deleteManyCalls: any[] = [];
    const txEdit: any = {
      $queryRaw: vi.fn().mockImplementation(async (sqlObj: any) => {
        editQueries.push(Array.isArray(sqlObj?.strings) ? sqlObj.strings.join('?') : String(sqlObj));
        return [{ id: 88 }];
      }),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 88,
          personaId: 10,
          sellerId: 5,
          billingType: BillingType.INTERNAL,
          status: OrderStatus.PENDING,
          items: [{ productId: 11, quantity: 1 }],
        }),
        update: vi.fn().mockResolvedValue({ id: 88, totalAmount: 4000, items: [] }),
      },
      persona: {
        findUnique: vi.fn().mockResolvedValue({ id: 10, priceList: 'A', creditLimit: 0, outstandingBalance: 0 }),
      },
      product: {
        update: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([
          { id: 11, name: 'Leche', listPrice: 2000, costPrice: 1200, stock: 20, minOrderQuantity: 1, isPesable: false, rubro: { id: 1 } },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      discountRule: { findMany: vi.fn().mockResolvedValue([]) },
      weeklyPromo: { findMany: vi.fn().mockResolvedValue([]) },
      orderItem: { deleteMany: vi.fn().mockResolvedValue({}) },
      stockMovement: {
        deleteMany: vi.fn().mockImplementation(async (args) => deleteManyCalls.push(args)),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txEdit));

    await OrderEditService.updateOrder({
      orderId: 88,
      userId: 5,
      userRole: Role.VENDEDOR,
      items: [{ productId: 11, quantity: 2 }],
    });

    expect(editQueries.some((q) => q.includes('FROM "Order"') && q.includes('FOR UPDATE'))).toBe(true);
    expect(editQueries.some((q) => q.includes('FROM "Product"') && q.includes('FOR UPDATE'))).toBe(true);
    expect(deleteManyCalls[0]).toEqual({
      where: {
        orderId: 88,
        OR: [
          { referenceId: 'ORDER-88' },
          { referenceId: { startsWith: 'WEB-ORDER-' } },
        ],
      },
    });
  });

  it('5. commitSingleWebOrderAtomically hace clamp en 0 (nunca stock negativo) y usa referenceId ORDER-<id>', async () => {
    const productUpdates: any[] = [];
    const movCreateMany: any[] = [];

    const txWeb: any = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 912, personaId: 1 }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 33, stock: 2 }]),
        update: vi.fn().mockImplementation(async (args) => productUpdates.push(args)),
      },
      stockMovement: {
        createMany: vi.fn().mockImplementation(async (args) => movCreateMany.push(args)),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txWeb));

    await commitSingleWebOrderAtomically({
      wo: {
        id: 'DV-2001',
        customer_phone: '3388501086',
        customer_name: 'Juan Perez',
        delivery_address: 'Mitre 100',
        delivery_method: 'reparto',
        notes: '',
        total_amount: 10000,
        status: 'nuevo',
        source: 'tienda_web',
        created_at: new Date().toISOString(),
        items_json: [],
      },
      webOrderId: 'DV-2001',
      source: 'tienda_web',
      webStatus: 'nuevo',
      phoneRaw: '3388501086',
      phone10: '3388501086',
      matchedClient: { id: 1, name: 'JUAN PEREZ' },
      translated: {
        lines: [
          {
            productId: 33,
            sku: '0033',
            productName: 'Leche Test',
            quantity: 5,
            weight: null,
            unitPrice: 2000,
            subtotal: 10000,
            unitCostSnapshot: 1500,
            listPriceSnapshot: 2000,
            discountPctSnapshot: 0,
            bultosEstimated: 1,
            stockInsufficient: true,
          },
        ],
        totalAmount: 10000,
        netAmount: 8264,
        taxAmount: 1736,
        bultosCount: 1,
        unmappedNotes: [],
        stockWarnings: [],
      },
      sellerId: 9,
    });

    // Había 2 u. y pidieron 5 u.: Product.stock queda en 0 (jamás -3)
    expect(productUpdates).toEqual([{ where: { id: 33 }, data: { stock: 0 } }]);
    expect(movCreateMany[0].data[0].referenceId).toBe('ORDER-912');
  });

  it('6. productWmsSubService.assignWmsLocation preserva lotes/vencimientos separados y actualiza fecha en STOCK_IN', async () => {
    const createdLots: any[] = [];
    const movements: any[] = [];

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 77 }]),
        warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 77, stock: 10, defaultLocation: null }),
          update: vi.fn().mockResolvedValue({ id: 77, stock: 10, defaultLocation: 'D1-R01-C04-A' }),
        },
        orderItem: { aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }) },
        productLot: {
          findMany: vi.fn().mockResolvedValue([
            { id: 1, productId: 77, lotNumber: 'L-1', stock: 5, location: 'S/U', expirationDate: new Date('2026-12-01T00:00:00Z') },
            { id: 2, productId: 77, lotNumber: 'L-2', stock: 5, location: 'S/U', expirationDate: new Date('2027-06-01T00:00:00Z') },
          ]),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockImplementation(async ({ data }) => {
            const created = { id: 100 + createdLots.length, ...data };
            createdLots.push(created);
            return created;
          }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            movements.push(data);
            return { id: movements.length, ...data };
          }),
        },
      }),
    );

    await productWmsSubService.assignWmsLocation(
      { productId: 77, locationCode: 'D1-R01-C04-A', quantity: 8 },
      1,
    );

    expect(createdLots).toHaveLength(2);
    expect(createdLots[0]).toMatchObject({
      lotNumber: 'L-1',
      location: 'D1-R01-C04-A',
      stock: 5,
      expirationDate: new Date('2026-12-01T00:00:00Z'),
    });
    expect(createdLots[1]).toMatchObject({
      lotNumber: 'L-2',
      location: 'D1-R01-C04-A',
      stock: 3,
      expirationDate: new Date('2027-06-01T00:00:00Z'),
    });
    expect(movements).toHaveLength(4);

    // STOCK_IN explícito sobre lote existente con nueva fecha de vencimiento actualiza expirationDate
    const stockInUpdates: any[] = [];
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 77 }]),
        warehouseCell: { findUnique: vi.fn().mockResolvedValue(null) },
        product: {
          findUnique: vi.fn().mockResolvedValue({ id: 77, stock: 10, defaultLocation: 'D1-R01-C04-A' }),
          update: vi.fn().mockResolvedValue({ id: 77, stock: 14, defaultLocation: 'D1-R01-C04-A' }),
        },
        productLot: {
          findMany: vi.fn().mockResolvedValue([
            { id: 201, productId: 77, lotNumber: 'L-9', stock: 10, location: 'D1-R01-C04-A', expirationDate: SENTINEL },
          ]),
          update: vi.fn().mockImplementation(async (args) => {
            stockInUpdates.push(args);
            return { id: 201, ...args.data };
          }),
        },
        stockMovement: { create: vi.fn().mockResolvedValue({ id: 1 }) },
      }),
    );

    await productWmsSubService.assignWmsLocation(
      {
        productId: 77,
        locationCode: 'D1-R01-C04-A',
        quantity: 4,
        lotNumber: 'L-9',
        expirationDate: '2027-09-15',
        mode: 'STOCK_IN',
      },
      1,
    );

    expect(stockInUpdates[0].data.expirationDate).toEqual(new Date('2027-09-15'));
  });

  it('7. productWmsSubService.clearWmsLocation registra asientos OUT/IN simétricos al liberar a S/U sin colisión', async () => {
    const movements: any[] = [];
    const lotUpdates: any[] = [];

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([]),
        productLot: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              { id: 301, productId: 55, lotNumber: 'L-UNICO', stock: 14, location: 'D1-R01-C04-A' },
            ])
            .mockResolvedValueOnce([]),
          findUnique: vi.fn().mockResolvedValue({
            id: 301,
            productId: 55,
            lotNumber: 'L-UNICO',
            stock: 14,
            location: 'D1-R01-C04-A',
          }),
          update: vi.fn().mockImplementation(async (args) => lotUpdates.push(args)),
          count: vi.fn().mockResolvedValue(0),
        },
        product: {
          findMany: vi.fn().mockResolvedValue([{ id: 55, defaultLocation: 'D1-R01-C04-A' }]),
          update: vi.fn().mockResolvedValue({ id: 55, defaultLocation: null }),
        },
        stockMovement: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            movements.push(data);
            return { id: movements.length, ...data };
          }),
        },
      }),
    );

    const out = await productWmsSubService.clearWmsLocation('D1-R01-C04-A', 1);
    expect(out.result.movedUnitsToUnassigned).toBe(14);
    expect(lotUpdates).toEqual([{ where: { id: 301 }, data: { location: 'S/U', lotNumber: 'L-UNICO' } }]);
    expect(movements.map((m) => [m.type, m.quantity, m.productLotId])).toEqual([
      ['OUT', -14, 301],
      ['IN', 14, 301],
    ]);
  });

  it('8. productReconciliationSubService no inventa stock fantasma en sobreventa y recalcula bajo FOR UPDATE', async () => {
    vi.spyOn(prisma.product, 'findMany').mockResolvedValue([
      { id: 1, sku: '0001', name: 'Tybo', stock: 0, lots: [] },
      { id: 2, sku: '0002', name: 'Cremoso', stock: -3, lots: [{ id: 20, stock: 2 }] },
    ] as any);
    vi.spyOn(prisma.orderItem, 'groupBy').mockResolvedValue([
      { productId: 1, _sum: { quantity: 5 } }, // 0 físico - 5 reservado => teórico clamped a 0 => drift 0
      { productId: 2, _sum: { quantity: 6 } }, // 2 físico - 6 reservado => teórico clamped a 0, stock actual -3 => drift -3
    ] as any);

    const audit = await productReconciliationSubService.reconcileStockAudit();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ id: 2, stockActual: -3, stockTeorico: 0, discrepancia: -3 });

    // Al ejecutar conciliación bajo FOR UPDATE, repara product.stock < 0 a 0 sin crear ni tocar lotes físicos
    const prodUpdates: any[] = [];
    const lotCreates = vi.fn();
    const lotUpdates = vi.fn();

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) =>
      cb({
        $queryRaw: vi.fn().mockResolvedValue([{ id: 2 }]),
        product: {
          findMany: vi.fn().mockResolvedValue([{ id: 2, sku: '0002', name: 'Cremoso', stock: -3 }]),
          update: vi.fn().mockImplementation(async (args) => prodUpdates.push(args)),
        },
        orderItem: {
          groupBy: vi.fn().mockResolvedValue([{ productId: 2, _sum: { quantity: 6 } }]),
        },
        productLot: {
          findMany: vi.fn().mockResolvedValue([{ id: 20, productId: 2, lotNumber: 'L-1', stock: 2, location: 'S/U' }]),
          create: lotCreates,
          update: lotUpdates,
        },
        stockMovement: { createMany: vi.fn() },
      }),
    );

    const rec = await productReconciliationSubService.executeStockReconciliation(1);
    expect(rec.count).toBe(1);
    expect(prodUpdates).toEqual([{ where: { id: 2 }, data: { stock: 0 } }]);
    expect(lotCreates).not.toHaveBeenCalled();
    expect(lotUpdates).not.toHaveBeenCalled();
  });

  it('9. Todas las mutaciones de stock en controladores y sync web invalidan el caché de catálogo', async () => {
    const invalidateSpy = vi.spyOn(appCache, 'invalidateProductCatalog');

    // A) purchase.controller
    vi.spyOn(purchaseOrderService, 'receivePurchaseOrder').mockResolvedValue({ id: 1 } as any);
    await receivePurchaseOrder({ user: { id: 1 }, params: { id: '1' }, body: {} } as any, makeMockRes());
    vi.spyOn(purchaseDocumentService, 'confirmExtractedDocument').mockResolvedValue({ id: 2 } as any);
    await confirmDocument({ user: { id: 1 }, body: {} } as any, makeMockRes());

    // B) billing.controller
    vi.spyOn(supplierInvoiceService, 'createSupplierInvoice').mockResolvedValue({ id: 3 } as any);
    await createSupplierInvoice({ user: { id: 1 }, body: { personaId: 1 } } as any, makeMockRes());
    vi.spyOn(supplierInvoiceService, 'deleteSupplierInvoice').mockResolvedValue(undefined as any);
    await deleteSupplierInvoice({ user: { id: 1 }, params: { id: '3' } } as any, makeMockRes());

    // C) order.controller (6 endpoints mutadores de stock)
    vi.spyOn(OrderService, 'createOrder').mockResolvedValue({ id: 10, personaId: 1, totalAmount: 100, status: OrderStatus.PENDING } as any);
    await createOrder({ user: { id: 1, role: Role.ADMIN }, body: { personaId: 1, items: [{ productId: 1, quantity: 1 }] } } as any, makeMockRes());
    vi.spyOn(OrderService, 'confirmArmado').mockResolvedValue({ id: 10, totalAmount: 100, status: OrderStatus.PREPARED } as any);
    await confirmArmado({ user: { id: 1, role: Role.ADMIN }, params: { id: '10' }, body: { items: [] } } as any, makeMockRes());
    vi.spyOn(OrderStatusService, 'updateOrderStatus').mockResolvedValue({ id: 10, status: OrderStatus.PREPARING } as any);
    await updateOrderStatus({ user: { id: 1, role: Role.ADMIN }, params: { id: '10' }, body: { status: OrderStatus.PREPARING } } as any, makeMockRes());
    vi.spyOn(OrderBillingService, 'invoiceOrder').mockResolvedValue({ order: { id: 10 } } as any);
    await invoiceOrder({ user: { id: 1, role: Role.ADMIN }, params: { id: '10' }, body: { billingType: BillingType.INTERNAL } } as any, makeMockRes());
    vi.spyOn(OrderEditService, 'updateOrder').mockResolvedValue({ id: 10 } as any);
    await updateOrder({ user: { id: 1, role: Role.ADMIN }, params: { id: '10' }, body: { items: [{ productId: 1, quantity: 2 }] } } as any, makeMockRes());
    vi.spyOn(DirectInvoiceService, 'createDirectInvoice').mockResolvedValue({ id: 11 } as any);
    await createDirectInvoice({ user: { id: 1, role: Role.ADMIN }, body: { personaId: 1, billingType: BillingType.INTERNAL, items: [{ productId: 1, quantity: 1 }] } } as any, makeMockRes());

    // D) creditNote.controller
    vi.spyOn(creditNoteService, 'createCreditNote').mockResolvedValue({ id: 20, status: CreditNoteStatus.APPROVED, reason: 'DEVOLUCION' } as any);
    await createCreditNote({ user: { id: 1, role: Role.ADMIN }, body: { personaId: 1, reason: 'DEVOLUCION', items: [] } } as any, makeMockRes());
    vi.spyOn(creditNoteApprovalService, 'approveCreditNote').mockResolvedValue({ id: 21, status: CreditNoteStatus.APPROVED } as any);
    await approveCreditNote({ user: { id: 1, role: Role.ADMIN }, params: { id: '21' } } as any, makeMockRes());

    // E) store.controller
    vi.spyOn(StoreOrderService, 'createStoreOrder').mockResolvedValue({ id: 30 } as any);
    await createStoreOrder({ storeClient: { personaId: 1 }, body: { items: [] } } as any, makeMockRes());

    // F) production-order-sync.service
    mockSharedProdDbHolder.client = {
      $transaction: vi.fn().mockImplementation(async (fn: any) =>
        fn({
          $executeRawUnsafe: vi.fn().mockResolvedValue(0),
          $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: 'DV-9001', status: 'cancelado', created_at: new Date().toISOString() }]),
        }),
      ),
    };
    vi.spyOn(prisma.order, 'findMany').mockResolvedValue([
      { id: 901, status: OrderStatus.PENDING, bultosDetails: { webOrderId: 'DV-9001' }, notes: null } as any,
    ]);
    vi.spyOn(prisma.product, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.persona, 'findMany').mockResolvedValue([]);
    vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({ id: 9, username: 'tienda_online', isActive: true } as any);

    await productionOrderSyncService.syncIncomingOrders({ dryRun: false, includeHistoricalTests: true });

    // 2 purchase + 2 billing + 6 order + 2 creditNote + 1 store + 1 web-sync = 14 invalidaciones
    expect(invalidateSpy).toHaveBeenCalledTimes(14);
  });
});
