import { Decimal } from 'decimal.js';
import {
  NumericInput,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  toDecimal,
} from '../core/money';
import {
  classifyOrderModality,
  computeMarginPercent,
  computeOrderRealBultos,
  findFallbackCostSnapshot,
  normalizeCity,
  resolveItemHistoricalMetrics,
  type ReportLineItemInput,
} from './reports-core.engine';

export interface EmployeeReportLineItem extends ReportLineItemInput {
  productId: number;
  product?: {
    isPesable?: boolean | null;
    costPrice?: NumericInput | null;
    name?: string | null;
    rubro?: { name?: string | null } | null;
  } | null;
}

export interface EmployeeReportOrderInput {
  personaId?: number | null;
  billingType: string;
  totalAmount: NumericInput;
  deliveryMethod?: string | null;
  salesChannel?: string | null;
  deliveryRouteId?: number | null;
  bultosCount?: number | null;
  persona?: {
    name?: string | null;
    city?: string | null;
    route?: string | null;
  } | null;
  items: EmployeeReportLineItem[];
}

export interface EmployeeReportCreditNoteInput {
  personaId?: number | null;
  billingType: string;
  totalAmount: NumericInput;
  persona?: {
    name?: string | null;
    city?: string | null;
    route?: string | null;
  } | null;
  order?: {
    deliveryMethod?: string | null;
    salesChannel?: string | null;
    deliveryRouteId?: number | null;
    items?: Array<{ productId: number; unitCostSnapshot?: NumericInput | null }>;
  } | null;
  items: EmployeeReportLineItem[];
}

export interface ComputeEmployeeReportInput {
  orders: EmployeeReportOrderInput[];
  creditNotes: EmployeeReportCreditNoteInput[];
  collectionsGrouped: Array<{ paymentMethod?: string | null; _sum: { amount: NumericInput | null } }>;
  routesCount: number;
  routeOrdersDelivered: number;
  fieldReceiptsCount: number;
  fieldReceiptsAmount: NumericInput | null;
  cashDrawersCount: number;
  stockMovementsCount: number;
}

