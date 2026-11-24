import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderStatus, Role } from '@prisma/client';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    order: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../../utils/prisma';
import {
  OrderQueriesService,
  buildOrderSearchWhere,
  buildOrderStatusGroupWhere,
} from '../orders/order-queries.service';

describe('Paso 3 Velocidad — Resumen Liviano de Inicio y Paginación Real de Pedidos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildOrderStatusGroupWhere y buildOrderSearchWhere construyen cláusulas SQL precisas y excluyentes', () => {
    expect(buildOrderStatusGroupWhere('ALL')).toBeNull();
    expect(buildOrderStatusGroupWhere('RECIBIDO')).toEqual({ status: OrderStatus.PENDING });
    expect(buildOrderStatusGroupWhere('EN_PICKING')).toEqual({ status: OrderStatus.PREPARING });
    expect(buildOrderStatusGroupWhere('ARMADO')).toEqual({
      status: OrderStatus.PREPARED,
      invoiceNumber: null,
      deliveredAt: null,
      OR: [{ deliveryRouteId: null }, { deliveryRoute: { is: { status: 'PENDING' } } }],
    });
    expect(buildOrderStatusGroupWhere('EN_ARMADO')).toEqual({
      OR: [
        { status: OrderStatus.PREPARING },
        {
          status: OrderStatus.PREPARED,
          invoiceNumber: null,
          deliveredAt: null,
          OR: [{ deliveryRouteId: null }, { deliveryRoute: { is: { status: 'PENDING' } } }],
        },
      ],
    });
    expect(buildOrderStatusGroupWhere('FACTURADO')).toEqual({
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING, OrderStatus.PREPARING] },
      invoiceNumber: { not: null },
      deliveredAt: null,
      OR: [{ deliveryRouteId: null }, { deliveryRoute: { is: { status: 'PENDING' } } }],
    });
    expect(buildOrderStatusGroupWhere('EN_VIAJE')).toEqual({
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING, OrderStatus.PREPARING] },
      deliveryRoute: { is: { status: 'IN_TRANSIT' } },
    });
    expect(buildOrderStatusGroupWhere('EN_REPARTO')).toEqual(buildOrderStatusGroupWhere('EN_VIAJE'));
    expect(buildOrderStatusGroupWhere('ENTREGADO')).toEqual({
      status: { not: OrderStatus.CANCELLED },
      OR: [
        { deliveredAt: { not: null } },
        { deliveryRoute: { is: { status: 'COMPLETED' } } },
      ],
    });
    expect(buildOrderStatusGroupWhere('CANCELADO')).toEqual({ status: OrderStatus.CANCELLED });

    const numericSearch = buildOrderSearchWhere('#1420');
    expect(numericSearch?.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 1420 })]),
    );

    expect(buildOrderSearchWhere('   ')).toBeNull();
  });

  it('getOrdersSummary ejecuta 4 COUNT(*) en paralelo y restringe por sellerId para VENDEDOR', async () => {
    (prisma.order.count as any)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(16)
      .mockResolvedValueOnce(9);

    const summary = await OrderQueriesService.getOrdersSummary(9, Role.VENDEDOR);

    expect(summary).toEqual({
      recibidosCount: 12,
      armadosCount: 5,
      facturadosCount: 16,
      enRepartoCount: 9,
    });
    expect(prisma.order.count).toHaveBeenCalledTimes(4);
    expect(prisma.order.count).toHaveBeenNthCalledWith(1, {
      where: {
        AND: [{ sellerId: 9 }, { status: OrderStatus.PENDING }],
      },
    });
    expect(prisma.order.count).toHaveBeenNthCalledWith(4, {
      where: {
        AND: [
          { sellerId: 9 },
          {
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING, OrderStatus.PREPARING] },
            deliveryRoute: { is: { status: 'IN_TRANSIT' } },
          },
        ],
      },
    });
  });

  it('getOrders pagina con skip/take reales, aplica tope máximo de 200 y combina statusGroup + search', async () => {
    (prisma.order.findMany as any).mockResolvedValue([{ id: 51 }]);
    (prisma.order.count as any).mockResolvedValue(125);

    const result = await OrderQueriesService.getOrders({
      userId: 1,
      userRole: Role.ADMIN,
      statusGroup: 'FACTURADO',
      search: 'Villegas',
      page: '2',
      limit: '50',
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result.pagination).toEqual({
      total: 125,
      page: 2,
      limit: 50,
      totalPages: 3,
    });

    // Verifica tope máximo defensivo (limit=999 -> take=200)
    await OrderQueriesService.getOrders({
      userId: 1,
      userRole: Role.ADMIN,
      page: '1',
      limit: '999',
    });
    expect(prisma.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 0, take: 200 }),
    );
  });

  it('aplica límite defensivo por defecto (100) si se omite page/limit y filtra pickingQueue en SQL para DEPOSITO/ADMIN', async () => {
    (prisma.order.findMany as any).mockResolvedValue([]);
    (prisma.order.count as any).mockResolvedValue(420);

    const resDefault = await OrderQueriesService.getOrders({
      userId: 1,
      userRole: Role.ADMIN,
    });

    expect(prisma.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
    expect(resDefault.pagination).toEqual({
      total: 420,
      page: 1,
      limit: 100,
      totalPages: 5,
    });

    await OrderQueriesService.getOrders({
      userId: 3,
      userRole: Role.DEPOSITO,
      pickingQueue: 'true',
      limit: '200',
    });

    expect(prisma.order.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ status: { in: [OrderStatus.PENDING, OrderStatus.PREPARING] } }],
        },
        skip: 0,
        take: 200,
      }),
    );
  });
});
