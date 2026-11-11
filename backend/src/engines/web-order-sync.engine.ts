import { Decimal } from 'decimal.js';
import { OrderStatus } from '@prisma/client';
import {
  calculateAfipBreakdown,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  sumIntegerAmounts,
  toDecimal,
} from '../core/money';
import { normalizeWebSku } from './catalog-bridge.engine';

export interface WebIncomingOrderItem {
  sku: string | null;
  product_name: string;
  unit_price: number | string;
  quantity: number;
  subtotal: number | string;
}

export interface ErpProductForWebOrder {
  id: number;
  sku: string;
  name: string;
  costPrice: Decimal | number | string;
  listPrice: Decimal | number | string;
  stock: number;
  isPesable: boolean;
  approximateWeight: Decimal | number | string | null;
  unitsPerBox: number;
}

export interface WebComboLegDefinition {
  sku: string;
  unitsPerCombo: number;
  unitPrice: number;
  isFree: boolean;
}

export interface WebComboDefinition {
  comboKey: string;
  title: string;
  legs: WebComboLegDefinition[];
}

export interface TranslatedErpOrderLine {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  weight: null;
  unitPrice: number;
  subtotal: number;
  unitCostSnapshot: number;
  listPriceSnapshot: number;
  discountPctSnapshot: number;
  bultosEstimated: number;
  stockInsufficient: boolean;
}

export interface TranslatedWebOrderResult {
  lines: TranslatedErpOrderLine[];
  totalAmount: number;
  netAmount: number;
  taxAmount: number;
  bultosCount: number;
  unmappedNotes: string[];
  stockWarnings: string[];
}

/**
 * Normaliza teléfonos argentinos (`+54 9 3388 501086`, `03388-15501086`, `3388501086`)
 * al núcleo comparable de 10 dígitos para cruzar sin duplicados contra `Persona.phone`.
 */
export function extractComparableArPhoneDigits(rawPhone?: string | null): string {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('549') && digits.length >= 12) {
    digits = digits.slice(3);
  } else if (digits.startsWith('54') && digits.length >= 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 12 && digits.slice(4, 6) === '15') {
    digits = digits.slice(0, 4) + digits.slice(6);
  } else if (digits.length === 11 && digits.slice(3, 5) === '15') {
    digits = digits.slice(0, 3) + digits.slice(5);
  }
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function parseComboLegBreakdown(leg: Record<string, any> | undefined): WebComboLegDefinition | null {
  if (!leg || typeof leg !== 'object' || !leg.sku) return null;
  const sku = normalizeWebSku(String(leg.sku));
  if (!sku) return null;

  const uxbMatch = String(leg.uxb || '').trim().match(/(\d+)/);
  const uxbUnits = uxbMatch ? Math.max(1, parseInt(uxbMatch[1], 10)) : 1;
  const condStr = String(leg.condition || '').trim().toUpperCase();

  let unitsPerCombo = uxbUnits;
  if (condStr.includes('UNIDAD')) {
    const m = condStr.match(/^(\d+)/);
    unitsPerCombo = m ? Math.max(1, parseInt(m[1], 10)) : uxbUnits;
  } else if (condStr.includes('BULTO')) {
    const m = condStr.match(/^(\d+)/);
    const bultos = m ? Math.max(1, parseInt(m[1], 10)) : 1;
    unitsPerCombo = bultos * uxbUnits;
  }

  const isFree = Boolean(leg.is_free);
  const unitPrice = isFree ? 0 : Math.max(0, roundToIntegerPeso(leg.price || 0).toNumber());

  return { sku, unitsPerCombo, unitPrice, isFree };
}

/**
 * Extrae el mapa de Combos activos desde `metadata.catalog_active_state` de `chatbot-dv`.
 */
export function parseCatalogCombosMap(
  rawStateJson?: string | null,
): Map<string, WebComboDefinition> {
  const map = new Map<string, WebComboDefinition>();
  if (!rawStateJson || !rawStateJson.trim()) return map;

  try {
    const parsed = JSON.parse(rawStateJson);
    const items: any[] = Array.isArray(parsed?.catalogItems)
      ? parsed.catalogItems
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];

    const combos = items.filter(
      (it) => it && typeof it === 'object' && (it.is_combo || it.category === 'COMBOS 💣'),
    );

    combos.forEach((c, idx) => {
      const legs = [parseComboLegBreakdown(c.prod1), parseComboLegBreakdown(c.prod2)].filter(
        Boolean,
      ) as WebComboLegDefinition[];
      if (legs.length === 0) return;

      const defaultCode = `COMBO_${idx + 1}`;
      const comboNumKey = String(c.combo_num || `COMBO ${idx + 1}`)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_');

      const def: WebComboDefinition = {
        comboKey: String(c.sku || defaultCode).trim().toUpperCase(),
        title: String(c.title || defaultCode).replace(/\s+/g, ' ').trim(),
        legs,
      };

      map.set(defaultCode, def);
      map.set(comboNumKey, def);
      if (c.sku) map.set(String(c.sku).trim().toUpperCase(), def);
      if (c.id) map.set(String(c.id).trim().toUpperCase(), def);
    });
  } catch {
    return map;
  }

  return map;
}

function computeSnapshotDiscountPct(listPrice: Decimal, effectiveUnitPrice: Decimal): number {
  if (listPrice.lte(0) || effectiveUnitPrice.gte(listPrice)) return 0;
  const pct = listPrice.minus(effectiveUnitPrice).dividedBy(listPrice).times(100);
  return roundToTwoDecimals(Decimal.max(0, Decimal.min(100, pct))).toNumber();
}

