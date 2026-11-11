import type { GoogleGenAI } from '@google/genai';
import prisma from '../utils/prisma';
import { roundToIntegerPeso } from '../core/money';
import {
  type InteractionContentItem,
  buildInlineMediaContent,
  isGeminiApiKeyConfigured,
  runGeminiInteraction,
} from './ai/genai-client.helper';
import {
  CHATBOT_RESPONSE_JSON_SCHEMA,
  chatbotResponseValidator,
  parseStructuredJsonText,
} from '../validators/ai-schemas.validator';

export interface ChatMessageContext {
  role: 'user' | 'model';
  content: string;
}

export interface ChatbotResponse {
  text: string;
  intent:
    | 'CATALOG_INQUIRY'
    | 'ORDER_DRAFT'
    | 'RECEIPT_OCR'
    | 'TRANSFER_TO_HUMAN'
    | 'GENERAL_TALK';
  draftOrderItems?: Array<{
    productId: number;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  ocrData?: any;
  transferToHuman?: boolean;
}

export function getFirstName(fullName?: string | null): string {
  if (!fullName) return 'Cliente';
  const firstWord = fullName.trim().split(/\s+/)[0];
  if (!firstWord) return 'Cliente';
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
}

export class AiChatbotService {
  constructor(private readonly clientOverride?: GoogleGenAI) {}

