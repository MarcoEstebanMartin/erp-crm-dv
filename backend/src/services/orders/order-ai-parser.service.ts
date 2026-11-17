import prisma from '../../utils/prisma';
import { roundToIntegerPeso } from '../../core/money';
import { geminiService } from '../gemini.service';
import { isGeminiApiKeyConfigured, runGeminiInteraction } from '../ai/genai-client.helper';
import { parseStructuredJsonText } from '../../validators/ai-schemas.validator';
import { AI_ORDER_PARSE_JSON_SCHEMA, aiOrderParseResultValidator } from '../../validators/order-ai.validator';

export interface ParseAiOrderInput {
  text?: string;
  audioBase64?: string;
  audioMimeType?: string;
  selectedClientId?: number;
}

export interface AiParsedClientRef {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
}

export interface AiParsedOrderItem {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string;
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

interface CatalogEntry {
  id: number;
  sku: string;
  name: string;
  listPrice: number;
  unitsPerBox: number;
  commercialCategory: string | null;
}

function normalizeSearchText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CLIENT_STOP_WORDS = new Set([
  'para', 'cliente', 'de', 'del', 'la', 'el', 'los', 'las', 'almacen', 'kiosco', 'despensa', 'autoservicio', 'super', 'minimercado',
]);

/**
 * Busca candidatos de cliente por similitud de tokens normalizados.
 */
export function findClientCandidatesLocal(
  queryText: string,
  clients: AiParsedClientRef[],
  limit = 5,
): AiParsedClientRef[] {
  const normalizedQuery = normalizeSearchText(queryText);
  if (!normalizedQuery) return [];

  const queryTokens = normalizedQuery
    .split(' ')
    .filter((t) => t.length >= 2 && !CLIENT_STOP_WORDS.has(t));

  if (queryTokens.length === 0) return [];

  const scored: Array<{ client: AiParsedClientRef; score: number }> = [];

  for (const client of clients) {
    const clientNorm = normalizeSearchText(`${client.name} ${client.city || ''}`);
    if (!clientNorm) continue;

    let score = 0;
    if (normalizedQuery.includes(normalizeSearchText(client.name)) && client.name.length >= 3) {
      score += 100;
    }

    const clientTokens = normalizeSearchText(client.name).split(' ').filter((t) => t.length >= 2);
    for (const qt of queryTokens) {
      if (clientTokens.some((ct) => ct === qt)) {
        score += 20;
      } else if (clientTokens.some((ct) => ct.includes(qt) || qt.includes(ct))) {
        score += 10;
      }
    }

    if (score > 0) {
      scored.push({ client, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.client);
}

const ITEM_STOP_WORDS = new Set([
  'hola', 'mandame', 'quiero', 'necesito', 'para', 'por', 'favor', 'con', 'sin', 'de', 'del', 'un', 'una', 'unos', 'unas',
  'el', 'la', 'los', 'las', 'y', 'o', 'gracias', 'efectivo', 'transferencia', 'cuenta', 'corriente',
]);

const BOX_WORDS = new Set(['caja', 'cajas', 'cajon', 'cajones', 'pack', 'packs', 'bulto', 'bultos']);
const CONTAINER_WORDS = new Set([
  ...BOX_WORDS,
  'botella', 'botellas', 'kilo', 'kilos', 'kg', 'u', 'unid', 'unidad', 'unidades', 'litro', 'litros', 'lt',
]);

/**
 * Fallback determinista local para extraer ítems del texto cuando Gemini no está disponible.
 */
export function parseOrderItemsLocalFallback(
  rawText: string,
  catalog: CatalogEntry[],
): { items: AiParsedOrderItem[]; unmatchedLines: string[] } {
  const clauses = rawText
    .split(/,|\n|;|\by\b/i)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);

  const items: AiParsedOrderItem[] = [];
  const unmatchedLines: string[] = [];

  for (const clause of clauses) {
    const normClause = normalizeSearchText(clause);
    if (!normClause) continue;

    const qtyMatch = normClause.match(/\b(\d+(?:[.,]\d+)?)\b/);
    const rawQty = qtyMatch ? Number(qtyMatch[1].replace(',', '.')) : 1;
    const baseQty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;

    const clauseTokens = normClause
      .split(' ')
      .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !ITEM_STOP_WORDS.has(t) && !CONTAINER_WORDS.has(t));

    if (clauseTokens.length === 0) continue;

    let bestProduct: CatalogEntry | null = null;
    let bestScore = 0;

    for (const prod of catalog) {
      const prodNorm = normalizeSearchText(`${prod.name} ${prod.sku}`);
      let score = 0;
      for (const token of clauseTokens) {
        if (prodNorm.includes(token)) {
          score += token.length >= 4 ? 2 : 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestProduct = prod;
      }
    }

    if (bestProduct && bestScore >= 2) {
      const hasBoxWord = normClause.split(' ').some((w) => BOX_WORDS.has(w));
      const finalQty = hasBoxWord && bestProduct.unitsPerBox > 1
        ? baseQty * bestProduct.unitsPerBox
        : baseQty;

      const existing = items.find((i) => i.productId === bestProduct!.id);
      if (existing) {
        existing.quantity += finalQty;
      } else {
        items.push({
          productId: bestProduct.id,
          sku: bestProduct.sku,
          productName: bestProduct.name,
          quantity: finalQty,
          unitPrice: roundToIntegerPeso(bestProduct.listPrice).toNumber(),
        });
      }
    } else if (qtyMatch) {
      unmatchedLines.push(clause);
    }
  }

  return { items, unmatchedLines };
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
      take: 600,
    }),
    input.selectedClientId
      ? Promise.resolve([])
      : prisma.persona.findMany({
          where: { type: 'CLIENT', isActive: true },
          select: { id: true, name: true, city: true, address: true },
          orderBy: { name: 'asc' },
          take: 500,
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
      const catalogCompact = catalog.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unitsPerBox: p.unitsPerBox,
        category: p.commercialCategory || '',
      }));

