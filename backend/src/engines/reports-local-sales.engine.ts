import { Decimal } from 'decimal.js';
import { NumericInput, roundToIntegerPeso, roundToThreeDecimalsWeight, toDecimal } from '../core/money';
import {
  classifyOrderModality,
  computeMarginPercent,
  computeOrderRealBultos,
  findFallbackCostSnapshot,
  ReportLineItemInput,
  resolveItemHistoricalMetrics,
} from './reports-core.engine';

interface LocalProductRef {
  id: number;
  sku: string;
  name: string;
  imageUrl?: string | null;
  costPrice?: NumericInput | null;
  commercialCategory?: string | null;
  isPesable?: boolean | null;
}

export interface LocalOrderAuditRow {
  id: number;
  movementId: number;
  createdAt: string;
  deliveredAt: string | null;
  billingType: string;
  invoiceType: string;
  invoiceNumber: string | null;
  clientId: number;
  clientName: string;
  sellerName: string;
  totalAmount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CTA_CORRIENTE' | 'MIXTO' | 'OTHER';
  itemsCount: number;
  bultosCount: number;
}

export interface LocalSalesReportInput {
  orders: Array<{
    id: number;
    movementId?: number | null;
    createdAt: Date | string;
    deliveredAt?: Date | string | null;
    billingType: string;
    invoiceType?: string | null;
    invoiceNumber?: string | null;
    salesChannel?: string | null;
    deliveryMethod?: string | null;
    deliveryRouteId?: number | null;
    totalAmount: NumericInput;
    bultosCount?: number | null;
    personaId: number;
    persona?: { id: number; name: string; city?: string | null } | null;
    seller?: { id?: number; username?: string | null } | null;
    items: Array<ReportLineItemInput & { productId: number; product?: LocalProductRef | null }>;
    transactions?: Array<{ id?: number; type?: string | null; paymentMethod?: string | null; amount?: NumericInput | null }> | null;
  }>;
  creditNotes?: Array<{
    id: number;
    totalAmount: NumericInput;
    personaId: number;
    order?: {
      id: number;
      deliveryMethod?: string | null;
      salesChannel?: string | null;
      deliveryRouteId?: number | null;
      items?: Array<{ productId: number; unitCostSnapshot?: NumericInput | null }>;
    } | null;
    items?: Array<ReportLineItemInput & { productId: number; product?: LocalProductRef | null }>;
  }>;
}

function imputeOrderPaymentMethods(
  orderTotalDec: Decimal,
  transactions: LocalSalesReportInput['orders'][number]['transactions'],
  paymentMethodsDec: Record<string, Decimal>,
): LocalOrderAuditRow['paymentMethod'] {
  const incomeTxs = (transactions || []).filter((tx) => !tx.type || tx.type === 'INCOME');
  let paidDec = new Decimal(0);
  const usedMethods = new Set<string>();

  for (const tx of incomeTxs) {
    const txAmtDec = roundToIntegerPeso(tx.amount ?? 0);
    if (txAmtDec.lte(0)) continue;
    const method = tx.paymentMethod || 'OTHER';
    paymentMethodsDec[method] = (paymentMethodsDec[method] || new Decimal(0)).plus(txAmtDec);
    paidDec = paidDec.plus(txAmtDec);
    usedMethods.add(method);
  }

  if (paidDec.lt(orderTotalDec)) {
    paymentMethodsDec.CTA_CORRIENTE = paymentMethodsDec.CTA_CORRIENTE.plus(orderTotalDec.minus(paidDec));
    usedMethods.add('CTA_CORRIENTE');
  }

  if (usedMethods.size === 0) return 'CTA_CORRIENTE';
  if (usedMethods.size > 1) return 'MIXTO';
  return Array.from(usedMethods)[0] as LocalOrderAuditRow['paymentMethod'];
}

