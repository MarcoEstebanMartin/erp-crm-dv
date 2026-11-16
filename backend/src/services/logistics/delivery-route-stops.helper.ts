import { DeliveryMethod, Prisma } from '@prisma/client';
import AppError from '../../utils/AppError';
import {
  computeTripSummaryMetrics,
  normalizeStopSequences,
  validateOrderDeliveryAssignment,
} from '../../engines/delivery-dispatch.engine';

/**
 * Re-numera secuencialmente las paradas (1..N) y recalcula totalBultos de viajes pendientes afectados.
 */
export async function recalculatePendingRoutesInTx(
  tx: Prisma.TransactionClient,
  routeIds: number[],
): Promise<void> {
  const uniqueIds = Array.from(new Set(routeIds.filter((id) => Number.isInteger(id) && id > 0)));
  for (const rId of uniqueIds) {
    const remaining = await tx.order.findMany({
      where: { deliveryRouteId: rId },
      orderBy: [{ deliverySequence: 'asc' }, { id: 'asc' }],
      select: { id: true, status: true, bultosCount: true, totalAmount: true },
    });
    const stops = normalizeStopSequences(remaining.map((o) => o.id));
    for (const stop of stops) {
      await tx.order.update({
        where: { id: stop.orderId },
        data: { deliverySequence: stop.deliverySequence },
      });
    }
    const metrics = computeTripSummaryMetrics(remaining);
    await tx.deliveryRoute.update({
      where: { id: rId },
      data: { totalBultos: metrics.totalBultos },
    });
  }
}

/**
 * Valida pedidos contra las reglas de despacho, asigna paradas en orden exacto (1..N)
 * y devuelve total de bultos + rutas origen pendientes que requieren recálculo.
 */
export async function validateAndAssignStopsInTx(
  tx: Prisma.TransactionClient,
  routeId: number,
  routeStatus: string,
  orderIds: number[],
): Promise<{ totalBultos: number; sourceRouteIdsToRecalc: number[] }> {
  const stops = normalizeStopSequences(orderIds);
  if (stops.length === 0) {
    return { totalBultos: 0, sourceRouteIdsToRecalc: [] };
  }

  const targetIds = stops.map((s) => s.orderId);
  const foundOrders = await tx.order.findMany({
    where: { id: { in: targetIds } },
    select: {
      id: true,
      status: true,
      invoiceNumber: true,
      deliveryMethod: true,
      deliveryRouteId: true,
      deliveredAt: true,
      bultosCount: true,
      totalAmount: true,
      deliveryRoute: { select: { id: true, status: true } },
    },
  });

  if (foundOrders.length !== targetIds.length) {
    const foundSet = new Set(foundOrders.map((o) => o.id));
    const missingId = targetIds.find((id) => !foundSet.has(id));
    throw new AppError(`Pedido #${missingId} no encontrado.`, 404);
  }

  const sourceRouteIds = new Set<number>();
  for (const order of foundOrders) {
    validateOrderDeliveryAssignment({
      order: {
        id: order.id,
        status: order.status,
        invoiceNumber: order.invoiceNumber,
        deliveryMethod: order.deliveryMethod,
        deliveryRouteId: order.deliveryRouteId,
        currentRouteStatus: order.deliveryRoute?.status ?? null,
        deliveredAt: order.deliveredAt,
      },
      targetMethod: 'DELIVERY',
      targetRoute: { id: routeId, status: routeStatus },
    });
    if (order.deliveryRouteId && order.deliveryRouteId !== routeId) {
      sourceRouteIds.add(order.deliveryRouteId);
    }
  }

  for (const stop of stops) {
    await tx.order.update({
      where: { id: stop.orderId },
      data: {
        deliveryMethod: DeliveryMethod.DELIVERY,
        deliveryRouteId: routeId,
        deliverySequence: stop.deliverySequence,
        deliveredAt: null,
      },
    });
  }

  const metrics = computeTripSummaryMetrics(foundOrders);
  return { totalBultos: metrics.totalBultos, sourceRouteIdsToRecalc: Array.from(sourceRouteIds) };
}

/**
 * Valida un viaje pendiente y reserva la siguiente parada disponible al crear un pedido o factura directa.
 */
export async function reserveStopSlotOnPendingRouteInTx(
  tx: Prisma.TransactionClient,
  deliveryRouteId: number,
): Promise<{ deliveryRouteId: number; deliverySequence: number }> {
  const targetRoute = await tx.deliveryRoute.findUnique({
    where: { id: deliveryRouteId },
    select: { id: true, status: true, totalBultos: true },
  });
  if (!targetRoute) {
    throw new AppError('Viaje no encontrado.', 404);
  }
  if (targetRoute.status !== 'PENDING') {
    throw new AppError('Solo se pueden asignar pedidos a viajes en estado Pendiente.', 400);
  }
  const deliverySequence =
    (await tx.order.count({ where: { deliveryRouteId: targetRoute.id } })) + 1;
  await tx.deliveryRoute.update({
    where: { id: targetRoute.id },
    data: { totalBultos: (targetRoute.totalBultos || 0) + 1 },
  });
  return { deliveryRouteId: targetRoute.id, deliverySequence };
}
