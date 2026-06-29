import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export interface ExtractedInvoiceData {
  supplierName: string;
  cuit: string | null;
  documentType: string;
  documentNumber: string;
  issueDate: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  netAmount: number;
  taxAmount: number;
  percepcionAmount: number;
  totalAmount: number;
}

export class GeminiService {
  /**
   * Procesa un archivo (imagen o pdf) y extrae los datos de la factura/remito.
   */
  async extractInvoiceData(mimeType: string, base64Data: string): Promise<ExtractedInvoiceData> {
    if (!apiKey || apiKey === 'tu-api-key-aqui') {
      throw new Error('GEMINI_API_KEY no está configurada o es inválida.');
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });

    const filePart: Part = {
      inlineData: {
        data: base64Data,
        mimeType
      }
    };

    const prompt = `
      Eres un experto en extracción de datos de facturas y remitos comerciales de Argentina.
      Analiza este documento y extrae la siguiente información en formato JSON estrictamente:
      - supplierName: Razón social del emisor.
      - cuit: CUIT del emisor (si existe).
      - documentType: Tipo de documento ("FACTURA_A", "FACTURA_B", "FACTURA_C", "REMITO").
      - documentNumber: Número del comprobante.
      - issueDate: Fecha de emisión en formato YYYY-MM-DD.
      - items: Arreglo de objetos con:
        - description: Descripción del producto.
        - quantity: Cantidad (número).
        - unitPrice: Precio unitario (número).
        - subtotal: Subtotal del ítem (número).
      - netAmount: Importe neto gravado (número).
      - taxAmount: Importe de IVA (número).
      - percepcionAmount: Importe de Percepciones/Retenciones (número).
      - totalAmount: Importe total (número).

      Asegúrate de que todos los valores numéricos sean números y no cadenas.
      Si un valor no está presente en el documento (por ejemplo, impuestos en un remito), devuélvelo como 0.
      Si el CUIT no está, devuélvelo como null.
    `;

    try {
      const result = await model.generateContent([prompt, filePart]);
      const responseText = result.response.text();
      const jsonData = JSON.parse(responseText);
      return jsonData as ExtractedInvoiceData;
    } catch (error: any) {
      console.error('Error al procesar el documento con Gemini:', error);
      throw new Error('Fallo en el procesamiento de OCR con IA: ' + error.message);
    }
  }
}

export const geminiService = new GeminiService();
