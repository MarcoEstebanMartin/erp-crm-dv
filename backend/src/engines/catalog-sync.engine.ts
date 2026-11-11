import path from 'path';
import { Decimal } from 'decimal.js';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
} from '../core/money';
import { calculateRealMarginPct } from './pricing.engine';

export interface ProductionCatalogRow {
  sku: string;
  name: string;
  price: number | string | null;
  active: number;
  category?: string | null;
  rubro?: string | null;
  subrubro?: string | null;
  min_qty?: string | number | null;
  peso_promedio?: number | string | null;
  photo_file?: string | null;
  has_photo?: number | null;
}

export interface ErpCatalogProductSnapshot {
  id: number;
  sku: string;
  name: string;
  costPrice: Decimal | number | string;
  listPrice: Decimal | number | string;
  listPriceB: Decimal | number | string;
  listPriceC: Decimal | number | string;
  profitMargin: Decimal | number | string | null;
  imageUrl: string | null;
  isActive: boolean;
  isPesable: boolean;
  minOrderQuantity: number;
  approximateWeight: Decimal | number | string | null;
  commercialCategory?: string | null;
  description?: string | null;
  rubroId?: number | null;
}

export interface ErpProductSyncPatchResult {
  hasChanges: boolean;
  priceChanged: boolean;
  imageChanged: boolean;
  activeChanged: boolean;
  nameChanged: boolean;
  categoryChanged: boolean;
  rubroChanged: boolean;
  metaChanged: boolean;
  updateData: Record<string, unknown>;
}

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const CANONICAL_RUBRO_MAP: Record<string, string> = {
  REMOTTI: 'REMOTTI',
  MELINCUE: 'REMOTTI',
  LECHES: 'LECHES',
  LACTEOS: 'LÁCTEOS',
  YOGURT: 'YOGURT',
  'SANCOR Y CREMIGAL': 'SANCOR Y CREMIGAL',
  SANCOR: 'SANCOR',
  'QUESOS RALLADOS': 'QUESOS RALLADOS',
  SODECAR: 'SODECAR',
  CONSERVAS: 'CONSERVAS',
  'A.G.D Y NIZA': 'A.G.D Y NIZA',
  CAFE: 'CAFÉ',
  ARROZ: 'ARROZ',
  YERBAS: 'YERBAS',
  AZUCAR: 'AZÚCAR',
  SAL: 'SAL',
  EDULCORANTES: 'EDULCORANTES',
  PESCADERIA: 'PESCADERÍA',
  'PASTAS SECAS': 'PASTAS SECAS',
  PAPELES: 'PAPELES',
  REGALERIA: 'REGALERÍA',
  BEBIDAS: 'BEBIDAS',
  'NO COMESTIBLES': 'NO COMESTIBLES',
  LIMPIEZA: 'LIMPIEZA',
};

export function normalizeRubroLookupKey(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim();
}

export function normalizeRubroCanonicalName(rawRubro?: string | null): string | null {
  if (!rawRubro) return null;
  const trimmed = rawRubro.trim();
  if (!trimmed || trimmed.includes('\uFFFD')) return null;
  const lookup = normalizeRubroLookupKey(trimmed);
  if (!lookup) return null;
  return CANONICAL_RUBRO_MAP[lookup] || trimmed.toUpperCase();
}

/**
 * Extrae el orden exacto de categorías definido con Subir/Bajar en `metadata.catalog_active_state`
 * de `chatbot-dv`, ignorando banners y bloques especiales de `COMBOS`.
 */
export function extractCategoryOrderFromCatalogState(rawStateJson?: string | null): string[] {
  if (!rawStateJson || !rawStateJson.trim()) return [];
  try {
    const parsed = JSON.parse(rawStateJson);
    const items: any[] = Array.isArray(parsed?.catalogItems)
      ? parsed.catalogItems
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const item of items) {
      if (!item || typeof item !== 'object' || item.is_combo || item.type === 'combo') continue;
      const cat = String(item.category || '').trim();
      if (!cat) continue;
      const key = normalizeRubroLookupKey(cat);
      if (key.startsWith('COMBO')) continue;
      if (!seen.has(key)) {
        seen.add(key);
        ordered.push(cat);
      }
    }
    return ordered;
  } catch {
    return [];
  }
}

export function resolveMasterArchiveExtension(
  rawFilename?: string | null,
  mimeType?: string | null,
): string {
  const candidate = rawFilename ? path.extname(path.basename(rawFilename)).toLowerCase() : '';
  if (ALLOWED_IMAGE_EXTENSIONS.has(candidate)) {
    return candidate === '.jpeg' ? '.jpg' : candidate;
  }
  const normalizedMime = (mimeType || '').toLowerCase();
  if (normalizedMime.includes('png')) return '.png';
  if (normalizedMime.includes('webp')) return '.webp';
  return '.jpg';
}

export function resolveSyncedImageFilename(
  sku: string,
  rawFilename: string | null | undefined,
  mimeType: string | null | undefined,
  md5Hex: string,
): string {
  const cleanSku = sku.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const ext = resolveMasterArchiveExtension(rawFilename, mimeType);
  const safeBase = rawFilename
    ? path.basename(rawFilename, path.extname(rawFilename)).replace(/[^a-zA-Z0-9_-]/g, '')
    : '';

  if (safeBase.startsWith(`${cleanSku}_`) && safeBase.length > cleanSku.length + 1) {
    return `${safeBase}${ext}`;
  }

  const shortHash = (md5Hex || '00000000').trim().toLowerCase().slice(0, 8) || '00000000';
  return `${cleanSku}_dv_${shortHash}${ext}`;
}

