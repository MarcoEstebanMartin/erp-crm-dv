import { describe, it, expect, vi } from 'vitest';
import prisma from '../../utils/prisma';
import {
  DEFAULT_GEMINI_FLASH_MODEL,
  FALLBACK_GEMINI_FLASH_LITE_MODEL,
  buildGeminiModelCascade,
  buildInlineMediaContent,
  resolveCurrentGeminiModel,
} from '../ai/genai-client.helper';
import { GeminiService } from '../gemini.service';
import { AiChatbotService } from '../aiChatbot.service';

describe('Paso M2 — Modernización IA (@google/genai Interactions API + Structured Outputs)', () => {
  it('reemplaza automáticamente modelos legados/deprecados por gemini-3.8-flash y construye cascada limpia', () => {
    expect(resolveCurrentGeminiModel('gemini-1.5-flash')).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    expect(resolveCurrentGeminiModel('gemini-2.0-flash')).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    expect(resolveCurrentGeminiModel('gemini-2.5-flash')).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    expect(resolveCurrentGeminiModel('gemini-3.6-flash')).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    expect(resolveCurrentGeminiModel(undefined)).toBe(DEFAULT_GEMINI_FLASH_MODEL);

    const cascade = buildGeminiModelCascade(undefined, 'gemini-2.0-flash');
    expect(cascade).toEqual([DEFAULT_GEMINI_FLASH_MODEL, FALLBACK_GEMINI_FLASH_LITE_MODEL]);
  });

  it('mapea correctamente PDFs a document, imágenes a image y audios a audio para Interactions API', () => {
    expect(buildInlineMediaContent('application/pdf', 'AAA')).toEqual({
      type: 'document',
      data: 'AAA',
      mime_type: 'application/pdf',
    });
    expect(buildInlineMediaContent('image/jpeg', 'BBB')).toEqual({
      type: 'image',
      data: 'BBB',
      mime_type: 'image/jpeg',
    });
    expect(buildInlineMediaContent('audio/ogg', 'CCC')).toEqual({
      type: 'audio',
      data: 'CCC',
      mime_type: 'audio/ogg',
    });
  });

  it('extractInvoiceData usa interactions.create con store:false + JSON Schema y sanea montos a 2 decimales exactos', async () => {
    const createSpy = vi.fn().mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify({
        supplierName: 'SODECAR S.A.',
        cuit: '30-50123456-7',
        receiverCuit: '20-40937847-2',
        receiverName: 'DISTRIBUIDORA VICTORIA',
        documentType: 'FACTURA_A',
        documentNumber: '0004-00123456',
        issueDate: '2026-11-10',
        items: [
          {
            code: '7667',
            description: 'JAMON COCIDO NATURAL',
            quantity: 12.45,
            unitPrice: 7850.556,
            subtotal: 97739.422,
          },
        ],
        netAmount: 97739.422,
        taxAmount: 20525.279,
        percepcionAmount: 2932.183,
        percepcionIIBBAmount: 2932.183,
        percepcionIvaAmount: 0,
        percepcionIva5329Amount: 0,
        percepcionJurisdiction: 'Buenos Aires',
        totalAmount: 121196.884,
      }),
    });

    const mockClient = { interactions: { create: createSpy } } as any;
    const service = new GeminiService(mockClient);

    const extracted = await service.extractInvoiceData('application/pdf', 'JVBERi0xLjQK');

    expect(createSpy).toHaveBeenCalledTimes(1);
    const callArg = createSpy.mock.calls[0][0];
    expect(callArg.model).toBe('gemini-3.8-flash');
    expect(callArg.store).toBe(false);
    expect(callArg.response_format?.type).toBe('text');
    expect(callArg.response_format?.mime_type).toBe('application/json');
    expect(callArg.response_format?.schema?.required).toContain('totalAmount');
    expect(callArg.input[1]).toEqual({
      type: 'document',
      data: 'JVBERi0xLjQK',
      mime_type: 'application/pdf',
    });

    expect(extracted.supplierName).toBe('SODECAR S.A.');
    expect(extracted.items[0].unitPrice).toBe(7850.56);
    expect(extracted.items[0].subtotal).toBe(97739.42);
    expect(extracted.netAmount).toBe(97739.42);
    expect(extracted.taxAmount).toBe(20525.28);
    expect(extracted.percepcionIIBBAmount).toBe(2932.18);
    expect(extracted.totalAmount).toBe(121196.88);
  });

  it('parseOrderMessage descarta productId inexistentes en catálogo y hace fallback al segundo modelo si el primero falla', async () => {
    const createSpy = vi
      .fn()
      .mockRejectedValueOnce(new Error('503 capacity temporarily unavailable'))
      .mockResolvedValueOnce({
        status: 'completed',
        output_text: JSON.stringify({
          items: [
            { productId: 10, quantity: 6, note: '1 caja' },
            { productId: 999999, quantity: 2, note: 'alucinado' },
          ],
        }),
      });

    const mockClient = { interactions: { create: createSpy } } as any;
    const service = new GeminiService(mockClient);

    const items = await service.parseOrderMessage('Mandame 1 caja de cremoso', [
      {
        id: 10,
        sku: 'CRE-01',
        name: 'Queso Cremoso',
        listPrice: 6500,
        costPrice: 5000,
        unitsPerBox: 6,
      },
    ]);

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy.mock.calls[0][0].model).toBe('gemini-3.8-flash');
    expect(createSpy.mock.calls[1][0].model).toBe('gemini-3.5-flash-lite');
    expect(items).toEqual([{ productId: 10, quantity: 6, note: '1 caja' }]);
  });

  it('AiChatbotService.processUserMessage aplica Structured Outputs y redondea borrador de pedido a pesos enteros', async () => {
    vi.spyOn(prisma.product, 'findMany').mockResolvedValue([
      {
        id: 22,
        sku: 'FER-750',
        name: 'Fernet 750ml',
        commercialCategory: 'Bebidas',
        listPrice: 9800,
        listPriceB: 9500,
        listPriceC: 9200,
        unitsPerBox: 12,
        stock: 48,
        isPesable: false,
      } as any,
    ]);

    const createSpy = vi.fn().mockResolvedValue({
      status: 'completed',
      output_text: JSON.stringify({
        text: 'Te preparé el borrador por 2 unidades de Fernet 750ml.',
        intent: 'ORDER_DRAFT',
        draftOrderItems: [
          {
            productId: 22,
            productName: 'Fernet 750ml',
            sku: 'FER-750',
            quantity: 2,
            unitPrice: 9800.4,
            subtotal: 19600.8,
          },
        ],
        transferToHuman: false,
      }),
    });

    const bot = new AiChatbotService({ interactions: { create: createSpy } } as any);
    const reply = await bot.processUserMessage({
      messageText: 'Hola, mandame 2 fernet 750',
      channel: 'WHATSAPP',
      customerName: 'Esteban Martin',
      priceListType: 'LISTA_A',
    });

    expect(reply.intent).toBe('ORDER_DRAFT');
    expect(reply.text).toContain('Hola Esteban 👋! Soy Ben');
    expect(reply.draftOrderItems).toEqual([
      {
        productId: 22,
        productName: 'Fernet 750ml',
        sku: 'FER-750',
        quantity: 2,
        unitPrice: 9800,
        subtotal: 19601,
      },
    ]);
  });
});
