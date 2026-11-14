import { Decimal } from 'decimal.js';
import {
  type NumericInput,
  calculateOrderLine,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  sumIntegerAmounts,
  toDecimal,
} from '../core/money';

export type WeeklyPromoTypeValue = 'OFFER_PRICE' | 'BUY_X_GET_Y' | 'COMBO';
export const ALLOWED_WEEKLY_PROMO_USERNAMES = ['admin', 'dario'] as const;
const ALLOWED_WEEKLY_PROMO_ROLES = new Set(['ADMIN', 'FACTURACION']);

export interface WeeklyPromoAuthActor { username?: string | null; role?: string | null; }
export interface WeeklyPromoItemSpec {
  productId: number;
  minQuantity: number;
  freeQuantity: number;
  promoUnitPrice: NumericInput | null;
}
export interface WeeklyPromoSpec {
  id: number;
  name: string;
  type: WeeklyPromoTypeValue;
  startDate: Date | string;
  endDate?: Date | string | null;
  isActive: boolean;
  items: WeeklyPromoItemSpec[];
}
export interface CartPromoInputLine {
  productId: number;
  quantity: number;
  weight?: NumericInput | null;
  isPromoBonus?: boolean;
}
export interface CartPromoProductCatalogItem {
  id: number;
  isPesable: boolean;
  approximateWeight?: NumericInput | null;
  costPrice: NumericInput;
  listPrice: NumericInput;
}
export interface CartBasePricingInfo {
  baseUnitPrice: NumericInput;
  baseListPrice: NumericInput;
  baseDiscountPct?: NumericInput;
}
export interface EvaluatedPromoOrderLine {
  productId: number;
  quantity: number;
  weight: number | null;
  unitPrice: number;
  subtotal: number;
  unitCostSnapshot: number;
  listPriceSnapshot: number;
  discountPctSnapshot: number;
  isPromoBonus: boolean;
  appliedPromoId: number | null;
  appliedPromoName: string | null;
}
export interface EvaluateCartWeeklyPromosResult {
  lines: EvaluatedPromoOrderLine[];
  totalAmount: number;
  stockRequiredByProduct: Record<number, number>;
  appliedPromoIds: number[];
}

/**
 * Restringe la gestión de Ofertas Semanales exclusivamente a admin y dario con rol administrativo.
 */
export function canUserManageWeeklyPromos(user?: WeeklyPromoAuthActor | null): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toUpperCase();
  const username = String(user.username || '').trim().toLowerCase();
  if (!ALLOWED_WEEKLY_PROMO_ROLES.has(role)) return false;
  return (ALLOWED_WEEKLY_PROMO_USERNAMES as readonly string[]).includes(username);
}

/**
 * Determina si una oferta semanal está activa y dentro de su ventana de vigencia.
 */
export function isWeeklyPromoCurrentlyValid(
  promo: { isActive: boolean; startDate: Date | string; endDate?: Date | string | null },
  now: Date = new Date(),
): boolean {
  if (!promo.isActive) return false;
  const start = new Date(promo.startDate);
  if (Number.isNaN(start.getTime()) || now.getTime() < start.getTime()) return false;
  if (promo.endDate !== undefined && promo.endDate !== null) {
    const end = new Date(promo.endDate);
    if (Number.isNaN(end.getTime()) || now.getTime() > end.getTime()) return false;
  }
  return true;
}

/**
 * Genera un nombre legible automático cuando el usuario no escribe título personalizado.
 */
