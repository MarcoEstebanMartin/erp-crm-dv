import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, sumIntegerAmounts, toDecimal } from '../core/money';

export const DEFAULT_WEEKLY_RESULT_BUFFER = 20_000_000;

export interface WeeklyPulsePurchaseItem {
  id: string;
  source: 'AUTO_INVOICE' | 'AUTO_PO' | 'MANUAL';
  sourceId?: number;
  company: string;
  date: string; // YYYY-MM-DD (fecha de recepción o fecha manual)
  invoiceDate?: string | null; // YYYY-MM-DD (referencia opcional de emisión)
  invoiceNumber?: string | null;
  amount: number; // Pesos enteros (negativo si es NC de proveedor)
  excluded?: boolean;
}

export interface WeeklyPulseSaleRow {
  id: string;
  source: 'AUTO' | 'MANUAL';
  locality: string;
  date: string; // YYYY-MM-DD (última fecha de venta de esa localidad en la semana o manual)
  amountA: number; // Pesos enteros (OFFICIAL)
  amountX: number; // Pesos enteros (INTERNAL)
  total: number; // amountA + amountX
  ordersCount?: number;
}

export interface WeeklyPulseCalculationInput {
  openingCredit: number; // D25: arrastre de la semana anterior (+ pasado / - a favor)
  resultBuffer: number; // D30: resultado fijo semanal (default 20.000.000)
  purchases: WeeklyPulsePurchaseItem[];
  sales: WeeklyPulseSaleRow[];
}

export interface WeeklyPulseSummary {
  openingCredit: number;
  weekPurchasesTotal: number; // Suma de compras/gastos activos de esta semana (sin openingCredit)
  totalPurchasesWithCredit: number; // D29 = openingCredit + weekPurchasesTotal
  resultBuffer: number; // D30
  salesA: number; // G30
  salesX: number; // H30
  salesTotal: number; // I30 = salesA + salesX
  salesAPct: number;
  salesXPct: number;
  weekNetBalance: number; // salesTotal - weekPurchasesTotal - resultBuffer (resultado puro de la semana)
  closingCredit: number; // D25 de la semana siguiente = -(salesTotal - totalPurchasesWithCredit - resultBuffer)
  status: 'AVAILABLE' | 'OVERBOUGHT' | 'BALANCED';
}

/**
 * Calcula una semana completa del Pulso Semanal usando Decimal.js y política de pesos enteros.
 * Replica exactamente la fórmula del Excel:
 *   D29 (totalPurchasesWithCredit) = openingCredit + SUM(compras activas de la semana)
 *   I30 (salesTotal)               = SUM(amountA + amountX)
 *   closingCredit (D25 sig.)       = -(I30 - D29 - D30) = D29 + D30 - I30
 *
 * Signo de closingCredit (idéntico al Excel):
 *   < 0  => Margen disponible para comprar (a favor)
 *   > 0  => Sobre-compra acumulada (pasado de compras)
 *   === 0 => Equilibrado
 */
