import prisma from '../utils/prisma';
import { aiChatbotService } from './aiChatbot.service';
import {
  dispatchWhatsAppCloudRequest,
  enqueueWhatsAppOutboundRetry,
  executeWithResilientRetry,
  isTransientExternalError,
} from './resilience/external-integrations-retry.service';
import { parseWhatsAppOrderDraft } from './whatsapp/whatsapp-order-parser.service';
import dotenv from 'dotenv';
import os from 'os';

function getLocalIpAddress(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {
    // Fallback
  }
  return 'localhost';
}

export function normalizeWaId(phone: string): string {
  let clean = (phone || '').replace(/\D/g, '');
  if (clean.length === 12 && clean.startsWith('54') && !clean.startsWith('549')) {
    clean = '549' + clean.slice(2);
  } else if (clean.length === 10) {
    clean = '549' + clean;
  }
  return clean;
}

export interface SendWhatsAppMessagePayload {
  to: string;
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  isManualOperator?: boolean;
}

export class WhatsAppService {
  private apiVersion = 'v19.0';

  private get token() {
    dotenv.config({ override: true });
    return process.env.WHATSAPP_TOKEN || '';
  }

  private get phoneNumberId() {
    dotenv.config({ override: true });
    return process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  private get frontendUrl() {
    dotenv.config({ override: true });
    if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost')) {
      return process.env.FRONTEND_URL;
    }
    return `http://${getLocalIpAddress()}:5173`;
  }

