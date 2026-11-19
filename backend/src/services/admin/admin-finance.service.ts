import prisma from '../../utils/prisma';
import { CreditNoteStatus, OrderStatus, TransactionType } from '@prisma/client';
import { computeFinancialSummaryMetrics } from '../../engines/reports-core.engine';
import { resolveReportDateRange } from './admin-report.helpers';

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
            persona: { select: { city: true } },
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
            persona: { select: { city: true } },
            order: {
              select: {
                deliveryMethod: true,
                salesChannel: true,
                deliveryRouteId: true,
                persona: { select: { city: true } },
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
}

export const adminFinanceSubService = new AdminFinanceSubService();
