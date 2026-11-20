import { Response } from 'express';
import { BillingType, SalesChannel } from '@prisma/client';
import prisma from '../utils/prisma';
import { whatsAppService, normalizeWaId } from '../services/whatsapp.service';
import { OrderService } from '../services/order.service';
import { AuthenticatedRequest } from '../types';

const SAFE_CRM_PERSONA_SELECT = {
  id: true,
  name: true,
  phone: true,
  cuit: true,
  address: true,
  priceList: true,
  sellerId: true,
  isClient: true,
  isActive: true,
} as const;

/**
 * Obtener lista de conversaciones CRM
 */
export async function getConversations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const conversations = await prisma.crmConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      include: {
        persona: {
          select: {
            ...SAFE_CRM_PERSONA_SELECT,
            seller: {
              select: { id: true, username: true }
            }
          }
        },
        assignedUser: {
          select: { id: true, username: true, role: true }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        drafts: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: conversations
    });
  } catch (error: any) {
    console.error('Error al obtener conversaciones CRM:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor.' });
  }
}

/**
 * Simular mensaje entrante de WhatsApp (Sandbox de Pruebas)
 */
export async function simulateIncomingMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { fromPhone, profileName, text } = req.body;

    if (!fromPhone || !text) {
      res.status(400).json({ status: 'error', message: 'Teléfono y texto son requeridos para la simulación.' });
      return;
    }

    const cleanWaId = normalizeWaId(fromPhone);
    const simulatedMetaMsg = {
      from: cleanWaId,
      id: `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      text: { body: text },
      profile: { name: profileName || `Cliente ${cleanWaId}` }
    };

    const result = await whatsAppService.handleIncomingMessage(simulatedMetaMsg);

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    console.error('Error al simular mensaje de WhatsApp:', error);
    res.status(500).json({ status: 'error', message: 'Error en el simulador de WhatsApp.' });
  }
}

/**
 * Obtener mensajes de una conversación específica
 */
export async function getMessagesByConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = parseInt(rawId, 10);

    const conversation = await prisma.crmConversation.findUnique({
      where: { id: conversationId },
      include: {
        persona: {
          select: SAFE_CRM_PERSONA_SELECT,
        },
        drafts: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!conversation) {
      res.status(404).json({ status: 'error', message: 'Conversación no encontrada.' });
      return;
    }

    await prisma.crmConversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 }
    });

    const messages = await prisma.crmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json({
      status: 'success',
      data: {
        conversation,
        messages
      }
    });
  } catch (error: any) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al consultar chat.' });
  }
}

/**
 * Enviar un mensaje de WhatsApp
 */
export async function sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { to, text, mediaUrl, mediaType } = req.body;

    if (!to || !text) {
      res.status(400).json({ status: 'error', message: 'Los campos to y text son obligatorios.' });
      return;
    }

    const result = await whatsAppService.sendMessage({ to, text, mediaUrl, mediaType });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    console.error('Error al enviar mensaje CRM:', error);
    res.status(500).json({ status: 'error', message: 'No se pudo enviar el mensaje.' });
  }
}

/**
 * Activar / Desactivar Auto-Respuesta 24/7 (Bot)
 */
export async function toggleAutoReply(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = parseInt(rawId, 10);
    const { enabled } = req.body;

    const updated = await prisma.crmConversation.update({
      where: { id: conversationId },
      data: { autoReplyEnabled: Boolean(enabled) }
    });

    res.status(200).json({
      status: 'success',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al cambiar estado de auto-respuesta.' });
  }
}

/**
 * Cambiar etapa en el Pipeline Kanban CRM
 */
export async function updateStage(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = parseInt(rawId, 10);
    const { stage } = req.body;

    if (!stage) {
      res.status(400).json({ status: 'error', message: 'La etapa es requerida.' });
      return;
    }

    const updated = await prisma.crmConversation.update({
      where: { id: conversationId },
      data: { stage }
    });

    res.status(200).json({
      status: 'success',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al actualizar etapa del pipeline.' });
  }
}

/**
 * Disparar Notificación Automática de Despacho de Pedido
 */
export async function sendDeliveryNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawOrderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
    const orderId = parseInt(rawOrderId, 10);

    const result = await whatsAppService.sendDeliveryNotification(orderId);

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al enviar notificación de despacho.' });
  }
}

/**
 * Generar un Borrador de Pedido mediante IA
 */
export async function parseOrderDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = parseInt(rawId, 10);
    const { rawText } = req.body;

    if (!rawText) {
      res.status(400).json({ status: 'error', message: 'Se requiere el texto del pedido.' });
      return;
    }

    const draft = await whatsAppService.parseOrderWithAI(conversationId, rawText);

    res.status(201).json({
      status: 'success',
      data: draft
    });
  } catch (error: any) {
    console.error('Error al procesar borrador con IA:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al generar borrador de pedido.' });
  }
}

/**
 * Aprobar Borrador de Pedido (Human-in-the-Loop)
 * - Recalcula precios y congela snapshots históricos exclusivamente en servidor vía OrderService.
 * - Bloqueo atómico anti-duplicados con updateMany({ id, status: 'PENDING' }).
 */
export async function approveOrderDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ status: 'error', message: 'Sesión de usuario requerida.' });
      return;
    }

    const rawDraftId = Array.isArray(req.params.draftId) ? req.params.draftId[0] : req.params.draftId;
    const draftId = parseInt(rawDraftId, 10);
    if (!Number.isInteger(draftId) || draftId <= 0) {
      res.status(400).json({ status: 'error', message: 'ID de borrador inválido.' });
      return;
    }

    const draft = await prisma.crmOrderDraft.findUnique({
      where: { id: draftId },
      include: {
        conversation: {
          select: {
            id: true,
            personaId: true,
          },
        },
      },
    });

    if (!draft || draft.status !== 'PENDING') {
      res.status(409).json({ status: 'error', message: 'Borrador no válido o ya procesado.' });
      return;
    }

    const rawItemsSource: unknown[] =
      Array.isArray(req.body?.items) && req.body.items.length > 0
        ? req.body.items
        : JSON.parse(draft.itemsJson || '[]');

    const sanitizedItems = rawItemsSource
      .map((item: any) => ({
        productId: Number(item?.productId),
        quantity: Number(item?.quantity),
        weight: item?.weight !== undefined && Number(item.weight) > 0 ? Number(item.weight) : undefined,
      }))
      .filter(
        (item) =>
          Number.isInteger(item.productId) &&
          item.productId > 0 &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      );

    if (sanitizedItems.length === 0) {
      res.status(400).json({ status: 'error', message: 'El borrador no contiene ítems válidos.' });
      return;
    }

    const personaId = draft.personaId || draft.conversation.personaId;
    if (!personaId) {
      res.status(400).json({
        status: 'error',
        message: 'Asigne un cliente a la conversación antes de aprobar la orden.',
      });
      return;
    }

    // Reclamo atómico del borrador para evitar doble aprobación concurrente
    const claimed = await prisma.crmOrderDraft.updateMany({
      where: { id: draftId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });

    if (claimed.count === 0) {
      res.status(409).json({ status: 'error', message: 'Borrador ya procesado por otra solicitud.' });
      return;
    }

    let newOrder;
    try {
      const requestedBilling =
        req.body?.billingType === BillingType.OFFICIAL ? BillingType.OFFICIAL : BillingType.INTERNAL;

      newOrder = await OrderService.createOrder({
        sellerId: req.user.id,
        userRole: req.user.role,
        personaId,
        billingType: requestedBilling,
        salesChannel: SalesChannel.TELEFONICO,
        notes: typeof req.body?.notes === 'string' && req.body.notes.trim()
          ? req.body.notes.trim()
          : `Aprobado desde Borrador CRM #${draftId}`,
        items: sanitizedItems,
      });
    } catch (createError) {
      await prisma.crmOrderDraft
        .update({
          where: { id: draftId },
          data: { status: 'PENDING' },
        })
        .catch(() => {});
      throw createError;
    }

    await prisma.crmOrderDraft.update({
      where: { id: draftId },
      data: {
        orderId: newOrder.id,
        itemsJson: JSON.stringify(sanitizedItems),
        totalEstimated: newOrder.totalAmount,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        message: '¡Borrador aprobado exitosamente y convertido en Preventa ERP!',
        order: newOrder,
      },
    });
  } catch (error: any) {
    console.error('Error al aprobar borrador CRM:', error);
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 400;
    const isClientError =
      statusCode >= 400 &&
      statusCode < 500 &&
      typeof error?.message === 'string' &&
      !error.message.includes('Prisma');
    res.status(isClientError ? statusCode : 500).json({
      status: 'error',
      message: isClientError ? error.message : 'Error interno al aprobar orden.',
    });
  }
}

