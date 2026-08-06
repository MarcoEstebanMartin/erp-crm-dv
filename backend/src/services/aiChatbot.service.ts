import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export interface ChatMessageContext {
  role: 'user' | 'model';
  content: string;
}

export interface ChatbotResponse {
  text: string;
  intent: 'CATALOG_INQUIRY' | 'ORDER_DRAFT' | 'RECEIPT_OCR' | 'TRANSFER_TO_HUMAN' | 'GENERAL_TALK';
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

async function callGeminiFallback(promptParts: Array<string | Part>, responseMimeType?: string) {
  const candidateModels = [
    process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-flash'
  ];
  const uniqueModels = Array.from(new Set(candidateModels));
  let lastError: any = null;

  for (const modelName of uniqueModels) {
    try {
      const modelConfig: any = { model: modelName };
      if (responseMimeType) {
        modelConfig.generationConfig = { responseMimeType };
      }
      const model = genAI.getGenerativeModel(modelConfig);
      return await model.generateContent(promptParts);
    } catch (err: any) {
      lastError = err;
      console.warn(`[AiChatbotService] Modelo ${modelName} no disponible: ${err.message || err}. Probando siguiente...`);
    }
  }
  throw lastError;
}

export class AiChatbotService {
  /**
   * Obtener catálogo formateado y optimizado para la IA en tiempo real desde la BD
   */
  private async getFormattedCatalog() {
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
        currentStock: true,
        unit: true
      },
      take: 300 // Límite razonable para ventana de contexto
    });

    return products.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      cat: p.commercialCategory || 'General',
      precioA: p.listPrice,
      precioB: p.listPriceB || p.listPrice,
      precioC: p.listPriceC || p.listPrice,
      unidCaja: p.unitsPerBox || 1,
      stock: p.currentStock,
      unid: p.unit || 'UN'
    }));
  }

  /**
   * Procesar mensaje entrante del usuario (Web o WhatsApp) con contexto conversacional
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
      priceListType = 'LISTA_A'
    } = params;

    // Si no hay API KEY, fallback cordial
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      return {
        text: `¡Hola ${customerName}! 👋 Soy Santi, el asistente virtual de DV Distribuidora. Estamos configurando nuestro sistema de IA. En breve un asesor humano se comunicará contigo.`,
        intent: 'GENERAL_TALK'
      };
    }

    const catalog = await this.getFormattedCatalog();

    const systemPrompt = `
Eres **Santi**, el asistente virtual inteligente de **DV Distribuidora** (distribuidora mayorista de alimentos y bebidas en Argentina).

PERSONALIDAD Y TONO:
- Eres **extremadamente amable, educado, empático, profesional y resolutivo**.
- Hablas en español de Argentina con calidez (respetuoso pero cercano, usando frases como "¡Con mucho gusto!", "Por supuesto", "Dame un segundito que te lo verifico").
- Transparencia: Eres transparente en que eres un asistente virtual de IA, pero tu atención es tan humana, cálida y atenta que da gusto conversar contigo.
- NUNCA respondas con frases robóticas ni estructuras rígidas de bot. Conversa de manera natural y fluida.

DATOS DE LA EMPRESA Y CATÁLOGO REAL:
- El cliente actual se llama: "${customerName}".
- Lista de precios aplicable: ${priceListType} (Usa los valores correspondientes de precioA, precioB o precioC del catálogo).
- Canal de atención: ${channel}.

CATÁLOGO DE PRODUCTOS DISPONIBLES EN TIEMPO REAL:
${JSON.stringify(catalog)}

REGLAS DE RESPUESTA E INTENCIONES:
1. CONSULTA DE CATÁLOGO / PRECIOS:
   - Responde amablemente dando los precios de tu catálogo.
   - Si no hay stock suficiente, ofrece alternativas del catálogo con tono empático.
2. ARMADO DE PEDIDOS / CARRITO:
   - Si el cliente te pide productos (ej: "Mándame 2 cajones de fernet y 5 cremosos"), identifica los productos correspondientes en el catálogo.
   - Ten en cuenta unidades por caja ('unidCaja') si el cliente habla de "cajas", "packs" o "cajones".
   - Calcula el subtotal por producto y el precio total.
3. IMÁGENES / COMPROBANTES DE PAGO O NOTAS MANUSCRITAS:
   - Si se adjunta una foto, analiza el documento:
     - Si es un comprobante de transferencia bancaria, confirma la recepción amablemente y extrae monto y número de transacción.
     - Si es una foto de una lista escrita a mano, lee los ítems y búscalos en el catálogo.
4. DERIVACIÓN A ASESOR HUMANO:
   - Si el cliente pide hablar con una persona, solicita un descuento especial fuera de lista o tiene un reclamo delicado:
     - Responde con máxima empatía indicando que transfieres la conversación al equipo comercial humano.
     - En el JSON de salida marca "transferToHuman": true.

FORMATO DE SALIDA DE TU RESPUESTA:
Debes responder NÚNICAMENTE con un objeto JSON válido con la siguiente estructura:
{
  "text": "Tu mensaje conversacional amable en texto plano listo para enviar al usuario",
  "intent": "CATALOG_INQUIRY | ORDER_DRAFT | RECEIPT_OCR | TRANSFER_TO_HUMAN | GENERAL_TALK",
  "draftOrderItems": [
    {
      "productId": 123,
      "productName": "Nombre exacto del catálogo",
      "sku": "SKU",
      "quantity": 2,
      "unitPrice": 15000,
      "subtotal": 30000
    }
  ],
  "transferToHuman": false
}
`;

    // Preparar partes del prompt para Gemini
    const promptParts: Array<string | Part> = [systemPrompt];

    // Incluir historial de chat para contexto
    if (history.length > 0) {
      const formattedHistory = history.map(h => `${h.role === 'user' ? 'Cliente' : 'Santi (IA)'}: ${h.content}`).join('\n');
      promptParts.push(`HISTORIAL RECIENTE DE CONVERSACIÓN:\n${formattedHistory}`);
    }

    // Agregar el mensaje actual
    promptParts.push(`MENSAJE ACTUAL DE CLIENTE (${customerName}): "${messageText || (mediaBase64 ? 'Adjunto de imagen/documento' : '')}"`);

    // Agregar media si existe
    if (mediaBase64 && mediaMimeType) {
      promptParts.push({
        inlineData: {
          data: mediaBase64,
          mimeType: mediaMimeType
        }
      });
    }

    try {
      const result = await callGeminiFallback(promptParts, 'application/json');
      const responseText = result.response.text().trim();
      const parsed: ChatbotResponse = JSON.parse(responseText);

      return {
        text: parsed.text || '¡Con mucho gusto te ayudo! ¿Qué productos necesitas?',
        intent: parsed.intent || 'GENERAL_TALK',
        draftOrderItems: parsed.draftOrderItems || [],
        transferToHuman: Boolean(parsed.transferToHuman)
      };
    } catch (error: any) {
      console.error('[AiChatbotService] Error procesando mensaje con Gemini:', error);
      return {
        text: `¡Hola ${customerName}! 👋 Muchas gracias por tu mensaje. Un asesor de nuestro equipo comercial te responderá a la brevedad.`,
        intent: 'GENERAL_TALK',
        transferToHuman: true
      };
    }
  }
}

export const aiChatbotService = new AiChatbotService();
