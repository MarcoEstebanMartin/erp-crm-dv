import prisma from '../../utils/prisma';
import { BillingType, CreditNoteStatus, OrderStatus } from '@prisma/client';
import { computeProfitabilityMetrics } from '../../engines/reports-profitability.engine';
import { resolveReportDateRange } from './admin-report.helpers';

export class AdminProfitabilitySubService {
  /**
   * Obtener reporte de rentabilidad por Clientes y Productos usando Decimal.js,
   * unitCostSnapshot histórico inmutable y Notas de Crédito aprobadas con todos los filtros.
   */
  async getProfitabilityReport(filters: {
    startDate?: string;
    endDate?: string;
    sellerId?: number;
    city?: string;
    rubroId?: number;
    billingType?: string;
  }) {
    const { range } = resolveReportDateRange({
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const billingFilter =
      filters.billingType && filters.billingType !== 'ALL'
        ? { billingType: filters.billingType as BillingType }
        : {};

    const whereOrder: any = {
      status: OrderStatus.DELIVERED,
      ...(range ? { createdAt: range } : {}),
      ...(filters.sellerId ? { sellerId: Number(filters.sellerId) } : {}),
      ...billingFilter,
    };

    const whereCreditNote: any = {
      status: CreditNoteStatus.APPROVED,
      ...(range ? { createdAt: range } : {}),
      ...billingFilter,
    };

    const [orders, creditNotes] = await Promise.all([
      prisma.order.findMany({
        where: whereOrder,
        include: {
          persona: {
            select: {
              id: true,
              name: true,
              city: true,
              sellerId: true,
              seller: { select: { username: true } },
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  costPrice: true,
                  profitMargin: true,
                  isPesable: true,
                  rubroId: true,
                  rubro: { select: { id: true, name: true, profitMargin: true } },
                },
              },
            },
          },
        },
      }),
      prisma.creditNote.findMany({
        where: whereCreditNote,
        include: {
          persona: {
            select: {
              id: true,
              name: true,
              city: true,
              sellerId: true,
              seller: { select: { username: true } },
            },
          },
          order: {
            select: {
              id: true,
              sellerId: true,
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
                  costPrice: true,
                  profitMargin: true,
                  isPesable: true,
                  rubroId: true,
                  rubro: { select: { id: true, name: true, profitMargin: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return computeProfitabilityMetrics({ orders, creditNotes, filters });
  }
}

export const adminProfitabilitySubService = new AdminProfitabilitySubService();
