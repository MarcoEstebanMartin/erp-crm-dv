import { BillingType, SalesChannel } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { whatsAppService, normalizeWaId } from '../whatsapp.service';
import { OrderService } from '../order.service';

export const SAFE_CRM_PERSONA_SELECT = {
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

export interface ApproveDraftInput {
  draftId: number;
  userId: number;
  userRole: string;
  items?: unknown[];
  billingType?: string;
  notes?: string;
}

export const crmWhatsappService = {
  async listConversations() {
    return prisma.crmConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      include: {
        persona: {
          select: {
            ...SAFE_CRM_PERSONA_SELECT,
            seller: { select: { id: true, username: true } },
          },
        },
        assignedUser: { select: { id: true, username: true, role: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        drafts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  },

  async simulateIncoming(fromPhone: string, profileName: string | undefined, text: string) {
    if (!fromPhone || !text) {
      throw new AppError('Teléfono y texto son requeridos para la simulación.', 400);
    }
    const cleanWaId = normalizeWaId(fromPhone);
    return whatsAppService.handleIncomingMessage({
      from: cleanWaId,
      id: `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      text: { body: text },
      profile: { name: profileName || `Cliente ${cleanWaId}` },
    });
  },

  async getMessages(conversationId: number) {
    const conversation = await prisma.crmConversation.findUnique({
      where: { id: conversationId },
      include: {
        persona: { select: SAFE_CRM_PERSONA_SELECT },
        drafts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!conversation) {
      throw new AppError('Conversación no encontrada.', 404);
    }

    await prisma.crmConversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });

    const messages = await prisma.crmMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return { conversation, messages };
  },

  async sendMessage(payload: { to?: string; text?: string; mediaUrl?: string; mediaType?: string }) {
    if (!payload.to || !payload.text) {
      throw new AppError('Los campos to y text son obligatorios.', 400);
    }
    return whatsAppService.sendMessage({
      to: payload.to,
      text: payload.text,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
    });
  },

  async toggleAutoReply(conversationId: number, enabled: boolean) {
    return prisma.crmConversation.update({
      where: { id: conversationId },
      data: { autoReplyEnabled: Boolean(enabled) },
    });
  },

  async updateStage(conversationId: number, stage?: string) {
    if (!stage) {
      throw new AppError('La etapa es requerida.', 400);
    }
    return prisma.crmConversation.update({
      where: { id: conversationId },
      data: { stage },
    });
  },

  async sendDeliveryNotification(orderId: number) {
    return whatsAppService.sendDeliveryNotification(orderId);
  },

  async parseOrderDraft(conversationId: number, rawText?: string) {
    if (!rawText) {
      throw new AppError('Se requiere el texto del pedido.', 400);
    }
    return whatsAppService.parseOrderWithAI(conversationId, rawText);
  },

  /**
   * Aprueba un borrador de pedido (Human-in-the-Loop) con reclamo atómico anti-duplicados
   * y recálculo de precios/snapshots exclusivamente en servidor vía OrderService.
   */
  async approveOrderDraft(input: ApproveDraftInput) {
    const { draftId, userId, userRole, items, billingType, notes } = input;
    if (!Number.isInteger(draftId) || draftId <= 0) {
      throw new AppError('ID de borrador inválido.', 400);
    }

    const draft = await prisma.crmOrderDraft.findUnique({
      where: { id: draftId },
      include: {
        conversation: { select: { id: true, personaId: true } },
      },
    });

    if (!draft || draft.status !== 'PENDING') {
      throw new AppError('Borrador no válido o ya procesado.', 409);
    }

    const rawItemsSource: unknown[] =
      Array.isArray(items) && items.length > 0 ? items : JSON.parse(draft.itemsJson || '[]');

    const sanitizedItems = rawItemsSource
      .map((item: any) => ({
        productId: Number(item?.productId),
        quantity: Number(item?.quantity),
        weight:
          item?.weight !== undefined && Number(item.weight) > 0 ? Number(item.weight) : undefined,
      }))
      .filter(
        (item) =>
          Number.isInteger(item.productId) &&
          item.productId > 0 &&
          Number.isInteger(item.quantity) &&
          item.quantity > 0,
      );

    if (sanitizedItems.length === 0) {
      throw new AppError('El borrador no contiene ítems válidos.', 400);
    }

    const personaId = draft.personaId || draft.conversation.personaId;
    if (!personaId) {
      throw new AppError('Asigne un cliente a la conversación antes de aprobar la orden.', 400);
    }

    const claimed = await prisma.crmOrderDraft.updateMany({
      where: { id: draftId, status: 'PENDING' },
      data: { status: 'APPROVED' },
    });

    if (claimed.count === 0) {
      throw new AppError('Borrador ya procesado por otra solicitud.', 409);
    }

    let newOrder;
    try {
      const requestedBilling =
        billingType === BillingType.OFFICIAL ? BillingType.OFFICIAL : BillingType.INTERNAL;

      newOrder = await OrderService.createOrder({
        sellerId: userId,
        userRole,
        personaId,
        billingType: requestedBilling,
        salesChannel: SalesChannel.TELEFONICO,
        notes:
          typeof notes === 'string' && notes.trim()
            ? notes.trim()
            : `Aprobado desde Borrador CRM #${draftId}`,
        items: sanitizedItems,
      });
    } catch (createError) {
      await prisma.crmOrderDraft
        .update({ where: { id: draftId }, data: { status: 'PENDING' } })
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

    return {
      message: '¡Borrador aprobado exitosamente y convertido en Preventa ERP!',
      order: newOrder,
    };
  },

  async linkPersona(conversationId: number, personaId: unknown) {
    if (!personaId) {
      throw new AppError('ID de persona es requerido.', 400);
    }
    const persona = await prisma.persona.findUnique({ where: { id: Number(personaId) } });
    if (!persona) {
      throw new AppError('Cliente ERP no encontrado.', 404);
    }
    return prisma.crmConversation.update({
      where: { id: conversationId },
      data: { personaId: persona.id, contactName: persona.name },
      include: { persona: { select: SAFE_CRM_PERSONA_SELECT } },
    });
  },

  async assignConversation(conversationId: number, assignedUserId: unknown) {
    return prisma.crmConversation.update({
      where: { id: conversationId },
      data: { assignedSellerId: assignedUserId ? Number(assignedUserId) : null },
      include: {
        persona: { select: SAFE_CRM_PERSONA_SELECT },
        assignedUser: { select: { id: true, username: true, role: true } },
      },
    });
  },

  async deleteConversation(conversationId: number) {
    if (Number.isNaN(conversationId)) {
      throw new AppError('ID de conversación inválido.', 400);
    }
    await prisma.crmMessage.deleteMany({ where: { conversationId } });
    await prisma.crmOrderDraft.deleteMany({ where: { conversationId } });
    await prisma.crmConversation.delete({ where: { id: conversationId } });
  },
};
