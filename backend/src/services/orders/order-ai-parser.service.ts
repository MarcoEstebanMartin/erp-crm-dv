import prisma from '../../utils/prisma';
import { roundToIntegerPeso } from '../../core/money';
import { geminiService } from '../gemini.service';
import {
  DEFAULT_GEMINI_FLASH_MODEL,
  FALLBACK_GEMINI_FLASH_LITE_MODEL,
  isGeminiApiKeyConfigured,
  runGeminiInteraction,
} from '../ai/genai-client.helper';
import { parseStructuredJsonText } from '../../validators/ai-schemas.validator';
import { AI_ORDER_PARSE_JSON_SCHEMA, aiOrderParseResultValidator } from '../../validators/order-ai.validator';
import {
  type AiParsedClientRef,
  type AiParsedOrderItem,
  type CatalogEntry,
  findClientCandidatesLocal,
  parseOrderItemsLocalFallback,
  prefilterCatalogForAi,
  scoreClientCandidatesLocal,
} from '../../engines/order-ai-fallback.engine';

export {
  type AiParsedClientRef,
  type AiParsedOrderItem,
  findClientCandidatesLocal,
  parseOrderItemsLocalFallback,
};

export interface ParseAiOrderInput {
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  selectedClientId?: number;
  sellerId?: number;
}

export interface ParseAiOrderResponse {
  rawText: string;
  usedAi: boolean;
  detectedClient: AiParsedClientRef | null;
  clientQuery: string | null;
  clientCandidates: AiParsedClientRef[];
  items: AiParsedOrderItem[];
  unmatchedLines: string[];
  orderNotes: string | null;
}

/**
 * Interpreta un pedido dictado por voz o escrito en chat libre por un vendedor,
 * identificando opcionalmente el cliente y los productos del catálogo activo.
 */