export function computeLocalSalesReport(input: LocalSalesReportInput) {
  const channelSummaryMap: Record<string, { salesDec: Decimal; costDec: Decimal; ordersCount: number }> = {
    MOSTRADOR: { salesDec: new Decimal(0), costDec: new Decimal(0), ordersCount: 0 },
    PREVENTA_RUTA: { salesDec: new Decimal(0), costDec: new Decimal(0), ordersCount: 0 },
    TIENDA_WEB: { salesDec: new Decimal(0), costDec: new Decimal(0), ordersCount: 0 },
  };
  const topProductsMap = new Map<number, { product: LocalProductRef; unitsSold: number; weightSoldDec: Decimal; totalRevenueDec: Decimal }>();
  const topClientsMap = new Map<number, { id: number; name: string; city: string | null; ordersCount: number; totalAmountDec: Decimal }>();
  const paymentMethodsDec: Record<string, Decimal> = {
    CASH: new Decimal(0), BANK_TRANSFER: new Decimal(0), CHECK: new Decimal(0), CTA_CORRIENTE: new Decimal(0), OTHER: new Decimal(0),
  };
  const localOrdersRaw: Array<LocalOrderAuditRow & { _ts: number }> = [];

  for (const order of input.orders) {
    const modality = classifyOrderModality(order);
    const channelKey = modality === 'LOCAL' ? 'MOSTRADOR' : order.salesChannel === 'TIENDA_WEB' ? 'TIENDA_WEB' : 'PREVENTA_RUTA';
    const orderTotalDec = roundToIntegerPeso(order.totalAmount || 0);
    let orderCostDec = new Decimal(0);

    for (const item of order.items) {
      const { itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics(item);
      orderCostDec = orderCostDec.plus(itemCostDec);
      if (modality === 'LOCAL' && item.product) {
        const cur = topProductsMap.get(item.productId) || {
          product: item.product, unitsSold: 0, weightSoldDec: new Decimal(0), totalRevenueDec: new Decimal(0),
        };
        cur.unitsSold += Number(item.quantity || 0);
        if (item.weight && Number(item.weight) > 0) cur.weightSoldDec = cur.weightSoldDec.plus(roundToThreeDecimalsWeight(item.weight));
        cur.totalRevenueDec = cur.totalRevenueDec.plus(itemRevenueDec);
        topProductsMap.set(item.productId, cur);
      }
    }

    channelSummaryMap[channelKey].salesDec = channelSummaryMap[channelKey].salesDec.plus(orderTotalDec);
    channelSummaryMap[channelKey].costDec = channelSummaryMap[channelKey].costDec.plus(orderCostDec);
    channelSummaryMap[channelKey].ordersCount += 1;

    if (modality === 'LOCAL') {
      const clientCur = topClientsMap.get(order.personaId) || {
        id: order.persona?.id ?? order.personaId, name: order.persona?.name || 'Consumidor Final', city: order.persona?.city ?? null, ordersCount: 0, totalAmountDec: new Decimal(0),
      };
      clientCur.ordersCount += 1;
      clientCur.totalAmountDec = clientCur.totalAmountDec.plus(orderTotalDec);
      topClientsMap.set(order.personaId, clientCur);

      const createdDate = new Date(order.createdAt);
      localOrdersRaw.push({
        id: order.id,
        movementId: order.movementId ?? order.id,
        createdAt: createdDate.toISOString(),
        deliveredAt: order.deliveredAt ? new Date(order.deliveredAt).toISOString() : null,
        billingType: order.billingType,
        invoiceType: order.invoiceType || 'PRESUPUESTO',
        invoiceNumber: order.invoiceNumber || null,
        clientId: order.personaId,
        clientName: order.persona?.name || 'Consumidor Final',
        sellerName: order.seller?.username || 'Sin asignar',
        totalAmount: orderTotalDec.toNumber(),
        paymentMethod: imputeOrderPaymentMethods(orderTotalDec, order.transactions, paymentMethodsDec),
        itemsCount: order.items.length,
        bultosCount: computeOrderRealBultos(order),
        _ts: createdDate.getTime(),
      });
    }
  }

  for (const cn of input.creditNotes || []) {
    const isLocalCn = Boolean(cn.order && classifyOrderModality(cn.order) === 'LOCAL');
    const channelKey = isLocalCn ? 'MOSTRADOR' : cn.order?.salesChannel === 'TIENDA_WEB' ? 'TIENDA_WEB' : 'PREVENTA_RUTA';
    const cnTotalDec = roundToIntegerPeso(cn.totalAmount || 0);
    let cnCostDec = new Decimal(0);

    for (const item of cn.items || []) {
      const fallback = findFallbackCostSnapshot(cn.order?.items, item.productId);
      const { itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics({ ...item, fallbackUnitCostSnapshot: fallback });
      cnCostDec = cnCostDec.plus(itemCostDec);
      if (isLocalCn) {
        const prod = topProductsMap.get(item.productId);
        if (prod) {
          prod.unitsSold = Math.max(0, prod.unitsSold - Number(item.quantity || 0));
          if (item.weight && Number(item.weight) > 0) prod.weightSoldDec = Decimal.max(0, prod.weightSoldDec.minus(roundToThreeDecimalsWeight(item.weight)));
          prod.totalRevenueDec = prod.totalRevenueDec.minus(itemRevenueDec);
        }
      }
    }

    channelSummaryMap[channelKey].salesDec = channelSummaryMap[channelKey].salesDec.minus(cnTotalDec);
    channelSummaryMap[channelKey].costDec = channelSummaryMap[channelKey].costDec.minus(cnCostDec);

    if (isLocalCn) {
      const client = topClientsMap.get(cn.personaId);
      if (client) client.totalAmountDec = client.totalAmountDec.minus(cnTotalDec);
      let remaining = cnTotalDec;
      for (const method of ['CTA_CORRIENTE', 'CASH', 'BANK_TRANSFER', 'CHECK', 'OTHER']) {
        if (remaining.lte(0)) break;
        const cur = paymentMethodsDec[method];
        if (cur && cur.gt(0)) {
          const deduction = Decimal.min(cur, remaining);
          paymentMethodsDec[method] = cur.minus(deduction);
          remaining = remaining.minus(deduction);
        }
      }
    }
  }

  const visibleEntries = Object.entries(channelSummaryMap).filter(([k, d]) => k !== 'TIENDA_WEB' || d.ordersCount > 0 || d.salesDec.gt(0));
  const totalOverallDec = visibleEntries.reduce((acc, [, d]) => acc.plus(Decimal.max(0, d.salesDec)), new Decimal(0));

  const channels = visibleEntries.map(([channel, data]) => {
    const salesDec = roundToIntegerPeso(data.salesDec);
    const costDec = roundToIntegerPeso(data.costDec);
    const profitDec = salesDec.minus(costDec);
    return {
      channel,
      sales: salesDec.toNumber(),
      cost: costDec.toNumber(),
      profit: profitDec.toNumber(),
      ordersCount: data.ordersCount,
      averageTicket: data.ordersCount > 0 ? roundToIntegerPeso(salesDec.dividedBy(data.ordersCount)).toNumber() : 0,
      percentage: totalOverallDec.gt(0) ? roundToIntegerPeso(Decimal.max(0, salesDec).dividedBy(totalOverallDec).times(100)).toNumber() : 0,
    };
  });

  const mostradorCh = channels.find((c) => c.channel === 'MOSTRADOR')!;
  const routeCh = channels.find((c) => c.channel === 'PREVENTA_RUTA')!;
  return {
    channels,
    mostrador: {
      totalSales: mostradorCh.sales,
      totalCost: mostradorCh.cost,
      grossProfit: mostradorCh.profit,
      marginPct: computeMarginPercent(toDecimal(mostradorCh.profit), toDecimal(mostradorCh.sales), 0),
      totalOrders: mostradorCh.ordersCount,
      averageTicket: mostradorCh.averageTicket,
      sharePct: mostradorCh.percentage,
      topProducts: Array.from(topProductsMap.values())
        .filter((p) => p.totalRevenueDec.gt(0))
        .map((p) => ({
          product: p.product,
          unitsSold: p.unitsSold,
          weightSold: roundToThreeDecimalsWeight(p.weightSoldDec).toNumber(),
          totalRevenue: roundToIntegerPeso(p.totalRevenueDec).toNumber(),
        }))
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10),
      topClients: Array.from(topClientsMap.values())
        .filter((c) => c.totalAmountDec.gt(0))
        .map((c) => ({ id: c.id, name: c.name, city: c.city, ordersCount: c.ordersCount, totalAmount: roundToIntegerPeso(c.totalAmountDec).toNumber() }))
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 10),
      paymentMethods: Object.entries(paymentMethodsDec).map(([method, amountDec]) => ({ method, amount: roundToIntegerPeso(amountDec).toNumber() })),
      localOrders: localOrdersRaw.sort((a, b) => b._ts - a._ts).slice(0, 200).map(({ _ts, ...rest }) => rest),
    },
    routeSummary: { totalSales: routeCh.sales, totalOrders: routeCh.ordersCount, averageTicket: routeCh.averageTicket, sharePct: routeCh.percentage },
  };
}
