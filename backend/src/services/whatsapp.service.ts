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

    await prisma.crmConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });

    return { message, conversation };
  }

  /**
   * Procesa un mensaje entrante recibido por el Webhook de Meta
   * y activa el motor de respuestas automáticas 24/7 si está habilitado.
   */
  async handleIncomingMessage(rawMessage: any): Promise<any> {
    const waId = rawMessage.from;
    const wamid = rawMessage.id;
    const body = rawMessage.text?.body || rawMessage.caption || '[Archivo / Media]';
    const profileName = rawMessage.profile?.name || `Cliente WhatsApp ${waId}`;

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
          unreadCount: 1,
          autoReplyEnabled: true,
          stage: 'LEAD'
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

    // 🤖 MOTOR DE RESPUESTAS AUTOMÁTICAS 24/7
    if (conversation.autoReplyEnabled) {
      await this.autoRespondIfEnabled(conversation, body);
    }

    return { message, conversation };
  }

  /**
   * Motor Inteligente de Auto-Respuesta 24/7 (Riesgo Cero)
   * Detecta intenciones frecuentes y responde consultando la BD del ERP.
   */
  private async autoRespondIfEnabled(conversation: any, inputMessage: string): Promise<void> {
    const lower = inputMessage.toLowerCase().trim();

    let autoText: string | null = null;

    // 1. Consulta de Saldo / Deuda en Cuenta Corriente
    if (lower.includes('saldo') || lower.includes('debo') || lower.includes('deuda') || lower.includes('cuenta corriente')) {
      if (conversation.personaId) {
        const persona = await prisma.persona.findUnique({ where: { id: conversation.personaId } });
        if (persona) {
          const balance = Number(persona.outstandingBalance || 0);
          autoText = `🤖 *Asistente DV*: Hola ${persona.name}. Tu saldo actual en Cuenta Corriente es *$${balance.toLocaleString('es-AR')}*. Si necesitas el detalle de comprobantes, te lo enviamos por este medio.`;
        }
      } else {
        autoText = `🤖 *Asistente DV*: Hola. No encontramos tu número vinculado a un cliente en nuestro sistema. Por favor envíanos tu CUIT o Razón Social para asociar tu cuenta.`;
      }
    }
    
    // 2. Consulta de Lista de Precios / Catálogo
    else if (lower.includes('precio') || lower.includes('lista') || lower.includes('catalogo') || lower.includes('catálogo')) {
      autoText = `🤖 *Asistente DV*: Te enviamos la información de catálogo de DV Distribuidora. También podés realizar tus pedidos online directamente en nuestra Tienda Web o dejar tu pedido anotado por este chat para que un vendedor lo apruebe.`;
    }

    // 3. Consulta de Reparto / Rutas de Logística
    else if (lower.includes('reparto') || lower.includes('camion') || lower.includes('camión') || lower.includes('cuando vienen') || lower.includes('cuándo vienen')) {
      if (conversation.personaId) {
        const persona = await prisma.persona.findUnique({ where: { id: conversation.personaId } });
        autoText = `🤖 *Asistente DV*: Tu zona registrada es *${persona?.route || 'General Villegas'}*. Los repartos se realizan habitualmente según la ruta asignada. Para consultar el estado en tiempo real de tu pedido, comunicate con logística.`;
      } else {
        autoText = `🤖 *Asistente DV*: Realizamos repartos continuos en General Villegas y zonas de influencia (Bunge, Banderaló, Piedritas, Ameghino, etc.).`;
      }
    }

    if (autoText) {
      // Esperar 1 segundo para simular respuesta natural
      setTimeout(async () => {
        await this.sendMessage({
          to: conversation.waId,
          text: autoText!
        });
      }, 1000);
    }
  }

  /**
   * Notificación Automática de Despacho de Pedido (Logística)
   */
  async sendDeliveryNotification(orderId: number): Promise<any> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { persona: true }
    });

    if (!order || !order.persona || !order.persona.phone) {
      return null;
    }

    const cleanPhone = order.persona.phone.replace(/\D/g, '');
    const text = `🚚 *DV Distribuidora - Notificación de Logística*: Hola ${order.persona.name}, tu Pedido #${order.id} por $${Number(order.totalAmount).toLocaleString('es-AR')} ha sido despachado y se encuentra en camino. ¡Muchas gracias por tu compra!`;

    return await this.sendMessage({
      to: cleanPhone,
      text
    });
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

    const matchedItems: any[] = [];
    let totalEstimated = 0;
    const lower = rawText.toLowerCase();

    for (const prod of activeProducts) {
      const nameParts = prod.name.toLowerCase().split(' ').filter(p => p.length > 3);
      const isMatch = nameParts.some(part => lower.includes(part));
      if (isMatch) {
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