export async function parseVendedorOrderWithAi(
  input: ParseAiOrderInput,
): Promise<ParseAiOrderResponse> {
  let transcribedText = '';
  if (input.audioBase64) {
    const transcription = await geminiService.transcribeAudioOrder(
      input.audioMimeType || 'audio/webm',
      input.audioBase64,
    );
    const cleaned = (transcription.rawText || '').trim();
    if (cleaned && !cleaned.startsWith('Nota de voz recibida')) {
      transcribedText = cleaned;
    } else if (!input.text?.trim()) {
      throw new Error(
        'No se pudo transcribir el audio con Gemini (verificá que GEMINI_API_KEY sea una clave válida de Google AI Studio).',
      );
    }
  }

  const rawText = [transcribedText, input.text?.trim() || '']
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!rawText) {
    return {
      rawText: '',
      usedAi: false,
      detectedClient: null,
      clientQuery: null,
      clientCandidates: [],
      items: [],
      unmatchedLines: [],
      orderNotes: null,
    };
  }

  const [activeProducts, activeClients] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        listPrice: true,
        costPrice: true,
        unitsPerBox: true,
        commercialCategory: true,
      },
      orderBy: { name: 'asc' },
    }),
    input.selectedClientId
      ? Promise.resolve([])
      : prisma.persona.findMany({
          where: { isClient: true, isActive: true },
          select: { id: true, name: true, city: true, address: true, sellerId: true },
          orderBy: { name: 'asc' },
        }),
  ]);

  const catalog: CatalogEntry[] = activeProducts.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    listPrice: roundToIntegerPeso(Number(p.listPrice) > 0 ? Number(p.listPrice) : Number(p.costPrice)).toNumber(),
    unitsPerBox: p.unitsPerBox || 1,
    commercialCategory: p.commercialCategory,
  }));

  const clientList: AiParsedClientRef[] = activeClients.map((c) => ({
    id: c.id,
    name: c.name,
    city: c.city,
    address: c.address,
    sellerId: (c as any).sellerId ?? null,
  }));

  let usedAi = false;
  let detectedClient: AiParsedClientRef | null = null;
  let clientQuery: string | null = null;
  let clientCandidates: AiParsedClientRef[] = [];
  let items: AiParsedOrderItem[] = [];
  let unmatchedLines: string[] = [];
  let orderNotes: string | null = null;

  if (isGeminiApiKeyConfigured()) {
    try {
      const relevantCatalog = prefilterCatalogForAi(rawText, catalog, 60);
      const catalogCompact = relevantCatalog.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unitsPerBox: p.unitsPerBox,
        category: p.commercialCategory || '',
      }));

      const prefilteredClients = input.selectedClientId
        ? []
        : findClientCandidatesLocal(rawText, clientList, 50, input.sellerId);

      const clientsSection = input.selectedClientId
        ? 'El vendedor ya seleccionó el cliente en pantalla. Devuelve detectedClientId: null y clientQuery: null.'
        : `CLIENTES CANDIDATOS:\n${JSON.stringify(
            prefilteredClients.map((c) => ({
              id: c.id,
              name: c.name,
              city: c.city || '',
              ...(input.sellerId ? { isMine: c.sellerId === input.sellerId } : {}),
            })),
          )}`;

      const systemInstruction = `
Eres el asistente de toma de pedidos mayoristas de DV Distribuidora (alimentos y bebidas en Argentina).
Tu tarea es interpretar el mensaje o dictado de un vendedor y devolver un borrador estructurado:
1. CLIENTE: Si el vendedor menciona un cliente y no hay cliente preseleccionado, busca el ID más probable en CLIENTES CANDIDATOS aunque el nombre y apellido estén en otro orden, falte algún nombre/apellido o haya un error de transcripción (ej: "Esteban Martin" -> "Marco Esteban Martin", "MARCO ESTEBAN MARTI" -> "MARTIN MARCO ESTEBAN"). Si hay dos clientes muy parecidos, prioriza el que tenga isMine: true. Solo deja detectedClientId en null si realmente hay empate o ambigüedad real, y coloca el nombre mencionado en clientQuery.
2. PRODUCTOS Y TAMAÑOS EXACTOS: Empareja ÚNICAMENTE productos explícitamente solicitados contra CATÁLOGO DISPONIBLE. Jamás inventes productos ni sustituyas tamaños, pesos, volúmenes o variedades:
   - "de litro" / "1 litro" / "1L" / "1000 ml" equivale EXCLUSIVAMENTE a 1L / 1000ML (NUNCA elijas 750ml).
   - "por 500" / "500g" / "medio kilo" equivale EXCLUSIVAMENTE a 500g (NUNCA elijas 1kg).
   - "número 3" / "N° 3" equivale EXCLUSIVAMENTE a N°3 (NUNCA elijas N°2).
3. Si pide "caja", "cajón", "pack" o "bulto", multiplica la cantidad por 'unitsPerBox' (si unitsPerBox > 1).
4. Si menciona algún producto que NO encuentras con su marca y tamaño/variedad exactos en el catálogo, agrégalo tal cual en unmatchedLines (aclarando brevemente si solo existe otro tamaño, ej: "fernet de litro (solo 750ml)") para que el vendedor lo revise.
5. Si menciona aclaraciones de entrega o pago ("entregar a la tarde", "paga en efectivo"), colócalas en orderNotes.
`.trim();

      const userInput = `TEXTO DEL VENDEDOR:\n"${rawText}"\n\n${clientsSection}\n\nCATÁLOGO DISPONIBLE:\n${JSON.stringify(catalogCompact)}`;

      const responseText = await runGeminiInteraction({
        systemInstruction,
        input: userInput,
        jsonSchema: AI_ORDER_PARSE_JSON_SCHEMA,
        preferredModels: [FALLBACK_GEMINI_FLASH_LITE_MODEL, DEFAULT_GEMINI_FLASH_MODEL],
      });

      const parsed = aiOrderParseResultValidator.parse(parseStructuredJsonText(responseText));
      usedAi = true;
      clientQuery = parsed.clientQuery;
      orderNotes = parsed.orderNotes;
      unmatchedLines = parsed.unmatchedLines;

      if (!input.selectedClientId && parsed.detectedClientId) {
        detectedClient = clientList.find((c) => c.id === parsed.detectedClientId) || null;
      }

      for (const item of parsed.items) {
        const prod = catalog.find((p) => p.id === item.productId);
        if (!prod) continue;
        const existing = items.find((i) => i.productId === prod.id);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          items.push({
            productId: prod.id,
            sku: prod.sku,
            productName: prod.name,
            quantity: item.quantity,
            unitPrice: prod.listPrice,
            ...(item.note ? { note: item.note } : {}),
          });
        }
      }
    } catch (error: any) {
      console.warn('[OrderAiParser] Fallback local activado:', error?.message || error);
    }
  }

  if (!usedAi) {
    const localItems = parseOrderItemsLocalFallback(rawText, catalog);
    items = localItems.items;
    unmatchedLines = localItems.unmatchedLines;

    if (!input.selectedClientId && clientList.length > 0) {
      clientCandidates = findClientCandidatesLocal(rawText, clientList, 5, input.sellerId);
      if (clientCandidates.length === 1) {
        detectedClient = clientCandidates[0];
      }
    }
  } else if (!input.selectedClientId && !detectedClient && clientQuery && clientList.length > 0) {
    const scoredCandidates = scoreClientCandidatesLocal(clientQuery, clientList, 5, input.sellerId);
    clientCandidates = scoredCandidates.map((entry) => entry.client);

    // Si el mejor candidato cubre todos los tokens buscados (ej: "Esteban Martin" -> "Marco Esteban Martin")
    // y supera claramente al segundo (o es el único), seleccionarlo automáticamente.
    const top = scoredCandidates[0];
    const second = scoredCandidates[1];
    if (
      top &&
      top.matchedTokens === top.totalQueryTokens &&
      (!second || top.score - second.score >= 25)
    ) {
      detectedClient = top.client;
    }
  }

  return {
    rawText,
    usedAi,
    detectedClient,
    clientQuery,
    clientCandidates,
    items,
    unmatchedLines,
    orderNotes,
  };
}
