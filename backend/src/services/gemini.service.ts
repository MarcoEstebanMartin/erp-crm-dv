import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export interface ExtractedInvoiceData {
  supplierName: string;
  cuit: string | null;
  receiverCuit: string | null;
  receiverName: string | null;
  documentType: string;
  documentNumber: string;
  issueDate: string;
  items: Array<{
    code: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  netAmount: number;
  taxAmount: number;
  percepcionAmount: number; // Suma total de percepciones (compatible con lógica previa si fuera necesario)
  percepcionIIBBAmount: number; // Específico de Ingresos Brutos
  percepcionIvaAmount: number; // Específico de IVA RG 3337
  percepcionIva5329Amount: number; // Específico de IVA RG 5329
  percepcionJurisdiction: string | null; // Provincia de la percepción IIBB (ej: "Buenos Aires", "CABA", etc.)
  totalAmount: number;
}

async function generateWithFallback(
  promptParts: Array<string | Part>,
  responseMimeType?: string
) {
  const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const candidateModels = [
    primaryModel,
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
      const result = await model.generateContent(promptParts);
      return result;
    } catch (err: any) {
      lastError = err;
      console.warn(`[GeminiService] Modelo ${modelName} no disponible: ${err.message || err}. Probando siguiente modelo...`);
    }
  }
  throw lastError;
}

export class GeminiService {
  /**
   * Procesa un archivo (imagen o pdf) y extrae los datos de la factura/remito.
   */
  async extractInvoiceData(mimeType: string, base64Data: string): Promise<ExtractedInvoiceData> {
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      throw new Error('GEMINI_API_KEY no está configurada o es inválida.');
    }

    const filePart: Part = {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };

    const prompt = `
      Eres un experto en extracción de datos de facturas y remitos comerciales de Argentina.
      Analiza este documento y extrae la siguiente información en formato JSON strictly:
      - supplierName: Razón social del emisor (proveedor, ej: SODECAR S.A.).
      - cuit: CUIT del emisor/proveedor (si existe).
      - receiverCuit: CUIT del receptor (comprador, ej: 20163165059 o similar).
      - receiverName: Razón social o Nombre del receptor (comprador, ej: MARTIN PABLO DAVID).
      - documentType: Tipo de documento ("FACTURA_A", "FACTURA_B", "FACTURA_C", "REMITO").
      - documentNumber: Número del comprobante (formato XXXX-XXXXXXXX).
      - issueDate: Fecha de emisión en formato YYYY-MM-DD.
      - items: Arreglo de objetos con:
        - code: Código o número de artículo del emisor/proveedor (si existe, ej: "0109000000" o "7667/1").
        - description: Descripción del producto (ej: PERNIL DE CERDO 1/2K, F.DTO.PALETA CBR, BONDIOLA ENTERA, etc.).
        - quantity: Cantidad de unidades o kilogramos (número). Si hay columnas de Kilogramos y Unidades, priorizar el peso/kilos si el precio unitario corresponde a kilos, o la cantidad vendida.
        - unitPrice: Precio unitario neto o bruto (número).
        - subtotal: Subtotal del ítem (número).
      - netAmount: Importe neto gravado (número).
      - taxAmount: Importe de IVA (número).
      - percepcionAmount: Importe total acumulado de todas las percepciones (número).
      - percepcionIIBBAmount: Importe específico de la percepción de Ingresos Brutos (IIBB) sufrida (número).
      - percepcionIvaAmount: Importe específico de la percepción de IVA Régimen General RG 3337 (número).
      - percepcionIva5329Amount: Importe específico de la percepción de IVA Alimentos Canasta Básica RG 5329 (número).
      - percepcionJurisdiction: Jurisdicción o provincia asociada a la percepción de IIBB (ej: "Buenos Aires", "CABA", "Santa Fe", "Misiones", etc.), si se indica expresamente; si no, null.
      - totalAmount: Importe total (número).

      Asegúrate de que todos los valores numéricos sean números y no cadenas.
      Si un valor no está presente en el documento (por ejemplo, impuestos en un remito), devuélvelo como 0.
      Si el CUIT no está, devuélvelo como null.
    `;

