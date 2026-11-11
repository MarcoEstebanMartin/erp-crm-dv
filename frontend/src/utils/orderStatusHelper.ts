export interface OrderStatusInfo {
  label: string;
  badgeClass: string;
  color: string;
}

export function getOrderStatusInfo(order: any): OrderStatusInfo {
  if (order.status === 'CANCELLED') {
    return { label: 'Cancelado', badgeClass: 'cancelled', color: 'var(--color-danger)' };
  }
  if (order.status === 'PENDING') {
    return { label: 'Recibido', badgeClass: 'pending', color: 'var(--accent-color)' };
  }
  if (order.status === 'PREPARING') {
    return { label: 'En Picking', badgeClass: 'preparing', color: '#F59E0B' };
  }
  if (order.deliveryRoute) {
    if (order.deliveryRoute.status === 'IN_TRANSIT') {
      return { label: 'En Viaje', badgeClass: 'in-transit', color: '#8B5CF6' };
    }
    if (order.deliveryRoute.status === 'COMPLETED') {
      return { label: 'Entregado', badgeClass: 'delivered', color: 'var(--color-success)' };
    }
  }

  if (order.status === 'PREPARED' && !order.invoiceNumber) {
    return { label: 'Armado', badgeClass: 'prepared', color: '#4F46E5' };
  }

  if (order.invoiceNumber) {
    return { label: 'Facturado', badgeClass: 'invoiced', color: '#10B981' };
  }

  if (order.status === 'DELIVERED') {
    return { label: 'Entregado', badgeClass: 'delivered', color: 'var(--color-success)' };
  }

  return { label: 'Recibido', badgeClass: 'pending', color: 'var(--accent-color)' };
}
