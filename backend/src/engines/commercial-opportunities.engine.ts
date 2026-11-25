import { Decimal } from 'decimal.js';
import {
  roundToIntegerPeso,
  sumIntegerAmounts,
  toDecimal,
} from '../core/money';
import type {
  ClientAtRiskItem,
  ClientRecommendationItem,
  ClientRiskReason,
  CommercialOpportunitiesReport,
  CrossSellSuggestion,
  ExpiringLotItem,
  ExpiringLotStatus,
  OpportunityLotInput,
  OpportunityOrderInput,
  OpportunityProductInput,
  StagnantProductItem,
  StoppedBuyingSuggestion,
} from './commercial-opportunities.types';

export * from './commercial-opportunities.types';

const MS_PER_DAY = 86_400_000;

function fullDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function computeClientsAtRisk(
  orders: OpportunityOrderInput[],
  referenceDate: Date,
  dropThresholdPct = 30,
): ClientAtRiskItem[] {
  const byClient = new Map<number, OpportunityOrderInput[]>();
  for (const order of orders) {
    const list = byClient.get(order.clientId);
    if (list) list.push(order);
    else byClient.set(order.clientId, [order]);
  }

  const results: ClientAtRiskItem[] = [];
  const thirtyDaysAgoMs = referenceDate.getTime() - 30 * MS_PER_DAY;

  for (const [clientId, clientOrders] of byClient.entries()) {
    if (clientOrders.length < 2) continue;

    const sorted = [...clientOrders].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const firstOrder = sorted[0];
    const lastOrder = sorted[sorted.length - 1];

    const spanDays = Math.max(1, fullDaysBetween(firstOrder.createdAt, lastOrder.createdAt));
    const intervalsCount = sorted.length - 1;
    const rawCycle = spanDays / intervalsCount;
    const avgCycleDays = Math.max(3, Math.round(rawCycle));
    const daysSinceLastOrder = Math.max(0, fullDaysBetween(lastOrder.createdAt, referenceDate));

    const totalRevenue = sumIntegerAmounts(sorted.map((o) => o.totalAmount));
    const totalSpanMonths = toDecimal(
      Math.max(30, fullDaysBetween(firstOrder.createdAt, referenceDate)),
    ).dividedBy(30);
    const monthlyAvgDec = roundToIntegerPeso(totalRevenue.dividedBy(totalSpanMonths));

    const recentOrders = sorted.filter((o) => o.createdAt.getTime() >= thirtyDaysAgoMs);
    const recent30Dec = sumIntegerAmounts(recentOrders.map((o) => o.totalAmount));

    const variationPctDec = monthlyAvgDec.gt(0)
      ? recent30Dec
          .minus(monthlyAvgDec)
          .dividedBy(monthlyAvgDec)
          .times(100)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      : new Decimal(0);
    const variationPct = variationPctDec.toNumber();

    const overdueThreshold = Math.max(14, Math.ceil(avgCycleDays * 1.5));
    const isOverdue = daysSinceLastOrder >= overdueThreshold;
    const isRevenueDrop =
      monthlyAvgDec.gt(0) &&
      daysSinceLastOrder >= 7 &&
      variationPct <= -dropThresholdPct;

    if (!isOverdue && !isRevenueDrop) continue;

    const reason: ClientRiskReason =
      isOverdue && isRevenueDrop
        ? 'OVERDUE_AND_DROP'
        : isOverdue
          ? 'OVERDUE_CYCLE'
          : 'REVENUE_DROP';

    results.push({
      clientId,
      clientName: lastOrder.clientName,
      sellerName: lastOrder.sellerName,
      ordersCount: sorted.length,
      daysSinceLastOrder,
      avgCycleDays,
      monthlyAvgAmount: monthlyAvgDec.toNumber(),
      recent30Amount: recent30Dec.toNumber(),
      variationPct,
      lastOrderDate: lastOrder.createdAt.toISOString(),
      reason,
    });
  }

  return results.sort((a, b) => b.monthlyAvgAmount - a.monthlyAvgAmount);
}

export function computeStagnantStock(
  products: OpportunityProductInput[],
  referenceDate: Date,
  stagnantDays = 30,
): StagnantProductItem[] {
  const results: StagnantProductItem[] = [];

  for (const product of products) {
    const stockDec = toDecimal(product.stock);
    if (stockDec.lte(0)) continue;

    const daysWithoutSale = product.lastSoldAt
      ? Math.max(0, fullDaysBetween(product.lastSoldAt, referenceDate))
      : null;

    if (daysWithoutSale !== null && daysWithoutSale < stagnantDays) continue;

    const capitalTiedUp = roundToIntegerPeso(
      stockDec.times(toDecimal(product.costPrice)),
    ).toNumber();
    const listPrice = roundToIntegerPeso(product.listPrice).toNumber();

    results.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      rubroName: product.rubroName,
      stock: stockDec.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
      daysWithoutSale,
      capitalTiedUp,
      listPrice,
    });
  }

  return results.sort((a, b) => b.capitalTiedUp - a.capitalTiedUp);
}

