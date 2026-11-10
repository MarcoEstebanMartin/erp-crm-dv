import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { purchaseOrderService } from '../services/purchases/purchase-order.service';
import { purchaseDocumentService } from '../services/purchases/purchase-document.service';

function handlePurchaseError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ status: 'error', message: fallbackMessage });
}

export async function getPurchaseOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const orders = await purchaseOrderService.getPurchaseOrders(
      req.query as Record<string, string>,
    );
    res.status(200).json({ status: 'success', data: { orders } });
  } catch (error) {
    handlePurchaseError(res, error, 'Error al obtener las órdenes de compra.');
  }
}

export async function createPurchaseOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const order = await purchaseOrderService.createPurchaseOrder({
      userId: req.user?.id,
      personaId: Number(req.body.personaId),
      items: req.body.items,
    });
    res.status(201).json({ status: 'success', data: { order } });
  } catch (error) {
    handlePurchaseError(res, error, 'Error al registrar la orden de compra.');
  }
}

export async function receivePurchaseOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autorizado' });
    return;
  }
  try {
    const order = await purchaseOrderService.receivePurchaseOrder({
      userId: req.user.id,
      orderId: Number(req.params.id),
      invoiceNumber: req.body.invoiceNumber,
      lotAssignments: req.body.lotAssignments,
      billingType: req.body.billingType,
    });
    res.status(200).json({ status: 'success', data: { order } });
  } catch (error) {
    handlePurchaseError(res, error, 'Error al procesar la recepción de la orden de compra.');
  }
}

export async function uploadDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ status: 'error', message: 'No se recibió ningún archivo.' });
    return;
  }
  try {
    const data = await purchaseDocumentService.uploadAndExtractDocument({
      mimeType: req.file.mimetype,
      fileBuffer: req.file.buffer,
    });
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    handlePurchaseError(res, error, 'Error al procesar el documento con IA.');
  }
}

export async function confirmDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autorizado' });
    return;
  }
  try {
    const result = await purchaseDocumentService.confirmExtractedDocument({
      userId: req.user.id,
      providerId: Number(req.body.providerId),
      documentType: req.body.documentType,
      documentNumber: req.body.documentNumber,
      issueDate: req.body.issueDate,
      items: req.body.items,
      netAmount: req.body.netAmount,
      taxAmount: req.body.taxAmount,
      percepcionAmount: req.body.percepcionAmount,
      percepcionPampa: req.body.percepcionPampa,
      percepcionBsAs: req.body.percepcionBsAs,
      percepcionIva: req.body.percepcionIva,
      percepcionIvaAmount: req.body.percepcionIvaAmount,
      percepcionIva5329: req.body.percepcionIva5329,
      impuestosInternos: req.body.impuestosInternos,
      percepcionJurisdiction: req.body.percepcionJurisdiction,
      totalAmount: req.body.totalAmount,
      billingType: req.body.billingType,
    });
    res.status(200).json({ status: 'success', data: result });
  } catch (error) {
    handlePurchaseError(res, error, 'Error al confirmar e ingresar el documento.');
  }
}