/**
 * Vincular una conversación CRM a una Ficha de Cliente ERP existente
 */
export async function linkPersonaToConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = parseInt(rawId, 10);
    const { personaId } = req.body;

    if (!personaId) {
      res.status(400).json({ status: 'error', message: 'ID de persona es requerido.' });
      return;
    }

    const persona = await prisma.persona.findUnique({ where: { id: Number(personaId) } });
    if (!persona) {
      res.status(404).json({ status: 'error', message: 'Cliente ERP no encontrado.' });
      return;
    }

    const updatedConv = await prisma.crmConversation.update({
      where: { id: conversationId },
      data: {
        personaId: persona.id,
        contactName: persona.name
      },
      include: {
        persona: {
          select: SAFE_CRM_PERSONA_SELECT,
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: updatedConv
    });
  } catch (error: any) {
    console.error('Error al vincular persona a conversación:', error);
    res.status(500).json({ status: 'error', message: 'Error al vincular cliente.' });
  }
}

/**
 * Asignar / Derivar conversación a un Usuario Administrativo
 */
export async function assignConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const conversationId = parseInt(rawId, 10);
    const { assignedUserId } = req.body;

    const updated = await prisma.crmConversation.update({
      where: { id: conversationId },
      data: {
        assignedSellerId: assignedUserId ? Number(assignedUserId) : null
      },
      include: {
        persona: {
          select: SAFE_CRM_PERSONA_SELECT,
        },
        assignedUser: { select: { id: true, username: true, role: true } }
      }
    });

    res.status(200).json({
      status: 'success',
      data: updated
    });
  } catch (error: any) {
    console.error('Error al derivar conversación:', error);
    res.status(500).json({ status: 'error', message: 'Error al derivar conversación.' });
  }
}

/**
 * Eliminar una conversación CRM y sus mensajes
 */
export async function deleteConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
    const conversationId = parseInt(rawId, 10);
    if (isNaN(conversationId)) {
      res.status(400).json({ status: 'error', message: 'ID de conversación inválido.' });
      return;
    }

    await prisma.crmMessage.deleteMany({ where: { conversationId } });
    await prisma.crmOrderDraft.deleteMany({ where: { conversationId } });
    await prisma.crmConversation.delete({ where: { id: conversationId } });

    res.status(200).json({
      status: 'success',
      message: 'Conversación eliminada correctamente.'
    });
  } catch (error: any) {
    console.error('Error al eliminar conversación:', error);
    res.status(500).json({ status: 'error', message: 'Error al eliminar la conversación.' });
  }
}
