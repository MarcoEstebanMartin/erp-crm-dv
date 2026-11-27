import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { fieldReceiptsService } from '../services/fieldReceipts.service';
import { whatsappDispatchService } from '../services/whatsappDispatch.service';
import { clientWhatsAppService } from '../services/collections/client-whatsapp.service';

function handleFieldReceiptError(res: Response, error: unknown, fallback: string) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

export const getOfflineBundle = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const bundle = await fieldReceiptsService.getOfflineBundle(req.user.id, req.user.role);
    return res.json(bundle);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al descargar hoja de ruta offline');
  }
};

export const syncFieldReceipt = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const result = await fieldReceiptsService.syncReceipt(req.user.id, req.body);
    let dispatchResult: Awaited<ReturnType<typeof whatsappDispatchService.dispatchReceiptPdf>> | null = null;
    if (!result.alreadySynced && Boolean(result.receipt.receiptNumber)) {
      try {
        dispatchResult = await whatsappDispatchService.dispatchReceiptPdf(result.receipt.id);
      } catch (err) {
        console.error('Error generando PDF/WhatsApp tras sincronizar recibo en calle:', err);
      }
    }
    const receiptWithPdf =
      dispatchResult && 'pdfUrl' in dispatchResult && dispatchResult.pdfUrl
        ? { ...result.receipt, pdfUrl: dispatchResult.pdfUrl }
        : result.receipt;
    return res.status(result.alreadySynced ? 200 : 201).json({
      ...result,
      receipt: receiptWithPdf,
      whatsapp: dispatchResult,
    });
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al sincronizar recibo en calle');
  }
};

export const listMySettlements = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const settlements = await fieldReceiptsService.listSettlements(req.user.id);
    return res.json(settlements);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al consultar mis rendiciones');
  }
};

export const listAllSettlements = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const settlements = await fieldReceiptsService.listSettlements();
    return res.json(settlements);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al listar rendiciones de reparto');
  }
};

export const verifyTransferPayment = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const paymentId = Number(req.params.paymentId);
    const updated = await fieldReceiptsService.verifyTransferPayment(paymentId, req.user.id, req.body);
    let whatsapp = null;
    if (req.body.action === 'CLEAR' && updated?.receiptNumber) {
      try {
        whatsapp = await whatsappDispatchService.dispatchReceiptPdf(updated.id);
      } catch (err) {
        console.error('Error generando PDF/WhatsApp al acreditar transferencia:', err);
      }
    }
    return res.json({ ...updated, whatsapp });
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al verificar transferencia');
  }
};

export const rejectCheckPayment = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const paymentId = Number(req.params.paymentId);
    const result = await fieldReceiptsService.rejectCheckPayment(
      paymentId,
      req.user.id,
      req.body.rejectionReason,
    );
    return res.json(result);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al rechazar cheque');
  }
};

export const voidFieldReceipt = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const receiptId = Number(req.params.id);
    const voided = await fieldReceiptsService.voidFieldReceipt(
      receiptId,
      req.user.id,
      req.body.voidReason,
    );
    return res.json(voided);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al anular recibo');
  }
};

export const approveSettlement = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const settlementId = Number(req.params.id);
    const approved = await fieldReceiptsService.approveSettlement(
      settlementId,
      req.user.id,
      req.body,
    );
    return res.json(approved);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al aprobar rendición');
  }
};

export const resendWhatsAppReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const receiptId = Number(req.params.id);
    const result = await whatsappDispatchService.dispatchReceiptPdf(receiptId, { forceApi: true });
    return res.json(result);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al reenviar recibo por WhatsApp');
  }
};

export const saveClientWhatsApp = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) return res.status(401).json({ error: 'No autorizado' });
  try {
    const personaId = Number(req.params.personaId);
    const updated = await clientWhatsAppService.saveClientWhatsApp(personaId, req.body, req.user.id);
    return res.json(updated);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al guardar WhatsApp del cliente');
  }
};

export const getWhatsAppCoverage = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const coverage = await clientWhatsAppService.getCoverage();
    return res.json(coverage);
  } catch (error) {
    return handleFieldReceiptError(res, error, 'Error al consultar cobertura de WhatsApp');
  }
};