export function computeProportionalTierPrice(
  newListPriceA: Decimal,
  oldListPriceA: Decimal,
  oldTierPrice: Decimal,
): Decimal {
  if (oldTierPrice.lte(0)) return new Decimal(0);
  if (oldListPriceA.lte(0)) return roundToIntegerPeso(newListPriceA);
  const ratio = oldTierPrice.dividedBy(oldListPriceA);
  return roundToIntegerPeso(newListPriceA.times(ratio));
}

export function computeClampedMarginPct(
  costPrice: Decimal,
  listPriceA: Decimal,
): number | null {
  if (costPrice.lte(0)) return null;
  const rawMargin = calculateRealMarginPct(costPrice, listPriceA);
  const clamped = Decimal.max(-999.99, Decimal.min(999.99, rawMargin));
  return roundToTwoDecimals(clamped).toNumber();
}

export function computeErpProductSyncPatch(
  erp: ErpCatalogProductSnapshot,
  prodRow: ProductionCatalogRow | undefined,
  resolvedImageUrl: string | null,
  syncTimestamp: Date = new Date(),
  resolvedRubroId?: number | null,
): ErpProductSyncPatchResult {
  if (!prodRow) {
    if (!erp.isActive) {
      return {
        hasChanges: false,
        priceChanged: false,
        imageChanged: false,
        activeChanged: false,
        nameChanged: false,
        categoryChanged: false,
        rubroChanged: false,
        metaChanged: false,
        updateData: {},
      };
    }
    return {
      hasChanges: true,
      priceChanged: false,
      imageChanged: false,
      activeChanged: true,
      nameChanged: false,
      categoryChanged: false,
      rubroChanged: false,
      metaChanged: false,
      updateData: { isActive: false },
    };
  }

  const updateData: Record<string, unknown> = {};
  const targetActive = Number(prodRow.active) === 1;
  const activeChanged = erp.isActive !== targetActive;
  if (activeChanged) updateData.isActive = targetActive;

  const cleanProdName = (prodRow.name || '').trim();
  const nameChanged = Boolean(cleanProdName && cleanProdName !== erp.name.trim());
  if (nameChanged) updateData.name = cleanProdName;

  let priceChanged = false;
  const rawProdPrice = prodRow.price !== null && prodRow.price !== undefined ? Number(prodRow.price) : 0;
  if (Number.isFinite(rawProdPrice) && rawProdPrice > 0) {
    const nextListPrice = roundToIntegerPeso(prodRow.price!);
    const currListPrice = roundToIntegerPeso(erp.listPrice);
    const currPriceB = roundToIntegerPeso(erp.listPriceB);
    const currPriceC = roundToIntegerPeso(erp.listPriceC);

    if (!nextListPrice.eq(currListPrice)) {
      priceChanged = true;
      const nextPriceB = computeProportionalTierPrice(nextListPrice, currListPrice, currPriceB);
      const nextPriceC = computeProportionalTierPrice(nextListPrice, currListPrice, currPriceC);
      const costDec = roundToTwoDecimals(erp.costPrice);

      updateData.previousListPrice = currListPrice.toNumber();
      updateData.lastPriceUpdateAt = syncTimestamp;
      updateData.listPrice = nextListPrice.toNumber();
      updateData.listPriceB = nextPriceB.toNumber();
      updateData.listPriceC = nextPriceC.toNumber();
      updateData.profitMargin = computeClampedMarginPct(costDec, nextListPrice);
    }
  }

  const imageChanged = Boolean(resolvedImageUrl && resolvedImageUrl !== erp.imageUrl);
  if (imageChanged) updateData.imageUrl = resolvedImageUrl;

  const cleanCategory = (prodRow.category || '').trim();
  const categoryChanged = Boolean(cleanCategory && cleanCategory !== (erp.commercialCategory || '').trim());
  if (categoryChanged) updateData.commercialCategory = cleanCategory;

  const rubroChanged = Boolean(
    resolvedRubroId !== undefined &&
      resolvedRubroId !== null &&
      erp.rubroId !== undefined &&
      erp.rubroId !== resolvedRubroId,
  );
  if (rubroChanged) updateData.rubroId = resolvedRubroId;

  let metaChanged = false;
  const cleanSubrubro = (prodRow.subrubro || '').trim();
  if (cleanSubrubro && cleanSubrubro !== (erp.description || '').trim()) {
    updateData.description = cleanSubrubro;
    metaChanged = true;
  }

  const parsedMinQty = parseInt(String(prodRow.min_qty ?? '').trim(), 10);
  if (Number.isInteger(parsedMinQty) && parsedMinQty >= 1 && parsedMinQty !== erp.minOrderQuantity) {
    updateData.minOrderQuantity = parsedMinQty;
    metaChanged = true;
  }

  const rawWeight =
    prodRow.peso_promedio !== null && prodRow.peso_promedio !== undefined
      ? Number(prodRow.peso_promedio)
      : 0;
  if (Number.isFinite(rawWeight) && rawWeight > 0) {
    const nextWeight = roundToThreeDecimalsWeight(prodRow.peso_promedio!);
    const currWeight =
      erp.approximateWeight !== null ? roundToThreeDecimalsWeight(erp.approximateWeight) : null;
    if (!currWeight || !nextWeight.eq(currWeight)) {
      updateData.approximateWeight = nextWeight.toNumber();
      metaChanged = true;
    }
    if (!erp.isPesable) {
      updateData.isPesable = true;
      metaChanged = true;
    }
  }

  const hasChanges =
    priceChanged ||
    imageChanged ||
    activeChanged ||
    nameChanged ||
    categoryChanged ||
    rubroChanged ||
    metaChanged;

  return {
    hasChanges,
    priceChanged,
    imageChanged,
    activeChanged,
    nameChanged,
    categoryChanged,
    rubroChanged,
    metaChanged,
    updateData,
  };
}
