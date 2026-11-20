import { roundToIntegerPeso } from '../core/money';

export interface AiParsedClientRef {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
  sellerId?: number | null;
}

export interface AiParsedOrderItem {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

export interface CatalogEntry {
  id: number;
  sku: string;
  name: string;
  listPrice: number;
  unitsPerBox: number;
  commercialCategory: string | null;
}

export function normalizeSearchText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CLIENT_STOP_WORDS = new Set([
  'para', 'cliente', 'cargar', 'carga', 'cargale', 'regalale', 'anotale', 'sumale', 'ponele', 'pedido',
  'de', 'del', 'la', 'el', 'los', 'las', 'a', 'al', 'un', 'una', 'uno', 'unos', 'unas', 'dos', 'tres', 'cuatro', 'cinco',
  'caja', 'cajas', 'pack', 'packs', 'bulto', 'bultos', 'litro', 'litros', 'por', 'numero', 'nro',
  'almacen', 'kiosco', 'despensa', 'autoservicio', 'super', 'minimercado',
]);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function scoreClientCandidatesLocal(
  queryText: string,
  clients: AiParsedClientRef[],
  limit = 5,
  preferredSellerId?: number,
): Array<{ client: AiParsedClientRef; score: number; matchedTokens: number; totalQueryTokens: number }> {
  const normalizedQuery = normalizeSearchText(queryText);
  if (!normalizedQuery) return [];

  const queryTokens = normalizedQuery
    .split(' ')
    .filter((t) => t.length >= 2 && !CLIENT_STOP_WORDS.has(t));

  if (queryTokens.length === 0) return [];

  const scored: Array<{ client: AiParsedClientRef; score: number; matchedTokens: number; totalQueryTokens: number }> = [];

  for (const client of clients) {
    const clientNameNorm = normalizeSearchText(client.name);
    const clientNorm = normalizeSearchText(`${client.name} ${client.city || ''}`);
    if (!clientNorm) continue;

    let score = 0;
    if (clientNameNorm.length >= 3 && normalizedQuery.includes(clientNameNorm)) {
      score += 120;
    }

    const clientTokens = clientNameNorm.split(' ').filter((t) => t.length >= 2);
    let matchedTokens = 0;

    for (const qt of queryTokens) {
      if (clientTokens.some((ct) => ct === qt)) {
        score += 30;
        matchedTokens += 1;
      } else if (clientTokens.some((ct) => ct.startsWith(qt) || qt.startsWith(ct) || ct.includes(qt) || qt.includes(ct))) {
        score += 14;
        matchedTokens += 1;
      } else if (qt.length >= 4) {
        const maxDist = qt.length >= 6 ? 2 : 1;
        const hasFuzzy = clientTokens.some(
          (ct) => ct.length >= 4 && Math.abs(ct.length - qt.length) <= maxDist && levenshtein(ct, qt) <= maxDist,
        );
        if (hasFuzzy) {
          score += 10;
          matchedTokens += 1;
        }
      }
    }

    if (matchedTokens >= 2) score += matchedTokens * 15;
    if (matchedTokens === queryTokens.length) score += 80;
    if (score > 0 && preferredSellerId && client.sellerId === preferredSellerId) score += 18;

    if (score > 0) {
      scored.push({ client, score, matchedTokens, totalQueryTokens: queryTokens.length });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function findClientCandidatesLocal(
  queryText: string,
  clients: AiParsedClientRef[],
  limit = 5,
  preferredSellerId?: number,
): AiParsedClientRef[] {
  return scoreClientCandidatesLocal(queryText, clients, limit, preferredSellerId).map((entry) => entry.client);
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

export function prefilterCatalogForAi(
  rawText: string,
  catalog: CatalogEntry[],
  limit = 60,
): CatalogEntry[] {
  if (catalog.length <= limit) return catalog;

  const normText = normalizeSearchText(rawText);
  const tokens = Array.from(
    new Set(
      normText
        .split(' ')
        .filter(
          (t) =>
            t.length >= 2 &&
            !ITEM_STOP_WORDS.has(t) &&
            !CONTAINER_WORDS.has(t) &&
            !(/^\d$/.test(t)),
        ),
    ),
  );

  if (tokens.length === 0) return catalog.slice(0, limit);

  const scored: Array<{ prod: CatalogEntry; score: number }> = [];
  for (const prod of catalog) {
    const prodNorm = normalizeSearchText(`${prod.name} ${prod.sku} ${prod.commercialCategory || ''}`);
    const prodWords = new Set(prodNorm.split(' '));
    let score = 0;
    for (const token of tokens) {
      if (prodWords.has(token)) {
        score += token.length >= 4 ? 4 : 3;
      } else if (prodNorm.includes(token)) {
        score += token.length >= 4 ? 2 : 1;
      }
    }
    if (score > 0) scored.push({ prod, score });
  }

  if (scored.length === 0) return catalog.slice(0, limit);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.prod);
}

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

    const wantsLiter = /\b(litro|litros|1l|1000\s*ml|1000ml)\b/.test(normClause);
    const wants500 = /\b500\b/.test(normClause);
    const requestedNumberMatch = normClause.match(/\b(?:numero|nro|n)\s*(\d+)\b/);
    const requestedNumber = requestedNumberMatch ? requestedNumberMatch[1] : null;

    for (const prod of catalog) {
      const prodNorm = normalizeSearchText(`${prod.name} ${prod.sku}`);
      let score = 0;
      for (const token of clauseTokens) {
        if (prodNorm.includes(token)) score += token.length >= 4 ? 2 : 1;
      }

      if (wantsLiter && /\b750\b/.test(prodNorm) && !/\b(1000|1l|1\s*l|litro)\b/.test(prodNorm)) score = 0;
      if (wants500 && /\b1\s*kg\b/.test(prodNorm) && !/\b500\b/.test(prodNorm)) score = 0;
      if (requestedNumber) {
        const prodNumMatch = prodNorm.match(/\b(?:n|nro|numero)\s*(\d+)\b/);
        if (prodNumMatch && prodNumMatch[1] !== requestedNumber) score = 0;
        else if (prodNumMatch && prodNumMatch[1] === requestedNumber) score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestProduct = prod;
      }
    }

    if (bestProduct && bestScore >= 2) {
      const hasBoxWord = normClause.split(' ').some((w) => BOX_WORDS.has(w));
      const rawFinalQty = hasBoxWord && bestProduct.unitsPerBox > 1
        ? baseQty * bestProduct.unitsPerBox
        : baseQty;
      const finalQty = Math.max(1, Math.round(rawFinalQty));

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