export function computeEmployeeReportMetrics(input: ComputeEmployeeReportInput) {
  let totalSalesDec = new Decimal(0);
  let totalCostDec = new Decimal(0);
  let totalBultos = 0;
  let officialSalesDec = new Decimal(0);
  let internalSalesDec = new Decimal(0);
  let localSalesDec = new Decimal(0);
  let routeSalesDec = new Decimal(0);

  const productSalesMap = new Map<
    number,
    { name: string; category: string; qtyDec: Decimal; amountDec: Decimal; costDec: Decimal }
  >();
  const clientSalesMap = new Map<
    number,
    {
      name: string;
      city: string;
      ordersCount: number;
      officialSalesDec: Decimal;
      internalSalesDec: Decimal;
      totalSalesDec: Decimal;
      costDec: Decimal;
    }
  >();

  const ensureClient = (personaId: number, name: string, city: string) => {
    let acc = clientSalesMap.get(personaId);
    if (!acc) {
      acc = {
        name,
        city,
        ordersCount: 0,
        officialSalesDec: new Decimal(0),
        internalSalesDec: new Decimal(0),
        totalSalesDec: new Decimal(0),
        costDec: new Decimal(0),
      };
      clientSalesMap.set(personaId, acc);
    }
    return acc;
  };

  for (const order of input.orders) {
    const orderTotalDec = roundToIntegerPeso(order.totalAmount ?? 0);
    totalSalesDec = totalSalesDec.plus(orderTotalDec);
    totalBultos += computeOrderRealBultos(order);

    if (order.billingType === 'OFFICIAL') officialSalesDec = officialSalesDec.plus(orderTotalDec);
    else internalSalesDec = internalSalesDec.plus(orderTotalDec);

    if (classifyOrderModality(order) === 'LOCAL') localSalesDec = localSalesDec.plus(orderTotalDec);
    else routeSalesDec = routeSalesDec.plus(orderTotalDec);

    let orderCostDec = new Decimal(0);
    for (const item of order.items) {
      const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics(item);
      orderCostDec = orderCostDec.plus(itemCostDec);

      const prodAcc = productSalesMap.get(item.productId) || {
        name: item.product?.name || `Producto #${item.productId}`,
        category: item.product?.rubro?.name || 'Sin Categoría',
        qtyDec: new Decimal(0),
        amountDec: new Decimal(0),
        costDec: new Decimal(0),
      };
      prodAcc.qtyDec = prodAcc.qtyDec.plus(qtyDec);
      prodAcc.amountDec = prodAcc.amountDec.plus(itemRevenueDec);
      prodAcc.costDec = prodAcc.costDec.plus(itemCostDec);
      productSalesMap.set(item.productId, prodAcc);
    }

    totalCostDec = totalCostDec.plus(orderCostDec);

    if (order.personaId) {
      const cityName = normalizeCity(order.persona?.city || order.persona?.route);
      const cliAcc = ensureClient(
        order.personaId,
        order.persona?.name || `Cliente #${order.personaId}`,
        cityName,
      );
      cliAcc.ordersCount += 1;
      cliAcc.totalSalesDec = cliAcc.totalSalesDec.plus(orderTotalDec);
      cliAcc.costDec = cliAcc.costDec.plus(orderCostDec);
      if (order.billingType === 'OFFICIAL') cliAcc.officialSalesDec = cliAcc.officialSalesDec.plus(orderTotalDec);
      else cliAcc.internalSalesDec = cliAcc.internalSalesDec.plus(orderTotalDec);
    }
  }

  for (const cn of input.creditNotes) {
    const cnTotalDec = roundToIntegerPeso(cn.totalAmount ?? 0);
    totalSalesDec = totalSalesDec.minus(cnTotalDec);

    if (cn.billingType === 'OFFICIAL') officialSalesDec = officialSalesDec.minus(cnTotalDec);
    else internalSalesDec = internalSalesDec.minus(cnTotalDec);

    if (classifyOrderModality(cn.order || { deliveryMethod: 'DELIVERY' }) === 'LOCAL') {
      localSalesDec = localSalesDec.minus(cnTotalDec);
    } else {
      routeSalesDec = routeSalesDec.minus(cnTotalDec);
    }

    let cnCostDec = new Decimal(0);
    for (const item of cn.items || []) {
      const fallback = findFallbackCostSnapshot(cn.order?.items, item.productId);
      const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics({
        ...item,
        fallbackUnitCostSnapshot: fallback,
      });
      cnCostDec = cnCostDec.plus(itemCostDec);

      const prodAcc = productSalesMap.get(item.productId);
      if (prodAcc) {
        prodAcc.qtyDec = prodAcc.qtyDec.minus(qtyDec);
        prodAcc.amountDec = prodAcc.amountDec.minus(itemRevenueDec);
        prodAcc.costDec = prodAcc.costDec.minus(itemCostDec);
      }
    }

    totalCostDec = totalCostDec.minus(cnCostDec);

    if (cn.personaId) {
      const cityName = normalizeCity(cn.persona?.city || cn.persona?.route);
      const cliAcc = ensureClient(
        cn.personaId,
        cn.persona?.name || `Cliente #${cn.personaId}`,
        cityName,
      );
      cliAcc.totalSalesDec = cliAcc.totalSalesDec.minus(cnTotalDec);
      cliAcc.costDec = cliAcc.costDec.minus(cnCostDec);
      if (cn.billingType === 'OFFICIAL') cliAcc.officialSalesDec = cliAcc.officialSalesDec.minus(cnTotalDec);
      else cliAcc.internalSalesDec = cliAcc.internalSalesDec.minus(cnTotalDec);
    }
  }

  let totalCollectedDec = new Decimal(0);
  const byMethodDec: Record<'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER', Decimal> = {
    CASH: new Decimal(0),
    BANK_TRANSFER: new Decimal(0),
    CHECK: new Decimal(0),
    OTHER: new Decimal(0),
  };

  for (const row of input.collectionsGrouped) {
    const amtDec = roundToIntegerPeso(row._sum?.amount ?? 0);
    totalCollectedDec = totalCollectedDec.plus(amtDec);
    const key =
      row.paymentMethod === 'CASH' || row.paymentMethod === 'BANK_TRANSFER' || row.paymentMethod === 'CHECK'
        ? row.paymentMethod
        : 'OTHER';
    byMethodDec[key] = byMethodDec[key].plus(amtDec);
  }

  const grossProfitDec = totalSalesDec.minus(totalCostDec);
  const activeClients = Array.from(clientSalesMap.values()).filter((c) => c.totalSalesDec.gt(0));

  const topClients = activeClients
    .map((c) => {
      const profitDec = c.totalSalesDec.minus(c.costDec);
      return {
        name: c.name,
        city: c.city,
        ordersCount: c.ordersCount,
        officialSales: roundToIntegerPeso(c.officialSalesDec).toNumber(),
        internalSales: roundToIntegerPeso(c.internalSalesDec).toNumber(),
        totalSales: roundToIntegerPeso(c.totalSalesDec).toNumber(),
        profit: roundToIntegerPeso(profitDec).toNumber(),
        marginPct: computeMarginPercent(profitDec, c.totalSalesDec, 0),
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales || b.profit - a.profit)
    .slice(0, 5);

  const topProducts = Array.from(productSalesMap.values())
    .filter((p) => p.amountDec.gt(0))
    .map((p) => {
      const profitDec = p.amountDec.minus(p.costDec);
      return {
        name: p.name,
        category: p.category,
        quantity: roundToThreeDecimalsWeight(p.qtyDec).toNumber(),
        amount: roundToIntegerPeso(p.amountDec).toNumber(),
        profit: roundToIntegerPeso(profitDec).toNumber(),
        marginPct: computeMarginPercent(profitDec, p.amountDec, 0),
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const totalOrders = input.orders.length;

  return {
    summary: {
      totalSales: roundToIntegerPeso(totalSalesDec).toNumber(),
      totalCost: roundToIntegerPeso(totalCostDec).toNumber(),
      grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
      grossMarginPct: computeMarginPercent(grossProfitDec, totalSalesDec, 0),
      totalOrders,
      totalBultos,
      activeClientsCount: activeClients.length,
      averageTicket:
        totalOrders > 0 ? roundToIntegerPeso(totalSalesDec.dividedBy(totalOrders)).toNumber() : 0,
    },
    breakdown: {
      officialSales: roundToIntegerPeso(officialSalesDec).toNumber(),
      internalSales: roundToIntegerPeso(internalSalesDec).toNumber(),
      localSales: roundToIntegerPeso(localSalesDec).toNumber(),
      routeSales: roundToIntegerPeso(routeSalesDec).toNumber(),
    },
    collections: {
      totalCollected: roundToIntegerPeso(totalCollectedDec).toNumber(),
      byMethod: {
        cash: roundToIntegerPeso(byMethodDec.CASH).toNumber(),
        transfer: roundToIntegerPeso(byMethodDec.BANK_TRANSFER).toNumber(),
        check: roundToIntegerPeso(byMethodDec.CHECK).toNumber(),
        other: roundToIntegerPeso(byMethodDec.OTHER).toNumber(),
      },
    },
    operations: {
      routesCount: input.routesCount,
      routeOrdersDelivered: input.routeOrdersDelivered,
      fieldReceiptsCount: input.fieldReceiptsCount,
      fieldReceiptsAmount: roundToIntegerPeso(toDecimal(input.fieldReceiptsAmount ?? 0)).toNumber(),
      cashDrawersCount: input.cashDrawersCount,
      stockMovementsCount: input.stockMovementsCount,
    },
    topClients,
    topProducts,
  };
}
