import prisma from '../../utils/prisma';
import { Role, BillingType, DeliveryMethod, OrderStatus } from '@prisma/client';

export interface GetOrdersQuery {
  userId: number;
  userRole: string;
  billingType?: string;
  status?: string;
  statusGroup?: string;
  deliveryMethod?: string;
  deliveryRouteId?: string;
  dispatchQueue?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export interface OrdersSummaryResult {
  recibidosCount: number;
  armadosCount: number;
  facturadosCount: number;
  enRepartoCount: number;
}

const MAX_PAGE_LIMIT = 200;

const NOT_IN_ACTIVE_OR_COMPLETED_ROUTE = {
  OR: [
    { deliveryRouteId: null },
    { deliveryRoute: { is: { status: 'PENDING' } } },
  ],
};

export function buildOrderStatusGroupWhere(statusGroup?: string): Record<string, any> | null {
  const key = statusGroup?.trim().toUpperCase();
  if (!key || key === 'ALL') return null;

  switch (key) {
    case 'RECIBIDO':
      return { status: OrderStatus.PENDING };
    case 'EN_PICKING':
      return { status: OrderStatus.PREPARING };
    case 'ARMADO':
      return {
        status: OrderStatus.PREPARED,
        invoiceNumber: null,
        deliveredAt: null,
        ...NOT_IN_ACTIVE_OR_COMPLETED_ROUTE,
      };
    case 'EN_ARMADO':
      return {
        OR: [
          { status: OrderStatus.PREPARING },
          {
            status: OrderStatus.PREPARED,
            invoiceNumber: null,
            deliveredAt: null,
            ...NOT_IN_ACTIVE_OR_COMPLETED_ROUTE,
          },
        ],
      };
    case 'FACTURADO':
      return {
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING, OrderStatus.PREPARING] },
        invoiceNumber: { not: null },
        deliveredAt: null,
        ...NOT_IN_ACTIVE_OR_COMPLETED_ROUTE,
      };
    case 'EN_VIAJE':
    case 'EN_REPARTO':
      return {
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING, OrderStatus.PREPARING] },
        deliveryRoute: { is: { status: 'IN_TRANSIT' } },
      };
    case 'ENTREGADO':
      return {
        status: { not: OrderStatus.CANCELLED },
        OR: [
          { deliveredAt: { not: null } },
          { deliveryRoute: { is: { status: 'COMPLETED' } } },
        ],
      };
    case 'RETIRO_LOCAL':
      return { deliveryMethod: DeliveryMethod.PICKUP, status: { not: OrderStatus.CANCELLED } };
    case 'SIN_VIAJE':
      return {
        deliveryMethod: DeliveryMethod.DELIVERY,
        deliveryRouteId: null,
        deliveredAt: null,
        status: { not: OrderStatus.CANCELLED },
      };
    case 'CANCELADO':
      return { status: OrderStatus.CANCELLED };
    default:
      return null;
  }
}

