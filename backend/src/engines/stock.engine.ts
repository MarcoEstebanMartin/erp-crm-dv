import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';

export interface StockValuationInput {
  physicalUnits: number;
  isWeighable: boolean;
  approxWeightKg: number;
  costPrice: number;
  priceList4: number;
  minStockAlert: number;
}

export interface StockValuationResult {
  physicalUnits: number;
  estimatedTotalKg: number;
  effectiveMultiplier: number;
  stockValueCost: number;
  stockValueSale: number;
  latentProfit: number;
  latentMarginPct: number;
  stockHealth: 'OK' | 'LOW' | 'OUT';
}

export type LotFefoStatus = 'OK' | 'EXPIRING_SOON' | 'EXPIRED';

/**
 * Calcula la valorización financiera exacta de un artículo en stock.
 * - Si el artículo es pesable (ej. Horma de Queso Barra Tybo de 4.2 kg),
 *   multiplica: Unidades Físicas * Peso Aproximado Kg * Precio por Kg,
 *   redondeando al peso entero más cercano (ROUND_HALF_UP).
 */
export function calculateProductStockValuation(input: StockValuationInput): StockValuationResult {
  const units = Math.max(0, Math.trunc(input.physicalUnits));
  const useWeightMultiplier = input.isWeighable && input.approxWeightKg > 0;
  const multiplierDec = useWeightMultiplier ? toDecimal(input.approxWeightKg) : toDecimal(1);

  const unitsDec = toDecimal(units);
  const effectiveQtyDec = unitsDec.times(multiplierDec);

  const costDec = toDecimal(input.costPrice);
  const saleDec = toDecimal(input.priceList4);

  const stockValueCost = roundToIntegerPeso(effectiveQtyDec.times(costDec)).toNumber();
  const stockValueSale = roundToIntegerPeso(effectiveQtyDec.times(saleDec)).toNumber();
  const latentProfit = stockValueSale - stockValueCost;

  const latentMarginPct =
    stockValueCost > 0
      ? roundToTwoDecimals(toDecimal(latentProfit).dividedBy(stockValueCost).times(100)).toNumber()
      : 0;

  let stockHealth: 'OK' | 'LOW' | 'OUT' = 'OK';
  if (units <= 0) {
    stockHealth = 'OUT';
  } else if (units <= Math.max(2, input.minStockAlert)) {
    stockHealth = 'LOW';
  }

  return {
    physicalUnits: units,
    estimatedTotalKg: useWeightMultiplier ? roundToThreeDecimalsWeight(effectiveQtyDec).toNumber() : 0,
    effectiveMultiplier: multiplierDec.toNumber(),
    stockValueCost,
    stockValueSale,
    latentProfit,
    latentMarginPct,
    stockHealth,
  };
}

/**
 * Evalúa el estado FEFO (First Expired, First Out) de un lote según su fecha de vencimiento.
 */
export function evaluateLotFefoStatus(
  expirationDateStr: string,
  referenceDate: Date = new Date(),
): LotFefoStatus {
  if (!expirationDateStr || expirationDateStr.startsWith('2036')) {
    return 'OK';
  }
  const exp = new Date(`${expirationDateStr}T00:00:00Z`);
  if (Number.isNaN(exp.getTime())) return 'OK';

  const ref = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()),
  );
  if (exp.getTime() <= ref.getTime()) {
    return 'EXPIRED';
  }

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (exp.getTime() - ref.getTime() <= thirtyDaysMs) {
    return 'EXPIRING_SOON';
  }
  return 'OK';
}

/**
 * Certifica la invariante de Libro Mayor:
 * La suma de unidades de todos los lotes activos de un SKU debe ser igual a la suma de deltas del StockLedger.
 */
export function verifyStockLedgerInvariant(
  lotQuantities: number[],
  ledgerDeltas: number[],
): { isValid: boolean; lotSum: number; ledgerSum: number } {
  const lotSum = lotQuantities.reduce((acc, q) => acc + Math.trunc(q), 0);
  const ledgerSum = ledgerDeltas.reduce((acc, d) => acc + Math.trunc(d), 0);
  return {
    isValid: lotSum === ledgerSum && lotSum >= 0,
    lotSum,
    ledgerSum,
  };
}
