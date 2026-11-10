import prisma from '../../utils/prisma';
import { BillingType, TransactionType } from '@prisma/client';
import { standardizeCityName } from '../../utils/normalize';
import { roundToIntegerPeso } from '../../core/money';
import { resolveOrderItemHistoricalCost } from './admin-report.helpers';

export class AdminFinanceSubService {
  /**
   * Obtener reporte consolidado financiero usando unitCostSnapshot (CMV histórico real).
   */
  async getFinancialReports(year?: number, month?: number) {
    const whereClause: any = { status: 'DELIVERED' };

    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      whereClause.createdAt = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    }

    const deliveredOrders = await prisma.order.findMany({
      where: whereClause,
      include: { items: { include: { product: true } } },
    });

    let officialSales = 0;
    let officialCost = 0;
    let officialCount = 0;
    let internalSales = 0;
    let internalCost = 0;
    let internalCount = 0;

    for (const order of deliveredOrders) {
      const amount = roundToIntegerPeso(order.totalAmount || 0).toNumber();
      let cost = 0;
      for (const item of order.items) {
        const { itemCost } = resolveOrderItemHistoricalCost(item);
        cost += itemCost;
      }

      if (order.billingType === BillingType.OFFICIAL) {
        officialSales += amount;
        officialCost += cost;
        officialCount++;
      } else {
        internalSales += amount;
        internalCost += cost;
        internalCount++;
      }
    }

    const transactionWhereClause: any = {};
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      transactionWhereClause.createdAt = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    }

    const [transactionsGrouped, paymentMethodsGrouped] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['billingType', 'type'],
        where: transactionWhereClause,
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['billingType', 'paymentMethod'],
        where: {
          ...transactionWhereClause,
          type: TransactionType.INCOME,
        },
        _sum: { amount: true },
      }),
    ]);

    const expenseWhereClause: any = {};
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      expenseWhereClause.date = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    }

    const expenses = await prisma.expense.findMany({
      where: expenseWhereClause,
      include: { category: true },
    });

    let totalExpenses = 0;
    const expensesByCategoryMap: { [key: string]: number } = {};

    expenses.forEach((e) => {
      const amount = Number(e.amount) || 0;
      totalExpenses += amount;
      const catName = e.category.name;
      expensesByCategoryMap[catName] = (expensesByCategoryMap[catName] || 0) + amount;
    });

    const expensesByCategory = Object.keys(expensesByCategoryMap).map((name) => ({
      name,
      value: roundToIntegerPeso(expensesByCategoryMap[name]).toNumber(),
    }));

    return {
      sales: {
        official: roundToIntegerPeso(officialSales).toNumber(),
        officialCost: roundToIntegerPeso(officialCost).toNumber(),
        officialCount,
        internal: roundToIntegerPeso(internalSales).toNumber(),
        internalCost: roundToIntegerPeso(internalCost).toNumber(),
        internalCount,
      },
      cashflow: {
        officialIncome:
          transactionsGrouped.find(
            (g) => g.billingType === BillingType.OFFICIAL && g.type === TransactionType.INCOME,
          )?._sum.amount || 0,
        officialOutcome:
          transactionsGrouped.find(
            (g) => g.billingType === BillingType.OFFICIAL && g.type === TransactionType.OUTCOME,
          )?._sum.amount || 0,
        internalIncome:
          transactionsGrouped.find(
            (g) => g.billingType === BillingType.INTERNAL && g.type === TransactionType.INCOME,
          )?._sum.amount || 0,
        internalOutcome:
          transactionsGrouped.find(
            (g) => g.billingType === BillingType.INTERNAL && g.type === TransactionType.OUTCOME,
          )?._sum.amount || 0,
      },
      paymentMethods: paymentMethodsGrouped.map((m) => ({
        channel: m.billingType,
        method: m.paymentMethod,
        total: m._sum.amount || 0,
      })),
      expenses: {
        total: roundToIntegerPeso(totalExpenses).toNumber(),
        byCategory: expensesByCategory,
      },
    };
  }

  async getAutofillSalesForWeek(weekStart: string) {
    const startDate = new Date(weekStart + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    const orders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: startDate, lt: endDate },
      },
      include: { persona: { select: { city: true } } },
    });

    const localityMap = new Map<
      string,
      { locality: string; date: string; amountA: number; amountX: number }
    >();

    for (const order of orders) {
      const city = standardizeCityName(order.persona?.city || 'SIN ESPECIFICAR');
      const amount = roundToIntegerPeso(order.totalAmount || 0).toNumber();
      const isOfficial = order.billingType === BillingType.OFFICIAL;

      const current = localityMap.get(city) || {
        locality: city,
        date: '',
        amountA: 0,
        amountX: 0,
      };

      if (isOfficial) current.amountA += amount;
      else current.amountX += amount;

      if (order.createdAt) {
        const orderDateObj = new Date(order.createdAt);
        const day = String(orderDateObj.getDate()).padStart(2, '0');
        const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
        current.date = `${day}/${month}`;
      }

      localityMap.set(city, current);
    }

    return Array.from(localityMap.values()).sort((a, b) => a.locality.localeCompare(b.locality));
  }

  async getWeeklyReports() {
    return prisma.weeklyReport.findMany({ orderBy: { weekStart: 'asc' } });
  }

  async saveWeeklyReport(data: {
    weekStart: string;
    purchases: any[];
    sales: any[];
    credit: number;
    buffer: number;
  }) {
    const { weekStart, purchases, sales, credit, buffer } = data;

    const parsedPurchases = purchases.map((p) => ({
      company: String(p.company),
      date: p.date ? String(p.date) : null,
      amount: roundToIntegerPeso(p.amount || 0).toNumber(),
    }));

    const parsedSales = sales.map((s) => ({
      locality: String(s.locality),
      date: s.date ? String(s.date) : null,
      amountA: roundToIntegerPeso(s.amountA || 0).toNumber(),
      amountX: roundToIntegerPeso(s.amountX || 0).toNumber(),
    }));

    return prisma.weeklyReport.upsert({
      where: { weekStart },
      create: {
        weekStart,
        purchases: parsedPurchases,
        sales: parsedSales,
        credit: roundToIntegerPeso(credit).toNumber(),
        buffer: roundToIntegerPeso(buffer).toNumber(),
      },
      update: {
        purchases: parsedPurchases,
        sales: parsedSales,
        credit: roundToIntegerPeso(credit).toNumber(),
        buffer: roundToIntegerPeso(buffer).toNumber(),
      },
    });
  }

  async deleteWeeklyReport(weekStart: string) {
    return prisma.weeklyReport.delete({ where: { weekStart } });
  }

  async getSuggestedCreditForWeek(weekStart: string): Promise<number> {
    const date = new Date(weekStart + 'T00:00:00');
    date.setDate(date.getDate() - 7);
    const prevWeekStart = date.toISOString().split('T')[0];

    const prevReport = await prisma.weeklyReport.findUnique({
      where: { weekStart: prevWeekStart },
    });

    if (!prevReport) return 0;

    const salesList = (prevReport.sales as any[]) || [];
    const purchasesList = (prevReport.purchases as any[]) || [];

    const prevTotalSales = salesList.reduce(
      (sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0),
      0,
    );
    const prevActualPurchases = purchasesList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const prevCredit = Number(prevReport.credit) || 0;
    const prevTotalPurchases = prevActualPurchases + prevCredit;
    const prevBuffer = Number(prevReport.buffer) || 0;

    return roundToIntegerPeso(prevTotalPurchases + prevBuffer - prevTotalSales).toNumber();
  }
}

export const adminFinanceSubService = new AdminFinanceSubService();
