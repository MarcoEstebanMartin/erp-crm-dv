import { Decimal } from 'decimal.js';
import {
  NumericInput,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';

export const MAIN_CITIES = [
  'GENERAL VILLEGAS', 'EMILIO V. BUNGE', 'BANDERALO', 'INTENDENTE ALVEAR', 'PIEDRITAS', 'CEBALLOS',
  'RUFINO', 'BUCHARDO', 'CHARLONE', 'LARROUDE', 'SAUCE', 'SANSINENA',
  'TRES ALGARROBOS', 'AMEGHINO', 'BLAQUIER', 'AMERICA', 'FORTIN', 'CARLOS TEJEDOR',
];

export function normalizeCity(city: string | null | undefined): string {
  if (!city) return 'Sin Localidad';
  const upper = city.toUpperCase().trim();
  for (const mainCity of MAIN_CITIES) {
    if (upper.includes(mainCity)) return mainCity;
  }
  if (upper.includes('BUNGE')) return 'EMILIO V. BUNGE';
  if (upper.includes('ALVEAR')) return 'INTENDENTE ALVEAR';
  if (upper.includes('VILLEGAS')) return 'GENERAL VILLEGAS';
  if (upper.includes('LARROUDE')) return 'LARROUDE';
  if (upper.includes('TEJEDOR')) return 'CARLOS TEJEDOR';
  if (upper.startsWith('(') || /\d/.test(upper)) return 'Sin Localidad';
  return upper;
}

export interface ReportLineItemInput {
  productId?: number;
  quantity: NumericInput | number;
  weight?: NumericInput | null;
  unitPrice?: NumericInput | null;
  subtotal?: NumericInput | null;
  unitCostSnapshot?: NumericInput | null;
  fallbackUnitCostSnapshot?: NumericInput | null;
  product?: { isPesable?: boolean | null; costPrice?: NumericInput | null } | null;
}

export function resolveItemHistoricalMetrics(item: ReportLineItemInput) {
  const isWeighable = Boolean(item.product?.isPesable);
  const rawWeight = item.weight !== undefined && item.weight !== null ? Number(item.weight) : 0;
  const qtyDec = isWeighable && rawWeight > 0 ? roundToThreeDecimalsWeight(item.weight!) : toDecimal(item.quantity || 0);

  const snapshotCost = Number(item.unitCostSnapshot || 0);
  const fallbackCost = Number(item.fallbackUnitCostSnapshot || 0);
  const currentCost = Number(item.product?.costPrice || 0);
  const unitCostDec =
    snapshotCost > 0
      ? roundToTwoDecimals(item.unitCostSnapshot!)
      : fallbackCost > 0
        ? roundToTwoDecimals(item.fallbackUnitCostSnapshot!)
        : roundToTwoDecimals(currentCost > 0 ? item.product!.costPrice! : 0);

  const itemRevenueDec =
    item.subtotal !== undefined && item.subtotal !== null
      ? roundToIntegerPeso(item.subtotal)
      : roundToIntegerPeso(toDecimal(item.unitPrice ?? 0).times(qtyDec));
  const itemCostDec = roundToIntegerPeso(unitCostDec.times(qtyDec));

  return {
    qtyDec,
    qtyOrWeight: qtyDec.toNumber(),
    itemRevenueDec,
    itemRevenue: itemRevenueDec.toNumber(),
    itemCostDec,
    itemCost: itemCostDec.toNumber(),
    unitCostUsed: unitCostDec.toNumber(),
  };
}

export function classifyOrderModality(order: {
  deliveryMethod?: string | null;
  salesChannel?: string | null;
  deliveryRouteId?: number | null;
}): 'LOCAL' | 'RUTA' {
  if (order.deliveryMethod === 'PICKUP') return 'LOCAL';
  if (
    (order.deliveryMethod === undefined || order.deliveryMethod === null) &&
    !order.deliveryRouteId &&
    order.salesChannel === 'MOSTRADOR'
  ) {
    return 'LOCAL';
  }
  return 'RUTA';
}

export function computeMarginPercent(profitDec: Decimal, revenueDec: Decimal, decimals: 0 | 2 = 0): number {
  if (revenueDec.lte(0)) return 0;
  return profitDec.dividedBy(revenueDec).times(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

export function computeOrderRealBultos(order: { bultosCount?: number | null; items?: Array<{ quantity: NumericInput | number }> }): number {
  if (order.bultosCount !== undefined && order.bultosCount !== null && Number(order.bultosCount) > 0) {
    return Math.trunc(Number(order.bultosCount));
  }
  return order.items && order.items.length > 0 ? Math.max(1, order.items.length) : 0;
}

export function findFallbackCostSnapshot(
  orderItems: Array<{ productId: number; unitCostSnapshot?: NumericInput | null }> | undefined | null,
  productId: number,
): NumericInput | null {
  if (!orderItems || orderItems.length === 0) return null;
  const match = orderItems.find((oi) => oi.productId === productId && Number(oi.unitCostSnapshot || 0) > 0);
  return match?.unitCostSnapshot ?? null;
}

export interface FinancialSummaryInput {
  orders: Array<{
    billingType: string;
    totalAmount: NumericInput;
    deliveryMethod?: string | null;
    salesChannel?: string | null;
    deliveryRouteId?: number | null;
    persona?: { city?: string | null } | null;
    items: ReportLineItemInput[];
  }>;
  creditNotes: Array<{
    billingType: string;
    totalAmount: NumericInput;
    persona?: { city?: string | null } | null;
    order?: {
      deliveryMethod?: string | null;
      salesChannel?: string | null;
      deliveryRouteId?: number | null;
      persona?: { city?: string | null } | null;
      items?: Array<{ productId: number; unitCostSnapshot?: NumericInput | null }>;
    } | null;
    items: Array<ReportLineItemInput & { productId: number }>;
  }>;
  expenses: Array<{ amount: NumericInput; category?: { name?: string | null } | null }>;
  transactionsGrouped: Array<{ billingType: string; type: string; _sum: { amount: NumericInput | null } }>;
  paymentMethodsGrouped: Array<{ billingType: string; paymentMethod: string; _sum: { amount: NumericInput | null } }>;
}

export function computeFinancialSummaryMetrics(input: FinancialSummaryInput) {
  let officialSalesDec = new Decimal(0), officialCostDec = new Decimal(0), officialCount = 0;
  let internalSalesDec = new Decimal(0), internalCostDec = new Decimal(0), internalCount = 0;
  let localSalesDec = new Decimal(0), localCostDec = new Decimal(0), localCount = 0;
  let routeSalesDec = new Decimal(0), routeCostDec = new Decimal(0), routeCount = 0;
  const cityMap = new Map<
    string,
    { officialDec: Decimal; internalDec: Decimal; officialCount: number; internalCount: number }
  >();

  const getOrCreateCityBucket = (rawCity: string | null | undefined) => {
    const key = normalizeCity(rawCity);
    let bucket = cityMap.get(key);
    if (!bucket) {
      bucket = {
        officialDec: new Decimal(0),
        internalDec: new Decimal(0),
        officialCount: 0,
        internalCount: 0,
      };
      cityMap.set(key, bucket);
    }
    return bucket;
  };

  for (const order of input.orders) {
    const amountDec = roundToIntegerPeso(order.totalAmount || 0);
    let costDec = new Decimal(0);
    for (const item of order.items) costDec = costDec.plus(resolveItemHistoricalMetrics(item).itemCostDec);
    const cityBucket = getOrCreateCityBucket(order.persona?.city);

    if (order.billingType === 'OFFICIAL') {
      officialSalesDec = officialSalesDec.plus(amountDec);
      officialCostDec = officialCostDec.plus(costDec);
      officialCount += 1;
      cityBucket.officialDec = cityBucket.officialDec.plus(amountDec);
      cityBucket.officialCount += 1;
    } else {
      internalSalesDec = internalSalesDec.plus(amountDec);
      internalCostDec = internalCostDec.plus(costDec);
      internalCount += 1;
      cityBucket.internalDec = cityBucket.internalDec.plus(amountDec);
      cityBucket.internalCount += 1;
    }

    if (classifyOrderModality(order) === 'LOCAL') {
      localSalesDec = localSalesDec.plus(amountDec);
      localCostDec = localCostDec.plus(costDec);
      localCount += 1;
    } else {
      routeSalesDec = routeSalesDec.plus(amountDec);
      routeCostDec = routeCostDec.plus(costDec);
      routeCount += 1;
    }
  }

  let creditNotesTotalDec = new Decimal(0);
  for (const cn of input.creditNotes) {
    const cnAmountDec = roundToIntegerPeso(cn.totalAmount || 0);
    creditNotesTotalDec = creditNotesTotalDec.plus(cnAmountDec);

    let cnCostDec = new Decimal(0);
    for (const item of cn.items || []) {
      const fallback = findFallbackCostSnapshot(cn.order?.items, item.productId);
      cnCostDec = cnCostDec.plus(resolveItemHistoricalMetrics({ ...item, fallbackUnitCostSnapshot: fallback }).itemCostDec);
    }

    const cityBucket = getOrCreateCityBucket(cn.persona?.city ?? cn.order?.persona?.city);
    if (cn.billingType === 'OFFICIAL') {
      officialSalesDec = officialSalesDec.minus(cnAmountDec);
      officialCostDec = officialCostDec.minus(cnCostDec);
      cityBucket.officialDec = cityBucket.officialDec.minus(cnAmountDec);
    } else {
      internalSalesDec = internalSalesDec.minus(cnAmountDec);
      internalCostDec = internalCostDec.minus(cnCostDec);
      cityBucket.internalDec = cityBucket.internalDec.minus(cnAmountDec);
    }

    if (classifyOrderModality(cn.order || { deliveryMethod: 'DELIVERY' }) === 'LOCAL') {
      localSalesDec = localSalesDec.minus(cnAmountDec);
      localCostDec = localCostDec.minus(cnCostDec);
    } else {
      routeSalesDec = routeSalesDec.minus(cnAmountDec);
      routeCostDec = routeCostDec.minus(cnCostDec);
    }
  }

  let totalExpensesDec = new Decimal(0);
  const expensesByCat = new Map<string, Decimal>();
  for (const exp of input.expenses) {
    const amtDec = toDecimal(exp.amount || 0);
    totalExpensesDec = totalExpensesDec.plus(amtDec);
    const catName = exp.category?.name || 'General';
    expensesByCat.set(catName, (expensesByCat.get(catName) || new Decimal(0)).plus(amtDec));
  }

  const expensesByCategory = Array.from(expensesByCat.entries())
    .map(([name, valDec]) => ({ name, value: roundToIntegerPeso(valDec).toNumber() }))
    .sort((a, b) => b.value - a.value);

  const netSalesDec = officialSalesDec.plus(internalSalesDec);
  const totalCostDec = officialCostDec.plus(internalCostDec);
  const grossProfitDec = netSalesDec.minus(totalCostDec);
  const totalExpensesIntDec = roundToIntegerPeso(totalExpensesDec);
  const netProfitDec = grossProfitDec.minus(totalExpensesIntDec);
  const localGrossDec = localSalesDec.minus(localCostDec);
  const routeGrossDec = routeSalesDec.minus(routeCostDec);

  const findTxSum = (billingType: string, type: string) =>
    roundToIntegerPeso(input.transactionsGrouped.find((g) => g.billingType === billingType && g.type === type)?._sum.amount ?? 0).toNumber();

  const salesByCity = Array.from(cityMap.entries())
    .map(([city, row]) => {
      const totalDec = row.officialDec.plus(row.internalDec);
      return {
        city,
        official: roundToIntegerPeso(row.officialDec).toNumber(),
        internal: roundToIntegerPeso(row.internalDec).toNumber(),
        total: roundToIntegerPeso(totalDec).toNumber(),
        officialCount: row.officialCount,
        internalCount: row.internalCount,
        count: row.officialCount + row.internalCount,
        sharePct: netSalesDec.gt(0) ? computeMarginPercent(Decimal.max(0, totalDec), netSalesDec, 0) : 0,
      };
    })
    .filter((row) => row.total !== 0 || row.count > 0)
    .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city, 'es'));

  return {
    sales: {
      official: roundToIntegerPeso(officialSalesDec).toNumber(),
      officialCost: roundToIntegerPeso(officialCostDec).toNumber(),
      officialCount,
      internal: roundToIntegerPeso(internalSalesDec).toNumber(),
      internalCost: roundToIntegerPeso(internalCostDec).toNumber(),
      internalCount,
    },
    salesByCity,
    summary: {
      netSales: roundToIntegerPeso(netSalesDec).toNumber(),
      totalCost: roundToIntegerPeso(totalCostDec).toNumber(),
      grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
      grossMarginPct: computeMarginPercent(grossProfitDec, netSalesDec, 0),
      totalExpenses: totalExpensesIntDec.toNumber(),
      netProfit: roundToIntegerPeso(netProfitDec).toNumber(),
      netMarginPct: computeMarginPercent(netProfitDec, netSalesDec, 0),
      creditNotesTotal: roundToIntegerPeso(creditNotesTotalDec).toNumber(),
      creditNotesCount: input.creditNotes.length,
    },
    modalityBreakdown: {
      local: {
        sales: roundToIntegerPeso(localSalesDec).toNumber(),
        cost: roundToIntegerPeso(localCostDec).toNumber(),
        grossProfit: roundToIntegerPeso(localGrossDec).toNumber(),
        marginPct: computeMarginPercent(localGrossDec, localSalesDec, 0),
        count: localCount,
        sharePct: netSalesDec.gt(0) ? computeMarginPercent(Decimal.max(0, localSalesDec), netSalesDec, 0) : 0,
      },
      route: {
        sales: roundToIntegerPeso(routeSalesDec).toNumber(),
        cost: roundToIntegerPeso(routeCostDec).toNumber(),
        grossProfit: roundToIntegerPeso(routeGrossDec).toNumber(),
        marginPct: computeMarginPercent(routeGrossDec, routeSalesDec, 0),
        count: routeCount,
        sharePct: netSalesDec.gt(0) ? computeMarginPercent(Decimal.max(0, routeSalesDec), netSalesDec, 0) : 0,
      },
    },
    cashflow: {
      officialIncome: findTxSum('OFFICIAL', 'INCOME'),
      officialOutcome: findTxSum('OFFICIAL', 'OUTCOME'),
      internalIncome: findTxSum('INTERNAL', 'INCOME'),
      internalOutcome: findTxSum('INTERNAL', 'OUTCOME'),
    },
    paymentMethods: input.paymentMethodsGrouped.map((m) => ({
      channel: m.billingType,
      method: m.paymentMethod,
      total: roundToIntegerPeso(m._sum.amount ?? 0).toNumber(),
    })),
    expenses: { total: totalExpensesIntDec.toNumber(), byCategory: expensesByCategory },
  };
}

export { computeProfitabilityMetrics, type ProfitabilityComputationInput } from './reports-profitability.engine';