export function buildOrderSearchWhere(search?: string): Record<string, any> | null {
  const q = search?.trim();
  if (!q) return null;

  const orConditions: any[] = [
    { invoiceNumber: { contains: q, mode: 'insensitive' } },
    { notes: { contains: q, mode: 'insensitive' } },
    {
      persona: {
        is: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { cuit: { contains: q } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        },
      },
    },
  ];

  const cleanNumeric = q.replace(/^#/, '');
  if (/^\d+$/.test(cleanNumeric)) {
    const parsedId = Number(cleanNumeric);
    if (Number.isSafeInteger(parsedId) && parsedId > 0 && parsedId <= 2147483647) {
      orConditions.push({ id: parsedId });
    }
  }

  return { OR: orConditions };
}

export class OrderQueriesService {
  /**
   * Contadores livianos para las 4 tarjetas de Inicio (4 COUNT(*) indexados en paralelo, excluyentes).
   */
  static async getOrdersSummary(userId: number, userRole: string): Promise<OrdersSummaryResult> {
    const baseWhere: Record<string, any> = {};
    if (userRole === Role.VENDEDOR) {
      baseWhere.sellerId = userId;
    }

    const withBase = (groupWhere: Record<string, any> | null) =>
      Object.keys(baseWhere).length > 0 ? { AND: [baseWhere, groupWhere!] } : groupWhere!;

    const [recibidosCount, armadosCount, facturadosCount, enRepartoCount] = await Promise.all([
      prisma.order.count({
        where: withBase(buildOrderStatusGroupWhere('RECIBIDO')),
      }),
      prisma.order.count({
        where: withBase(buildOrderStatusGroupWhere('EN_ARMADO')),
      }),
      prisma.order.count({
        where: withBase(buildOrderStatusGroupWhere('FACTURADO')),
      }),
      prisma.order.count({
        where: withBase(buildOrderStatusGroupWhere('EN_VIAJE')),
      }),
    ]);

    return { recibidosCount, armadosCount, facturadosCount, enRepartoCount };
  }

  /**
   * Obtiene el listado paginado de pedidos filtrando según rol, estado lógico y búsqueda.
   * - ADMIN / DEPOSITO / FACTURACION: Ven todos los pedidos.
   * - VENDEDOR: Solo ve los pedidos que él mismo cargó.
   */
  static async getOrders(query: GetOrdersQuery) {
    const {
      userId,
      userRole,
      billingType,
      status,
      statusGroup,
      deliveryMethod,
      deliveryRouteId,
      dispatchQueue,
      search,
      page,
      limit,
    } = query;
    const andClauses: Record<string, any>[] = [];

    if (userRole === Role.VENDEDOR) {
      andClauses.push({ sellerId: userId });
    }
    if (billingType) {
      andClauses.push({ billingType: billingType as BillingType });
    }
    if (status) {
      andClauses.push({ status: status as OrderStatus });
    }
    if (deliveryMethod) {
      const dm = deliveryMethod.trim().toUpperCase();
      if (dm === DeliveryMethod.DELIVERY || dm === DeliveryMethod.PICKUP) {
        andClauses.push({ deliveryMethod: dm as DeliveryMethod });
      }
    }
    if (deliveryRouteId) {
      const rId = parseInt(deliveryRouteId, 10);
      if (Number.isInteger(rId) && rId > 0) {
        andClauses.push({ deliveryRouteId: rId });
      }
    }
    if (dispatchQueue === 'true') {
      andClauses.push({
        deliveryMethod: DeliveryMethod.DELIVERY,
        deliveryRouteId: null,
        deliveredAt: null,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.PENDING, OrderStatus.PREPARING] },
        invoiceNumber: { not: null },
      });
    }

    const groupWhere = buildOrderStatusGroupWhere(statusGroup);
    if (groupWhere) {
      andClauses.push(groupWhere);
    }

    const searchWhere = buildOrderSearchWhere(search);
    if (searchWhere) {
      andClauses.push(searchWhere);
    }

    const whereClause = andClauses.length > 0 ? { AND: andClauses } : {};

    const pageNum = page ? Math.max(1, parseInt(page, 10) || 1) : undefined;
    const limitNum = limit
      ? Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(limit, 10) || 50))
      : undefined;
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
              barrio: true,
              route: true,
              address: true,
              latitude: true,
              longitude: true,
              phone: true,
              province: true,
              priceList: true,
              discount: true,
              outstandingBalance: true,
              iibbAliquot: true,
              saleRoute: { select: { id: true, name: true } },
            },
          },
          seller: {
            select: { id: true, username: true },
          },
          deliveryRoute: {
            select: {
              id: true,
              routeName: true,
              status: true,
              driverName: true,
              vehiclePlate: true,
              date: true,
              custodyStatus: true,
            },
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
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
        totalPages: limitNum ? Math.max(1, Math.ceil(totalCount / limitNum)) : 1,
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
          select: {
            id: true,
            routeName: true,
            status: true,
            driverName: true,
            vehiclePlate: true,
            date: true,
            custodyStatus: true,
          },
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
