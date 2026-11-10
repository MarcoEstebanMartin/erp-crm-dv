import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { Role, BillingType, OrderStatus, PaymentMethod } from '@prisma/client';
import { logAudit } from '../utils/audit';
import { OrderService } from '../services/order.service';
import { DirectInvoiceService } from '../services/directInvoice.service';
import { OrderQueriesService } from '../services/orders/order-queries.service';
import { OrderEditService } from '../services/orders/order-edit.service';
import { OrderStatusService } from '../services/orders/order-status.service';
import { OrderBillingService } from '../services/orders/order-billing.service';

export async function getOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const data = await OrderQueriesService.getOrders({
      userId,
      userRole,
      billingType: req.query.billingType as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page as string | undefined,
      limit: req.query.limit as string | undefined,
    });
    res.status(200).json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener pedidos.' });
  }
}

export async function getOrderById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const order = await OrderQueriesService.getOrderById(Number(req.params.id), userId, userRole);
    res.status(200).json({ status: 'success', data: { order } });
  } catch (error: any) {
    const code = error.statusCode || 500;
    res.status(code).json({
      status: 'error',
      message: error.message || 'Error al obtener el pedido.',
    });
  }
}

export async function createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const sellerId = req.user?.id;
  const userRole = req.user?.role;
  const { personaId, clientId, billingType, salesChannel, notes, items } = req.body;
  const targetPersonaId = personaId || clientId;

  if (!sellerId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (!targetPersonaId) {
    res
      .status(400)
      .json({ status: 'error', message: 'Debe especificar el cliente (personaId o clientId).' });
    return;
  }

  try {
    const result = await OrderService.createOrder({
      sellerId,
      userRole,
      personaId: targetPersonaId,
      billingType,
      salesChannel,
      notes,
      items,
    });

    await logAudit({
      userId: sellerId,
      action: 'CREATE_ORDER',
      entityType: 'Order',
      entityId: result.id,
      newValues: {
        personaId: result.personaId,
        total: result.totalAmount,
        status: result.status,
      },
    });

    res.status(201).json({ status: 'success', data: { order: result } });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al procesar el pedido.',
    });
  }
}

export async function updateOrderWeights(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION && userRole !== Role.DEPOSITO) {
    res
      .status(403)
      .json({ status: 'error', message: 'Permisos insuficientes para actualizar pesos.' });
    return;
  }

  try {
    const updatedOrder = await OrderService.updateOrderWeights(Number(req.params.id), req.body.items);
    await logAudit({
      userId,
      action: 'UPDATE_ORDER_WEIGHTS',
      entityType: 'Order',
      entityId: updatedOrder.id,
      newValues: { totalAmount: updatedOrder.totalAmount },
    });

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
      message: 'Pesos actualizados con éxito.',
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al actualizar los pesos.',
    });
  }
}

export async function confirmArmado(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION && userRole !== Role.DEPOSITO) {
    res
      .status(403)
      .json({ status: 'error', message: 'Permisos insuficientes para confirmar armado.' });
    return;
  }

  try {
    const updatedOrder = await OrderService.confirmArmado(Number(req.params.id), req.body.items);
    await logAudit({
      userId,
      action: 'CONFIRM_ARMADO',
      entityType: 'Order',
      entityId: updatedOrder.id,
      newValues: { totalAmount: updatedOrder.totalAmount, status: updatedOrder.status },
    });

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
      message: 'Armado confirmado con éxito.',
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al confirmar el armado.',
    });
  }
}

export async function updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const updated = await OrderStatusService.updateOrderStatus({
      orderId: Number(req.params.id),
      userId,
      userRole,
      status: req.body.status as OrderStatus,
      lotAssignments: req.body.lotAssignments,
      bultosCount: req.body.bultosCount,
      bultosDetails: req.body.bultosDetails,
    });
    res.status(200).json({ status: 'success', data: { order: updated } });
  } catch (error: any) {
    const code = error.statusCode || 400;
    res.status(code).json({
      status: 'error',
      message: error.message || 'Error al actualizar el estado del pedido.',
    });
  }
}

export async function invoiceOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const adminId = req.user?.id;
  const userRole = req.user?.role;
  if (!adminId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION) {
    res.status(403).json({
      status: 'error',
      message: 'Acceso denegado. Permisos de facturación insuficientes.',
    });
    return;
  }
  if (!req.body.billingType) {
    res.status(400).json({ status: 'error', message: 'El tipo de facturación es obligatorio.' });
    return;
  }

  try {
    const data = await OrderBillingService.invoiceOrder({
      orderId: Number(req.params.id),
      adminId,
      userRole,
      billingType: req.body.billingType as BillingType,
      paymentMethod: req.body.paymentMethod as PaymentMethod | undefined,
      paymentDescription: req.body.paymentDescription,
      bankAccountId: req.body.bankAccountId,
      deferCae: req.body.deferCae,
    });
    res.status(200).json({ status: 'success', data });
  } catch (error: any) {
    const code = error.statusCode || 400;
    res.status(code).json({
      status: 'error',
      message: error.message || 'Error al facturar el pedido.',
    });
  }
}

export async function updateOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (!req.body.items || req.body.items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Los items son requeridos.' });
    return;
  }

  try {
    const order = await OrderEditService.updateOrder({
      orderId: Number(req.params.id),
      userId,
      userRole,
      items: req.body.items,
    });
    res.status(200).json({ status: 'success', data: { order } });
  } catch (error: any) {
    const code = error.statusCode || 400;
    res.status(code).json({
      status: 'error',
      message: error.message || 'Error al editar el pedido.',
    });
  }
}

export async function createDirectInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  const adminId = req.user?.id;
  const userRole = req.user?.role;
  if (!adminId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION) {
    res.status(403).json({
      status: 'error',
      message: 'Acceso denegado. Permisos de facturación insuficientes.',
    });
    return;
  }

  const { personaId, billingType, items } = req.body;
  if (!personaId || !billingType || !items || items.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Cliente, tipo de facturación e ítems son requeridos.',
    });
    return;
  }

  try {
    const order = await DirectInvoiceService.createDirectInvoice({
      adminId,
      userRole,
      ...req.body,
    });
    res.status(200).json({ status: 'success', data: { order } });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al emitir factura directa.',
    });
  }
}

export async function requestCaeForOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const adminId = req.user?.id;
  const userRole = req.user?.role;
  if (!adminId || (userRole !== Role.ADMIN && userRole !== Role.FACTURACION)) {
    res.status(403).json({ status: 'error', message: 'Acceso denegado.' });
    return;
  }

  try {
    const result = await OrderBillingService.requestCaeForOrder(Number(req.params.id));
    res.json({
      status: 'success',
      message: `CAE asignado correctamente por AFIP/ARCA (N° ${result.invoiceNumber}, CAE: ${result.cae}).`,
      data: result.updated,
    });
  } catch (err: any) {
    const code = err.statusCode || 400;
    res.status(code).json({ status: 'error', message: `Error AFIP al solicitar CAE: ${err.message}` });
  }
}
