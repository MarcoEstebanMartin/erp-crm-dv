import { Response } from 'express';
import { BillingType, PaymentMethod, Role } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { collectionService } from '../services/collections/collection.service';
import { receiptService } from '../services/collections/receipt.service';
import { rendicionService } from '../services/collections/rendicion.service';

function handleCollectionError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
}

export const getPendingCollections = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const personas = await collectionService.getPendingCollections(req.user.id, req.user.role);
    return res.json(personas);
  } catch (error) {
    return handleCollectionError(res, error, 'Error al obtener saldos pendientes');
  }
};

export const getCollectionsSummary = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const summary = await collectionService.getCollectionsSummary();
    return res.json(summary);
  } catch (error) {
    return handleCollectionError(res, error, 'Error al obtener resumen de cobranzas');
  }
};

export const registerCollection = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const hostOrigin = `${req.protocol}://${req.get('host')}`;
    const transaction = await collectionService.registerCollection({
      userId: req.user.id,
      userRole: req.user.role,
      personaId: Number(req.body.personaId),
      amount: Number(req.body.amount),
      paymentMethod: req.body.paymentMethod as PaymentMethod,
      billingType: req.body.billingType as BillingType,
      description: req.body.description,
      orderId: req.body.orderId ? Number(req.body.orderId) : null,
      isCreditOnAccount: req.body.isCreditOnAccount,
      bankAccountId: req.body.bankAccountId ? Number(req.body.bankAccountId) : null,
      checkNumber: req.body.checkNumber,
      hostOrigin,
    });
    return res.status(201).json({ message: 'Cobro registrado exitosamente', transaction });
  } catch (error) {
    return handleCollectionError(res, error, 'Error al registrar cobro');
  }
};

export const getReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const transaction = await receiptService.getReceipt(parseInt(req.params.id as string, 10));
    return res.json(transaction);
  } catch (error) {
    return handleCollectionError(res, error, 'Error al obtener recibo');
  }
};

export const getPendingRendiciones = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await rendicionService.getPendingRendiciones();
    return res.json({ status: 'success', data });
  } catch (error) {
    return handleCollectionError(res, error, 'Error al obtener rendiciones pendientes');
  }
};

export const verifyRendicion = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const hostOrigin = `${req.protocol}://${req.get('host')}`;
    const data = await rendicionService.verifyRendicion({
      adminId: req.user.id,
      sellerId: req.body.sellerId ? Number(req.body.sellerId) : null,
      routeId: req.body.routeId ? Number(req.body.routeId) : null,
      realCash: req.body.realCash !== undefined ? Number(req.body.realCash) : 0,
      realChecks: req.body.realChecks !== undefined ? Number(req.body.realChecks) : 0,
      destinationDrawerId: req.body.destinationDrawerId
        ? Number(req.body.destinationDrawerId)
        : null,
      routeNote: req.body.routeNote,
      notes: req.body.notes,
      declaredChecks: req.body.declaredChecks,
      hostOrigin,
    });
    return res.json({ status: 'success', data });
  } catch (error) {
    return handleCollectionError(
      res,
      error,
      'Error interno del servidor al procesar la rendición.',
    );
  }
};

export const deleteReceipt = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  if (req.user.role !== Role.ADMIN && req.user.role !== Role.FACTURACION) {
    return res.status(403).json({ error: 'No tienes permisos para eliminar o anular recibos' });
  }
  try {
    const { receiptLabel, amountToRestore } = await receiptService.deleteReceipt({
      adminId: req.user.id,
      userRole: req.user.role,
      receiptId: Number(req.params.id),
    });
    return res.json({
      status: 'success',
      message: `Recibo ${receiptLabel} eliminado correctamente. Se restableció $${amountToRestore.toLocaleString()} al saldo pendiente del cliente.`,
    });
  } catch (error) {
    return handleCollectionError(res, error, 'Error interno del servidor al eliminar el recibo');
  }
};
