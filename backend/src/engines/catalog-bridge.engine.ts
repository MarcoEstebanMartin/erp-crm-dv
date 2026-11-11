import path from 'path';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  type NumericInput,
} from '../core/money';

export interface OutboundErpProductInput {
  sku: string;
  name: string;
  listPrice: NumericInput;
  isActive: boolean;
  minOrderQuantity?: number | null;
  approximateWeight?: NumericInput | null;
  imageUrl?: string | null;
  commercialCategory?: string | null;
  rubroName?: string | null;
}

export interface OutboundWebProductPayload {
  sku: string;
  name: string;
  price: number;
  priceFormatted: string;
  active: 0 | 1;
  minQty: string;
  pesoPromedio: number | null;
  rubro: string;
  category: string;
  fallbackPhotoFile: string | null;
}

export interface CatalogStateItemPatch {
  sku: string;
  name?: string;
  price?: number;
  priceFormatted?: string;
  minQty?: string;
  pesoPromedio?: number | null;
  photoFile?: string | null;
  hasPhoto?: boolean;
}

/**
 * Normaliza un SKU al formato limpio de 4+ dígitos usado por `chatbot-dv` (`donvenancio.com.ar`).
 */
export function normalizeWebSku(rawSku: string): string {
  const cleaned = String(rawSku || '')
    .trim()
    .replace(/\.0$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  if (/^\d+$/.test(cleaned) && cleaned.length < 4) {
    return cleaned.padStart(4, '0');
  }
  return cleaned;
}

/**
 * Formatea un precio en pesos enteros al estándar visual de `donvenancio.com.ar` (ej. `$9.112`, `$11.156`).
 */
export function formatWebCurrencyArs(price: NumericInput): string {
  const intPeso = roundToIntegerPeso(price);
  const isNeg = intPeso.isNegative();
  const digits = intPeso.abs().toFixed(0);
  const withDots = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNeg ? `-$${withDots}` : `$${withDots}`;
}

/**
 * Construye el payload normalizado listo para sincronizar un producto del ERP hacia `chatbot-dv`.
 */
export function buildOutboundProductPayload(
  erp: OutboundErpProductInput,
): OutboundWebProductPayload {
  const sku = normalizeWebSku(erp.sku);
  const name = String(erp.name || '')
    .trim()
    .replace(/\bMELINCUE\b/gi, 'MELINCUÉ');

  const price = Math.max(0, roundToIntegerPeso(erp.listPrice || 0).toNumber());
  const priceFormatted = formatWebCurrencyArs(price);
  const active: 0 | 1 = erp.isActive ? 1 : 0;

  const minOrder = erp.minOrderQuantity ? Math.floor(Number(erp.minOrderQuantity)) : 1;
  const minQty = minOrder > 1 ? String(minOrder) : '';

  const rawWeight =
    erp.approximateWeight !== null && erp.approximateWeight !== undefined
      ? Number(erp.approximateWeight)
      : 0;
  const pesoPromedio =
    Number.isFinite(rawWeight) && rawWeight > 0
      ? roundToThreeDecimalsWeight(erp.approximateWeight!).toNumber()
      : null;

  const rubro = String(erp.rubroName || '').trim();
  const category = String(erp.commercialCategory || erp.rubroName || 'General').trim();

  let fallbackPhotoFile: string | null = null;
  if (erp.imageUrl && erp.imageUrl.trim()) {
    const cleanUrl = erp.imageUrl.split('?')[0].trim();
    const base = path.basename(cleanUrl);
    if (base && /\.(png|jpg|jpeg|webp)$/i.test(base)) {
      fallbackPhotoFile = base;
    }
  }

  return {
    sku,
    name,
    price,
    priceFormatted,
    active,
    minQty,
    pesoPromedio,
    rubro,
    category,
    fallbackPhotoFile,
  };
}

/**
 * Aplica un lote de parches sobre `metadata.catalog_active_state` replicando exactamente
 * `_sync_product_into_catalog_state` de `donvenancio.com.ar` (incluyendo sub-ítems de combos).
 */
export function patchCatalogActiveStateJson(
  rawStateJson: string,
  patches: CatalogStateItemPatch[],
  nowIso: string = new Date().toISOString(),
  nowEpochMs: number = Date.now(),
): { changed: boolean; nextJson: string } {
  if (!rawStateJson || !rawStateJson.trim() || patches.length === 0) {
    return { changed: false, nextJson: rawStateJson };
  }

  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(rawStateJson);
  } catch {
    return { changed: false, nextJson: rawStateJson };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { changed: false, nextJson: rawStateJson };
  }

  const items: any[] | null = Array.isArray(parsed.catalogItems)
    ? parsed.catalogItems
    : Array.isArray(parsed.items)
      ? parsed.items
      : null;

  if (!items) {
    return { changed: false, nextJson: rawStateJson };
  }

  const patchBySku = new Map<string, CatalogStateItemPatch>();
  for (const p of patches) {
    const clean = normalizeWebSku(p.sku);
    if (clean) patchBySku.set(clean, { ...p, sku: clean });
  }

  let changed = false;

  for (const item of items) {
    if (!item || typeof item !== 'object' || item.is_banner) continue;

    if (item.is_combo || item.type === 'combo') {
      for (const subKey of ['prod1', 'prod2'] as const) {
        const sub = item[subKey];
        if (!sub || typeof sub !== 'object' || !sub.sku) continue;
        const match = patchBySku.get(normalizeWebSku(sub.sku));
        if (match && match.photoFile !== undefined) {
          sub.photo_file = match.photoFile;
          sub.has_photo = Boolean(match.hasPhoto);
          changed = true;
        }
      }
      continue;
    }

    if (!item.sku) continue;
    const match = patchBySku.get(normalizeWebSku(item.sku));
    if (!match) continue;

    if (match.name !== undefined && match.name) item.name = match.name;
    if (match.price !== undefined) item.price = match.price;
    if (match.priceFormatted !== undefined) item.price_formatted = match.priceFormatted;
    if (match.minQty !== undefined) item.min_qty = match.minQty;
    if (match.pesoPromedio !== undefined) item.peso_promedio = match.pesoPromedio;
    if (match.photoFile !== undefined) {
      item.photo_file = match.photoFile;
      item.has_photo = Boolean(match.hasPhoto);
    }
    changed = true;
  }

  if (!changed) {
    return { changed: false, nextJson: rawStateJson };
  }

  parsed.catalogItems = items;
  if ('items' in parsed) {
    parsed.items = items;
  }
  parsed.timestamp = nowEpochMs;
  parsed.saved_at = nowIso;

  return {
    changed: true,
    nextJson: JSON.stringify(parsed),
  };
}
