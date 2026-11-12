export const SCALE = 1_000_000n;
const SCALE_SQUARED = SCALE * SCALE;

export interface ExactRowValuation {
  physicalUnits: number;
  isWeighable: boolean;
  estimatedTotalKg: number;
  stockValueCost: number;
  stockValueSale: number;
}

export interface ExactLatentMargin {
  latentProfit: number;
  latentMarginPct: number;
  latentMarginPctInt: number;
  sign: '+' | '-' | '';
}

export function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  const sign = (numerator < 0n) !== (denominator < 0n) ? -1n : 1n;
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;
  return sign * ((absNum * 2n + absDen) / (absDen * 2n));
}

export function parseScaledBigInt(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  if (typeof value === 'number' && !Number.isFinite(value)) return 0n;
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(value).trim().replace(',', '.'));
  if (!match) return 0n;
  const sign = match[1] === '-' ? -1n : 1n;
  const rawFrac = match[3] || '';
  const frac6 = BigInt(rawFrac.slice(0, 6).padEnd(6, '0'));
  const roundUp = rawFrac.length > 6 && rawFrac[6] >= '5' ? 1n : 0n;
  return sign * (BigInt(match[2]) * SCALE + frac6 + roundUp);
}

function scaledToNumber(scaled: bigint, decimals: number, divisor: bigint): number {
  if (scaled === 0n) return 0;
  const signPrefix = scaled < 0n ? '-' : '';
  const abs = scaled < 0n ? -scaled : scaled;
  const whole = abs / divisor;
  const rem = abs % divisor;
  return rem === 0n
    ? Number(`${signPrefix}${whole}`)
    : Number(`${signPrefix}${whole}.${rem.toString().padStart(decimals, '0')}`);
}

export function calculateExactStockValuation(input: {
  physicalUnits: number; isPesable?: boolean; approximateWeight?: string | number | null;
  costPrice?: string | number | null; listPrice?: string | number | null;
}): ExactRowValuation {
  const units = Math.max(0, Math.trunc(input.physicalUnits || 0));
  const weightScaled = parseScaledBigInt(input.approximateWeight);
  const isWeighable = Boolean(input.isPesable) && weightScaled > 0n;
  const effectiveQtyScaled = BigInt(units) * (isWeighable ? weightScaled : SCALE);
  const grams = isWeighable ? divRoundHalfUp(effectiveQtyScaled, 1_000n) : 0n;
  return {
    physicalUnits: units,
    isWeighable,
    estimatedTotalKg: isWeighable ? scaledToNumber(grams, 3, 1_000n) : 0,
    stockValueCost: Number(divRoundHalfUp(effectiveQtyScaled * parseScaledBigInt(input.costPrice), SCALE_SQUARED)),
    stockValueSale: Number(divRoundHalfUp(effectiveQtyScaled * parseScaledBigInt(input.listPrice), SCALE_SQUARED)),
  };
}

export function resolveProductRowValuation(
  product: any, displayedStock: number, options?: { hasPendingEdit?: boolean; canViewCosts?: boolean }
): ExactRowValuation {
  const units = Math.max(0, Math.trunc(displayedStock || 0));
  const canViewCosts = options?.canViewCosts ?? true;
  const computed = calculateExactStockValuation({
    physicalUnits: units, isPesable: product?.isPesable, approximateWeight: product?.approximateWeight,
    costPrice: canViewCosts ? product?.costPrice : 0, listPrice: product?.listPrice,
  });
  const sv = product?.stockValuation;
  if (!options?.hasPendingEdit && sv && sv.physicalUnits === units) {
    return {
      ...computed,
      estimatedTotalKg: computed.isWeighable ? (sv.estimatedTotalKg ?? computed.estimatedTotalKg) : 0,
      stockValueCost: canViewCosts ? Math.trunc(sv.stockValueCost || 0) : 0,
      stockValueSale: Math.trunc(sv.stockValueSale || 0),
    };
  }
  return computed;
}

export function computeExactLatentMargin(totalCostInt: number, totalSaleInt: number): ExactLatentMargin {
  const costBig = BigInt(Math.trunc(totalCostInt || 0));
  const saleBig = BigInt(Math.trunc(totalSaleInt || 0));
  const profitBig = saleBig - costBig;
  const sign: '+' | '-' | '' = profitBig > 0n ? '+' : profitBig < 0n ? '-' : '';
  const marginBps = costBig > 0n ? divRoundHalfUp(profitBig * 10_000n, costBig) : 0n;
  const marginInt = costBig > 0n ? divRoundHalfUp(profitBig * 100n, costBig) : 0n;
  return {
    latentProfit: Number(profitBig),
    latentMarginPct: scaledToNumber(marginBps, 2, 100n),
    latentMarginPctInt: Number(marginInt),
    sign,
  };
}
