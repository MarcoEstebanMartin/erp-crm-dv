import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { geminiService } from './gemini.service';

const prisma = new PrismaClient();

export interface SendWhatsAppMessagePayload {
  to: string; // Número con código de país (ej: 5491112345678)
  text: string;
  mediaUrl?: string;
  mediaType?: string;
}

export class WhatsAppService {
  private apiVersion = 'v19.0';
  private token = process.env.WHATSAPP_TOKEN || '';
  private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

  /**
   * Envia un mensaje utilizando la API oficial de Meta WhatsApp Cloud.
   * Si las credenciales no están configuradas, registra el mensaje en la BD CRM en modo mock.
   */
  async sendMessage(payload: SendWhatsAppMessagePayload): Promise<any> {
    const cleanWaId = payload.to.replace(/\D/g, '');

    // 1. Obtener o crear conversación en CRM
    let conversation = await prisma.crmConversation.findUnique({
      where: { waId: cleanWaId }
    });

    if (!conversation) {
      // Buscar si corresponde a algún cliente existente en el ERP
      const persona = await prisma.persona.findFirst({
        where: {
          phone: { contains: cleanWaId.slice(-8) },
          isActive: true
        }
      });

      conversation = await prisma.crmConversation.create({
        data: {
          waId: cleanWaId,
          contactName: persona ? persona.name : `Contacto ${cleanWaId}`,
          personaId: persona ? persona.id : null
        }
      });
    }

    let wamid: string | null = null;
    let status: 'SENT' | 'FAILED' = 'SENT';

    // 2. Intentar envío por Meta Cloud API si hay credenciales
    if (this.token && this.phoneNumberId) {
      try {
        const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
        const requestData: any = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanWaId,
          type: payload.mediaUrl ? payload.mediaType || 'image' : 'text'
        };

        if (payload.mediaUrl) {
          const mediaKey = payload.mediaType === 'document' ? 'document' : 'image';
          requestData[mediaKey] = {
            link: payload.mediaUrl,
            caption: payload.text
          };
        } else {
          requestData.text = { body: payload.text };
        }

        const response = await axios.post(url, requestData, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.data?.messages?.[0]?.id) {
          wamid = response.data.messages[0].id;
        }
      } catch (error: any) {
        console.error('Error al enviar mensaje vía WhatsApp Cloud API:', error?.response?.data || error.message);
        status = 'FAILED';
      }
    } else {
      // Modo Mock / Sandbox (Enlaces wa.me asistidos)
      wamid = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // 3. Registrar mensaje enviado en CRM
    const message = await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        body: payload.text,
        mediaUrl: payload.mediaUrl || null,
        mediaType: payload.mediaType || null,
        wamid: wamid,
        status: status === 'SENT' ? 'SENT' : 'FAILED'
      }
    });

    // Actualizar última fecha de conversación
    await prisma.crmConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    return { message, conversation };
  }

  /**
   * Procesa un mensaje entrante recibido por el Webhook de Meta.
   */
  async handleIncomingMessage(rawMessage: any): Promise<any> {
    const waId = rawMessage.from;
    const wamid = rawMessage.id;
    const body = rawMessage.text?.body || rawMessage.caption || '[Archivo / Media]';
    const profileName = rawMessage.profile?.name || `Cliente WhatsApp ${waId}`;

    // Buscar o crear conversación
    let conversation = await prisma.crmConversation.findUnique({
      where: { waId }
    });

    if (!conversation) {
      const persona = await prisma.persona.findFirst({
        where: {
          phone: { contains: waId.slice(-8) },
          isActive: true
        }
      });

      conversation = await prisma.crmConversation.create({
        data: {
          waId,
          contactName: persona ? persona.name : profileName,
          personaId: persona ? persona.id : null,
          unreadCount: 1
        }
      });
    } else {
      await prisma.crmConversation.update({
        where: { id: conversation.id },
        data: {
          unreadCount: { increment: 1 },
          lastMessageAt: new Date()
        }
      });
    }

    // Evitar duplicados por wamid
    const existingMsg = await prisma.crmMessage.findUnique({ where: { wamid } });
    if (existingMsg) return existingMsg;

    const message = await prisma.crmMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        body,
        wamid,
        status: 'READ'
      }
    });

    return { message, conversation };
  }

  /**
   * Interpreta un texto o pedido de cliente mediante IA (Gemini)
   * y genera un Borrador de Pedido en CRM.
   */
  async parseOrderWithAI(conversationId: number, rawText: string): Promise<any> {
    const conversation = await prisma.crmConversation.findUnique({
      where: { id: conversationId },
      include: { persona: true }
    });

    if (!conversation) {
      throw new Error('Conversación CRM no encontrada.');
    }

    // Obtener catálogo de productos activos para la IA
    const activeProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        costPrice: true,
        commercialCategory: true
      },
      take: 150
    });

    // Búsqueda aproximada inteligente por catálogo
    const matchedItems: any[] = [];
    let totalEstimated = 0;
    const lower = rawText.toLowerCase();

    for (const prod of activeProducts) {
      const nameParts = prod.name.toLowerCase().split(' ').filter(p => p.length > 3);
      const isMatch = nameParts.some(part => lower.includes(part));
      if (isMatch) {
        // Intentar extraer cantidad cercana al producto o default 1
        matchedItems.push({
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          quantity: 1,
          unitPrice: Number(prod.costPrice),
          subtotal: Number(prod.costPrice)
        });
        totalEstimated += Number(prod.costPrice);
      }
    }

    const draft = await prisma.crmOrderDraft.create({
      data: {
        conversationId,
        personaId: conversation.personaId,
        rawText,
        itemsJson: JSON.stringify(matchedItems),
        totalEstimated,
        status: 'PENDING'
      }
    });

    return draft;
  }
}

export const whatsAppService = new WhatsAppService();