  /**
   * Obtener catálogo formateado para la IA exponiendo ÚNICAMENTE el precio entero de la lista
   * correspondiente al interlocutor y disponibilidad booleana (sin filtrar Lista B/C ni stock exacto).
   */
  public async getFormattedCatalog(priceListType: 'LISTA_A' | 'LISTA_B' | 'LISTA_C' = 'LISTA_A') {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        commercialCategory: true,
        listPrice: true,
        listPriceB: true,
        listPriceC: true,
        unitsPerBox: true,
        stock: true,
        isPesable: true,
      },
      take: 300,
    });

    return products.map((p) => {
      const resolvedRawPrice =
        priceListType === 'LISTA_C'
          ? p.listPriceC || p.listPrice
          : priceListType === 'LISTA_B'
            ? p.listPriceB || p.listPrice
            : p.listPrice;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        cat: p.commercialCategory || 'General',
        precio: roundToIntegerPeso(resolvedRawPrice ? resolvedRawPrice.toString() : 0).toNumber(),
        unidCaja: p.unitsPerBox || 1,
        disponible: p.stock > 0,
        unid: p.isPesable ? 'KG' : 'UN',
      };
    });
  }

  /**
   * Procesa mensaje entrante del usuario (Web o WhatsApp) con Interactions API (`@google/genai`)
   * y Structured Outputs (`CHATBOT_RESPONSE_JSON_SCHEMA`).
   */
  async processUserMessage(params: {
    messageText: string;
    history?: ChatMessageContext[];
    mediaBase64?: string;
    mediaMimeType?: string;
    channel: 'WEB' | 'WHATSAPP';
    customerName?: string;
    priceListType?: 'LISTA_A' | 'LISTA_B' | 'LISTA_C';
  }): Promise<ChatbotResponse> {
    const {
      messageText,
      history = [],
      mediaBase64,
      mediaMimeType,
      channel,
      customerName = 'Cliente',
      priceListType = 'LISTA_A',
    } = params;

    const firstName = getFirstName(customerName);
    const requiredWelcomeHeader = `Hola ${firstName} 👋! Soy Ben, tu asistente de inteligencia artificial. Contame con el mayor detalle posible que necesitas, asi puedo darte una mejor respuesta. Estoy aca para ayudarte.`;

    if (!this.clientOverride && !isGeminiApiKeyConfigured()) {
      return {
        text: requiredWelcomeHeader,
        intent: 'GENERAL_TALK',
      };
    }

    const catalog = await this.getFormattedCatalog(priceListType);

    const systemInstruction = `
Eres **Ben**, el asistente de inteligencia artificial de **DV Distribuidora** (distribuidora mayorista de alimentos y bebidas en Argentina).

PERSONALIDAD Y TONO:
- Eres amable, atento, profesional y resolutivo en español de Argentina, sin frases robóticas.
- El cliente actual se llama "${firstName}". Usa ÚNICAMENTE su primer nombre cuando corresponda:
  1. En el PRIMER mensaje de la conversación, comienza con: "${requiredWelcomeHeader}"
  2. En respuestas intermedias, NO repitas su nombre ni el saludo inicial.
  3. Al despedirte o cerrar un pedido, agradece mencionando su primer nombre ("${firstName}").

DATOS DEL CATÁLOGO EN TIEMPO REAL (Canal: ${channel}):
- El campo 'precio' ya está en pesos enteros finales y 'disponible' indica si hay stock.
${JSON.stringify(catalog)}

REGLAS DE INTENCIÓN:
1. CATALOG_INQUIRY: Consultas de precios o disponibilidad (ofrece alternativas si disponible=false).
2. ORDER_DRAFT: Si pide productos, identifícalos en el catálogo respetando 'unidCaja' cuando pida cajas/packs y calcula unitPrice y subtotal en pesos enteros.
3. RECEIPT_OCR: Si adjunta comprobante de transferencia o lista manuscrita, interprétalo con precisión.
4. TRANSFER_TO_HUMAN: Si pide hablar con una persona, solicita descuento especial fuera de lista o plantea un reclamo, marca transferToHuman=true.
`.trim();

    const inputItems: InteractionContentItem[] = [];

    if (history.length > 0) {
      const formattedHistory = history
        .map((h) => `${h.role === 'user' ? 'Cliente' : 'Ben (IA)'}: ${h.content}`)
        .join('\n');
      inputItems.push({
        type: 'text',
        text: `HISTORIAL RECIENTE DE CONVERSACIÓN:\n${formattedHistory}`,
      });
    }

    inputItems.push({
      type: 'text',
      text: `MENSAJE ACTUAL DE CLIENTE (${firstName}): "${
        messageText || (mediaBase64 ? 'Adjunto de imagen/documento' : '')
      }"`,
    });

    if (mediaBase64 && mediaMimeType) {
      inputItems.push(buildInlineMediaContent(mediaMimeType, mediaBase64));
    }

    try {
      const responseText = await runGeminiInteraction({
        client: this.clientOverride,
        systemInstruction,
        input: inputItems,
        jsonSchema: CHATBOT_RESPONSE_JSON_SCHEMA,
      });

      const parsed = chatbotResponseValidator.parse(parseStructuredJsonText(responseText));
      const hasPreviousBotReply = history.some((h) => h.role === 'model');
      let finalText = parsed.text || '¡Con mucho gusto te ayudo! ¿Qué productos necesitas?';

      if (!hasPreviousBotReply) {
        if (!finalText.includes('Soy Ben, tu asistente de inteligencia artificial')) {
          const cleanContent = finalText.replace(/^¡?Hola[^!\n]*![ \t]*/i, '').trim();
          finalText = cleanContent
            ? `${requiredWelcomeHeader}\n\n${cleanContent}`
            : requiredWelcomeHeader;
        }
      } else {
        finalText = finalText.replace(/^¡?Hola(\s+[\w\s]+)?![ \t]*/i, '').trim();
      }

      return {
        text: finalText,
        intent: parsed.intent,
        draftOrderItems: parsed.draftOrderItems,
        transferToHuman: parsed.transferToHuman,
      };
    } catch (error: any) {
      console.error('[AiChatbotService] Error procesando mensaje con Gemini:', error);
      const hasPreviousBotReply = history.some((h) => h.role === 'model');

      return {
        text: !hasPreviousBotReply
          ? requiredWelcomeHeader
          : `¡Muchas gracias por tu mensaje, ${firstName}! 👋 Un asesor de nuestro equipo comercial te responderá a la brevedad.`,
        intent: 'GENERAL_TALK',
        transferToHuman: true,
      };
    }
  }
}

export const aiChatbotService = new AiChatbotService();
