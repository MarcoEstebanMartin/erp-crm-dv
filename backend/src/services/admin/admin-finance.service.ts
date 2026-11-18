import { Decimal } from 'decimal.js';
import prisma from '../../utils/prisma';
import { CreditNoteStatus, OrderStatus, TransactionType } from '@prisma/client';
import { standardizeCityName } from '../../utils/normalize';
import { roundToIntegerPeso, toDecimal } from '../../core/money';
import { computeFinancialSummaryMetrics } from '../../engines/reports-core.engine';
import { parseArgentinaTimestampRange } from '../billing/billing-date-range.helper';
import { resolveReportDateRange } from './admin-report.helpers';

const AR_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Argentina/Buenos_Aires',
  day: '2-digit',
  month: '2-digit',
});

export class AdminFinanceSubService {
  /**
   * Obtener reporte consolidado financiero usando unitCostSnapshot (CMV histórico real)
   * con Decimal.js, rangos horarios AR (-03:00) y descuento de Notas de Crédito aprobadas.
   */
  async getFinancialReports(
    paramsOrYear?: number | { year?: number; month?: number; startDate?: string; endDate?: string },
    month?: number,
  ) {
    const params =
      typeof paramsOrYear === 'object' && paramsOrYear !== null
        ? paramsOrYear
        : { year: paramsOrYear, month };

    const { range } = resolveReportDateRange({
      startDate: params.startDate,
      endDate: params.endDate,
      year: params.year,
      month: params.month,
    });

    const [deliveredOrders, creditNotes, transactionsGrouped, paymentMethodsGrouped, expenses] =
      await Promise.all([
        prisma.order.findMany({
          where: { status: OrderStatus.DELIVERED, ...(range ? { createdAt: range } : {}) },
          include: {
            items: {
              include: {
                product: { select: { isPesable: true, costPrice: true } },
              },
            },
          },
        }),
        prisma.creditNote.findMany({
          where: { status: CreditNoteStatus.APPROVED, ...(range ? { createdAt: range } : {}) },
          include: {
            order: {
              select: {
                deliveryMethod: true,
                salesChannel: true,
                deliveryRouteId: true,
                items: { select: { productId: true, unitCostSnapshot: true } },
              },
            },
            items: {
              include: {
                product: { select: { isPesable: true, costPrice: true } },
              },
            },
          },
        }),
        prisma.transaction.groupBy({
          by: ['billingType', 'type'],
          where: range ? { createdAt: range } : {},
          _sum: { amount: true },
        }),
        prisma.transaction.groupBy({
          by: ['billingType', 'paymentMethod'],
          where: { ...(range ? { createdAt: range } : {}), type: TransactionType.INCOME },
          _sum: { amount: true },
        }),
        prisma.expense.findMany({
          where: range ? { date: range } : {},
          include: { category: true },
        }),
      ]);

    return computeFinancialSummaryMetrics({
      orders: deliveredOrders,
      creditNotes,
      expenses,
      transactionsGrouped,
      paymentMethodsGrouped,
    });
  }

  async getAutofillSalesForWeek(weekStart: string) {
    const [y, m, d] = weekStart.split('-').map(Number);
    const sundayUtc = new Date(Date.UTC(y, m - 1, d + 6));
    const endDateIso = sundayUtc.toISOString().slice(0, 10);
    const range = parseArgentinaTimestampRange(weekStart, endDateIso);

    const orders = await prisma.order.findMany({
      where: { status: OrderStatus.DELIVERED, ...(range ? { createdAt: range } : {}) },
      include: { persona: { select: { city: true } } },
    });

    const localityMap = new Map<
      string,
      { locality: string; date: string; amountADec: Decimal; amountXDec: Decimal }
    >();

    for (const order of orders) {
      const city = standardizeCityName(order.persona?.city || 'SIN ESPECIFICAR');
      const amountDec = roundToIntegerPeso(order.totalAmount || 0);
      const isOfficial = order.billingType === 'OFFICIAL';

      const current = localityMap.get(city) || {
        locality: city,
        date: '',
        amountADec: new Decimal(0),
        amountXDec: new Decimal(0),
      };

      if (isOfficial) current.amountADec = current.amountADec.plus(amountDec);
      else current.amountXDec = current.amountXDec.plus(amountDec);

      if (order.createdAt) {
        current.date = AR_DAY_MONTH_FORMATTER.format(new Date(order.createdAt));
      }

      localityMap.set(city, current);
    }

    return Array.from(localityMap.values())
      .map((item) => ({
        locality: item.locality,
        date: item.date,
        amountA: roundToIntegerPeso(item.amountADec).toNumber(),
        amountX: roundToIntegerPeso(item.amountXDec).toNumber(),
      }))
      .sort((a, b) => a.locality.localeCompare(b.locality));
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
    const [y, m, d] = weekStart.split('-').map(Number);
    const prevMondayUtc = new Date(Date.UTC(y, m - 1, d - 7));
    const prevWeekStart = prevMondayUtc.toISOString().slice(0, 10);

    const prevReport = await prisma.weeklyReport.findUnique({
      where: { weekStart: prevWeekStart },
    });

    if (!prevReport) return 0;

    const salesList = (prevReport.sales as any[]) || [];
    const purchasesList = (prevReport.purchases as any[]) || [];

    const prevTotalSalesDec = salesList.reduce(
      (sum, s) => sum.plus(toDecimal(s.amountA || 0)).plus(toDecimal(s.amountX || 0)),
      new Decimal(0),
    );
    const prevActualPurchasesDec = purchasesList.reduce(
      (sum, p) => sum.plus(toDecimal(p.amount || 0)),
      new Decimal(0),
    );

    const prevCreditDec = toDecimal(prevReport.credit || 0);
    const prevBufferDec = toDecimal(prevReport.buffer || 0);

    return roundToIntegerPeso(
      prevActualPurchasesDec.plus(prevCreditDec).plus(prevBufferDec).minus(prevTotalSalesDec),
    ).toNumber();
  }
}

export const adminFinanceSubService = new AdminFinanceSubService();
