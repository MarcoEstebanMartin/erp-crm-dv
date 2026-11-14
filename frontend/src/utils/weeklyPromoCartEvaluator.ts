import type { WeeklyPromo } from '../components/admin/config/weeklyPromo.helpers';
import { formatArsInteger, resolvePromoVisualStatus } from '../components/admin/config/weeklyPromo.helpers';
import { SCALE, divRoundHalfUp, parseScaledBigInt } from './exactStockMath';

export interface FrontendPromoCartItemInput {
  productId: number;
  productName?: string;
  quantity: number;
  weight?: number | string | null;
  isPesable?: boolean;
  approximateWeight?: number | string | null;
  baseUnitPrice: number | string;
  isPromoBonus?: boolean;
}

export interface FrontendEvaluatedLine {
  productId: number;
  effectiveUnitPrice: number;
  baseUnitPrice: number;
  lineSubtotal: number;
  promoApplied: boolean;
  appliedPromoId: number | null;
  appliedPromoName: string | null;
}

export interface FrontendPromoBonusLine {
  productId: number;
  productName: string;
  quantity: number;
  promoId: number;
  promoName: string;
}

export interface FrontendCartPromoEvalResult {
  byProductId: Record<number, FrontendEvaluatedLine>;
  bonusLines: FrontendPromoBonusLine[];
  stockRequiredByProduct: Record<number, number>;
  totalAmount: number;
  appliedPromoIds: number[];
  totalBonusUnits: number;
}

function roundPesoHalfUpBigInt(value: number | string | null | undefined): bigint {
  return divRoundHalfUp(parseScaledBigInt(value), SCALE);
}

/**
 * Calcula subtotal entero exacto usando BigInt escalado (ROUND_HALF_UP, 0 centavos),
 * replicando la precisión de core/money.ts para pesables (3 decimales en kg) y unidades.
 */
export function calculateExactLineSubtotalInt(params: {
  unitPriceInt: number | string;
  quantity: number;
  isPesable?: boolean;
  weight?: number | string | null;
  approximateWeight?: number | string | null;
}): number {
  const unitInt = roundPesoHalfUpBigInt(params.unitPriceInt);
  const qty = Math.max(0, Math.trunc(Number(params.quantity || 0)));
  if (qty <= 0 || unitInt <= 0n) return 0;

  if (!params.isPesable) {
    return Number(unitInt * BigInt(qty));
  }

  const explicitWeightScaled = parseScaledBigInt(params.weight);
  let grams: bigint;
  if (params.weight !== null && params.weight !== undefined && explicitWeightScaled > 0n) {
    grams = divRoundHalfUp(explicitWeightScaled, 1_000n);
  } else {
    const approxScaled = parseScaledBigInt(params.approximateWeight ?? 1);
    const safeApprox = approxScaled > 0n ? approxScaled : SCALE;
    grams = divRoundHalfUp(BigInt(qty) * safeApprox, 1_000n);
  }

  return Number(divRoundHalfUp(unitInt * grams, 1_000n));
}

/**
 * Detecta si un renglón histórico de pedido corresponde a bonificación N+M sin cargo ($0).
 * Permite excluir renglones gratis al reabrir un pedido en Editar Pedido o Repetir Compra.
 */
export function isBonusOrderItem(
  item: { isPromoBonus?: boolean; unitPrice?: any; price?: any; discountPctSnapshot?: any } | null | undefined,
): boolean {
  if (!item) return false;
  if (item.isPromoBonus === true) return true;
  const priceScaled = parseScaledBigInt(item.unitPrice ?? item.price ?? 0);
  const discountScaled = parseScaledBigInt(item.discountPctSnapshot ?? 0);
  return priceScaled === 0n && discountScaled >= 100n * SCALE;
}

/**
 * Devuelve una etiqueta breve de Oferta Semanal vigente para tarjetas y buscadores de productos.
 */
export function getProductPromoBadge(
  productId: number,
  promos: WeeklyPromo[],
  isPesable: boolean = false,
  now: Date = new Date(),
): string | null {
  if (!Array.isArray(promos) || promos.length === 0) return null;

  for (const promo of promos) {
    if (resolvePromoVisualStatus(promo, now) !== 'VIGENTE') continue;
    const item = promo.items?.find((i) => Number(i.productId) === Number(productId));
    if (!item) continue;

    if (promo.type === 'BUY_X_GET_Y' && !isPesable && item.minQuantity >= 1 && item.freeQuantity >= 1) {
      return `${item.minQuantity}+${item.freeQuantity} Gratis`;
    }
    if (promo.type === 'OFFER_PRICE' && item.promoUnitPrice !== null && item.promoUnitPrice !== undefined) {
      const priceText = formatArsInteger(item.promoUnitPrice);
      return item.minQuantity > 1 ? `x${item.minQuantity} a ${priceText}` : `Oferta ${priceText}`;
    }
    if (promo.type === 'COMBO') {
      return item.promoUnitPrice !== null && item.promoUnitPrice !== undefined
        ? `Combo ${formatArsInteger(item.promoUnitPrice)}`
        : 'En Combo';
    }
  }

  return null;
}

function resolveBestPricePromoForItem(
  productId: number,
  paidQty: number,
  baseUnitBig: bigint,
  validCombos: WeeklyPromo[],
  validOffers: WeeklyPromo[],
): { unitPriceBig: bigint; promoId: number | null; promoName: string | null } {
  let best = {
    unitPriceBig: baseUnitBig,
    promoId: null as number | null,
    promoName: null as string | null,
  };

  const tryApply = (promo: WeeklyPromo, requireMinQty: boolean) => {
    const item = promo.items.find((i) => Number(i.productId) === productId);
    if (!item || (requireMinQty && paidQty < item.minQuantity) || item.promoUnitPrice == null) return;
    const candidateBig = roundPesoHalfUpBigInt(item.promoUnitPrice);
    if (candidateBig > 0n && candidateBig < best.unitPriceBig) {
      best = { unitPriceBig: candidateBig, promoId: promo.id, promoName: promo.name };
    }
  };

  validCombos.forEach((c) => tryApply(c, false));
  validOffers.forEach((o) => tryApply(o, true));
  return best;
}

