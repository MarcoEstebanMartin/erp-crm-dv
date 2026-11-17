import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '../../utils/prisma';
import * as genaiHelper from '../ai/genai-client.helper';
import { geminiService } from '../gemini.service';
import {
  findClientCandidatesLocal,
  parseOrderItemsLocalFallback,
  parseVendedorOrderWithAi,
} from '../orders/order-ai-parser.service';

vi.mock('../../utils/prisma', () => ({
  default: {
    product: {
      findMany: vi.fn(),
    },
    persona: {
      findMany: vi.fn(),
    },
  },
}));

const MOCK_PRODUCTS = [
  {
    id: 101,
    sku: 'FID-MAT-500',
    name: 'Fideos Matarazzo Tallarin 500g',
    listPrice: 1200,
    costPrice: 900,
    unitsPerBox: 12,
    commercialCategory: 'Almacen',
  },
  {
    id: 102,
    sku: 'ACE-NAT-15',
    name: 'Aceite Natura Girasol 1.5L',
    listPrice: 3500,
    costPrice: 2800,
    unitsPerBox: 6,
    commercialCategory: 'Almacen',
  },
];

const MOCK_CLIENTS = [
  { id: 1, name: 'Almacén Don José', city: 'General Villegas', address: 'San Martín 120' },
  { id: 2, name: 'Kiosco El Pepe', city: 'Banderaló', address: 'Belgrano 45' },
  { id: 3, name: 'Despensa Pepe', city: 'General Villegas', address: 'Mitre 300' },
];

