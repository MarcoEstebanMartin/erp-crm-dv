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

  it('buildOrderStatusGroupWhere y buildOrderSearchWhere construyen cláusulas SQL precisas', () => {
    expect(buildOrderStatusGroupWhere('ALL')).toBeNull();
    expect(buildOrderStatusGroupWhere('RECIBIDO')).toEqual({ status: OrderStatus.PENDING });
    expect(buildOrderStatusGroupWhere('EN_PICKING')).toEqual({ status: OrderStatus.PREPARING });
    expect(buildOrderStatusGroupWhere('ARMADO')).toEqual({
      status: OrderStatus.PREPARED,
      invoiceNumber: null,
    });
    expect(buildOrderStatusGroupWhere('ENTREGADO')).toEqual({ status: OrderStatus.DELIVERED });
    expect(buildOrderStatusGroupWhere('CANCELADO')).toEqual({ status: OrderStatus.CANCELLED });

    const numericSearch = buildOrderSearchWhere('#1420');
    expect(numericSearch?.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 1420 })]),
    );

    expect(buildOrderSearchWhere('   ')).toBeNull();
  });

  it('getOrdersSummary ejecuta 3 COUNT(*) en paralelo y restringe por sellerId para VENDEDOR', async () => {
    (prisma.order.count as any)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(48);

    const summary = await OrderQueriesService.getOrdersSummary(9, Role.VENDEDOR);

    expect(summary).toEqual({
      recibidosCount: 12,
      armadosCount: 5,
      facturadosCount: 48,
    });
    expect(prisma.order.count).toHaveBeenCalledTimes(3);
    expect(prisma.order.count).toHaveBeenNthCalledWith(1, {
      where: { sellerId: 9, status: OrderStatus.PENDING },
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
});
