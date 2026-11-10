import prisma from '../../utils/prisma';
import { BillingType, TransactionType, OrderStatus } from '@prisma/client';
import { normalizeCity, resolveOrderItemHistoricalCost } from './admin-report.helpers';

export class AdminExecutiveSubService {
  /**
   * Obtener datos consolidados para el Reporte Ejecutivo (PDF para la Dirección) usando unitCostSnapshot.
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

    let totalSales = 0;
    let totalCost = 0;
    let totalBultos = 0;
    let officialSales = 0;
    let officialCost = 0;
    let officialCount = 0;
    let internalSales = 0;
    let internalCost = 0;
    let internalCount = 0;

    const productSalesMap: Record<number, { name: string; category: string; quantity: number; amount: number; cost: number }> = {};
    const categorySalesMap: Record<string, { amount: number; cost: number; itemsCount: number }> = {};
    const citySalesMap: Record<string, { officialSales: number; internalSales: number; totalSales: number; count: number; clients: Set<number> }> = {};
    const clientSalesMap: Record<number, { name: string; city: string; officialSales: number; internalSales: number; totalSales: number; cost: number; ordersCount: number }> = {};

    for (const order of currentOrders) {
      const orderTotal = Number(order.totalAmount) || 0;
      totalSales += orderTotal;
      let orderCost = 0;

      const cityName = normalizeCity(order.persona?.city || order.persona?.route);
      if (!citySalesMap[cityName]) {
        citySalesMap[cityName] = { officialSales: 0, internalSales: 0, totalSales: 0, count: 0, clients: new Set() };
      }
      citySalesMap[cityName].totalSales += orderTotal;
      citySalesMap[cityName].count += 1;
      if (order.personaId) citySalesMap[cityName].clients.add(order.personaId);
      if (order.billingType === BillingType.OFFICIAL) {
        citySalesMap[cityName].officialSales += orderTotal;
      } else {
        citySalesMap[cityName].internalSales += orderTotal;
      }

      for (const item of order.items) {
        const { itemRevenue, itemCost } = resolveOrderItemHistoricalCost(item);
        orderCost += itemCost;
        totalBultos += item.quantity;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.product.name,
            category: item.product.rubro?.name || 'Sin Categoría',
            quantity: 0,
            amount: 0,
            cost: 0,
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].amount += itemRevenue;
        productSalesMap[item.productId].cost += itemCost;

        const catName = item.product.rubro?.name || 'Sin Categoría';
        if (!categorySalesMap[catName]) {
          categorySalesMap[catName] = { amount: 0, cost: 0, itemsCount: 0 };
        }
        categorySalesMap[catName].amount += itemRevenue;
        categorySalesMap[catName].cost += itemCost;
        categorySalesMap[catName].itemsCount += item.quantity;
      }

      totalCost += orderCost;

      if (order.billingType === BillingType.OFFICIAL) {
        officialSales += orderTotal;
        officialCost += orderCost;
        officialCount++;
      } else {
        internalSales += orderTotal;
        internalCost += orderCost;
        internalCount++;
      }

      if (order.personaId) {
        const clientName = order.persona?.name || `Cliente #${order.personaId}`;
        if (!clientSalesMap[order.personaId]) {
          clientSalesMap[order.personaId] = {
            name: clientName,
            city: cityName,
            officialSales: 0,
            internalSales: 0,
            totalSales: 0,
            cost: 0,
            ordersCount: 0,
          };
        }
        clientSalesMap[order.personaId].totalSales += orderTotal;
        clientSalesMap[order.personaId].cost += orderCost;
        clientSalesMap[order.personaId].ordersCount += 1;
        if (order.billingType === BillingType.OFFICIAL) {
          clientSalesMap[order.personaId].officialSales += orderTotal;
        } else {
          clientSalesMap[order.personaId].internalSales += orderTotal;
        }
      }
    }

    const prevTotalSales = prevOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const salesGrowthPct = prevTotalSales > 0 ? Math.round(((totalSales - prevTotalSales) / prevTotalSales) * 100) : 0;

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

    let totalCollected = 0;
    const collectionsByMethod: Record<string, number> = { CASH: 0, CHECK: 0, BANK_TRANSFER: 0, OTHER: 0 };
    collections.forEach((c) => {
      const amt = Math.round(Number(c._sum.amount || 0));
      totalCollected += amt;
      const method = c.paymentMethod || 'OTHER';
      collectionsByMethod[method] = (collectionsByMethod[method] || 0) + amt;
    });

    const totalPendingDebt = Math.round(Number(debtors._sum?.outstandingBalance || 0));

    let totalExpenses = 0;
    const expensesByCategoryMap: Record<string, number> = {};
    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      totalExpenses += amt;
      const cat = e.category?.name || 'General';
      expensesByCategoryMap[cat] = (expensesByCategoryMap[cat] || 0) + amt;
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        amount: Math.round(p.amount),
        cost: Math.round(p.cost),
        profit: Math.round(p.amount - p.cost),
        marginPct: p.amount > 0 ? Math.round(((p.amount - p.cost) / p.amount) * 100) : 0,
      }));

    const topClients = Object.values(clientSalesMap)
      .map((c) => ({
        ...c,
        officialSales: Math.round(c.officialSales),
        internalSales: Math.round(c.internalSales),
        totalSales: Math.round(c.totalSales),
        cost: Math.round(c.cost),
        profit: Math.round(c.totalSales - c.cost),
        marginPct: c.totalSales > 0 ? Math.round(((c.totalSales - c.cost) / c.totalSales) * 100) : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const topCategories = Object.entries(categorySalesMap)
      .map(([name, data]) => ({
        name,
        amount: Math.round(data.amount),
        cost: Math.round(data.cost),
        profit: Math.round(data.amount - data.cost),
        marginPct: data.amount > 0 ? Math.round(((data.amount - data.cost) / data.amount) * 100) : 0,
        itemsCount: data.itemsCount,
      }))
      .sort((a, b) => b.amount - a.amount);

    const citiesSummary = Object.entries(citySalesMap)
      .map(([cityName, data]) => ({
        cityName,
        officialSales: Math.round(data.officialSales),
        internalSales: Math.round(data.internalSales),
        totalSales: Math.round(data.totalSales),
        ordersCount: data.count,
        activeClientsCount: data.clients.size,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - totalExpenses;
    const grossMarginPct = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        durationDays: Math.ceil(durationMs / (1000 * 60 * 60 * 24)),
      },
      summary: {
        totalSales: Math.round(totalSales),
        totalCost: Math.round(totalCost),
        grossProfit: Math.round(grossProfit),
        grossMarginPct,
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round(netProfit),
        totalOrders: currentOrders.length,
        totalBultos,
        salesGrowthPct,
        prevTotalSales: Math.round(prevTotalSales),
      },
      billingBreakdown: {
        official: {
          sales: Math.round(officialSales),
          cost: Math.round(officialCost),
          grossProfit: Math.round(officialSales - officialCost),
          count: officialCount,
        },
        internal: {
          sales: Math.round(internalSales),
          cost: Math.round(internalCost),
          grossProfit: Math.round(internalSales - internalCost),
          count: internalCount,
        },
      },
      collections: {
        totalCollected,
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
        total: Math.round(totalExpenses),
        byCategory: Object.entries(expensesByCategoryMap).map(([name, amount]) => ({ name, amount: Math.round(amount) })),
      },
    };
  }
}

export const adminExecutiveSubService = new AdminExecutiveSubService();
