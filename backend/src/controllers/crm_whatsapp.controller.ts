import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { crmWhatsappService } from '../services/crm/crm-whatsapp.service';

function parseParamId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(String(value ?? ''), 10);
}

function respondCrmError(res: Response, error: any, fallbackMessage: string, allowClientMessage = false): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 500;
  const isClientError =
    allowClientMessage &&
    statusCode >= 400 &&
    statusCode < 500 &&
    typeof error?.message === 'string' &&
    !error.message.includes('Prisma');
  res.status(isClientError ? statusCode : 500).json({
    status: 'error',
    message: isClientError ? error.message : fallbackMessage,
  });
}

export async function getConversations(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    res.status(200).json({ status: 'success', data: await crmWhatsappService.listConversations() });
  } catch (error) {
    respondCrmError(res, error, 'Error interno del servidor.');
  }
}

export async function simulateIncomingMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { fromPhone, profileName, text } = req.body;
    const data = await crmWhatsappService.simulateIncoming(fromPhone, profileName, text);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error en el simulador de WhatsApp.');
  }
}

export async function getMessagesByConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.getMessages(parseParamId(req.params.id));
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error interno al consultar chat.');
  }
}

export async function sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.sendMessage(req.body);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'No se pudo enviar el mensaje.');
  }
}

export async function toggleAutoReply(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.toggleAutoReply(parseParamId(req.params.id), req.body?.enabled);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error al cambiar estado de auto-respuesta.');
  }
}

export async function updateStage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.updateStage(parseParamId(req.params.id), req.body?.stage);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error al actualizar etapa del pipeline.');
  }
}

export async function sendDeliveryNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.sendDeliveryNotification(parseParamId(req.params.orderId));
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error al enviar notificación de despacho.');
  }
}

export async function parseOrderDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.parseOrderDraft(parseParamId(req.params.id), req.body?.rawText);
    res.status(201).json({ status: 'success', data });
  } catch (error: any) {
    respondCrmError(res, error, error?.message || 'Error al generar borrador de pedido.');
  }
}

export async function approveOrderDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'Sesión de usuario requerida.' });
    return;
  }
  try {
    const data = await crmWhatsappService.approveOrderDraft({
      draftId: parseParamId(req.params.draftId),
      userId: req.user.id,
      userRole: req.user.role,
      items: req.body?.items,
      billingType: req.body?.billingType,
      notes: req.body?.notes,
    });
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error interno al aprobar orden.', true);
  }
}

export async function linkPersonaToConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.linkPersona(parseParamId(req.params.id), req.body?.personaId);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error al vincular cliente.');
  }
}

export async function assignConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await crmWhatsappService.assignConversation(parseParamId(req.params.id), req.body?.assignedUserId);
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    respondCrmError(res, error, 'Error al derivar conversación.');
  }
}

export async function deleteConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await crmWhatsappService.deleteConversation(parseParamId(req.params.id));
    res.status(200).json({ status: 'success', message: 'Conversación eliminada correctamente.' });
  } catch (error) {
    respondCrmError(res, error, 'Error al eliminar la conversación.');
  }
}