export function computeExpiringLots(
  lots: OpportunityLotInput[],
  referenceDate: Date,
  expiringDays = 30,
): ExpiringLotItem[] {
  const results: ExpiringLotItem[] = [];

  for (const lot of lots) {
    const stockDec = toDecimal(lot.stock);
    if (stockDec.lte(0)) continue;

    const daysToExpire = fullDaysBetween(referenceDate, lot.expirationDate);
    if (daysToExpire > expiringDays) continue;

    const status: ExpiringLotStatus =
      daysToExpire < 0 ? 'EXPIRED' : daysToExpire <= 7 ? 'CRITICAL' : 'SOON';

    const capitalAtRisk = roundToIntegerPeso(
      stockDec.times(toDecimal(lot.costPrice)),
    ).toNumber();

    results.push({
      lotId: lot.id,
      productId: lot.productId,
      sku: lot.sku,
      productName: lot.productName,
      lotNumber: lot.lotNumber,
      expirationDate: lot.expirationDate.toISOString(),
      daysToExpire,
      stock: stockDec.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
      capitalAtRisk,
      status,
    });
  }

  return results.sort((a, b) => {
    if (a.daysToExpire !== b.daysToExpire) return a.daysToExpire - b.daysToExpire;
    return b.capitalAtRisk - a.capitalAtRisk;
  });
}

export function computeClientRecommendations(
  orders: OpportunityOrderInput[],
  products: OpportunityProductInput[],
  referenceDate: Date,
  maxClients = 50,
): ClientRecommendationItem[] {
  const inStockMap = new Map<number, OpportunityProductInput>();
  const productNameById = new Map<number, string>();
  for (const p of products) {
    productNameById.set(p.id, p.name);
    if (toDecimal(p.stock).gt(0)) {
      inStockMap.set(p.id, p);
    }
  }

  const byClient = new Map<number, OpportunityOrderInput[]>();
  const productBuyers = new Map<number, Set<number>>();

  for (const order of orders) {
    const list = byClient.get(order.clientId);
    if (list) list.push(order);
    else byClient.set(order.clientId, [order]);

    for (const item of order.items) {
      if (toDecimal(item.quantity).lte(0)) continue;
      let buyers = productBuyers.get(item.productId);
      if (!buyers) {
        buyers = new Set<number>();
        productBuyers.set(item.productId, buyers);
      }
      buyers.add(order.clientId);
    }
  }

  const results: ClientRecommendationItem[] = [];

  for (const [clientId, clientOrders] of byClient.entries()) {
    if (clientOrders.length < 2) continue;

    const sorted = [...clientOrders].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const lastOrder = sorted[sorted.length - 1];
    const totalRevenue = sumIntegerAmounts(sorted.map((o) => o.totalAmount)).toNumber();

    const spanDays = Math.max(1, fullDaysBetween(sorted[0].createdAt, lastOrder.createdAt));
    const avgCycleDays = Math.max(3, Math.round(spanDays / (sorted.length - 1)));
    const stoppedDaysThreshold = Math.max(21, avgCycleDays * 2);

    const recentTwoOrderIds = new Set(sorted.slice(-2).map((o) => o.id));
    const skuHistory = new Map<number, { timesBought: number; lastDate: Date; inRecentTwo: boolean }>();

    for (const order of sorted) {
      const seenInOrder = new Set<number>();
      for (const item of order.items) {
        if (toDecimal(item.quantity).lte(0) || seenInOrder.has(item.productId)) continue;
        seenInOrder.add(item.productId);
        const prev = skuHistory.get(item.productId);
        const inRecent = recentTwoOrderIds.has(order.id);
        if (!prev) {
          skuHistory.set(item.productId, {
            timesBought: 1,
            lastDate: order.createdAt,
            inRecentTwo: inRecent,
          });
        } else {
          prev.timesBought += 1;
          if (order.createdAt > prev.lastDate) prev.lastDate = order.createdAt;
          if (inRecent) prev.inRecentTwo = true;
        }
      }
    }

    const stoppedBuying: StoppedBuyingSuggestion[] = [];
    for (const [productId, hist] of skuHistory.entries()) {
      if (hist.timesBought < 2 || hist.inRecentTwo) continue;
      const product = inStockMap.get(productId);
      if (!product) continue;

      const daysSince = Math.max(0, fullDaysBetween(hist.lastDate, referenceDate));
      if (daysSince < stoppedDaysThreshold) continue;

      stoppedBuying.push({
        productId,
        sku: product.sku,
        name: product.name,
        listPrice: roundToIntegerPeso(product.listPrice).toNumber(),
        stock: toDecimal(product.stock).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
        timesBought: hist.timesBought,
        daysSinceLastBought: daysSince,
      });
    }
    stoppedBuying.sort(
      (a, b) => b.timesBought - a.timesBought || b.daysSinceLastBought - a.daysSinceLastBought,
    );

    const boughtProductIds = new Set(skuHistory.keys());
    const candidateBest = new Map<
      number,
      { peerClientsCount: number; affinityPct: number; basedOnProductName: string }
    >();

    for (const baseProductId of boughtProductIds) {
      const baseBuyers = productBuyers.get(baseProductId);
      if (!baseBuyers || baseBuyers.size < 2) continue;
      const baseProductName =
        inStockMap.get(baseProductId)?.name ||
        productNameById.get(baseProductId) ||
        `#${baseProductId}`;

      for (const [candidateId, candidateBuyers] of productBuyers.entries()) {
        if (boughtProductIds.has(candidateId)) continue;
        if (!inStockMap.has(candidateId)) continue;

        let shared = 0;
        for (const peerId of baseBuyers) {
          if (peerId !== clientId && candidateBuyers.has(peerId)) shared += 1;
        }
        if (shared < 2) continue;

        const peerPool = baseBuyers.size - 1;
        const affinityPct = toDecimal(shared)
          .dividedBy(peerPool)
          .times(100)
          .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
          .toNumber();

        const existing = candidateBest.get(candidateId);
        if (
          !existing ||
          affinityPct > existing.affinityPct ||
          (affinityPct === existing.affinityPct && shared > existing.peerClientsCount)
        ) {
          candidateBest.set(candidateId, {
            peerClientsCount: shared,
            affinityPct,
            basedOnProductName: baseProductName,
          });
        }
      }
    }

    const crossSell: CrossSellSuggestion[] = [];
    for (const [productId, score] of candidateBest.entries()) {
      const product = inStockMap.get(productId);
      if (!product) continue;
      crossSell.push({
        productId,
        sku: product.sku,
        name: product.name,
        listPrice: roundToIntegerPeso(product.listPrice).toNumber(),
        stock: toDecimal(product.stock).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
        peerClientsCount: score.peerClientsCount,
        affinityPct: score.affinityPct,
        basedOnProductName: score.basedOnProductName,
      });
    }
    crossSell.sort(
      (a, b) => b.affinityPct - a.affinityPct || b.peerClientsCount - a.peerClientsCount,
    );

    if (stoppedBuying.length === 0 && crossSell.length === 0) continue;

    results.push({
      clientId,
      clientName: lastOrder.clientName,
      sellerName: lastOrder.sellerName,
      totalRevenue,
      stoppedBuying: stoppedBuying.slice(0, 5),
      crossSell: crossSell.slice(0, 5),
    });
  }

  return results
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, maxClients);
}

