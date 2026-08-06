import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { geminiService } from './gemini.service';
import { aiChatbotService } from './aiChatbot.service';
import { generateMagicToken } from '../controllers/store.controller';
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
  } catch (e) {
    // Fallback
  }
  return 'localhost';
}

const prisma = new PrismaClient();

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
  to: string; // Número con código de país (ej: 5491112345678)
  text: string;
  mediaUrl?: string;
  mediaType?: string;
  isManualOperator?: boolean; // Si es enviado manualmente por un vendedor desde el CRM
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
    const localIp = getLocalIpAddress();
    return `http://${localIp}:5173`;
  }

  /**
   * Envia un mensaje utilizando la API oficial de Meta WhatsApp Cloud.
   * Si las credenciales no están configuradas, registra el mensaje en la BD CRM en modo mock.
   */
  async sendMessage(payload: SendWhatsAppMessagePayload): Promise<any> {
    const cleanWaId = normalizeWaId(payload.to);

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
    const waId = normalizeWaId(rawMessage.from);
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
      try {
        await this.autoRespondIfEnabled(conversation, body);
      } catch (err: any) {
        console.error('⚠️ Error en motor de auto-respuesta IA de WhatsApp:', err?.message || err);
      }
    }

    return { message, conversation };
  }

  /**
   * Motor Inteligente de Auto-Respuesta Humana (aiChatbotService)
   */
  private async autoRespondIfEnabled(conversation: any, inputMessage: string): Promise<void> {
    const personaId = conversation.personaId;
    let persona: any = null;
    if (personaId) {
      persona = await prisma.persona.findUnique({ where: { id: personaId } });
    }

    // Obtener historial reciente de la conversación
    const recentMessages = await prisma.crmMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 6
    });

    const history = recentMessages.reverse().map(m => ({
      role: m.direction === 'INBOUND' ? ('user' as const) : ('model' as const),
      content: m.body
    }));

    // Procesar con el motor unificado de IA conversacional
    const aiResponse = await aiChatbotService.processUserMessage({
      messageText: inputMessage,
      history,
      channel: 'WHATSAPP',
      customerName: persona?.name || conversation.contactName || 'Cliente',
      priceListType: (persona?.priceList as any) || 'LISTA_A'
    });

    // Si el usuario necesita atención de un vendedor humano, pausar el bot para este chat
    if (aiResponse.transferToHuman) {
      await prisma.crmConversation.update({
        where: { id: conversation.id },
        data: { autoReplyEnabled: false }
      });
    }

    // Si la IA generó un borrador de pedido, guardarlo en la base de datos
    if (aiResponse.draftOrderItems && aiResponse.draftOrderItems.length > 0) {
      const totalEstimated = aiResponse.draftOrderItems.reduce((acc, item) => acc + (item.subtotal || 0), 0);
      await prisma.crmOrderDraft.create({
        data: {
          conversationId: conversation.id,
          personaId: personaId || null,
          rawText: inputMessage,
          itemsJson: JSON.stringify(aiResponse.draftOrderItems),
          totalEstimated: totalEstimated,
          status: 'PENDING'
        }
      });
    }

    if (aiResponse.text) {
      await this.sendMessage({
        to: conversation.waId,
        text: aiResponse.text
      });
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
  /**
   * Interpreta un texto o pedido de cliente mediante IA (Gemini)
   * y genera un Borrador de Pedido en CRM.
   */
  async parseOrderWithAI(conversationId: number, rawText: string): Promise<any> {
    const conversation = await prisma.crmConversation.findUnique({
      where: { id: conversationId },
      include: {
        persona: true,
        drafts: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!conversation) {
      throw new Error('Conversación CRM no encontrada.');
    }

    // 0. Reutilizar borrador pendiente si ya contiene ítems válidos
    const existingDraft = conversation.drafts?.[0];
    if (existingDraft && existingDraft.itemsJson) {
      try {
        const parsedItems = JSON.parse(existingDraft.itemsJson);
        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
          return existingDraft;
        }
      } catch (e) {
        // Continuar si el JSON no era válido
      }
    }

    // Obtener los últimos mensajes del usuario para rescatar el contexto completo del pedido
    const recentInboundMsgs = await prisma.crmMessage.findMany({
      where: {
        conversationId,
        direction: 'INBOUND'
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const inboundTexts = recentInboundMsgs.map(m => m.body).reverse();
    let fullContextText = rawText;
    if (inboundTexts.length > 0) {
      const concatenated = inboundTexts.join('\n');
      if (!fullContextText || concatenated.toLowerCase().includes(fullContextText.toLowerCase())) {
        fullContextText = concatenated;
      } else {
        fullContextText = `${concatenated}\n${fullContextText}`;
      }
    }

    const activeProducts = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        listPrice: true,
        costPrice: true,
        unitsPerBox: true,
        commercialCategory: true
      },
      take: 500
    });

    const catalog = activeProducts.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      listPrice: Number(p.listPrice) > 0 ? Number(p.listPrice) : Number(p.costPrice),
      costPrice: Number(p.costPrice),
      unitsPerBox: p.unitsPerBox || 1,
      commercialCategory: p.commercialCategory
    }));

    const matchedItems: any[] = [];
    let totalEstimated = 0;

    // 1. Intentar interpretación con Gemini AI pasando el texto con contexto completo
    let geminiResult: Array<{ productId: number; quantity: number; note?: string }> = [];
    try {
      geminiResult = await geminiService.parseOrderMessage(fullContextText, catalog);
    } catch (err: any) {
      console.warn('⚡ Fallback a Matcher Algorítmico Local (Gemini offline o no configurado):', err.message);
    }

    if (geminiResult && geminiResult.length > 0) {
      for (const item of geminiResult) {
        const prod = catalog.find(p => p.id === item.productId);
        if (prod) {
          const qty = Math.max(1, item.quantity || 1);
          const price = prod.listPrice;
          const subtotal = price * qty;
          matchedItems.push({
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            quantity: qty,
            unitPrice: price,
            subtotal
          });
          totalEstimated += subtotal;
        }
      }
    } else {
      // 2. Fallback Matcher Algorítmico Inteligente (Determinista)
      const clauses = fullContextText.split(/,|\n|\by\b/i).map(c => c.trim()).filter(c => c.length > 2);
      const containerWords = ['caja', 'cajas', 'cajon', 'cajones', 'pack', 'packs', 'botella', 'botellas', 'kilo', 'kilos', 'kg', 'u', 'unid', 'unidades'];
      const stopWords = [
        'hola', 'mandame', 'mándame', 'quiero', 'por', 'favor', 'necesito', 'de', 'un', 'una', 'el', 'la', 'los', 'las',
        'pago', 'contrareembolso', 'contra', 'reembolso', 'efectivo', 'transferencia', 'gracias', 'buenisimo', 'buenísimo',
        'ok', 'dale', 'envio', 'envío', 'entrega', 'cbu', 'alias', 'mercado', 'mercadopago'
      ];

      const addedProductIds = new Set<number>();

      for (const clause of clauses) {
        const numberMatch = clause.match(/\b(\d+)\b/);
        let qty = numberMatch ? parseInt(numberMatch[1], 10) : 1;

        const isBox = containerWords.some(w => ['caja', 'cajas', 'cajon', 'cajones', 'pack', 'packs'].includes(w) && clause.toLowerCase().includes(w));

        const clauseTokens = clause.toLowerCase()
          .replace(/[^\w\s]/gi, '')
          .split(/\s+/)
          .filter(w => !containerWords.includes(w) && !stopWords.includes(w) && !/^\d+$/.test(w) && w.length > 1);

        if (clauseTokens.length === 0) continue;

        let bestProd: typeof catalog[0] | null = null;
        let bestScore = 0;

        for (const prod of catalog) {
          if (addedProductIds.has(prod.id)) continue;

          const prodNameLower = prod.name.toLowerCase();
          const prodTokens = prodNameLower.split(/\s+/);
          let score = 0;

          for (const token of clauseTokens) {
            const tokenStem = token.replace(/(s|es)$/i, '');
            for (const prodWord of prodTokens) {
              const prodStem = prodWord.replace(/(s|es)$/i, '');
              if (prodWord === token || (prodStem === tokenStem && tokenStem.length >= 3)) {
                score += 4;
              } else if ((prodWord.includes(tokenStem) || tokenStem.includes(prodStem)) && tokenStem.length >= 3) {
                score += 3;
              }
            }
          }

          if (prodNameLower.includes('caja') && !clause.toLowerCase().includes('yerba')) {
            score -= 2;
          }

          if (score > bestScore) {
            bestScore = score;
            bestProd = prod;
          }
        }

        if (bestProd && bestScore >= 4) {
          addedProductIds.add(bestProd.id);
          const finalQty = isBox ? (bestProd.unitsPerBox > 1 ? bestProd.unitsPerBox * qty : 12 * qty) : qty;
          const price = bestProd.listPrice;
          const subtotal = price * finalQty;

          matchedItems.push({
            productId: bestProd.id,
            productName: bestProd.name,
            sku: bestProd.sku,
            quantity: finalQty,
            unitPrice: price,
            subtotal
          });
          totalEstimated += subtotal;
        }
      }
    }

    const draft = await prisma.crmOrderDraft.create({
      data: {
        conversationId,
        personaId: conversation.personaId,
        rawText: fullContextText || rawText,
        itemsJson: JSON.stringify(matchedItems),
        totalEstimated,
        status: 'PENDING'
      }
    });

    return draft;
  }
}

export const whatsAppService = new WhatsAppService();