  /**
   * Envía un mensaje utilizando Meta WhatsApp Cloud API con reintentos inmediatos
   * y encolado resiliente (exponential backoff) ante caídas transitorias 429/5xx/timeout.
   */
  async sendMessage(payload: SendWhatsAppMessagePayload): Promise<any> {
    const cleanWaId = normalizeWaId(payload.to);

    let conversation = await prisma.crmConversation.findUnique({
      where: { waId: cleanWaId },
    });

    if (!conversation) {
      const persona = await prisma.persona.findFirst({
        where: { phone: { contains: cleanWaId.slice(-8) }, isActive: true },
      });

      conversation = await prisma.crmConversation.create({
        data: {
          waId: cleanWaId,
          contactName: persona ? persona.name : `Contacto ${cleanWaId}`,
          personaId: persona ? persona.id : null,
        },
      });
    }

    let wamid: string | null = null;
    let status: 'SENT' | 'FAILED' = 'SENT';
    let retryDispatchInput: Parameters<typeof dispatchWhatsAppCloudRequest>[0] | null = null;
    const isWhatsAppLiveEnabled = process.env.WHATSAPP_ENABLED === 'true';

    if (isWhatsAppLiveEnabled && this.token && this.phoneNumberId) {
      const dispatchInput = {
        apiVersion: this.apiVersion,
        phoneNumberId: this.phoneNumberId,
        token: this.token,
        toWaId: cleanWaId,
        text: payload.text,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
      };
      try {
        const res = await executeWithResilientRetry(
          () => dispatchWhatsAppCloudRequest(dispatchInput),
          {
            maxAttempts: 2,
            baseDelayMs: 600,
            maxDelayMs: 1_800,
            isRetryable: isTransientExternalError,
          },
        );
        wamid = res.wamid || `wa_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      } catch (error: any) {
        console.error('⚠️ Error en Meta Cloud API al enviar WhatsApp:', error?.message);
        status = 'FAILED';
        if (isTransientExternalError(error)) {
          wamid = `retrying_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          retryDispatchInput = dispatchInput;
        } else {
          wamid = `failed_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        }
      }
    } else {
      wamid = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    const message = await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        body: payload.text,
        mediaUrl: payload.mediaUrl || null,
        mediaType: payload.mediaType || null,
        wamid,
        status,
      },
    });

    if (retryDispatchInput) {
      enqueueWhatsAppOutboundRetry(message.id, retryDispatchInput);
    }

    await prisma.crmConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    return { message, conversation };
  }

  async handleIncomingMessage(rawMessage: any): Promise<any> {
    const waId = normalizeWaId(rawMessage.from);
    const wamid = rawMessage.id;
    const body = rawMessage.text?.body || rawMessage.caption || '[Archivo / Media]';
    const profileName = rawMessage.profile?.name || `Cliente WhatsApp ${waId}`;

    let conversation = await prisma.crmConversation.findUnique({ where: { waId } });

    if (!conversation) {
      const persona = await prisma.persona.findFirst({
        where: { phone: { contains: waId.slice(-8) }, isActive: true },
      });

      conversation = await prisma.crmConversation.create({
        data: {
          waId,
          contactName: persona ? persona.name : profileName,
          personaId: persona ? persona.id : null,
          unreadCount: 1,
          autoReplyEnabled: true,
          stage: 'LEAD',
        },
      });
    } else {
      await prisma.crmConversation.update({
        where: { id: conversation.id },
        data: { unreadCount: { increment: 1 }, lastMessageAt: new Date() },
      });
    }

    const existingMsg = await prisma.crmMessage.findUnique({ where: { wamid } });
    if (existingMsg) return existingMsg;

    const message = await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        body,
        wamid,
        status: 'READ',
      },
    });

    if (conversation.autoReplyEnabled) {
      try {
        await this.autoRespondIfEnabled(conversation, body);
      } catch (err: any) {
        console.error('⚠️ Error en motor de auto-respuesta IA de WhatsApp:', err?.message || err);
      }
    }

    return { message, conversation };
  }

  private async autoRespondIfEnabled(conversation: any, inputMessage: string): Promise<void> {
    const personaId = conversation.personaId;
    const persona = personaId
      ? await prisma.persona.findUnique({ where: { id: personaId } })
      : null;

    const recentMessages = await prisma.crmMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });

    const history = recentMessages.reverse().map((m) => ({
      role: m.direction === 'INBOUND' ? ('user' as const) : ('model' as const),
      content: m.body,
    }));

    const aiResponse = await aiChatbotService.processUserMessage({
      messageText: inputMessage,
      history,
      channel: 'WHATSAPP',
      customerName: persona?.name || conversation.contactName || 'Cliente',
      priceListType: (persona?.priceList as any) || 'LISTA_A',
    });

    if (aiResponse.transferToHuman) {
      await prisma.crmConversation.update({
        where: { id: conversation.id },
        data: { autoReplyEnabled: false },
      });
    }

    if (aiResponse.draftOrderItems && aiResponse.draftOrderItems.length > 0) {
      const totalEstimated = aiResponse.draftOrderItems.reduce(
        (acc, item) => acc + (item.subtotal || 0),
        0,
      );
      await prisma.crmOrderDraft.create({
        data: {
          conversationId: conversation.id,
          personaId: personaId || null,
          rawText: inputMessage,
          itemsJson: JSON.stringify(aiResponse.draftOrderItems),
          totalEstimated,
          status: 'PENDING',
        },
      });
    }

    if (aiResponse.text) {
      await this.sendMessage({ to: conversation.waId, text: aiResponse.text });
    }
  }

  async sendDeliveryNotification(orderId: number): Promise<any> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { persona: true },
    });

    if (!order || !order.persona || !order.persona.phone) {
      return null;
    }

    const cleanPhone = order.persona.phone.replace(/\D/g, '');
    const text = `🚚 *DV Distribuidora - Notificación de Logística*: Hola ${order.persona.name}, tu Pedido #${order.id} por $${Number(order.totalAmount).toLocaleString('es-AR')} ha sido despachado y se encuentra en camino. ¡Muchas gracias por tu compra!`;

    return this.sendMessage({ to: cleanPhone, text });
  }

  async parseOrderWithAI(conversationId: number, rawText: string): Promise<any> {
    return parseWhatsAppOrderDraft(conversationId, rawText);
  }
}

export const whatsAppService = new WhatsAppService();
