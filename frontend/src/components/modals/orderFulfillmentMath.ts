import { SCALE, divRoundHalfUp, parseScaledBigInt } from '../../utils/exactStockMath';
import { roundHalfUpInteger } from '../../utils/currency';
import {
  calculateExactLineSubtotalInt,
  isBonusOrderItem,
} from '../../utils/weeklyPromoCartEvaluator';

export interface FulfillmentWeightAnomaly {
  item: any;
  currentWeight: number;
  suggestedAvgWeight: number;
  possibleDecimalFix: number | null;
}

export function isOrderItemWeighable(item: any): boolean {
  return Boolean(item?.product?.isPesable || item?.isPesable);
}

/**
 * Calcula el peso sugerido en kg (a 3 decimales exactos con BigInt) únicamente
 * para artículos marcados como pesables en catálogo (`isPesable === true`).
 */
export function computeSuggestedItemWeightKg(item: any): number {
  if (!isOrderItemWeighable(item)) return 0;
  const qty = Math.max(0, Math.trunc(Number(item?.quantity || 0)));
  if (qty <= 0) return 0;

  const rawApproxScaled = parseScaledBigInt(item?.product?.approximateWeight);
  const approxScaled = rawApproxScaled > 0n ? rawApproxScaled : SCALE;
  const totalGrams = divRoundHalfUp(BigInt(qty) * approxScaled, 1_000n);
  return Number(totalGrams) / 1000;
}

export function normalizeWeightKg3(rawWeight: number | string | null | undefined): number {
  const scaled = parseScaledBigInt(rawWeight);
  if (scaled <= 0n) return 0;
  return Number(divRoundHalfUp(scaled, 1_000n)) / 1000;
}

export function buildInitialFulfillmentWeights(items: any[] | undefined): Record<number, number> {
  const initialWeights: Record<number, number> = {};
  for (const item of items || []) {
    if (!isOrderItemWeighable(item) || isBonusOrderItem(item)) continue;
    const prevWeight = normalizeWeightKg3(item?.weight);
    initialWeights[item.id] = prevWeight > 0 ? prevWeight : computeSuggestedItemWeightKg(item);
  }
  return initialWeights;
}

export function detectFulfillmentWeightAnomalies(
  items: any[] | undefined,
  weights: Record<number, number>,
): FulfillmentWeightAnomaly[] {
  const list: FulfillmentWeightAnomaly[] = [];

  for (const item of items || []) {
    if (!isOrderItemWeighable(item) || isBonusOrderItem(item)) continue;
    const suggestedAvgWeight = computeSuggestedItemWeightKg(item);
    const currentWeight = weights[item.id];
    const currentScaled = parseScaledBigInt(currentWeight);
    const suggestedScaled = parseScaledBigInt(suggestedAvgWeight);

    if (currentScaled <= 0n || suggestedScaled <= 0n) continue;

    const isOutlier =
      currentScaled > suggestedScaled * 2n ||
      (suggestedScaled >= 2n * SCALE && currentScaled * 10n < suggestedScaled * 3n);

    if (!isOutlier) continue;

    const fix10 = Number(divRoundHalfUp(currentScaled, SCALE)) / 10;
    const fix100 = Number(divRoundHalfUp(currentScaled, SCALE)) / 100;
    const fix10Scaled = parseScaledBigInt(fix10);
    const fix100Scaled = parseScaledBigInt(fix100);

    let possibleDecimalFix: number | null = null;
    if (fix10Scaled * 10n >= suggestedScaled * 5n && fix10Scaled * 10n <= suggestedScaled * 16n) {
      possibleDecimalFix = fix10;
    } else if (
      fix100Scaled * 10n >= suggestedScaled * 5n &&
      fix100Scaled * 10n <= suggestedScaled * 16n
    ) {
      possibleDecimalFix = fix100;
    }

    list.push({
      item,
      currentWeight: Number(currentWeight),
      suggestedAvgWeight,
      possibleDecimalFix,
    });
  }

  return list;
}

export function calculateFulfillmentLineSubtotalInt(
  item: any,
  weights: Record<number, number>,
): number {
  if (isBonusOrderItem(item)) return 0;

  const qty = Math.max(0, Math.trunc(Number(item?.quantity || 0)));
  if (qty <= 0) return 0;

  const unitPriceInt = roundHalfUpInteger(item?.unitPrice ?? item?.price ?? 0);
  if (unitPriceInt <= 0) return 0;

  const isPesable = isOrderItemWeighable(item);
  if (!isPesable) {
    return calculateExactLineSubtotalInt({
      unitPriceInt,
      quantity: qty,
      isPesable: false,
    });
  }

  const enteredWeight = normalizeWeightKg3(weights[item.id]);
  const fallbackWeight = computeSuggestedItemWeightKg(item);
  const effectiveWeight = enteredWeight > 0 ? enteredWeight : fallbackWeight;

  return calculateExactLineSubtotalInt({
    unitPriceInt,
    quantity: qty,
    isPesable: true,
    weight: effectiveWeight,
    approximateWeight: item?.product?.approximateWeight,
  });
}

export function calculateFulfillmentOrderTotalInt(
  items: any[] | undefined,
  weights: Record<number, number>,
): number {
  let total = 0;
  for (const item of items || []) {
    total += calculateFulfillmentLineSubtotalInt(item, weights);
  }
  return total;
}