/**
 * Traduce los renglones entrantes de `donvenancio.com.ar` / Bot WA a renglones contables del ERP:
 * - Desglosa `unit_price` de pesables (`$/pieza` -> `$/kg` real para balanza `OrderScaleService`).
 * - Expande `COMBOS` en sus SKUs físicos reales preservando el subtotal exacto de la promoción.
 */
export function translateWebOrderItemsToErpLines(
  webItems: WebIncomingOrderItem[],
  erpProductsBySku: Map<string, ErpProductForWebOrder>,
  combosMap: Map<string, WebComboDefinition> = new Map(),
): TranslatedWebOrderResult {
  const lines: TranslatedErpOrderLine[] = [];
  const unmappedNotes: string[] = [];
  const stockWarnings: string[] = [];

  const pushProductLine = (
    product: ErpProductForWebOrder,
    qtyInput: number,
    rawWebUnitPrice: number | string,
    forceExactUnitPrice = false,
  ) => {
    const qty = Math.max(1, Math.trunc(qtyInput));
    const costSnap = roundToTwoDecimals(product.costPrice);
    const listSnap = roundToIntegerPeso(product.listPrice);
    const webUnitDec = toDecimal(rawWebUnitPrice || 0);
    const approxKg =
      product.approximateWeight && Number(product.approximateWeight) > 0
        ? roundToThreeDecimalsWeight(product.approximateWeight)
        : new Decimal(1);

    let effectiveUnitPrice: Decimal;
    let lineSubtotal: Decimal;

    if (product.isPesable && !forceExactUnitPrice && approxKg.gt(1.05) && listSnap.gt(0)) {
      const pieceReference = listSnap.times(approxKg);
      const looksLikePiecePrice = webUnitDec.gte(pieceReference.times(0.75));
      effectiveUnitPrice = looksLikePiecePrice
        ? roundToIntegerPeso(webUnitDec.dividedBy(approxKg))
        : roundToIntegerPeso(webUnitDec);
      lineSubtotal = roundToIntegerPeso(effectiveUnitPrice.times(qty).times(approxKg));
    } else {
      effectiveUnitPrice = roundToIntegerPeso(webUnitDec);
      lineSubtotal = roundToIntegerPeso(effectiveUnitPrice.times(qty));
    }

    const discountPct = computeSnapshotDiscountPct(listSnap, effectiveUnitPrice);
    const stockInsufficient = product.stock < qty;
    if (stockInsufficient) {
      stockWarnings.push(
        `SKU ${product.sku} (${product.name}): pedido ${qty}, stock sistema ${product.stock}`,
      );
    }

    lines.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: qty,
      weight: null,
      unitPrice: effectiveUnitPrice.toNumber(),
      subtotal: lineSubtotal.toNumber(),
      unitCostSnapshot: costSnap.toNumber(),
      listPriceSnapshot: listSnap.toNumber(),
      discountPctSnapshot: discountPct,
      bultosEstimated: Math.ceil(qty / Math.max(1, product.unitsPerBox || 1)),
      stockInsufficient,
    });
  };

  for (const rawItem of webItems) {
    const qty = Math.max(1, Math.trunc(Number(rawItem.quantity) || 1));
    const rawSku = String(rawItem.sku || '').trim();
    const upperKey = rawSku.toUpperCase().replace(/\s+/g, '_');

    const comboDef = combosMap.get(upperKey) || combosMap.get(rawSku.toUpperCase());
    if (comboDef) {
      for (const leg of comboDef.legs) {
        const legProd = erpProductsBySku.get(leg.sku);
        if (!legProd) {
          unmappedNotes.push(
            `Componente ${leg.sku} de ${comboDef.comboKey} (${comboDef.title}) x${qty * leg.unitsPerCombo}`,
          );
          continue;
        }
        pushProductLine(legProd, qty * leg.unitsPerCombo, leg.unitPrice, true);
      }
      continue;
    }

    const normalizedSku = normalizeWebSku(rawSku);
    const product = normalizedSku ? erpProductsBySku.get(normalizedSku) : undefined;
    if (!product || normalizedSku === 'CHAT') {
      unmappedNotes.push(
        `${qty}x ${rawItem.product_name}${rawSku && rawSku !== 'CHAT' ? ` [SKU ${rawSku}]` : ''}`,
      );
      continue;
    }

    pushProductLine(product, qty, rawItem.unit_price);
  }

  const totalDec = sumIntegerAmounts(lines.map((l) => l.subtotal));
  const afip = calculateAfipBreakdown(totalDec, 21, 0);
  const bultosCount = Math.max(
    1,
    lines.reduce((acc, l) => acc + l.bultosEstimated, 0),
  );

  return {
    lines,
    totalAmount: totalDec.toNumber(),
    netAmount: afip.netAmount.toNumber(),
    taxAmount: afip.ivaAmount.toNumber(),
    bultosCount,
    unmappedNotes,
    stockWarnings,
  };
}

export function mapWebOrderStatusToErp(webStatus?: string | null): OrderStatus {
  const s = String(webStatus || '').trim().toLowerCase();
  if (s === 'cancelado') return OrderStatus.CANCELLED;
  if (s === 'entregado') return OrderStatus.DELIVERED;
  if (s === 'en_armado') return OrderStatus.PREPARING;
  if (s === 'en_reparto') return OrderStatus.PREPARED;
  return OrderStatus.PENDING;
}

export function mapErpOrderStatusToWeb(erpStatus: OrderStatus): string {
  switch (erpStatus) {
    case OrderStatus.PREPARING:
      return 'en_armado';
    case OrderStatus.PREPARED:
      return 'en_reparto';
    case OrderStatus.DELIVERED:
      return 'entregado';
    case OrderStatus.CANCELLED:
      return 'cancelado';
    case OrderStatus.PENDING:
    default:
      return 'confirmado';
  }
}