    try {
      const result = await generateWithFallback([prompt, filePart], 'application/json');
      const responseText = result.response.text();
      const jsonData = JSON.parse(responseText);
      return jsonData as ExtractedInvoiceData;
    } catch (error: any) {
      console.error('Error al procesar el documento con Gemini:', error);
      throw new Error('Fallo en el procesamiento de OCR con IA: ' + error.message);
    }
  }

  /**
   * Procesa un archivo de audio (nota de voz de WhatsApp) y transfiere la voz a texto comercial.
   */
  async transcribeAudioOrder(mimeType: string, base64Audio: string): Promise<{ rawText: string }> {
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      return { rawText: 'Nota de voz recibida. Transcripción IA disponible con GEMINI_API_KEY.' };
    }

    const audioPart: Part = {
      inlineData: {
        data: base64Audio,
        mimeType
      }
    };

    const prompt = `
      Eres un asistente experto en toma de pedidos comerciales de alimentos y bebidas en Argentina.
      Escucha esta nota de voz y transcribe textualmente los productos, cantidades y marcas solicitados.
    `;

    try {
      const result = await generateWithFallback([prompt, audioPart]);
      const rawText = result.response.text().trim();
      return { rawText };
    } catch (error: any) {
      console.error('Error procesando nota de voz con Gemini:', error);
      return { rawText: 'Nota de voz recibida por WhatsApp.' };
    }
  }

  /**
   * Interpreta un texto de pedido de WhatsApp utilizando Gemini AI y empareja con el catálogo del ERP.
   */
  async parseOrderMessage(rawText: string, catalog: Array<{ id: number; sku: string; name: string; listPrice: number; costPrice: number; unitsPerBox: number; commercialCategory?: string | null }>): Promise<Array<{ productId: number; quantity: number; note?: string }>> {
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const catalogFormatted = catalog.map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unitsPerBox: p.unitsPerBox || 1,
      category: p.commercialCategory || ''
    }));

    const prompt = `
      Eres el asistente inteligente de toma de pedidos mayoristas de DV Distribuidora (alimentos y bebidas en Argentina).
      Tu tarea es interpretar el texto/conversación del cliente en WhatsApp y emparejar CADA producto solicitado con el CATÁLOGO DE PRODUCTOS de la empresa.

      TEXTO DE LA CONVERSACIÓN DEL CLIENTE:
      "${rawText}"

      CATÁLOGO DE PRODUCTOS DISPONIBLES:
      ${JSON.stringify(catalogFormatted)}

      REGLAS STRICTAS DE MATCHING:
      1. Identifica únicamente los productos que el cliente solicita explícitamente comprar en la conversación.
      2. ATENCIÓN AL CONTEXTO CONVERSACIONAL: Si el texto contiene mensajes de pago o logística (ej: "Pago contrareembolso", "Efectivo", "Enviamelo mañana", "Paso por el depósito"), busca si previamente en el texto se solicitaron productos. 
      3. SI NO SE SOLICITAN PRODUCTOS EN EL TEXTO: Si el cliente solo está saludando, indicando la forma de pago o haciendo consultas sin pedir ningún producto específico del catálogo, devuelve estrictamente un arreglo de ítems VACÍO: {"items": []}. ¡JAMÁS inventes ni asignes productos aleatorios si el cliente no pidió nada!
      4. Para cada ítem solicitado, selecciona SOLAMENTE UN producto del catálogo que sea la mejor coincidencia. NO agregues productos duplicados o variantes adicionales.
      5. EXTRAER CANTIDAD:
         - Extrae la cantidad numérica exacta especificada (ej: "10 cremosos" -> 10, "2 tybo" -> 2).
         - Si el cliente especifica empaque como "caja", "cajon", "pack" (ej: "1 caja de fernet"), calcula la cantidad total multiplicando la cantidad de cajas por 'unitsPerBox' del producto (o si es 1, asume 12 unidades por caja si es bebida).
         - Si no se indica número, la cantidad es 1.
      6. FALSOS POSITIVOS Y PALABRAS DE CONTENEDOR O PAGO:
         - Palabras como "caja", "cajon", "pack", "botella", "lata", "kilo", "pago", "contrareembolso", "efectivo", "transferencia", "gracias" NO son nombres de productos.
      7. Devuelve un JSON strictly con la siguiente estructura:
         {
           "items": [
             {
               "productId": 123,
               "quantity": 10,
               "note": "10 u."
             }
           ]
         }
    `;

    try {
      const result = await generateWithFallback([prompt], 'application/json');
      const responseText = result.response.text().trim();
      const parsed = JSON.parse(responseText);
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch (error: any) {
      console.error('Error al procesar pedido con Gemini:', error);
      return [];
    }
  }
}

export const geminiService = new GeminiService();