export function buildCommercialOpportunitiesReport(params: {
  orders: OpportunityOrderInput[];
  products: OpportunityProductInput[];
  lots: OpportunityLotInput[];
  referenceDate: Date;
  stagnantDays?: number;
  expiringDays?: number;
}): CommercialOpportunitiesReport {
  const stagnantDays = params.stagnantDays ?? 30;
  const expiringDays = params.expiringDays ?? 30;

  const clientsAtRisk = computeClientsAtRisk(params.orders, params.referenceDate);
  const stagnantProducts = computeStagnantStock(
    params.products,
    params.referenceDate,
    stagnantDays,
  );
  const expiringLots = computeExpiringLots(params.lots, params.referenceDate, expiringDays);
  const recommendations = computeClientRecommendations(
    params.orders,
    params.products,
    params.referenceDate,
  );

  const clientsAtRiskMonthlyAmount = sumIntegerAmounts(
    clientsAtRisk.map((c) => c.monthlyAvgAmount),
  ).toNumber();
  const stagnantCapitalTotal = sumIntegerAmounts(
    stagnantProducts.map((p) => p.capitalTiedUp),
  ).toNumber();
  const expiringCapitalTotal = sumIntegerAmounts(
    expiringLots.map((l) => l.capitalAtRisk),
  ).toNumber();
  const expiredLotsCount = expiringLots.filter((l) => l.status === 'EXPIRED').length;

  return {
    generatedAt: params.referenceDate.toISOString(),
    filters: { stagnantDays, expiringDays },
    summary: {
      clientsAtRiskCount: clientsAtRisk.length,
      clientsAtRiskMonthlyAmount,
      stagnantProductsCount: stagnantProducts.length,
      stagnantCapitalTotal,
      expiringLotsCount: expiringLots.length,
      expiredLotsCount,
      expiringCapitalTotal,
      clientsWithRecommendationsCount: recommendations.length,
    },
    clientsAtRisk,
    stagnantProducts,
    expiringLots,
    recommendations,
  };
}
