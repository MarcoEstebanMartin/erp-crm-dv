import prisma from '../../utils/prisma';
import { CreditNoteStatus, OrderStatus } from '@prisma/client';
import { computeLocalSalesReport } from '../../engines/reports-local-sales.engine';
import { resolveReportDateRange } from './admin-report.helpers';

export class AdminChannelsSubService {
  /**
   * Estadísticas reales por modalidad (Local/Depósito vs Reparto en Ruta) usando
   * DeliveryMethod, Decimal.js, rangos horarios AR (-03:00) y descuento de Notas de Crédito aprobadas.
   */
  async getSalesChannelStats(
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
    });

    const createdAtFilter = range ? { createdAt: range } : {};

    const [orders, creditNotes] = await Promise.all([
      prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, ...createdAtFilter },
        include: {
          persona: { select: { id: true, name: true, city: true } },
          seller: { select: { id: true, username: true } },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  imageUrl: true,
                  costPrice: true,
                  commercialCategory: true,
                  isPesable: true,
                },
              },
            },
          },
          transactions: {
            select: { id: true, type: true, paymentMethod: true, amount: true, cashDrawerId: true },
          },
        },
      }),
      prisma.creditNote.findMany({
        where: { status: CreditNoteStatus.APPROVED, ...createdAtFilter },
        include: {
          order: {
            select: {
              id: true,
              deliveryMethod: true,
              salesChannel: true,
              deliveryRouteId: true,
              items: { select: { productId: true, unitCostSnapshot: true } },
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  imageUrl: true,
                  costPrice: true,
                  commercialCategory: true,
                  isPesable: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const report = computeLocalSalesReport({ orders, creditNotes });

    return {
      period: {
        year: params.year,
        month: params.month,
        startDate: startDateIso,
        endDate: endDateIso,
      },
      ...report,
    };
  }
}

export const adminChannelsSubService = new AdminChannelsSubService();