function resolveBestBuyXGetYPromo(
  productId: number,
  paidQty: number,
  validBuyXGetY: WeeklyPromo[],
): { bonusQty: number; promoId: number; promoName: string } | null {
  let best: { bonusQty: number; promoId: number; promoName: string } | null = null;
  for (const promo of validBuyXGetY) {
    const item = promo.items.find((i) => Number(i.productId) === productId);
    if (!item || item.minQuantity < 1 || item.freeQuantity < 1 || paidQty < item.minQuantity) continue;
    const bonusQty = Math.floor(paidQty / item.minQuantity) * item.freeQuantity;
    if (bonusQty > 0 && (!best || bonusQty > best.bonusQty)) {
      best = { bonusQty, promoId: promo.id, promoName: promo.name };
    }
  }
  return best;
}

/**
 * Evalúa Ofertas Semanales vigentes en el cliente con exactitud de pesos enteros,
 * generando vista previa fiel de precios promocionales, combos, renglones $0 y stock total requerido.
 */
export function evaluateFrontendCartPromos(params: {
  items: FrontendPromoCartItemInput[];
  promos: WeeklyPromo[];
  now?: Date;
}): FrontendCartPromoEvalResult {
  const { items, promos, now = new Date() } = params;
  const paidLines = items.filter((l) => !l.isPromoBonus && Math.trunc(Number(l.quantity || 0)) > 0);

  const paidQtyByProduct = new Map<number, number>();
  const productInfoById = new Map<number, FrontendPromoCartItemInput>();
  for (const line of paidLines) {
    const qty = Math.trunc(Number(line.quantity));
    paidQtyByProduct.set(line.productId, (paidQtyByProduct.get(line.productId) ?? 0) + qty);
    if (!productInfoById.has(line.productId)) productInfoById.set(line.productId, line);
  }

  const validPromos = (Array.isArray(promos) ? promos : []).filter(
    (p) => resolvePromoVisualStatus(p, now) === 'VIGENTE',
  );
  const validCombos = validPromos.filter(
    (p) =>
      p.type === 'COMBO' &&
      p.items.length >= 2 &&
      p.items.every((i) => (paidQtyByProduct.get(Number(i.productId)) ?? 0) >= i.minQuantity),
  );
  const validOffers = validPromos.filter((p) => p.type === 'OFFER_PRICE');
  const validBuyXGetY = validPromos.filter((p) => p.type === 'BUY_X_GET_Y');

  const byProductId: Record<number, FrontendEvaluatedLine> = {};
  const appliedIdsSet = new Set<number>();
  const stockRequiredByProduct: Record<number, number> = {};
  let totalAmountBig = 0n;

  for (const line of paidLines) {
    const qty = Math.trunc(Number(line.quantity));
    const totalPaidQty = paidQtyByProduct.get(line.productId) ?? qty;
    const baseUnitBig = roundPesoHalfUpBigInt(line.baseUnitPrice);
    const bestPrice = resolveBestPricePromoForItem(
      line.productId,
      totalPaidQty,
      baseUnitBig,
      validCombos,
      validOffers,
    );

    const promoApplied = bestPrice.promoId !== null;
    if (promoApplied && bestPrice.promoId !== null) appliedIdsSet.add(bestPrice.promoId);

    const effectiveUnitPrice = Number(bestPrice.unitPriceBig);
    const lineSubtotal = calculateExactLineSubtotalInt({
      unitPriceInt: effectiveUnitPrice,
      quantity: qty,
      isPesable: line.isPesable,
      weight: line.weight,
      approximateWeight: line.approximateWeight,
    });

    totalAmountBig += BigInt(lineSubtotal);
    stockRequiredByProduct[line.productId] = (stockRequiredByProduct[line.productId] || 0) + qty;

    const existing = byProductId[line.productId];
    byProductId[line.productId] = {
      productId: line.productId,
      effectiveUnitPrice,
      baseUnitPrice: Number(baseUnitBig),
      lineSubtotal: (existing?.lineSubtotal || 0) + lineSubtotal,
      promoApplied,
      appliedPromoId: bestPrice.promoId,
      appliedPromoName: bestPrice.promoName,
    };
  }

  const bonusLines: FrontendPromoBonusLine[] = [];
  let totalBonusUnits = 0;

  for (const [productId, paidQty] of paidQtyByProduct.entries()) {
    const info = productInfoById.get(productId);
    if (!info || info.isPesable) continue;
    const bonus = resolveBestBuyXGetYPromo(productId, paidQty, validBuyXGetY);
    if (!bonus) continue;
    appliedIdsSet.add(bonus.promoId);
    bonusLines.push({
      productId,
      productName: info.productName || `Producto #${productId}`,
      quantity: bonus.bonusQty,
      promoId: bonus.promoId,
      promoName: bonus.promoName,
    });
    stockRequiredByProduct[productId] = (stockRequiredByProduct[productId] || 0) + bonus.bonusQty;
    totalBonusUnits += bonus.bonusQty;
  }

  return {
    byProductId,
    bonusLines,
    stockRequiredByProduct,
    totalAmount: Number(totalAmountBig),
    appliedPromoIds: Array.from(appliedIdsSet),
    totalBonusUnits,
  };
}
