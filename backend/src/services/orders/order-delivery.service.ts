import { DeliveryMethod, OrderStatus, Prisma, Role } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import {
  normalizeStopSequences,
  validateOrderDeliveryAssignment,
} from '../../engines/delivery-dispatch.engine';
import { recalculatePendingRoutesInTx } from '../logistics/delivery-route-stops.helper';
import { notifyWebOrderStatusForErpOrder } from './web-order-status-bridge.service';

export interface UpdateOrderDeliveryInput {
  orderId: number;
  userId: number;
  userRole: string;
  deliveryMethod: DeliveryMethod;
  deliveryRouteId?: number | null;
  deliverySequence?: number | null;
  markPickedUp?: boolean;
  markDelivered?: boolean;
}

export interface BulkUpdateOrdersDeliveryInput {
  orderIds: number[];
  userId: number;
  userRole: string;
  deliveryMethod: DeliveryMethod;
  deliveryRouteId?: number | null;
}

export class OrderDeliveryService {
  /**
   * Actualiza la modalidad de entrega (Reparto / Retiro en local), asignación de viaje
   * o confirmación de retiro en local de un pedido en transacción atómica.
   */
  static async updateOrderDelivery(input: UpdateOrderDeliveryInput) {
    const result = await prisma.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === 'function') {
        await (tx as any).$queryRaw(
          Prisma.sql`SELECT id FROM "Order" WHERE id = ${input.orderId} FOR UPDATE`,
        );
      }

      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: {
          deliveryRoute: { select: { id: true, status: true } },
          persona: { select: { id: true, name: true } },
        },
      });
      if (!order) {
        throw new AppError('Pedido no encontrado.', 404);
      }

      if (input.userRole === Role.VENDEDOR) {
        if (order.sellerId !== input.userId) {
          throw new AppError('No podés modificar entregas de pedidos de otros vendedores.', 403);
        }
        if (order.status !== OrderStatus.PENDING) {
          throw new AppError(
            'El vendedor solo puede modificar la entrega mientras el pedido esté pendiente de armado.',
            403,
          );
        }
      }

      let targetRoute: { id: number; status: string } | null = null;
      if (input.deliveryRouteId) {
        targetRoute = await tx.deliveryRoute.findUnique({
          where: { id: input.deliveryRouteId },
          select: { id: true, status: true },
        });
        if (!targetRoute) {
          throw new AppError('Viaje no encontrado.', 404);
        }
      }

      const plan = validateOrderDeliveryAssignment({
        order: {
          id: order.id,
          status: order.status,
          invoiceNumber: order.invoiceNumber,
          deliveryMethod: order.deliveryMethod,
          deliveryRouteId: order.deliveryRouteId,
          currentRouteStatus: order.deliveryRoute?.status ?? null,
          deliveredAt: order.deliveredAt,
        },
        targetMethod: input.deliveryMethod,
        targetRoute,
        markPickedUp: input.markPickedUp,
        markDelivered: input.markDelivered,
      });

      let nextSequence: number | null = null;
      if (!plan.clearSequence && plan.deliveryRouteId) {
        if (input.deliverySequence && input.deliverySequence > 0) {
          nextSequence = input.deliverySequence;
        } else if (order.deliveryRouteId === plan.deliveryRouteId && order.deliverySequence) {
          nextSequence = order.deliverySequence;
        } else {
          const existingCount = await tx.order.count({
            where: { deliveryRouteId: plan.deliveryRouteId },
          });
          nextSequence = existingCount + 1;
        }
      }

      const nextDeliveredAt = plan.stampDeliveredAt
        ? new Date()
        : plan.clearDeliveredAt
          ? null
          : undefined;
      const nextStatus = plan.stampDeliveredAt ? OrderStatus.DELIVERED : undefined;

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          deliveryMethod: plan.deliveryMethod,
          deliveryRouteId: plan.deliveryRouteId,
          deliverySequence: nextSequence,
          ...(nextDeliveredAt !== undefined ? { deliveredAt: nextDeliveredAt } : {}),
          ...(nextStatus !== undefined ? { status: nextStatus } : {}),
        },
        include: {
          persona: {
            select: { id: true, name: true, city: true, address: true, latitude: true, longitude: true },
          },
          deliveryRoute: {
            select: {
              id: true,
              routeName: true,
              driverName: true,
              vehiclePlate: true,
              status: true,
              date: true,
            },
          },
        },
      });

      const pendingRoutesToRecalc: number[] = [];
      if (order.deliveryRouteId && order.deliveryRoute?.status === 'PENDING') {
        pendingRoutesToRecalc.push(order.deliveryRouteId);
      }
      if (plan.deliveryRouteId && targetRoute?.status === 'PENDING') {
        pendingRoutesToRecalc.push(plan.deliveryRouteId);
      }
      if (pendingRoutesToRecalc.length > 0) {
        await recalculatePendingRoutesInTx(tx, pendingRoutesToRecalc);
      }

      return { previousOrder: order, updatedOrder, stampedPickedUp: plan.stampDeliveredAt };
    });

    if (result.stampedPickedUp) {
      notifyWebOrderStatusForErpOrder(
        result.updatedOrder,
        OrderStatus.DELIVERED,
        result.updatedOrder.deliveryMethod === DeliveryMethod.PICKUP
          ? 'Retirado por el local'
          : 'Entregado en domicilio',
      );
    }

    await logAudit({
      userId: input.userId,
      action: 'UPDATE_ORDER_DELIVERY',
      entityType: 'Order',
      entityId: result.updatedOrder.id,
      oldValues: {
        deliveryMethod: result.previousOrder.deliveryMethod,
        deliveryRouteId: result.previousOrder.deliveryRouteId,
        deliveredAt: result.previousOrder.deliveredAt,
      },
      newValues: {
        deliveryMethod: result.updatedOrder.deliveryMethod,
        deliveryRouteId: result.updatedOrder.deliveryRouteId,
        deliveredAt: result.updatedOrder.deliveredAt,
      },
    });

    return result.updatedOrder;
  }

  /**
   * Asigna o cambia en lote la modalidad de entrega / viaje de múltiples pedidos en una única transacción.
   */
  static async bulkUpdateOrdersDelivery(input: BulkUpdateOrdersDeliveryInput) {
    const orderedUniqueIds = normalizeStopSequences(input.orderIds).map((s) => s.orderId);
    if (orderedUniqueIds.length === 0) {
      throw new AppError('Seleccione al menos un pedido válido.', 400);
    }
    const sortedLockIds = [...orderedUniqueIds].sort((a, b) => a - b);

    await prisma.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === 'function') {
        await (tx as any).$queryRaw(
          Prisma.sql`SELECT id FROM "Order" WHERE id IN (${Prisma.join(sortedLockIds)}) ORDER BY id ASC FOR UPDATE`,
        );
      }

      let targetRoute: { id: number; status: string } | null = null;
      if (input.deliveryRouteId) {
        targetRoute = await tx.deliveryRoute.findUnique({
          where: { id: input.deliveryRouteId },
          select: { id: true, status: true },
        });
        if (!targetRoute) {
          throw new AppError('Viaje no encontrado.', 404);
        }
      }

      const orders = await tx.order.findMany({
        where: { id: { in: orderedUniqueIds } },
        include: { deliveryRoute: { select: { id: true, status: true } } },
      });
      if (orders.length !== orderedUniqueIds.length) {
        const foundSet = new Set(orders.map((o) => o.id));
        const missingId = orderedUniqueIds.find((id) => !foundSet.has(id));
        throw new AppError(`Pedido #${missingId} no encontrado.`, 404);
      }

      const orderById = new Map(orders.map((o) => [o.id, o]));
      const affectedPendingRouteIds = new Set<number>();
      let baseSequence = targetRoute
        ? await tx.order.count({ where: { deliveryRouteId: targetRoute.id } })
        : 0;

      for (const id of orderedUniqueIds) {
        const order = orderById.get(id)!;
        const plan = validateOrderDeliveryAssignment({
          order: {
            id: order.id,
            status: order.status,
            invoiceNumber: order.invoiceNumber,
            deliveryMethod: order.deliveryMethod,
            deliveryRouteId: order.deliveryRouteId,
            currentRouteStatus: order.deliveryRoute?.status ?? null,
            deliveredAt: order.deliveredAt,
          },
          targetMethod: input.deliveryMethod,
          targetRoute,
          markPickedUp: false,
        });

        const nextSeq = plan.clearSequence
          ? null
          : order.deliveryRouteId === plan.deliveryRouteId && order.deliverySequence
            ? order.deliverySequence
            : ++baseSequence;

        await tx.order.update({
          where: { id: order.id },
          data: {
            deliveryMethod: plan.deliveryMethod,
            deliveryRouteId: plan.deliveryRouteId,
            deliverySequence: nextSeq,
            ...(plan.clearDeliveredAt ? { deliveredAt: null } : {}),
          },
        });

        if (order.deliveryRouteId && order.deliveryRoute?.status === 'PENDING') {
          affectedPendingRouteIds.add(order.deliveryRouteId);
        }
        if (plan.deliveryRouteId && targetRoute?.status === 'PENDING') {
          affectedPendingRouteIds.add(plan.deliveryRouteId);
        }
      }

      if (affectedPendingRouteIds.size > 0) {
        await recalculatePendingRoutesInTx(tx, Array.from(affectedPendingRouteIds));
      }
    });

    await logAudit({
      userId: input.userId,
      action: 'BULK_UPDATE_ORDER_DELIVERY',
      entityType: 'Order',
      entityId: orderedUniqueIds[0],
      newValues: {
        orderIds: orderedUniqueIds,
        deliveryMethod: input.deliveryMethod,
        deliveryRouteId: input.deliveryRouteId ?? null,
      },
    });

    return {
      updatedCount: orderedUniqueIds.length,
      deliveryMethod: input.deliveryMethod,
      deliveryRouteId: input.deliveryRouteId ?? null,
    };
  }
}
