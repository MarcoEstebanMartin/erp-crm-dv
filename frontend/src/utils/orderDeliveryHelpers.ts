export type OrderDeliveryMethodType = 'DELIVERY' | 'PICKUP';

export type DeliverySelectionValue =
  | 'PICKUP'
  | 'DELIVERY_UNASSIGNED'
  | `ROUTE:${number}`;

export interface OrderDeliverySummary {
  method: OrderDeliveryMethodType;
  routeId: number | null;
  routeStatus: string | null;
  isCancelled: boolean;
  isLocked: boolean;
  isPickedUp: boolean;
  canMarkPickedUp: boolean;
  badgeLabel: string;
  subLabel: string | null;
  selectValue: DeliverySelectionValue;
}

/**
 * Etiqueta concisa y legible de un viaje pendiente para selectors y modales.
 */
export function formatDeliveryRouteOptionLabel(route: any): string {
  if (!route || !route.id) return 'Viaje';
  const idPart = `Viaje #${route.id}`;
  if (route.routeName) {
    const driverSuffix = route.driverName ? ` (${route.driverName})` : '';
    return `${idPart} · ${route.routeName}${driverSuffix}`;
  }
  return [idPart, route.driverName, route.vehiclePlate].filter(Boolean).join(' · ');
}

/**
 * Resume la modalidad de entrega, bloqueo operativo y etiqueta visual de un pedido.
 */
export function formatOrderDeliverySummary(order: any): OrderDeliverySummary {
  const method: OrderDeliveryMethodType =
    order?.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY';
  const routeId = order?.deliveryRouteId ? Number(order.deliveryRouteId) : null;
  const routeStatus: string | null = order?.deliveryRoute?.status ?? null;
  const isCancelled = order?.status === 'CANCELLED';
  const isLocked =
    isCancelled ||
    Boolean(routeId && (routeStatus === 'IN_TRANSIT' || routeStatus === 'COMPLETED'));
  const isPickedUp = method === 'PICKUP' && Boolean(order?.deliveredAt);
  const canMarkPickedUp =
    !isCancelled &&
    method === 'PICKUP' &&
    !order?.deliveredAt &&
    Boolean(order?.invoiceNumber);

  let badgeLabel = 'Reparto · Sin viaje';
  if (method === 'PICKUP') {
    badgeLabel = isPickedUp ? 'Retirado en local' : 'Retiro local';
  } else if (routeId) {
    badgeLabel = order?.deliveryRoute?.routeName
      ? `Viaje #${routeId} · ${order.deliveryRoute.routeName}`
      : `Viaje #${routeId}`;
  } else if (order?.deliveredAt) {
    badgeLabel = 'Entregado';
  }

  const subParts = [
    order?.deliveryRoute?.driverName,
    order?.deliveryRoute?.vehiclePlate,
  ].filter(Boolean);
  const subLabel = routeId && subParts.length > 0 ? subParts.join(' · ') : null;

  const selectValue: DeliverySelectionValue =
    method === 'PICKUP'
      ? 'PICKUP'
      : routeId
        ? `ROUTE:${routeId}`
        : 'DELIVERY_UNASSIGNED';

  return {
    method,
    routeId,
    routeStatus,
    isCancelled,
    isLocked,
    isPickedUp,
    canMarkPickedUp,
    badgeLabel,
    subLabel,
    selectValue,
  };
}

/**
 * Traduce el valor del selector de entrega al payload esperado por PATCH /api/orders/:id/delivery.
 */
export function parseDeliverySelectionValue(value: string): {
  deliveryMethod: OrderDeliveryMethodType;
  deliveryRouteId: number | null;
} {
  if (value === 'PICKUP') {
    return { deliveryMethod: 'PICKUP', deliveryRouteId: null };
  }
  if (value.startsWith('ROUTE:')) {
    const parsed = Number(value.slice(6));
    if (Number.isInteger(parsed) && parsed > 0) {
      return { deliveryMethod: 'DELIVERY', deliveryRouteId: parsed };
    }
  }
  return { deliveryMethod: 'DELIVERY', deliveryRouteId: null };
}
