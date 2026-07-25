import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { whatsAppService } from '../services/whatsapp.service';
import { AuthenticatedRequest } from '../types';

const prisma = new PrismaClient();

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
            id: true,
            name: true,
            cuit: true,
            phone: true,
            city: true,
            province: true,
            route: true,
            outstandingBalance: true,
            priceList: true,
            seller: {
              select: { id: true, name: true, username: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        drafts: {
          where: { status: 'PENDING' },
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

    const cleanWaId = fromPhone.replace(/\D/g, '');
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
        persona: true,
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
 */
export async function approveOrderDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rawDraftId = Array.isArray(req.params.draftId) ? req.params.draftId[0] : req.params.draftId;
    const draftId = parseInt(rawDraftId, 10);

    const draft = await prisma.crmOrderDraft.findUnique({
      where: { id: draftId },
      include: { conversation: { include: { persona: true } } }
    });

    if (!draft || draft.status !== 'PENDING') {
      res.status(400).json({ status: 'error', message: 'Borrador no válido o ya procesado.' });
      return;
    }

    const items = JSON.parse(draft.itemsJson || '[]');
    if (items.length === 0) {
      res.status(400).json({ status: 'error', message: 'El borrador no contiene ítems válidos.' });
      return;
    }

    const personaId = draft.personaId || draft.conversation.personaId;
    if (!personaId) {
      res.status(400).json({ status: 'error', message: 'Asigne un cliente a la conversación antes de aprobar la orden.' });
      return;
    }

    const userId = req.user?.id || 1;

    const newOrder = await prisma.order.create({
      data: {
        personaId,
        sellerId: userId,
        billingType: 'INTERNAL',
        invoiceType: 'PRESUPUESTO',
        status: 'PENDING',
        totalAmount: draft.totalEstimated,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice || 0,
            subtotal: item.subtotal || 0
          }))
        }
      }
    });

    await prisma.crmOrderDraft.update({
      where: { id: draftId },
      data: {
        status: 'APPROVED',
        orderId: newOrder.id
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        message: '¡Borrador aprobado exitosamente y convertido en Preventa ERP!',
        order: newOrder
      }
    });
  } catch (error: any) {
    console.error('Error al aprobar borrador CRM:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al aprobar orden.' });
  }
}

/**
 * Webhook de Meta: Verificación GET
 */
export async function verifyWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'dv_crm_secure_token';

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
}

/**
 * Webhook de Meta: Recepción POST
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value && value.messages) {
            for (const msg of value.messages) {
              await whatsAppService.handleIncomingMessage(msg);
            }
          }
        }
      }
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  } catch (error: any) {
    console.error('Error en Webhook Meta:', error);
    res.status(500).send('SERVER_ERROR');
  }
}
