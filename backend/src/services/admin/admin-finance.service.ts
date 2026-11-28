import prisma from '../../utils/prisma';
import { CreditNoteStatus, OrderStatus, TransactionType } from '@prisma/client';
import { computeFinancialSummaryMetrics } from '../../engines/reports-core.engine';
import { buildCitySalesDetail } from '../../engines/reports-city-sales.engine';
import {
  buildOperatingCreditNoteWhere,
  buildOperatingOrderWhere,
  resolveReportDateRange,
} from './admin-report.helpers';
import { REPORT_FINANCE_TTL_SECONDS, withReportCache } from './admin-report-cache.helper';

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

    const { range, startDateIso, endDateIso } = resolveReportDateRange({
      startDate: params.startDate,
      endDate: params.endDate,
      year: params.year,
      month: params.month,
      defaultCurrentMonth: true,
    });

    return withReportCache(
      'finance',
      { startDate: startDateIso, endDate: endDateIso },
      REPORT_FINANCE_TTL_SECONDS,
      async () => {
        const [deliveredOrders, creditNotes, transactionsGrouped, paymentMethodsGrouped, expenses] =
          await Promise.all([
            prisma.order.findMany({
              where: {
                status: OrderStatus.DELIVERED,
                ...(range ? { createdAt: range } : {}),
                AND: [buildOperatingOrderWhere()],
              },
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
              where: {
                status: CreditNoteStatus.APPROVED,
                ...(range ? { createdAt: range } : {}),
                AND: [buildOperatingCreditNoteWhere()],
              },
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
              where: { ...(range ? { createdAt: range } : {}), voidedAt: null },
              _sum: { amount: true },
            }),
            prisma.transaction.groupBy({
              by: ['billingType', 'paymentMethod'],
              where: { ...(range ? { createdAt: range } : {}), type: TransactionType.INCOME, voidedAt: null },
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
      },
    );
  }

  /**
   * Detalle minimalista de ventas y notas de crédito aprobadas dentro de una localidad.
   * Reutiliza los mismos filtros operativos y reglas de redondeo que getFinancialReports.
   */
  async getCitySalesDetail(params: {
    city: string;
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const { range, startDateIso, endDateIso } = resolveReportDateRange({
      startDate: params.startDate,
      endDate: params.endDate,
      year: params.year,
      month: params.month,
      defaultCurrentMonth: true,
    });

    return withReportCache(
      'finance',
      {
        scope: 'city-detail',
        city: params.city.trim(),
        startDate: startDateIso,
        endDate: endDateIso,
      },
      REPORT_FINANCE_TTL_SECONDS,
      async () => {
        const [deliveredOrders, creditNotes] = await Promise.all([
          prisma.order.findMany({
            where: {
              status: OrderStatus.DELIVERED,
              ...(range ? { createdAt: range } : {}),
              AND: [buildOperatingOrderWhere()],
            },
            select: {
              id: true,
              movementId: true,
              createdAt: true,
              billingType: true,
              invoiceType: true,
              invoiceNumber: true,
              totalAmount: true,
              persona: { select: { id: true, name: true, city: true } },
              items: {
                select: {
                  quantity: true,
                  weight: true,
                  unitPrice: true,
                  subtotal: true,
                  product: { select: { isPesable: true } },
                },
              },
            },
          }),
          prisma.creditNote.findMany({
            where: {
              status: CreditNoteStatus.APPROVED,
              ...(range ? { createdAt: range } : {}),
              AND: [buildOperatingCreditNoteWhere()],
            },
            select: {
              id: true,
              movementId: true,
              createdAt: true,
              billingType: true,
              creditNoteType: true,
              creditNoteNumber: true,
              totalAmount: true,
              persona: { select: { id: true, name: true, city: true } },
              order: {
                select: {
                  persona: { select: { id: true, name: true, city: true } },
                },
              },
              items: {
                select: {
                  quantity: true,
                  weight: true,
                  unitPrice: true,
                  subtotal: true,
                  product: { select: { isPesable: true } },
                },
              },
            },
          }),
        ]);

        return buildCitySalesDetail({
          city: params.city,
          orders: deliveredOrders,
          creditNotes,
        });
      },
    );
  }
}

export const adminFinanceSubService = new AdminFinanceSubService();
