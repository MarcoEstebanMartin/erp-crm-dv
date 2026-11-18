import prisma from '../../utils/prisma';
import { BillingType, CreditNoteStatus, OrderStatus, TransactionType } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, roundToThreeDecimalsWeight, toDecimal } from '../../core/money';
import {
  computeMarginPercent,
  computeOrderRealBultos,
  findFallbackCostSnapshot,
  normalizeCity,
  resolveItemHistoricalMetrics,
} from '../../engines/reports-core.engine';
import { resolveReportDateRange } from './admin-report.helpers';

export class AdminExecutiveSubService {
  /**
   * Reporte Ejecutivo (PDF Dirección): Decimal.js, rango completo AR (-03:00),
   * bultos reales y descuento de Notas de Crédito aprobadas en período actual y previo.
   */
  async getExecutivePdfReportData(startDateStr?: string, endDateStr?: string) {
    const resolved = resolveReportDateRange({
      startDate: startDateStr,
      endDate: endDateStr,
      defaultCurrentMonth: true,
    });
    const start = resolved.start!;
    const end = resolved.end!;
    const totalWindowMs = end.getTime() - start.getTime() + 1;
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(start.getTime() - totalWindowMs);

    const [currentOrders, prevOrders, currentCreditNotes, prevCreditNotes, collections, debtors, expenses] =
      await Promise.all([
        prisma.order.findMany({
          where: { status: OrderStatus.DELIVERED, createdAt: { gte: start, lte: end } },
          include: { persona: true, items: { include: { product: { include: { rubro: true } } } } },
        }),
        prisma.order.findMany({
          where: { status: OrderStatus.DELIVERED, createdAt: { gte: prevStart, lte: prevEnd } },
          select: { totalAmount: true },
        }),
        prisma.creditNote.findMany({
          where: { status: CreditNoteStatus.APPROVED, createdAt: { gte: start, lte: end } },
          include: {
            persona: true,
            order: { select: { items: { select: { productId: true, unitCostSnapshot: true } } } },
            items: { include: { product: { include: { rubro: true } } } },
          },
        }),
        prisma.creditNote.findMany({
          where: { status: CreditNoteStatus.APPROVED, createdAt: { gte: prevStart, lte: prevEnd } },
          select: { totalAmount: true },
        }),
        prisma.transaction.groupBy({
          by: ['paymentMethod'],
          where: { type: TransactionType.INCOME, createdAt: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        prisma.persona.aggregate({ where: { outstandingBalance: { gt: 0 } }, _sum: { outstandingBalance: true } }),
        prisma.expense.findMany({ where: { date: { gte: start, lte: end } }, include: { category: true } }),
      ]);

    let totalSalesDec = new Decimal(0), totalCostDec = new Decimal(0), totalBultos = 0;
    let officialSalesDec = new Decimal(0), officialCostDec = new Decimal(0), officialCount = 0;
    let internalSalesDec = new Decimal(0), internalCostDec = new Decimal(0), internalCount = 0;

    const productSalesMap = new Map<number, { name: string; category: string; qtyDec: Decimal; amountDec: Decimal; costDec: Decimal }>();
    const categorySalesMap = new Map<string, { amountDec: Decimal; costDec: Decimal; itemsCount: number }>();
    const citySalesMap = new Map<string, { officialSalesDec: Decimal; internalSalesDec: Decimal; totalSalesDec: Decimal; count: number; clients: Set<number> }>();
    const clientSalesMap = new Map<number, { name: string; city: string; officialSalesDec: Decimal; internalSalesDec: Decimal; totalSalesDec: Decimal; costDec: Decimal; ordersCount: number }>();

    const ensureCity = (cityName: string) => {
      let c = citySalesMap.get(cityName);
      if (!c) {
        c = { officialSalesDec: new Decimal(0), internalSalesDec: new Decimal(0), totalSalesDec: new Decimal(0), count: 0, clients: new Set() };
        citySalesMap.set(cityName, c);
      }
      return c;
    };

    const ensureClient = (personaId: number, name: string, cityName: string) => {
      let c = clientSalesMap.get(personaId);
      if (!c) {
        c = { name, city: cityName, officialSalesDec: new Decimal(0), internalSalesDec: new Decimal(0), totalSalesDec: new Decimal(0), costDec: new Decimal(0), ordersCount: 0 };
        clientSalesMap.set(personaId, c);
      }
      return c;
    };

    for (const order of currentOrders) {
      const orderTotalDec = roundToIntegerPeso(order.totalAmount?.toString() ?? 0);
      totalSalesDec = totalSalesDec.plus(orderTotalDec);
      totalBultos += computeOrderRealBultos(order);
      let orderCostDec = new Decimal(0);

      const cityName = normalizeCity(order.persona?.city || order.persona?.route);
      const cityAcc = ensureCity(cityName);
      cityAcc.totalSalesDec = cityAcc.totalSalesDec.plus(orderTotalDec);
      cityAcc.count += 1;
      if (order.personaId) cityAcc.clients.add(order.personaId);
      if (order.billingType === BillingType.OFFICIAL) cityAcc.officialSalesDec = cityAcc.officialSalesDec.plus(orderTotalDec);
      else cityAcc.internalSalesDec = cityAcc.internalSalesDec.plus(orderTotalDec);

      for (const item of order.items) {
        const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics(item);
        orderCostDec = orderCostDec.plus(itemCostDec);

        const prodAcc = productSalesMap.get(item.productId) || {
          name: item.product.name,
          category: item.product.rubro?.name || 'Sin Categoría',
          qtyDec: new Decimal(0),
          amountDec: new Decimal(0),
          costDec: new Decimal(0),
        };
        prodAcc.qtyDec = prodAcc.qtyDec.plus(qtyDec);
        prodAcc.amountDec = prodAcc.amountDec.plus(itemRevenueDec);
        prodAcc.costDec = prodAcc.costDec.plus(itemCostDec);
        productSalesMap.set(item.productId, prodAcc);

        const catName = item.product.rubro?.name || 'Sin Categoría';
        const catAcc = categorySalesMap.get(catName) || { amountDec: new Decimal(0), costDec: new Decimal(0), itemsCount: 0 };
        catAcc.amountDec = catAcc.amountDec.plus(itemRevenueDec);
        catAcc.costDec = catAcc.costDec.plus(itemCostDec);
        catAcc.itemsCount += item.quantity;
        categorySalesMap.set(catName, catAcc);
      }

      totalCostDec = totalCostDec.plus(orderCostDec);
      if (order.billingType === BillingType.OFFICIAL) {
        officialSalesDec = officialSalesDec.plus(orderTotalDec);
        officialCostDec = officialCostDec.plus(orderCostDec);
        officialCount += 1;
      } else {
        internalSalesDec = internalSalesDec.plus(orderTotalDec);
        internalCostDec = internalCostDec.plus(orderCostDec);
        internalCount += 1;
      }

      if (order.personaId) {
        const cliAcc = ensureClient(order.personaId, order.persona?.name || `Cliente #${order.personaId}`, cityName);
        cliAcc.totalSalesDec = cliAcc.totalSalesDec.plus(orderTotalDec);
        cliAcc.costDec = cliAcc.costDec.plus(orderCostDec);
        cliAcc.ordersCount += 1;
        if (order.billingType === BillingType.OFFICIAL) cliAcc.officialSalesDec = cliAcc.officialSalesDec.plus(orderTotalDec);
        else cliAcc.internalSalesDec = cliAcc.internalSalesDec.plus(orderTotalDec);
      }
    }

    for (const cn of currentCreditNotes) {
      const cnTotalDec = roundToIntegerPeso(cn.totalAmount?.toString() ?? 0);
      totalSalesDec = totalSalesDec.minus(cnTotalDec);
      let cnCostDec = new Decimal(0);

      const cityName = normalizeCity(cn.persona?.city || cn.persona?.route);
      const cityAcc = ensureCity(cityName);
      cityAcc.totalSalesDec = cityAcc.totalSalesDec.minus(cnTotalDec);
      if (cn.billingType === BillingType.OFFICIAL) cityAcc.officialSalesDec = cityAcc.officialSalesDec.minus(cnTotalDec);
      else cityAcc.internalSalesDec = cityAcc.internalSalesDec.minus(cnTotalDec);

      for (const item of cn.items) {
        const fallback = findFallbackCostSnapshot(cn.order?.items, item.productId);
        const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics({ ...item, fallbackUnitCostSnapshot: fallback });
        cnCostDec = cnCostDec.plus(itemCostDec);

        const prodAcc = productSalesMap.get(item.productId);
        if (prodAcc) {
          prodAcc.qtyDec = prodAcc.qtyDec.minus(qtyDec);
          prodAcc.amountDec = prodAcc.amountDec.minus(itemRevenueDec);
          prodAcc.costDec = prodAcc.costDec.minus(itemCostDec);
        }
        const catName = item.product?.rubro?.name || 'Sin Categoría';
        const catAcc = categorySalesMap.get(catName);
        if (catAcc) {
          catAcc.amountDec = catAcc.amountDec.minus(itemRevenueDec);
          catAcc.costDec = catAcc.costDec.minus(itemCostDec);
        }
      }

      totalCostDec = totalCostDec.minus(cnCostDec);
      if (cn.billingType === BillingType.OFFICIAL) {
        officialSalesDec = officialSalesDec.minus(cnTotalDec);
        officialCostDec = officialCostDec.minus(cnCostDec);
      } else {
        internalSalesDec = internalSalesDec.minus(cnTotalDec);
        internalCostDec = internalCostDec.minus(cnCostDec);
      }

      if (cn.personaId) {
        const cliAcc = ensureClient(cn.personaId, cn.persona?.name || `Cliente #${cn.personaId}`, cityName);
        cliAcc.totalSalesDec = cliAcc.totalSalesDec.minus(cnTotalDec);
        cliAcc.costDec = cliAcc.costDec.minus(cnCostDec);
        if (cn.billingType === BillingType.OFFICIAL) cliAcc.officialSalesDec = cliAcc.officialSalesDec.minus(cnTotalDec);
        else cliAcc.internalSalesDec = cliAcc.internalSalesDec.minus(cnTotalDec);
      }
    }

    const prevOrdersDec = prevOrders.reduce((s, o) => s.plus(roundToIntegerPeso(o.totalAmount?.toString() ?? 0)), new Decimal(0));
    const prevCnDec = prevCreditNotes.reduce((s, c) => s.plus(roundToIntegerPeso(c.totalAmount?.toString() ?? 0)), new Decimal(0));
    const prevTotalSalesDec = prevOrdersDec.minus(prevCnDec);
    const salesGrowthPct = prevTotalSalesDec.gt(0)
      ? computeMarginPercent(totalSalesDec.minus(prevTotalSalesDec), prevTotalSalesDec, 0)
      : 0;

    let totalCollectedDec = new Decimal(0);
    const collectionsByMethod: Record<string, number> = { CASH: 0, CHECK: 0, BANK_TRANSFER: 0, OTHER: 0 };
    for (const c of collections) {
      const amtDec = roundToIntegerPeso(c._sum.amount?.toString() ?? 0);
      totalCollectedDec = totalCollectedDec.plus(amtDec);
      const method = c.paymentMethod || 'OTHER';
      collectionsByMethod[method] = roundToIntegerPeso(toDecimal(collectionsByMethod[method] || 0).plus(amtDec)).toNumber();
    }

    let totalExpensesDec = new Decimal(0);
    const expensesByCat = new Map<string, Decimal>();
    for (const e of expenses) {
      const amtDec = toDecimal(e.amount?.toString() ?? 0);
      totalExpensesDec = totalExpensesDec.plus(amtDec);
      const cat = e.category?.name || 'General';
      expensesByCat.set(cat, (expensesByCat.get(cat) || new Decimal(0)).plus(amtDec));
    }

    const grossProfitDec = totalSalesDec.minus(totalCostDec);
    const netProfitDec = grossProfitDec.minus(totalExpensesDec);

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        startDateIso: resolved.startDateIso,
        endDateIso: resolved.endDateIso,
        durationDays: Math.max(1, Math.round(totalWindowMs / 86_400_000)),
      },
      summary: {
        totalSales: roundToIntegerPeso(totalSalesDec).toNumber(),
        totalCost: roundToIntegerPeso(totalCostDec).toNumber(),
        grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
        grossMarginPct: computeMarginPercent(grossProfitDec, totalSalesDec, 0),
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
          cash: collectionsByMethod.CASH || 0,
          check: collectionsByMethod.CHECK || 0,
          transfer: collectionsByMethod.BANK_TRANSFER || 0,
          other: collectionsByMethod.OTHER || 0,
        },
        totalPendingDebt: roundToIntegerPeso(debtors._sum?.outstandingBalance?.toString() ?? 0).toNumber(),
      },
      topProducts: Array.from(productSalesMap.values())
        .filter((p) => p.amountDec.gt(0))
        .map((p) => {
          const profitDec = p.amountDec.minus(p.costDec);
          return {
            name: p.name,
            category: p.category,
            quantity: roundToThreeDecimalsWeight(p.qtyDec).toNumber(),
            amount: roundToIntegerPeso(p.amountDec).toNumber(),
            cost: roundToIntegerPeso(p.costDec).toNumber(),
            profit: roundToIntegerPeso(profitDec).toNumber(),
            marginPct: computeMarginPercent(profitDec, p.amountDec, 0),
          };
        })
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10),
      topClients: Array.from(clientSalesMap.values())
        .map((c) => {
          const profitDec = c.totalSalesDec.minus(c.costDec);
          return {
            name: c.name,
            city: c.city,
            ordersCount: c.ordersCount,
            officialSales: roundToIntegerPeso(c.officialSalesDec).toNumber(),
            internalSales: roundToIntegerPeso(c.internalSalesDec).toNumber(),
            totalSales: roundToIntegerPeso(c.totalSalesDec).toNumber(),
            cost: roundToIntegerPeso(c.costDec).toNumber(),
            profit: roundToIntegerPeso(profitDec).toNumber(),
            marginPct: computeMarginPercent(profitDec, c.totalSalesDec, 0),
          };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10),
      topCategories: Array.from(categorySalesMap.entries())
        .map(([name, d]) => {
          const profitDec = d.amountDec.minus(d.costDec);
          return {
            name,
            amount: roundToIntegerPeso(d.amountDec).toNumber(),
            cost: roundToIntegerPeso(d.costDec).toNumber(),
            profit: roundToIntegerPeso(profitDec).toNumber(),
            marginPct: computeMarginPercent(profitDec, d.amountDec, 0),
            itemsCount: d.itemsCount,
          };
        })
        .sort((a, b) => b.amount - a.amount),
      citiesSummary: Array.from(citySalesMap.entries())
        .map(([cityName, d]) => ({
          cityName,
          officialSales: roundToIntegerPeso(d.officialSalesDec).toNumber(),
          internalSales: roundToIntegerPeso(d.internalSalesDec).toNumber(),
          totalSales: roundToIntegerPeso(d.totalSalesDec).toNumber(),
          ordersCount: d.count,
          activeClientsCount: d.clients.size,
        }))
        .sort((a, b) => b.totalSales - a.totalSales),
      expensesSummary: {
        total: roundToIntegerPeso(totalExpensesDec).toNumber(),
        byCategory: Array.from(expensesByCat.entries()).map(([name, amtDec]) => ({
          name,
          amount: roundToIntegerPeso(amtDec).toNumber(),
        })),
      },
    };
  }
}

export const adminExecutiveSubService = new AdminExecutiveSubService();
