import { Response } from 'express';
import { DeliveryMethod, Role } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { OrderDeliveryService } from '../services/orders/order-delivery.service';

const SINGLE_DELIVERY_ROLES: Role[] = [
  Role.ADMIN,
  Role.FACTURACION,
  Role.DEPOSITO,
  Role.VENDEDOR,
];
const BULK_DELIVERY_ROLES: Role[] = [Role.ADMIN, Role.FACTURACION, Role.DEPOSITO];

function handleDeliveryError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  const errObj = error as { statusCode?: number; message?: string };
  res.status(errObj?.statusCode || 400).json({
    status: 'error',
    message: errObj?.message || fallbackMessage,
  });
}

export async function updateOrderDeliveryHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role as Role | undefined;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (!SINGLE_DELIVERY_ROLES.includes(userRole)) {
    res.status(403).json({ status: 'error', message: 'Permisos insuficientes.' });
    return;
  }

  try {
    const order = await OrderDeliveryService.updateOrderDelivery({
      orderId: Number(req.params.id),
      userId,
      userRole,
      deliveryMethod: req.body.deliveryMethod as DeliveryMethod,
      deliveryRouteId: req.body.deliveryRouteId,
      deliverySequence: req.body.deliverySequence,
      markPickedUp: req.body.markPickedUp,
    });
    res.status(200).json({ status: 'success', data: { order } });
  } catch (error) {
    handleDeliveryError(res, error, 'Error al actualizar la modalidad de entrega del pedido.');
  }
}

export async function bulkUpdateOrdersDeliveryHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role as Role | undefined;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (!BULK_DELIVERY_ROLES.includes(userRole)) {
    res.status(403).json({ status: 'error', message: 'Permisos insuficientes.' });
    return;
  }

  try {
    const result = await OrderDeliveryService.bulkUpdateOrdersDelivery({
      orderIds: req.body.orderIds,
      userId,
      userRole,
      deliveryMethod: req.body.deliveryMethod as DeliveryMethod,
      deliveryRouteId: req.body.deliveryRouteId,
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    handleDeliveryError(res, error, 'Error al actualizar entregas en lote.');
  }
}