      const clientsSection = input.selectedClientId
        ? 'El vendedor ya seleccionó el cliente en pantalla. Devuelve detectedClientId: null y clientQuery: null.'
        : `CLIENTES DISPONIBLES:\n${JSON.stringify(clientList.map((c) => ({ id: c.id, name: c.name, city: c.city || '' })))}`;

      const systemInstruction = `
Eres el asistente de toma de pedidos mayoristas de DV Distribuidora (alimentos y bebidas en Argentina).
Tu tarea es interpretar el mensaje o dictado de un vendedor y devolver un borrador estructurado:
1. CLIENTE: Si el vendedor menciona un cliente y no hay cliente preseleccionado, busca el ID exacto en CLIENTES DISPONIBLES. Si hay duda o varios parecidos, deja detectedClientId en null y coloca el nombre mencionado en clientQuery.
2. PRODUCTOS: Empareja ÚNICAMENTE productos explícitamente solicitados contra CATÁLOGO DISPONIBLE. Jamás inventes productos.
3. Si pide "caja", "cajón", "pack" o "bulto", multiplica la cantidad por 'unitsPerBox' (si unitsPerBox > 1).
4. Si menciona algún producto que NO encuentras con certeza en el catálogo, agrégalo tal cual en unmatchedLines para que el vendedor lo revise.
5. Si menciona aclaraciones de entrega o pago ("entregar a la tarde", "paga en efectivo"), colócalas en orderNotes.
`.trim();

      const userInput = `TEXTO DEL VENDEDOR:\n"${rawText}"\n\n${clientsSection}\n\nCATÁLOGO DISPONIBLE:\n${JSON.stringify(catalogCompact)}`;

      const responseText = await runGeminiInteraction({
        systemInstruction,
        input: userInput,
        jsonSchema: AI_ORDER_PARSE_JSON_SCHEMA,
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
      clientCandidates = findClientCandidatesLocal(rawText, clientList, 5);
      if (clientCandidates.length === 1) {
        detectedClient = clientCandidates[0];
      }
    }
  } else if (!input.selectedClientId && !detectedClient && clientQuery && clientList.length > 0) {
    clientCandidates = findClientCandidatesLocal(clientQuery, clientList, 5);
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