export function buildDefaultWeeklyPromoName(input: {
  type: WeeklyPromoTypeValue;
  items: Array<{ productName: string; minQuantity: number; freeQuantity?: number; promoUnitPrice?: NumericInput | null }>;
}): string {
  const first = input.items[0];
  if (!first) return 'Oferta Semanal';
  if (input.type === 'OFFER_PRICE') {
    const prefix = first.minQuantity > 1 ? `Oferta x${first.minQuantity}` : 'Oferta';
    return `${prefix} · ${first.productName}`.slice(0, 120);
  }
  if (input.type === 'BUY_X_GET_Y') {
    const freeQty = Math.max(0, Math.trunc(Number(first.freeQuantity || 0)));
    return `${first.minQuantity}+${freeQty} Gratis · ${first.productName}`.slice(0, 120);
  }
  if (input.items.length === 2) {
    return `Combo · ${input.items[0].productName} + ${input.items[1].productName}`.slice(0, 120);
  }
  return `Combo · ${first.productName} + ${input.items.length - 1} más`.slice(0, 120);
}

function resolveBestPricePromoForProduct(
  productId: number,
  paidQty: number,
  baseUnitPriceInt: Decimal,
  validCombos: WeeklyPromoSpec[],
  validOffers: WeeklyPromoSpec[],
): { unitPrice: Decimal; promoId: number | null; promoName: string | null } {
  let best = { unitPrice: baseUnitPriceInt, promoId: null as number | null, promoName: null as string | null };
  const tryApply = (promo: WeeklyPromoSpec, requireMinQty: boolean) => {
    const item = promo.items.find((i) => i.productId === productId);
    if (!item || (requireMinQty && paidQty < item.minQuantity) || item.promoUnitPrice == null) return;
    const candidate = roundToIntegerPeso(item.promoUnitPrice);
    if (candidate.lt(best.unitPrice)) best = { unitPrice: candidate, promoId: promo.id, promoName: promo.name };
  };
  validCombos.forEach((c) => tryApply(c, false));
  validOffers.forEach((o) => tryApply(o, true));
  return best;
}

function resolveBestBuyXGetYPromo(
  productId: number,
  paidQty: number,
  buyXGetYPromos: WeeklyPromoSpec[],
): { bonusQty: number; promoId: number; promoName: string } | null {
  let best: { bonusQty: number; promoId: number; promoName: string } | null = null;
  for (const promo of buyXGetYPromos) {
    const item = promo.items.find((i) => i.productId === productId);
    if (!item || item.minQuantity < 1 || item.freeQuantity < 1 || paidQty < item.minQuantity) continue;
    const bonusQty = Math.floor(paidQty / item.minQuantity) * item.freeQuantity;
    if (bonusQty > 0 && (!best || bonusQty > best.bonusQty)) {
      best = { bonusQty, promoId: promo.id, promoName: promo.name };
    }
  }
  return best;
}

/**
 * Evalúa Ofertas Semanales (Precio Oferta, N+M Gratis y Combos) sobre líneas de carrito,
 * garantizando pesos enteros, Snapshots contables y prevención de doble bonificación.
 */
