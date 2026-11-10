import prisma from '../../utils/prisma';
import { Role, BillingType, OrderStatus } from '@prisma/client';

export interface GetOrdersQuery {
  userId: number;
  userRole: string;
  billingType?: string;
  status?: string;
  page?: string;
  limit?: string;
}

export class OrderQueriesService {
  /**
   * Obtiene el listado paginado de pedidos filtrando según rol y estado.
   * - ADMIN / DEPOSITO / FACTURACION: Ven todos los pedidos.
   * - VENDEDOR: Solo ve los pedidos que él mismo cargó.
   */
  static async getOrders(query: GetOrdersQuery) {
    const { userId, userRole, billingType, status, page, limit } = query;
    const whereClause: any = {};

    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    if (billingType) {
      whereClause.billingType = billingType as BillingType;
    }

    if (status) {
      whereClause.status = status as OrderStatus;
    }

    const pageNum = page ? Math.max(1, parseInt(page, 10)) : undefined;
    const limitNum = limit ? Math.max(1, parseInt(limit, 10)) : undefined;
    const skip = pageNum && limitNum ? (pageNum - 1) * limitNum : undefined;
    const take = limitNum || undefined;

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          persona: {
            select: {
              id: true,
              name: true,
              cuit: true,
              city: true,
              route: true,
              address: true,
              saleRoute: { select: { id: true, name: true } },
            },
          },
          seller: {
            select: { id: true, username: true },
          },
          deliveryRoute: {
            select: { id: true, status: true, driverName: true, vehiclePlate: true },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  isPesable: true,
                  approximateWeight: true,
                  unitsPerBox: true,
                  pickingZone: true,
                  defaultLocation: true,
                  rubro: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return {
      orders,
      pagination: {
        total: totalCount,
        page: pageNum || 1,
        limit: limitNum || totalCount,
        totalPages: limitNum ? Math.ceil(totalCount / limitNum) : 1,
      },
    };
  }

  /**
   * Obtiene el detalle completo de un pedido con lotes, transacciones y vendedor.
   */
  static async getOrderById(orderId: number, userId: number, userRole: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        persona: true,
        seller: { select: { id: true, username: true } },
        deliveryRoute: {
          select: { id: true, status: true, driverName: true, vehiclePlate: true },
        },
        items: {
          include: {
            product: {
              include: {
                lots: {
                  orderBy: { expirationDate: 'asc' },
                },
                rubro: true,
              },
            },
            orderItemLots: {
              include: {
                productLot: true,
              },
            },
          },
        },
        transactions: true,
      },
    });

    if (!order) {
      const err: any = new Error('Pedido no encontrado.');
      err.statusCode = 404;
      throw err;
    }

    if (userRole === Role.VENDEDOR && order.sellerId !== userId) {
      const err: any = new Error('Acceso denegado. No podés ver pedidos de otros vendedores.');
      err.statusCode = 403;
      throw err;
    }

    return order;
  }
}
