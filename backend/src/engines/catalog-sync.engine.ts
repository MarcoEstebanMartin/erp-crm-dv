import path from 'path';
import { Decimal } from 'decimal.js';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';
import { calculateRealMarginPct } from './pricing.engine';

export interface ProductionCatalogRow {
  sku: string;
  name: string;
  price: number | string | null;
  active: number;
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
}

export interface ErpProductSyncPatchResult {
  hasChanges: boolean;
  priceChanged: boolean;
  imageChanged: boolean;
  activeChanged: boolean;
  nameChanged: boolean;
  metaChanged: boolean;
  updateData: Record<string, unknown>;
}

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/**
 * Resuelve la extensión segura de imagen a partir del nombre original o MIME type.
 */
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

/**
 * Genera un nombre de archivo inmutable y libre de colisiones para `backend/uploads/products/`.
 * - Si Producción ya versionó el archivo con sufijo (`0031_1794344664.png`), lo preserva sanitizado.
 * - Si es plano (`0029.jpg`), agrega `_dv_<md5_8>` (`0029_dv_8a9f12b4.jpg`) para evitar que
 *   `syncMasterProductImages` o el directorio estático de Vite pisen la foto HD de Producción.
 */
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

/**
 * Preserva la relación exacta de Lista B o Lista C respecto a Lista A redondeando al peso entero.
 */
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

/**
 * Calcula el margen real acotado a [-999.99, 999.99] para no desbordar `NUMERIC(5, 2)` en PostgreSQL.
 */
export function computeClampedMarginPct(
  costPrice: Decimal,
  listPriceA: Decimal,
): number | null {
  if (costPrice.lte(0)) return null;
  const rawMargin = calculateRealMarginPct(costPrice, listPriceA);
  const clamped = Decimal.max(-999.99, Decimal.min(999.99, rawMargin));
  return roundToTwoDecimals(clamped).toNumber();
}

/**
 * Calcula de forma determinística el parche a aplicar en `erp-dv` para nivelarlo con `chatbot-dv`.
 */
export function computeErpProductSyncPatch(
  erp: ErpCatalogProductSnapshot,
  prodRow: ProductionCatalogRow | undefined,
  resolvedImageUrl: string | null,
  syncTimestamp: Date = new Date(),
): ErpProductSyncPatchResult {
  if (!prodRow) {
    if (!erp.isActive) {
      return {
        hasChanges: false,
        priceChanged: false,
        imageChanged: false,
        activeChanged: false,
        nameChanged: false,
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

  let metaChanged = false;
  const parsedMinQty = parseInt(String(prodRow.min_qty ?? '').trim(), 10);
  if (Number.isInteger(parsedMinQty) && parsedMinQty >= 1 && parsedMinQty !== erp.minOrderQuantity) {
    updateData.minOrderQuantity = parsedMinQty;
    metaChanged = true;
  }

  const rawWeight = prodRow.peso_promedio !== null && prodRow.peso_promedio !== undefined
    ? Number(prodRow.peso_promedio)
    : 0;
  if (Number.isFinite(rawWeight) && rawWeight > 0) {
    const nextWeight = roundToThreeDecimalsWeight(prodRow.peso_promedio!);
    const currWeight = erp.approximateWeight !== null ? roundToThreeDecimalsWeight(erp.approximateWeight) : null;
    if (!currWeight || !nextWeight.eq(currWeight)) {
      updateData.approximateWeight = nextWeight.toNumber();
      metaChanged = true;
    }
    if (!erp.isPesable) {
      updateData.isPesable = true;
      metaChanged = true;
    }
  }

  const hasChanges = priceChanged || imageChanged || activeChanged || nameChanged || metaChanged;
  return {
    hasChanges,
    priceChanged,
    imageChanged,
    activeChanged,
    nameChanged,
    metaChanged,
    updateData,
  };
}