describe('order-ai-parser.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.product.findMany as any).mockResolvedValue(MOCK_PRODUCTS);
    (prisma.persona.findMany as any).mockResolvedValue(MOCK_CLIENTS);
  });

  it('detecta cliente único y multiplica cajas en fallback local cuando Gemini no está configurado', async () => {
    vi.spyOn(genaiHelper, 'isGeminiApiKeyConfigured').mockReturnValue(false);

    const result = await parseVendedorOrderWithAi({
      text: 'Para Don Jose 2 cajas de fideos matarazzo y 3 aceites natura',
    });

    expect(result.usedAi).toBe(false);
    expect(result.detectedClient?.id).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        productId: 101,
        quantity: 24, // 2 cajas x 12 unidades
        unitPrice: 1200,
      }),
      expect.objectContaining({
        productId: 102,
        quantity: 3,
        unitPrice: 3500,
      }),
    ]);
    expect(result.unmatchedLines).toEqual([]);
  });

  it('devuelve candidatos cuando hay ambigüedad de clientes (mismo nombre parcial)', () => {
    const candidates = findClientCandidatesLocal('para pepe', MOCK_CLIENTS);
    expect(candidates.map((c) => c.id)).toEqual([2, 3]);
  });

  it('detecta clientes con orden invertido y faltante de letra (MARCO ESTEBAN MARTI -> MARTIN MARCO ESTEBAN)', () => {
    const candidates = findClientCandidatesLocal('Cargar a MARCO ESTEBAN MARTI', [
      ...MOCK_CLIENTS,
      { id: 99, name: 'MARTIN MARCO ESTEBAN', city: 'General Villegas', address: null },
      { id: 100, name: 'ESTEBAN LOPEZ', city: 'Banderaló', address: null },
    ]);
    expect(candidates[0]?.id).toBe(99);
  });

  it('guarda en unmatchedLines los productos con cantidad que no existen en el catálogo', () => {
    const parsed = parseOrderItemsLocalFallback(
      '3 fideos matarazzo, 5 yerba desconocida xyz',
      MOCK_PRODUCTS.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        listPrice: p.listPrice,
        unitsPerBox: p.unitsPerBox,
        commercialCategory: p.commercialCategory,
      })),
    );

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].productId).toBe(101);
    expect(parsed.unmatchedLines).toEqual(['5 yerba desconocida xyz']);
  });

  it('transcribe audio base64 e interpreta cliente, ítems y notas mediante Gemini', async () => {
    vi.spyOn(geminiService, 'transcribeAudioOrder').mockResolvedValue({
      rawText: 'Para Don José mandame 2 aceites natura, entregar a la tarde',
    });
    vi.spyOn(genaiHelper, 'isGeminiApiKeyConfigured').mockReturnValue(true);
    vi.spyOn(genaiHelper, 'runGeminiInteraction').mockResolvedValue(
      JSON.stringify({
        detectedClientId: 1,
        clientQuery: 'Don José',
        items: [{ productId: 102, quantity: 2, note: null }],
        unmatchedLines: [],
        orderNotes: 'Entregar a la tarde',
      }),
    );

    const result = await parseVendedorOrderWithAi({
      audioBase64: 'UklGRg==',
      audioMimeType: 'audio/webm',
    });

    expect(geminiService.transcribeAudioOrder).toHaveBeenCalledWith('audio/webm', 'UklGRg==');
    expect(result.usedAi).toBe(true);
    expect(result.detectedClient?.id).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ productId: 102, quantity: 2, unitPrice: 3500 });
    expect(result.orderNotes).toBe('Entregar a la tarde');
  });

  it('no consulta clientes cuando selectedClientId ya fue elegido en pantalla', async () => {
    vi.spyOn(genaiHelper, 'isGeminiApiKeyConfigured').mockReturnValue(false);

    const result = await parseVendedorOrderWithAi({
      text: '4 aceites natura',
      selectedClientId: 2,
    });

    expect(prisma.persona.findMany).not.toHaveBeenCalled();
    expect(result.detectedClient).toBeNull();
    expect(result.clientCandidates).toEqual([]);
    expect(result.items[0]).toMatchObject({ productId: 102, quantity: 4 });
  });

  it('auto-resuelve cliente parcial claro cuando Gemini devuelve detectedClientId: null y clientQuery "Esteban Martin"', async () => {
    (prisma.persona.findMany as any).mockResolvedValue([
      ...MOCK_CLIENTS,
      { id: 77, name: 'Marco Esteban Martin', city: 'General Villegas', address: null },
      { id: 78, name: 'Esteban Lopez', city: 'Banderaló', address: null },
    ]);
    vi.spyOn(genaiHelper, 'isGeminiApiKeyConfigured').mockReturnValue(true);
    vi.spyOn(genaiHelper, 'runGeminiInteraction').mockResolvedValue(
      JSON.stringify({
        detectedClientId: null,
        clientQuery: 'Esteban Martin',
        items: [{ productId: 102, quantity: 1, note: null }],
        unmatchedLines: [],
        orderNotes: null,
      }),
    );

    const result = await parseVendedorOrderWithAi({
      text: 'Cargale a Esteban Martin 1 aceite natura',
    });

    expect(result.detectedClient?.id).toBe(77);
    expect(result.detectedClient?.name).toBe('Marco Esteban Martin');
  });

  it('no sustituye "fernet de litro" por 750ml ni "numero 3" por N°2 en el fallback local', () => {
    const parsed = parseOrderItemsLocalFallback(
      '1 caja de fernet de litro, 1 caja de fideos 308 numero 3',
      [
        {
          id: 201,
          sku: 'FER-750',
          name: 'BRANCA FERNET X 750 ML',
          listPrice: 17772,
          unitsPerBox: 12,
          commercialCategory: 'Bebidas',
        },
        {
          id: 202,
          sku: 'FID-308-2',
          name: '308 TALLARIN N°2 MORRON X 500G',
          listPrice: 1939,
          unitsPerBox: 12,
          commercialCategory: 'Almacen',
        },
        {
          id: 203,
          sku: 'FID-308-3',
          name: '308 TALLARIN N°3 X 500G',
          listPrice: 1939,
          unitsPerBox: 12,
          commercialCategory: 'Almacen',
        },
      ],
    );

    expect(parsed.items.map((i) => i.productId)).toEqual([203]);
    expect(parsed.unmatchedLines).toEqual(['1 caja de fernet de litro']);
  });
});