export function computeWeeklyPulseSummary(input: WeeklyPulseCalculationInput): WeeklyPulseSummary {
  const openingCredit = roundToIntegerPeso(input.openingCredit);
  const resultBuffer = roundToIntegerPeso(input.resultBuffer);

  const activePurchaseAmounts = input.purchases
    .filter((item) => !item.excluded)
    .map((item) => item.amount);

  const weekPurchasesTotal = sumIntegerAmounts(activePurchaseAmounts);
  const totalPurchasesWithCredit = openingCredit.plus(weekPurchasesTotal);

  let salesADec = new Decimal(0);
  let salesXDec = new Decimal(0);

  for (const row of input.sales) {
    salesADec = salesADec.plus(roundToIntegerPeso(row.amountA));
    salesXDec = salesXDec.plus(roundToIntegerPeso(row.amountX));
  }

  const salesTotalDec = salesADec.plus(salesXDec);

  // weekNetBalance = Venta - ComprasSemana - ResultadoFijo (positivo = generó margen esta semana)
  const weekNetBalance = salesTotalDec.minus(weekPurchasesTotal).minus(resultBuffer);

  // Fórmula exacta del Excel: D25(siguiente) = -(I30 - D29 - D30)
  const closingCredit = salesTotalDec
    .minus(totalPurchasesWithCredit)
    .minus(resultBuffer)
    .negated();

  const salesTotalNum = salesTotalDec.isZero() ? 0 : salesTotalDec.toNumber();
  const salesANum = salesADec.isZero() ? 0 : salesADec.toNumber();
  const salesXNum = salesXDec.isZero() ? 0 : salesXDec.toNumber();
  const closingCreditNum = closingCredit.isZero() ? 0 : closingCredit.toNumber();

  const salesAPct =
    salesTotalNum > 0
      ? toDecimal(salesANum).dividedBy(salesTotalNum).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber()
      : 0;
  const salesXPct =
    salesTotalNum > 0
      ? toDecimal(salesXNum).dividedBy(salesTotalNum).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber()
      : 0;

  const status: WeeklyPulseSummary['status'] =
    closingCreditNum < 0 ? 'AVAILABLE' : closingCreditNum > 0 ? 'OVERBOUGHT' : 'BALANCED';

  return {
    openingCredit: openingCredit.toNumber(),
    weekPurchasesTotal: weekPurchasesTotal.toNumber(),
    totalPurchasesWithCredit: totalPurchasesWithCredit.toNumber(),
    resultBuffer: resultBuffer.toNumber(),
    salesA: salesANum,
    salesX: salesXNum,
    salesTotal: salesTotalNum,
    salesAPct,
    salesXPct,
    weekNetBalance: weekNetBalance.toNumber(),
    closingCredit: closingCreditNum,
    status,
  };
}

/**
 * Encadena el cálculo de múltiples semanas consecutivas ordenadas cronológicamente (más vieja -> más nueva).
 * Si una semana tiene `manualOpeningCredit` definido (ej. primera semana para empatar con el Excel),
 * usa ese valor como punto de partida; si no, hereda el `closingCredit` de la semana anterior.
 */
export interface WeeklyPulseChainInput {
  weekStart: string;
  manualOpeningCredit?: number | null;
  resultBuffer: number;
  purchases: WeeklyPulsePurchaseItem[];
  sales: WeeklyPulseSaleRow[];
}

export interface WeeklyPulseChainResult {
  weekStart: string;
  isManualOpeningCredit: boolean;
  summary: WeeklyPulseSummary;
}

export function computeWeeklyPulseChain(weeks: WeeklyPulseChainInput[]): WeeklyPulseChainResult[] {
  const results: WeeklyPulseChainResult[] = [];
  let carriedCredit = 0;

  for (const week of weeks) {
    const hasManual =
      typeof week.manualOpeningCredit === 'number' && Number.isFinite(week.manualOpeningCredit);
    const openingCredit = hasManual ? week.manualOpeningCredit! : carriedCredit;

    const summary = computeWeeklyPulseSummary({
      openingCredit,
      resultBuffer: week.resultBuffer,
      purchases: week.purchases,
      sales: week.sales,
    });

    results.push({
      weekStart: week.weekStart,
      isManualOpeningCredit: hasManual,
      summary,
    });

    carriedCredit = summary.closingCredit;
  }

  return results;
}

/**
 * Normaliza una fila de venta asegurando pesos enteros y total exacto = A + X.
 */
export function buildNormalizedSaleRow(input: {
  id: string;
  source: 'AUTO' | 'MANUAL';
  locality: string;
  date: string;
  amountA: number;
  amountX: number;
  ordersCount?: number;
}): WeeklyPulseSaleRow {
  const amountA = roundToIntegerPeso(input.amountA).toNumber();
  const amountX = roundToIntegerPeso(input.amountX).toNumber();
  return {
    id: input.id,
    source: input.source,
    locality: input.locality.trim() || 'Sin localidad',
    date: input.date,
    amountA,
    amountX,
    total: toDecimal(amountA).plus(amountX).toNumber(),
    ordersCount: input.ordersCount,
  };
}

/**
 * Suma días a una fecha ISO YYYY-MM-DD en aritmética pura UTC (sin desvío horario).
 */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Dada cualquier fecha YYYY-MM-DD, devuelve el Lunes (weekStart) y Sábado (weekEnd) de esa semana laboral.
 */
export function getWorkWeekBounds(isoDate: string): { weekStart: string; weekEnd: string } {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sab
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const weekStart = addDaysIso(isoDate, diffToMonday);
  const weekEnd = addDaysIso(weekStart, 5); // Lunes + 5 = Sábado
  return { weekStart, weekEnd };
}
