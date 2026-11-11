import prisma from '../../utils/prisma';
import { BillingType, TransactionType, OrderStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, toDecimal } from '../../core/money';
import { normalizeCity, resolveOrderItemHistoricalCost } from './admin-report.helpers';

export class AdminExecutiveSubService {
  /**
   * Obtener datos consolidados para el Reporte Ejecutivo (PDF para la Dirección) usando unitCostSnapshot y Decimal.js.
   */
  async getExecutivePdfReportData(startDateStr?: string, endDateStr?: string) {
    let start: Date;
    let end: Date;

    if (startDateStr && endDateStr) {
      start = new Date(startDateStr);
      end = new Date(endDateStr);
      if (isNaN(start.getTime())) start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (isNaN(end.getTime())) end = new Date();
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const durationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - durationMs);
    const prevEnd = new Date(start.getTime() - 1);

    const [currentOrders, prevOrders] = await Promise.all([
      prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: start, lte: end } },
        include: {
          persona: true,
          items: { include: { product: { include: { rubro: true } } } },
        },
      }),
      prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, createdAt: { gte: prevStart, lte: prevEnd } },
      }),
    ]);

    let totalSalesDec = new Decimal(0);
    let totalCostDec = new Decimal(0);
    let totalBultos = 0;
    let officialSalesDec = new Decimal(0);
    let officialCostDec = new Decimal(0);
    let officialCount = 0;
    let internalSalesDec = new Decimal(0);
    let internalCostDec = new Decimal(0);
    let internalCount = 0;

    const productSalesMap: Record<
      number,
      { name: string; category: string; quantity: number; amount: Decimal; cost: Decimal }
    > = {};
    const categorySalesMap: Record<
      string,
      { amount: Decimal; cost: Decimal; itemsCount: number }
    > = {};
    const citySalesMap: Record<
      string,
      {
        officialSales: Decimal;
        internalSales: Decimal;
        totalSales: Decimal;
        count: number;
        clients: Set<number>;
      }
    > = {};
    const clientSalesMap: Record<
      number,
      {
        name: string;
        city: string;
        officialSales: Decimal;
        internalSales: Decimal;
        totalSales: Decimal;
        cost: Decimal;
        ordersCount: number;
      }
    > = {};

    for (const order of currentOrders) {
      const orderTotalDec = roundToIntegerPeso(order.totalAmount ? order.totalAmount.toString() : 0);
      totalSalesDec = totalSalesDec.plus(orderTotalDec);
      let orderCostDec = new Decimal(0);

      const cityName = normalizeCity(order.persona?.city || order.persona?.route);
      if (!citySalesMap[cityName]) {
        citySalesMap[cityName] = {
          officialSales: new Decimal(0),
          internalSales: new Decimal(0),
          totalSales: new Decimal(0),
          count: 0,
          clients: new Set(),
        };
      }
      citySalesMap[cityName].totalSales = citySalesMap[cityName].totalSales.plus(orderTotalDec);
      citySalesMap[cityName].count += 1;
      if (order.personaId) citySalesMap[cityName].clients.add(order.personaId);
      if (order.billingType === BillingType.OFFICIAL) {
        citySalesMap[cityName].officialSales = citySalesMap[cityName].officialSales.plus(orderTotalDec);
      } else {
        citySalesMap[cityName].internalSales = citySalesMap[cityName].internalSales.plus(orderTotalDec);
      }

      for (const item of order.items) {
        const { itemRevenue, itemCost } = resolveOrderItemHistoricalCost(item);
        const itemRevenueDec = toDecimal(itemRevenue);
        const itemCostDec = toDecimal(itemCost);

        orderCostDec = orderCostDec.plus(itemCostDec);
        totalBultos += item.quantity;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.product.name,
            category: item.product.rubro?.name || 'Sin Categoría',
            quantity: 0,
            amount: new Decimal(0),
            cost: new Decimal(0),
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].amount = productSalesMap[item.productId].amount.plus(itemRevenueDec);
        productSalesMap[item.productId].cost = productSalesMap[item.productId].cost.plus(itemCostDec);

        const catName = item.product.rubro?.name || 'Sin Categoría';
        if (!categorySalesMap[catName]) {
          categorySalesMap[catName] = { amount: new Decimal(0), cost: new Decimal(0), itemsCount: 0 };
        }
        categorySalesMap[catName].amount = categorySalesMap[catName].amount.plus(itemRevenueDec);
        categorySalesMap[catName].cost = categorySalesMap[catName].cost.plus(itemCostDec);
        categorySalesMap[catName].itemsCount += item.quantity;
      }

      totalCostDec = totalCostDec.plus(orderCostDec);

      if (order.billingType === BillingType.OFFICIAL) {
        officialSalesDec = officialSalesDec.plus(orderTotalDec);
        officialCostDec = officialCostDec.plus(orderCostDec);
        officialCount++;
      } else {
        internalSalesDec = internalSalesDec.plus(orderTotalDec);
        internalCostDec = internalCostDec.plus(orderCostDec);
        internalCount++;
      }

      if (order.personaId) {
        const clientName = order.persona?.name || `Cliente #${order.personaId}`;
        if (!clientSalesMap[order.personaId]) {
          clientSalesMap[order.personaId] = {
            name: clientName,
            city: cityName,
            officialSales: new Decimal(0),
            internalSales: new Decimal(0),
            totalSales: new Decimal(0),
            cost: new Decimal(0),
            ordersCount: 0,
          };
        }
        clientSalesMap[order.personaId].totalSales = clientSalesMap[order.personaId].totalSales.plus(orderTotalDec);
        clientSalesMap[order.personaId].cost = clientSalesMap[order.personaId].cost.plus(orderCostDec);
        clientSalesMap[order.personaId].ordersCount += 1;
        if (order.billingType === BillingType.OFFICIAL) {
          clientSalesMap[order.personaId].officialSales =
            clientSalesMap[order.personaId].officialSales.plus(orderTotalDec);
        } else {
          clientSalesMap[order.personaId].internalSales =
            clientSalesMap[order.personaId].internalSales.plus(orderTotalDec);
        }
      }
    }

    const prevTotalSalesDec = prevOrders.reduce(
      (sum, o) => sum.plus(roundToIntegerPeso(o.totalAmount ? o.totalAmount.toString() : 0)),
      new Decimal(0),
    );
    const salesGrowthPct = prevTotalSalesDec.gt(0)
      ? roundToIntegerPeso(
          totalSalesDec.minus(prevTotalSalesDec).dividedBy(prevTotalSalesDec).times(100),
        ).toNumber()
      : 0;

    const [collections, debtors, expenses] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where: { type: TransactionType.INCOME, createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      prisma.persona.aggregate({
        where: { outstandingBalance: { gt: 0 } },
        _sum: { outstandingBalance: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        include: { category: true },
      }),
    ]);

    let totalCollectedDec = new Decimal(0);
    const collectionsByMethod: Record<string, number> = {
      CASH: 0,
      CHECK: 0,
      BANK_TRANSFER: 0,
      OTHER: 0,
    };
    collections.forEach((c) => {
      const amtDec = roundToIntegerPeso(c._sum.amount ? c._sum.amount.toString() : 0);
      totalCollectedDec = totalCollectedDec.plus(amtDec);
      const method = c.paymentMethod || 'OTHER';
      collectionsByMethod[method] = roundToIntegerPeso(
        toDecimal(collectionsByMethod[method] || 0).plus(amtDec),
      ).toNumber();
    });

    const totalPendingDebt = roundToIntegerPeso(
      debtors._sum?.outstandingBalance ? debtors._sum.outstandingBalance.toString() : 0,
    ).toNumber();

    let totalExpensesDec = new Decimal(0);
    const expensesByCategoryMap: Record<string, Decimal> = {};
    expenses.forEach((e) => {
      const amtDec = toDecimal(e.amount ? e.amount.toString() : 0);
      totalExpensesDec = totalExpensesDec.plus(amtDec);
      const cat = e.category?.name || 'General';
      expensesByCategoryMap[cat] = (expensesByCategoryMap[cat] || new Decimal(0)).plus(amtDec);
    });

    const topProducts = Object.values(productSalesMap)
      .map((p) => {
        const amount = roundToIntegerPeso(p.amount).toNumber();
        const cost = roundToIntegerPeso(p.cost).toNumber();
        const profitDec = p.amount.minus(p.cost);
        return {
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          amount,
          cost,
          profit: roundToIntegerPeso(profitDec).toNumber(),
          marginPct: p.amount.gt(0)
            ? roundToIntegerPeso(profitDec.dividedBy(p.amount).times(100)).toNumber()
            : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    const topClients = Object.values(clientSalesMap)
      .map((c) => {
        const profitDec = c.totalSales.minus(c.cost);
        return {
          name: c.name,
          city: c.city,
          ordersCount: c.ordersCount,
          officialSales: roundToIntegerPeso(c.officialSales).toNumber(),
          internalSales: roundToIntegerPeso(c.internalSales).toNumber(),
          totalSales: roundToIntegerPeso(c.totalSales).toNumber(),
          cost: roundToIntegerPeso(c.cost).toNumber(),
          profit: roundToIntegerPeso(profitDec).toNumber(),
          marginPct: c.totalSales.gt(0)
            ? roundToIntegerPeso(profitDec.dividedBy(c.totalSales).times(100)).toNumber()
            : 0,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const topCategories = Object.entries(categorySalesMap)
      .map(([name, data]) => {
        const profitDec = data.amount.minus(data.cost);
        return {
          name,
          amount: roundToIntegerPeso(data.amount).toNumber(),
          cost: roundToIntegerPeso(data.cost).toNumber(),
          profit: roundToIntegerPeso(profitDec).toNumber(),
          marginPct: data.amount.gt(0)
            ? roundToIntegerPeso(profitDec.dividedBy(data.amount).times(100)).toNumber()
            : 0,
          itemsCount: data.itemsCount,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const citiesSummary = Object.entries(citySalesMap)
      .map(([cityName, data]) => ({
        cityName,
        officialSales: roundToIntegerPeso(data.officialSales).toNumber(),
        internalSales: roundToIntegerPeso(data.internalSales).toNumber(),
        totalSales: roundToIntegerPeso(data.totalSales).toNumber(),
        ordersCount: data.count,
        activeClientsCount: data.clients.size,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    const grossProfitDec = totalSalesDec.minus(totalCostDec);
    const netProfitDec = grossProfitDec.minus(totalExpensesDec);
    const grossMarginPct = totalSalesDec.gt(0)
      ? roundToIntegerPeso(grossProfitDec.dividedBy(totalSalesDec).times(100)).toNumber()
      : 0;

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        durationDays: Math.ceil(durationMs / (1000 * 60 * 60 * 24)),
      },
      summary: {
        totalSales: roundToIntegerPeso(totalSalesDec).toNumber(),
        totalCost: roundToIntegerPeso(totalCostDec).toNumber(),
        grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
        grossMarginPct,
        totalExpenses: roundToIntegerPeso(totalExpensesDec).toNumber(),
        netProfit: roundToIntegerPeso(netProfitDec).toNumber(),
        totalOrders: currentOrders.length,
        totalBultos,
        salesGrowthPct,
        prevTotalSales: roundToIntegerPeso(prevTotalSalesDec).toNumber(),
      },
      billingBreakdown: {
        official: {
          sales: roundToIntegerPeso(officialSalesDec).toNumber(),
          cost: roundToIntegerPeso(officialCostDec).toNumber(),
          grossProfit: roundToIntegerPeso(officialSalesDec.minus(officialCostDec)).toNumber(),
          count: officialCount,
        },
        internal: {
          sales: roundToIntegerPeso(internalSalesDec).toNumber(),
          cost: roundToIntegerPeso(internalCostDec).toNumber(),
          grossProfit: roundToIntegerPeso(internalSalesDec.minus(internalCostDec)).toNumber(),
          count: internalCount,
        },
      },
      collections: {
        totalCollected: roundToIntegerPeso(totalCollectedDec).toNumber(),
        byMethod: {
          cash: collectionsByMethod['CASH'] || 0,
          check: collectionsByMethod['CHECK'] || 0,
          transfer: collectionsByMethod['BANK_TRANSFER'] || 0,
          other: collectionsByMethod['OTHER'] || 0,
        },
        totalPendingDebt,
      },
      topProducts,
      topClients,
      topCategories,
      citiesSummary,
      expensesSummary: {
        total: roundToIntegerPeso(totalExpensesDec).toNumber(),
        byCategory: Object.entries(expensesByCategoryMap).map(([name, amountDec]) => ({
          name,
          amount: roundToIntegerPeso(amountDec).toNumber(),
        })),
      },
    };
  }
}

export const adminExecutiveSubService = new AdminExecutiveSubService();
