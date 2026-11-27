import type { GoogleGenAI } from '@google/genai';
import {
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_TRANSCRIBE_MODEL,
  FALLBACK_GEMINI_FLASH_LITE_MODEL,
  buildInlineMediaContent,
  isGeminiApiKeyConfigured,
  runGeminiInteraction,
} from './ai/genai-client.helper';
import {
  INVOICE_EXTRACTION_JSON_SCHEMA,
  PARSED_ORDER_ITEMS_JSON_SCHEMA,
  extractedInvoiceValidator,
  parseStructuredJsonText,
  parsedOrderItemsValidator,
} from '../validators/ai-schemas.validator';

export interface ExtractedInvoiceData {
  supplierName: string;
  cuit: string | null;
  receiverCuit: string | null;
  receiverName: string | null;
  documentType: string;
  documentNumber: string;
  issueDate: string;
  dueDate: string | null;
  items: Array<{
    code: string | null;
    ean: string | null;
    description: string;
    quantity: number;
    unitOfMeasure: string | null;
    unitsPerPack: number;
    unitPrice: number;
    subtotal: number;
    isNonStock: boolean;
  }>;
  netAmount: number;
  taxAmount: number;
  impuestosInternos: number;
  percepcionAmount: number;
  percepcionIIBBAmount: number;
  percepcionIvaAmount: number;
  percepcionIva5329Amount: number;
  percepcionJurisdiction: string | null;
  totalAmount: number;
}

const INVOICE_SYSTEM_INSTRUCTION = `
Eres un contador auditor experto en facturación y remitos mayoristas de Argentina (AFIP/ARCA).
Extrae con precisión quirúrgica los datos del comprobante adjunto (imagen o PDF). Ignora bordes o encabezados de otras hojas que puedan asomarse detrás del comprobante principal:
- supplierName: Razón social del emisor/proveedor (ej: CAFÉS LA VIRGINIA S.A., FRATELLI BRANCA DESTILERÍAS S.A.).
- cuit: CUIT del emisor/proveedor sin inventar dígitos (o null si no figura).
- receiverCuit: CUIT del receptor/comprador (o null si no figura).
- receiverName: Razón social o nombre del receptor/comprador (o null si no figura).
- documentType: "FACTURA_A", "FACTURA_B", "FACTURA_C", "NOTA_CREDITO_A", "NOTA_CREDITO_B", "NOTA_CREDITO_C" o "REMITO".
- documentNumber: Número en formato XXXX-XXXXXXXX o XXXXX-XXXXXXXX.
- issueDate: Fecha de emisión en formato YYYY-MM-DD.
- dueDate: Fecha de vencimiento en formato YYYY-MM-DD si figura explícitamente (o null si no figura).
- items: Lista de renglones del comprobante:
  * code: Código de artículo del proveedor (o null).
  * ean: Código de barras EAN-13 / DUN (solo dígitos, 8 a 14 dígitos) si aparece en columna EAN o descripción; si el código principal ya es un EAN-13, repítelo aquí; si no figura, null.
  * description: Descripción del artículo o servicio.
  * quantity: Cantidad facturada tal como figura en la columna Cantidad (priorizar kilogramos si el precio está expresado por kg).
  * unitOfMeasure: Unidad de medida impresa (ej: "CAJ", "CA", "BTO", "UN", "CU", "KG") o null.
  * unitsPerPack: Cantidad de unidades por bulto/caja indicada en Contenido o Descripción (ej: "6/100G" -> 6, "12/75 CL" -> 12, "12X500" -> 12). Si se factura por unidad suelta o kilogramo, devolver 1.
  * unitPrice: Precio unitario neto del renglón (ya descontando bonificaciones de línea si las hay).
  * subtotal: Importe neto final del renglón (descontando bonificaciones de línea).
  * isNonStock: true si el renglón es un servicio o gasto sin mercadería (ej: FLETE, ENVÍO, TRANSPORTE, LOGÍSTICA, DESPACHO); false para mercadería física.
- netAmount: Importe Neto Gravado final (después de descuentos/bonificaciones globales al pie).
- taxAmount: IVA total (21% / 10.5%).
- impuestosInternos: Impuestos Internos (ej: bebidas alcohólicas, gaseosas). Devolver 0 si no figura. Nunca mezclarlos con netAmount ni percepciones.
- percepcionIIBBAmount: Percepción de Ingresos Brutos (IIBB).
- percepcionIvaAmount: Percepción de IVA (RG 3337 o RG 2408).
- percepcionIva5329Amount: Percepción de IVA RG 5329.
- percepcionAmount: Suma total de percepciones (IIBB + IVA RG 3337/2408 + IVA RG 5329).
- percepcionJurisdiction: Provincia de IIBB si figura (ej: "Buenos Aires", "La Pampa") o null.
- totalAmount: Total final del comprobante.
Si algún importe impositivo no existe en el documento (ej. en un remito), devuélvelo como 0.
`.trim();

export class GeminiService {
  constructor(private readonly clientOverride?: GoogleGenAI) {}

