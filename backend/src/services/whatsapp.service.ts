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
  private get token() { return process.env.WHATSAPP_TOKEN || ''; }
  private get phoneNumberId() { return process.env.WHATSAPP_PHONE_NUMBER_ID || ''; }


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

    // 1. Detección de Intención de Pedido de Mercadería (IA Gemini)
    const isOrderIntent = ['pedido', 'cajon', 'cajones', 'caja', 'cajas', 'lata', 'latas', 'kilo', 'kilos', 'botella', 'botellas', 'pack', 'packs', 'mandame', 'mándame', 'quiero', 'comprar'].some(k => lower.includes(k));
    if (isOrderIntent) {
      try {
        await this.parseOrderWithAI(conversation.id, inputMessage);
        autoText = `🤖 *Asistente DV*: ¡Excelente! Registramos tu borrador de pedido en nuestro sistema. Un vendedor revisará y confirmará la preventa a la brevedad. 🛒`;
      } catch (err: any) {
        autoText = `🤖 *Asistente DV*: Tomamos nota de tu pedido. Un vendedor se comunicará a la brevedad para confirmar los ítems.`;
      }
    }

    // 2. Consulta de Saldo / Deuda en Cuenta Corriente
    else if (lower.includes('saldo') || lower.includes('debo') || lower.includes('deuda') || lower.includes('cuenta corriente')) {
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
    
    // 3. Consulta de Lista de Precios / Catálogo
    else if (lower.includes('precio') || lower.includes('lista') || lower.includes('catalogo') || lower.includes('catálogo')) {
      autoText = `🤖 *Asistente DV*: Te enviamos la información de catálogo de DV Distribuidora. También podés realizar tus pedidos online directamente en nuestra Tienda Web o dejar tu pedido anotado por este chat para que un vendedor lo apruebe.`;
    }

    // 4. Consulta de Reparto / Rutas de Logística
    else if (lower.includes('reparto') || lower.includes('camion') || lower.includes('camión') || lower.includes('cuando vienen') || lower.includes('cuándo vienen')) {
      if (conversation.personaId) {
        const persona = await prisma.persona.findUnique({ where: { id: conversation.personaId } });
        autoText = `🤖 *Asistente DV*: Tu zona registrada es *${persona?.route || 'General Villegas'}*. Los repartos se realizan habitualmente según la ruta asignada. Para consultar el estado en tiempo real de tu pedido, comunicate con logística.`;
      } else {
        autoText = `🤖 *Asistente DV*: Realizamos repartos continuos en General Villegas y zonas de influencia (Bunge, Banderaló, Piedritas, Ameghino, etc.).`;
      }
    }

    // 5. Saludo o Menú Inicial
    else if (['hola', 'buenas', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'consulta', 'menu'].some(k => lower.includes(k))) {
      autoText = `🤖 *Asistente DV (Bot 24/7)*: ¡Hola! Gracias por comunicarte con DV Distribuidora. ¿En qué podemos ayudarte?\n\n1️⃣ *Consulta de Saldo Cta Cte* (escribe "saldo")\n2️⃣ *Realizar un Pedido* (escribe "quiero 10 cajones de Quilmes...")\n3️⃣ *Días de Reparto* (escribe "reparto")\n4️⃣ *Catálogo y Precios* (escribe "precios")`;
    }

    // 6. Respuesta por Defecto
    else {
      autoText = `🤖 *Asistente DV (Bot 24/7)*: Gracias por escribirnos. Hemos recibido tu mensaje y un vendedor lo atenderá en breve. Escribe "hola" o "menu" para ver opciones automáticas.`;
    }

    if (autoText) {
      await this.sendMessage({
        to: conversation.waId,
        text: autoText
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

    // 1. Intentar interpretación con Gemini AI
    let geminiResult: Array<{ productId: number; quantity: number; note?: string }> = [];
    try {
      geminiResult = await geminiService.parseOrderMessage(rawText, catalog);
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
      const clauses = rawText.split(/,|\n|\by\b/i).map(c => c.trim()).filter(c => c.length > 2);
      const containerWords = ['caja', 'cajas', 'cajon', 'cajones', 'pack', 'packs', 'botella', 'botellas', 'kilo', 'kilos', 'kg', 'u', 'unid', 'unidades'];
      const stopWords = ['hola', 'mandame', 'mándame', 'quiero', 'por', 'favor', 'necesito', 'de', 'un', 'una', 'el', 'la', 'los', 'las'];

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

        if (bestProd && bestScore >= 2) {
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
