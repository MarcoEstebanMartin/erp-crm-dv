import { roundToTwoDecimals, toDecimal } from '../core/money';

export interface RawExtractedInvoiceItem {
  code: string | null;
  ean?: string | null;
  description: string;
  quantity: number;
  unitOfMeasure?: string | null;
  unitsPerPack?: number;
  unitPrice: number;
  subtotal: number;
  isNonStock?: boolean;
}

export interface NormalizedExtractedInvoiceItem {
  code: string | null;
  ean: string | null;
  description: string;
  billedQuantity: number;
  unitOfMeasure: string | null;
  unitsPerPack: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isNonStock: boolean;
  globalDiscountApplied: boolean;
}

const PACK_UOM_SET = new Set(['CA', 'CAJ', 'CAJA', 'CAJAS', 'BTO', 'BULTO', 'BULTOS', 'PACK', 'CJ', 'BX']);
const WEIGHT_UOM_SET = new Set(['KG', 'KGS', 'GR', 'GRS', 'LT', 'LTS']);

const NON_STOCK_PATTERNS = [
  /\bFLETE\b/,
  /\bENVIO\b/,
  /\bTRANSPORTE\b/,
  /\bLOGISTICA\b/,
  /\bACARREO\b/,
  /\bDESPACHO\b/,
  /\bSEGURO\s+DE\s+CARGA\b/,
  /\bSERVICIO\s+DE\b/,
];

/**
 * Detecta descripciones de fletes, logística o servicios que no deben ingresar a stock físico.
 */
export function isLikelyNonStockDescription(description: string): boolean {
  if (!description) return false;
  const normalized = description
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return NON_STOCK_PATTERNS.some((pattern) => pattern.test(normalized));
}

function shouldConvertPacksToUnits(item: RawExtractedInvoiceItem, unitsPerPack: number): boolean {
  if (unitsPerPack <= 1) return false;

  const uom = item.unitOfMeasure ? item.unitOfMeasure.trim().toUpperCase() : '';
  if (WEIGHT_UOM_SET.has(uom)) return false;
  if (PACK_UOM_SET.has(uom)) return true;

  // Caso La Virginia: CANT en bultos (ej. 4), CONTENIDO 6/100G, U.NETO por unidad y TOTAL = 4 * 6 * U.NETO
  const qty = toDecimal(item.quantity || 0);
  const price = toDecimal(item.unitPrice || 0);
  const subtotal = toDecimal(item.subtotal || 0);
  if (qty.gt(0) && price.gt(0) && subtotal.gt(0)) {
    const asUnitsDiff = qty.times(price).minus(subtotal).abs();
    const asPacksDiff = qty.times(unitsPerPack).times(price).minus(subtotal).abs();
    if (asPacksDiff.lt(asUnitsDiff) && asPacksDiff.div(subtotal).lte(0.05)) {
      return true;
    }
  }

  return false;
}

/**
 * Normaliza los renglones extraídos por OCR/IA usando Decimal.js:
 * 1. Prorratea descuentos globales al pie (ej. Bonif. Canal + Desc. Financiero en Branca) si la suma de ítems supera el neto gravado.
 * 2. Convierte bultos/cajas a unidades de stock y calcula el costo neto unitario exacto.
 * 3. Marca automáticamente fletes y servicios como `isNonStock: true`.
 */
export function normalizeExtractedInvoiceItems(params: {
  items: RawExtractedInvoiceItem[];
  netAmount: number;
}): NormalizedExtractedInvoiceItem[] {
  const rawItems = params.items || [];
  if (rawItems.length === 0) return [];

  const netDec = toDecimal(params.netAmount || 0);
  const rawSubtotalsSum = rawItems.reduce(
    (acc, item) => acc.plus(toDecimal(item.subtotal || 0)),
    toDecimal(0),
  );

  // Si la suma de subtotales de línea excede el neto gravado en más de 0.5%, hubo descuentos globales al pie.
  let globalFactor = toDecimal(1);
  let globalDiscountApplied = false;
  if (netDec.gt(0) && rawSubtotalsSum.gt(netDec)) {
    const diffRatio = rawSubtotalsSum.minus(netDec).div(rawSubtotalsSum);
    if (diffRatio.gt(0.005)) {
      globalFactor = netDec.div(rawSubtotalsSum);
      globalDiscountApplied = true;
    }
  }

  return rawItems.map((item) => {
    const isNonStock = Boolean(item.isNonStock) || isLikelyNonStockDescription(item.description);
    const uom = item.unitOfMeasure ? item.unitOfMeasure.trim().toUpperCase() : null;
    const rawPack = Math.trunc(Number(item.unitsPerPack ?? 1));
    const unitsPerPack = isNonStock || !Number.isFinite(rawPack) || rawPack < 1 ? 1 : rawPack;

    const billedQtyDec = toDecimal(item.quantity || 0);
    const rawSubtotalDec = toDecimal(item.subtotal || 0);
    const effectiveSubtotalDec =
      rawSubtotalDec.gt(0)
        ? roundToTwoDecimals(rawSubtotalDec.times(globalFactor))
        : roundToTwoDecimals(billedQtyDec.times(toDecimal(item.unitPrice || 0)).times(globalFactor));

    const convertPacks = !isNonStock && shouldConvertPacksToUnits(item, unitsPerPack);
    const stockQtyDec = convertPacks ? billedQtyDec.times(unitsPerPack) : billedQtyDec;

    let unitCostDec = roundToTwoDecimals(item.unitPrice || 0);
    if (stockQtyDec.gt(0) && effectiveSubtotalDec.gt(0)) {
      const derivedUnitCost = roundToTwoDecimals(effectiveSubtotalDec.div(stockQtyDec));
      if (convertPacks || globalDiscountApplied || unitCostDec.lte(0)) {
        unitCostDec = derivedUnitCost;
      } else {
        const lineMismatch = stockQtyDec.times(unitCostDec).minus(effectiveSubtotalDec).abs().div(effectiveSubtotalDec);
        if (lineMismatch.gt(0.005)) {
          unitCostDec = derivedUnitCost;
        }
      }
    } else if (globalDiscountApplied && unitCostDec.gt(0)) {
      unitCostDec = roundToTwoDecimals(unitCostDec.times(globalFactor));
    }

    const cleanEan = item.ean ? item.ean.replace(/\D/g, '') : '';

    return {
      code: item.code ? String(item.code).trim() : null,
      ean: cleanEan.length >= 8 ? cleanEan : null,
      description: item.description,
      billedQuantity: billedQtyDec.toNumber(),
      unitOfMeasure: uom,
      unitsPerPack: convertPacks ? unitsPerPack : 1,
      quantity: stockQtyDec.toNumber(),
      unitPrice: unitCostDec.toNumber(),
      subtotal: effectiveSubtotalDec.toNumber(),
      isNonStock,
      globalDiscountApplied,
    };
  });
}