  /**
   * Procesa una imagen o PDF de factura/remito de proveedor mediante Interactions API (`@google/genai`)
   * con Structured Outputs (`INVOICE_EXTRACTION_JSON_SCHEMA`) + validación estricta Zod (`Decimal` 2 dec).
   */
  async extractInvoiceData(mimeType: string, base64Data: string): Promise<ExtractedInvoiceData> {
    if (!this.clientOverride && !isGeminiApiKeyConfigured()) {
      throw new Error('GEMINI_API_KEY no está configurada o es inválida.');
    }

    const mediaBlock = buildInlineMediaContent(mimeType, base64Data);

    try {
      const responseText = await runGeminiInteraction({
        client: this.clientOverride,
        systemInstruction: INVOICE_SYSTEM_INSTRUCTION,
        input: [
          {
            type: 'text',
            text: 'Extrae todos los campos fiscales y renglones de este comprobante comercial argentino.',
          },
          mediaBlock,
        ],
        jsonSchema: INVOICE_EXTRACTION_JSON_SCHEMA,
      });

      const rawJson = parseStructuredJsonText(responseText);
      return extractedInvoiceValidator.parse(rawJson);
    } catch (error: any) {
      console.error('[GeminiService] Error al procesar el documento con Gemini:', error);
      throw new Error('Fallo en el procesamiento de OCR con IA: ' + (error?.message || error));
    }
  }

  /**
   * Procesa una nota de voz de WhatsApp y transcribe textualmente el pedido comercial.
   */
  async transcribeAudioOrder(
    mimeType: string,
    base64Audio: string,
  ): Promise<{ rawText: string }> {
    if (!this.clientOverride && !isGeminiApiKeyConfigured()) {
      return { rawText: 'Nota de voz recibida. Transcripción IA disponible con GEMINI_API_KEY.' };
    }

    const audioBlock = buildInlineMediaContent(mimeType || 'audio/ogg', base64Audio);

    try {
      const rawText = await runGeminiInteraction({
        client: this.clientOverride,
        preferredModels: [
          DEFAULT_GEMINI_TRANSCRIBE_MODEL,
          FALLBACK_GEMINI_FLASH_LITE_MODEL,
          DEFAULT_GEMINI_FLASH_MODEL,
        ],
        systemInstruction:
          'Eres un transcriptor experto para vendedores mayoristas de alimentos y bebidas en Argentina. El hablante dicta pedidos para clientes usando modismos argentinos como "cargale a...", "anotale a...", "para...", "sumale...", "caja", "pack", "bulto", "de litro", "por 500", "número 3". Nunca confundas "cargale" con "regalale".',
        input: [
          {
            type: 'text',
            text: 'Escucha esta nota de voz y transcribe textualmente en español rioplatense el cliente mencionado, las cantidades, envases (caja, pack, bulto, unidad) y los productos con su marca, variedad y tamaño exacto (ej: "de litro", "750", "por 500", "número 3").',
          },
          audioBlock,
        ],
      });

      return { rawText: rawText.trim() };
    } catch (error: any) {
      console.error('[GeminiService] Error procesando nota de voz con Gemini:', error);
      return { rawText: 'Nota de voz recibida por WhatsApp.' };
    }
  }

  /**
   * Interpreta un texto de pedido de WhatsApp y lo vincula estrictamente contra IDs reales del catálogo.
   */
  async parseOrderMessage(
    rawText: string,
    catalog: Array<{
      id: number;
      sku: string;
      name: string;
      listPrice: number;
      costPrice: number;
      unitsPerBox: number;
      commercialCategory?: string | null;
    }>,
  ): Promise<Array<{ productId: number; quantity: number; note?: string }>> {
    if (!this.clientOverride && !isGeminiApiKeyConfigured()) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const validProductIds = new Set(catalog.map((p) => p.id));
    const catalogFormatted = catalog.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unitsPerBox: p.unitsPerBox || 1,
      category: p.commercialCategory || '',
    }));

    const systemInstruction = `
Eres el asistente de toma de pedidos mayoristas de DV Distribuidora (alimentos y bebidas en Argentina).
Empareja ÚNICAMENTE productos explícitamente solicitados por el cliente contra el CATÁLOGO provisto:
1. Si el cliente solo saluda, indica medio de pago o consulta sin pedir productos, devuelve {"items": []}. ¡Jamás inventes productos!
2. Selecciona como máximo 1 producto del catálogo por cada ítem pedido.
3. Si pide "caja", "cajón" o "pack", multiplica la cantidad por 'unitsPerBox' del producto (o 12 si es bebida y unitsPerBox es 1).
4. Palabras de empaque o pago ("caja", "efectivo", "transferencia", "gracias") NO son productos.
`.trim();

    const userInput = `TEXTO DE LA CONVERSACIÓN DEL CLIENTE:\n"${rawText}"\n\nCATÁLOGO DISPONIBLE:\n${JSON.stringify(catalogFormatted)}`;

    try {
      const responseText = await runGeminiInteraction({
        client: this.clientOverride,
        systemInstruction,
        input: userInput,
        jsonSchema: PARSED_ORDER_ITEMS_JSON_SCHEMA,
      });

      const parsed = parsedOrderItemsValidator.parse(parseStructuredJsonText(responseText));
      return parsed.items.filter((item) => validProductIds.has(item.productId));
    } catch (error: any) {
      console.error('[GeminiService] Error al procesar pedido con Gemini:', error);
      return [];
    }
  }
}

export const geminiService = new GeminiService();
