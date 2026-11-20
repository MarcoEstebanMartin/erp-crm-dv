import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingType, OrderStatus, Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import * as auditModule from '../../utils/audit';
import { purchaseOrderService } from '../purchases/purchase-order.service';
import { OrderStatusService } from '../orders/order-status.service';
import { OrderScaleService } from '../orders/order-scale.service';
import { restoreReturnedStockAndLots } from '../credit-notes/credit-note-stock.helper';

describe('Paso A4 — Blindaje de Stock, Compras, Pedidos y Notas de Crédito', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
  });

  it('receivePurchaseOrder ejecuta FOR UPDATE sobre PurchaseOrder antes de validar PENDING', async () => {
    const queryRawSpy = vi.fn().mockResolvedValue([]);
    const mockTx: any = {
      $queryRaw: queryRawSpy,
      purchaseOrder: {
        findUnique: vi.fn().mockResolvedValue({ id: 55, status: 'RECEIVED', items: [] }),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      purchaseOrderService.receivePurchaseOrder({ userId: 1, orderId: 55 }),
    ).rejects.toThrow(/ya fue procesada/i);

    expect(queryRawSpy).toHaveBeenCalledTimes(1);
  });

  it('OrderStatusService bloquea reactivación desde CANCELLED y bloquea cancelación de DELIVERED con Nota de Crédito', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
      id: 70,
      status: OrderStatus.CANCELLED,
      billingType: BillingType.INTERNAL,
    } as any);

    const cancelledTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 70,
          status: OrderStatus.CANCELLED,
          billingType: BillingType.INTERNAL,
        }),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb(cancelledTx));

    await expect(
      OrderStatusService.updateOrderStatus({
        orderId: 70,
        status: OrderStatus.PREPARED,
        userId: 1,
        userRole: Role.ADMIN,
      }),
    ).rejects.toThrow(/no se puede reactivar/i);

    vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
      id: 71,
      status: OrderStatus.DELIVERED,
      billingType: BillingType.INTERNAL,
    } as any);
    vi.spyOn(prisma.transaction, 'findFirst').mockResolvedValue(null);

    const cnTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 71,
          status: OrderStatus.DELIVERED,
          billingType: BillingType.INTERNAL,
          totalAmount: 10000,
        }),
      },
      transaction: { findFirst: vi.fn().mockResolvedValue(null) },
      creditNote: { findFirst: vi.fn().mockResolvedValue({ id: 5, creditNoteNumber: 'NCI-00005' }) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb(cnTx));

    await expect(
      OrderStatusService.updateOrderStatus({
        orderId: 71,
        status: OrderStatus.CANCELLED,
        userId: 1,
        userRole: Role.ADMIN,
      }),
    ).rejects.toThrow(/Nota de Crédito asociada/i);
  });

  it('OrderStatusService recalcula Product.stock contra Σlotes - reservas al cancelar (evita stock fantasma web)', async () => {
    vi.spyOn(prisma.order, 'findUnique').mockResolvedValue({
      id: 72,
      status: OrderStatus.PENDING,
      billingType: BillingType.INTERNAL,
      totalAmount: 5000,
    } as any);

    const productUpdateSpy = vi.fn().mockResolvedValue({});
    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 72,
          status: OrderStatus.PENDING,
          billingType: BillingType.INTERNAL,
          totalAmount: 5000,
          bultosDetails: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 72,
          status: OrderStatus.CANCELLED,
          totalAmount: 5000,
        }),
      },
      orderItem: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, productId: 99, quantity: 10, orderItemLots: [] },
        ]),
        // Quedan 0 reservas activas tras cancelar el pedido #72
        aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
      },
      productLot: {
        // Solo había 2 unidades físicas reales en lotes (el pedido web de 10 había clampeado stock a 0)
        aggregate: vi.fn().mockResolvedValue({ _sum: { stock: 2 }, _count: { _all: 1 } }),
      },
      product: { update: productUpdateSpy },
      stockMovement: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await OrderStatusService.updateOrderStatus({
      orderId: 72,
      status: OrderStatus.CANCELLED,
      userId: 1,
      userRole: Role.ADMIN,
    });

    // Debe quedar en 2 (real en lotes), NO en 0 + 10 = 10
    expect(productUpdateSpy).toHaveBeenCalledWith({
      where: { id: 99 },
      data: { stock: 2 },
    });
  });

  it('confirmArmado bloquea Order con FOR UPDATE y rechaza aumento de cantidad sin stock suficiente', async () => {
    const prevIgnore = process.env.IGNORE_STOCK_CHECK;
    process.env.IGNORE_STOCK_CHECK = 'false';

    try {
      const queryRawSpy = vi.fn().mockResolvedValue([]);
      const mockTx: any = {
        $queryRaw: queryRawSpy,
        order: {
          findUnique: vi.fn().mockResolvedValue({
            id: 80,
            status: OrderStatus.PREPARING,
            sellerId: 1,
            totalAmount: 1000,
            items: [
              {
                id: 1,
                productId: 50,
                quantity: 2,
                unitPrice: 500,
                subtotal: 1000,
                weight: null,
                product: { id: 50, name: 'Leche Entera', isPesable: false },
                orderItemLots: [],
              },
            ],
          }),
        },
        product: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

      await expect(
        OrderScaleService.confirmArmado(80, [{ orderItemId: 1, quantity: 5 }]),
      ).rejects.toThrow(/Stock insuficiente/i);

      expect(queryRawSpy).toHaveBeenCalled();
    } finally {
      process.env.IGNORE_STOCK_CHECK = prevIgnore;
    }
  });

  it('restoreReturnedStockAndLots crea un StockMovement.IN por cada lote restaurado en devoluciones multi-lote', async () => {
    const movCreateSpy = vi.fn().mockResolvedValue({});
    const mockTx: any = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      product: {
        findUnique: vi.fn().mockResolvedValue({ id: 40, name: 'Yogur' }),
        update: vi.fn().mockResolvedValue({}),
      },
      orderItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: 10,
          orderItemLots: [
            { productLotId: 101, quantity: 3 },
            { productLotId: 102, quantity: 4 },
          ],
        }),
      },
      productLot: {
        update: vi.fn().mockResolvedValue({}),
      },
      stockMovement: {
        create: movCreateSpy,
      },
    };

    await restoreReturnedStockAndLots(mockTx, {
      creditNoteId: 25,
      creditNoteNumber: 'NCI-00025',
      orderId: 900,
      userId: 1,
      reasonLabel: 'Devolución multi-lote',
      items: [{ productId: 40, quantity: 5 }],
    });

    expect(movCreateSpy).toHaveBeenCalledTimes(2);
    expect(movCreateSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ productLotId: 101, quantity: 3 }),
      }),
    );
    expect(movCreateSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ productLotId: 102, quantity: 2 }),
      }),
    );
  });
});