export function evaluateCartWeeklyPromos(params: {
  lines: CartPromoInputLine[];
  productsById: Map<number, CartPromoProductCatalogItem>;
  basePricingByProductId: Map<number, CartBasePricingInfo>;
  promos: WeeklyPromoSpec[];
  now?: Date;
}): EvaluateCartWeeklyPromosResult {
  const { lines, productsById, basePricingByProductId, promos, now = new Date() } = params;
  const paidLines = lines.filter((l) => !l.isPromoBonus && Math.trunc(Number(l.quantity)) > 0);
  const paidQtyByProduct = new Map<number, number>();
  for (const line of paidLines) {
    paidQtyByProduct.set(line.productId, (paidQtyByProduct.get(line.productId) ?? 0) + Math.trunc(Number(line.quantity)));
  }

  const validPromos = promos.filter((p) => isWeeklyPromoCurrentlyValid(p, now));
  const validCombos = validPromos.filter(
    (p) => p.type === 'COMBO' && p.items.length >= 2 && p.items.every((i) => (paidQtyByProduct.get(i.productId) ?? 0) >= i.minQuantity),
  );
  const validOffers = validPromos.filter((p) => p.type === 'OFFER_PRICE');
  const validBuyXGetY = validPromos.filter((p) => p.type === 'BUY_X_GET_Y');

  const resultLines: EvaluatedPromoOrderLine[] = [];
  const appliedIdsSet = new Set<number>();

  for (const line of paidLines) {
    const product = productsById.get(line.productId);
    const basePricing = basePricingByProductId.get(line.productId);
    if (!product || !basePricing) throw new Error(`Producto ID ${line.productId} sin datos base para evaluar promociones.`);

    const qty = Math.trunc(Number(line.quantity));
    const totalPaidQty = paidQtyByProduct.get(line.productId) ?? qty;
    const baseUnitInt = roundToIntegerPeso(basePricing.baseUnitPrice);
    const baseListInt = roundToIntegerPeso(basePricing.baseListPrice);
    const baseDiscount = roundToTwoDecimals(basePricing.baseDiscountPct ?? 0);
    const bestPromo = resolveBestPricePromoForProduct(line.productId, totalPaidQty, baseUnitInt, validCombos, validOffers);

    const approxKg = Number(product.approximateWeight || 1) || 1;
    const cleanWeight = product.isPesable && line.weight != null ? roundToThreeDecimalsWeight(line.weight).toNumber() : null;
    const billableQty = product.isPesable
      ? roundToThreeDecimalsWeight(cleanWeight !== null ? cleanWeight : toDecimal(qty).times(approxKg))
      : toDecimal(qty);

    const promoApplied = bestPromo.promoId !== null;
    if (promoApplied && bestPromo.promoId !== null) appliedIdsSet.add(bestPromo.promoId);

    const lineCalc = calculateOrderLine({
      unitCost: product.costPrice,
      unitPriceList: promoApplied ? bestPromo.unitPrice : baseDiscount.gt(0) ? baseListInt : baseUnitInt,
      billableQty,
      discountPct: promoApplied ? 0 : baseDiscount,
    });

    resultLines.push({
      productId: line.productId,
      quantity: qty,
      weight: cleanWeight,
      unitPrice: promoApplied ? bestPromo.unitPrice.toNumber() : roundToIntegerPeso(lineCalc.netUnitPrice).toNumber(),
      subtotal: lineCalc.lineSubtotal.toNumber(),
      unitCostSnapshot: lineCalc.unitCostSnapshot.toNumber(),
      listPriceSnapshot: lineCalc.listPriceSnapshot.toNumber(),
      discountPctSnapshot: lineCalc.discountPctSnapshot.toNumber(),
      isPromoBonus: false,
      appliedPromoId: bestPromo.promoId,
      appliedPromoName: bestPromo.promoName,
    });
  }

  for (const [productId, paidQty] of paidQtyByProduct.entries()) {
    const product = productsById.get(productId);
    const basePricing = basePricingByProductId.get(productId);
    if (!product || !basePricing || product.isPesable) continue;
    const bonus = resolveBestBuyXGetYPromo(productId, paidQty, validBuyXGetY);
    if (!bonus) continue;
    appliedIdsSet.add(bonus.promoId);
    resultLines.push({
      productId,
      quantity: bonus.bonusQty,
      weight: null,
      unitPrice: 0,
      subtotal: 0,
      unitCostSnapshot: roundToTwoDecimals(product.costPrice).toNumber(),
      listPriceSnapshot: roundToIntegerPeso(basePricing.baseListPrice).toNumber(),
      discountPctSnapshot: new Decimal(100).toNumber(),
      isPromoBonus: true,
      appliedPromoId: bonus.promoId,
      appliedPromoName: bonus.promoName,
    });
  }

  const stockRequiredByProduct: Record<number, number> = {};
  for (const outLine of resultLines) {
    stockRequiredByProduct[outLine.productId] = (stockRequiredByProduct[outLine.productId] || 0) + outLine.quantity;
  }

  return {
    lines: resultLines,
    totalAmount: sumIntegerAmounts(resultLines.map((l) => l.subtotal)).toNumber(),
    stockRequiredByProduct,
    appliedPromoIds: Array.from(appliedIdsSet),
  };
}
