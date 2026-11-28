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
import {
  buildOperatingCreditNoteWhere,
  buildOperatingOrderWhere,
  resolveReportDateRange,
} from './admin-report.helpers';

export class AdminSellerMeetingSubService {
  /**
   * Ficha de Reunión por Vendedor: Decimal.js, rango AR (-03:00),
   * cobranzas reales de su cartera y descuento de Notas de Crédito aprobadas.
   */
  async getSellerMeetingPdfReportData(sellerId: number, startDateStr?: string, endDateStr?: string) {
    const resolved = resolveReportDateRange({
      startDate: startDateStr,
      endDate: endDateStr,
      defaultCurrentMonth: true,
    });
    const start = resolved.start!;
    const end = resolved.end!;

    const sellerUser = await prisma.user.findUnique({ where: { id: sellerId } });
    const sellerPersona = await prisma.persona.findFirst({
      where: {
        OR: [{ id: sellerId }, { name: { contains: sellerUser?.username || '', mode: 'insensitive' } }],
      },
    });

    const sellerName = sellerUser?.username
      ? sellerUser.username.toUpperCase()
      : sellerPersona?.name || `Vendedor #${sellerId}`;

    const [assignedClients, sellerOrders, sellerCreditNotes] = await Promise.all([
      prisma.persona.findMany({ where: { sellerId }, include: { saleRoute: true } }),
      prisma.order.findMany({
        where: {
          sellerId,
          status: OrderStatus.DELIVERED,
          createdAt: { gte: start, lte: end },
          AND: [buildOperatingOrderWhere()],
        },
        include: { persona: true, items: { include: { product: { include: { rubro: true } } } } },
      }),
      prisma.creditNote.findMany({
        where: {
          status: CreditNoteStatus.APPROVED,
          createdAt: { gte: start, lte: end },
          OR: [{ order: { sellerId } }, { orderId: null, persona: { sellerId } }],
          AND: [buildOperatingCreditNoteWhere()],
        },
        include: {
          order: { select: { items: { select: { productId: true, unitCostSnapshot: true } } } },
          items: { include: { product: { include: { rubro: true } } } },
        },
      }),
    ]);

    const totalClientsCount = assignedClients.length;
    let totalSalesDec = new Decimal(0);
    let totalCostDec = new Decimal(0);
    let totalBultos = 0;
    let officialSalesDec = new Decimal(0);
    let internalSalesDec = new Decimal(0);
    const buyingClientsSet = new Set<number>();
    const productSalesMap = new Map<
      number,
      { name: string; category: string; qtyDec: Decimal; amountDec: Decimal }
    >();

    for (const order of sellerOrders) {
      const orderAmtDec = roundToIntegerPeso(order.totalAmount || 0);
      totalSalesDec = totalSalesDec.plus(orderAmtDec);
      totalBultos += computeOrderRealBultos(order);
      if (order.personaId) buyingClientsSet.add(order.personaId);

      if (order.billingType === BillingType.OFFICIAL) officialSalesDec = officialSalesDec.plus(orderAmtDec);
      else internalSalesDec = internalSalesDec.plus(orderAmtDec);

      for (const item of order.items) {
        const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics(item);
        totalCostDec = totalCostDec.plus(itemCostDec);

        const cur = productSalesMap.get(item.productId) || {
          name: item.product.name,
          category: item.product.rubro?.name || 'Sin Categoría',
          qtyDec: new Decimal(0),
          amountDec: new Decimal(0),
        };
        cur.qtyDec = cur.qtyDec.plus(qtyDec);
        cur.amountDec = cur.amountDec.plus(itemRevenueDec);
        productSalesMap.set(item.productId, cur);
      }
    }

    for (const cn of sellerCreditNotes) {
      const cnAmtDec = roundToIntegerPeso(cn.totalAmount || 0);
      totalSalesDec = totalSalesDec.minus(cnAmtDec);
      if (cn.billingType === BillingType.OFFICIAL) officialSalesDec = officialSalesDec.minus(cnAmtDec);
      else internalSalesDec = internalSalesDec.minus(cnAmtDec);

      for (const item of cn.items) {
        const fallback = findFallbackCostSnapshot(cn.order?.items, item.productId);
        const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics({
          ...item,
          fallbackUnitCostSnapshot: fallback,
        });
        totalCostDec = totalCostDec.minus(itemCostDec);

        const cur = productSalesMap.get(item.productId);
        if (cur) {
          cur.qtyDec = cur.qtyDec.minus(qtyDec);
          cur.amountDec = cur.amountDec.minus(itemRevenueDec);
        }
      }
    }

    const activeBuyingClientsCount = buyingClientsSet.size;
    const portfolioCoveragePct = computeMarginPercent(
      toDecimal(activeBuyingClientsCount),
      toDecimal(totalClientsCount),
      0,
    );
    const averageTicketPerClient =
      activeBuyingClientsCount > 0
        ? roundToIntegerPeso(totalSalesDec.dividedBy(activeBuyingClientsCount)).toNumber()
        : 0;

    const clientIds = assignedClients.map((c) => c.id);
    const [sellerCollections, carteraDebtAggregate] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.INCOME,
          voidedAt: null,
          createdAt: { gte: start, lte: end },
          OR:
            clientIds.length > 0
              ? [{ personaId: { in: clientIds } }, { userId: sellerId, personaId: null }]
              : [{ userId: sellerId }],
        },
        _sum: { amount: true },
      }),
      prisma.persona.aggregate({
        where: { id: { in: clientIds }, outstandingBalance: { gt: 0 } },
        _sum: { outstandingBalance: true },
      }),
    ]);

    const totalCollected = roundToIntegerPeso(sellerCollections._sum.amount ?? 0).toNumber();
    const totalCarteraDebt = roundToIntegerPeso(carteraDebtAggregate._sum?.outstandingBalance ?? 0).toNumber();

    const inactiveClients = assignedClients
      .filter((c) => !buyingClientsSet.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: normalizeCity(c.city || c.route),
        balance: roundToIntegerPeso(c.outstandingBalance || 0).toNumber(),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    const debtorClients = assignedClients
      .filter((c) => Number(c.outstandingBalance || 0) > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: normalizeCity(c.city || c.route),
        balance: roundToIntegerPeso(c.outstandingBalance || 0).toNumber(),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 8);

    const topProducts = Array.from(productSalesMap.values())
      .filter((p) => p.amountDec.gt(0))
      .map((p) => ({
        name: p.name,
        category: p.category,
        quantity: roundToThreeDecimalsWeight(p.qtyDec).toNumber(),
        amount: roundToIntegerPeso(p.amountDec).toNumber(),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const actionInsights: Array<{ type: 'warning' | 'opportunity' | 'success'; title: string; description: string }> = [];
    if (portfolioCoveragePct < 60) {
      actionInsights.push({
        type: 'warning',
        title: 'Baja Cobertura de Cartera',
        description: `Solo el ${portfolioCoveragePct}% de los clientes asignados (${activeBuyingClientsCount} de ${totalClientsCount}) realizaron compras en el período. Hay ${inactiveClients.length} clientes inactivos para revisar.`,
      });
    } else {
      actionInsights.push({
        type: 'success',
        title: 'Buena Cobertura de Cartera',
        description: `El vendedor registró ventas en el ${portfolioCoveragePct}% de su cartera (${activeBuyingClientsCount} clientes).`,
      });
    }

    if (totalCarteraDebt > 2000000) {
      actionInsights.push({
        type: 'warning',
        title: 'Deuda Acumulada en Cartera',
        description: `Los clientes asignados acumulan $${totalCarteraDebt.toLocaleString('es-AR')} en cuenta corriente. Revisar prioridad de cobranza antes de autorizar nuevos créditos.`,
      });
    }

    if (inactiveClients.length > 0) {
      actionInsights.push({
        type: 'opportunity',
        title: 'Recuperación de Clientes Inactivos',
        description: `Identificados ${inactiveClients.length} clientes principales que no compraron este período. Planificar visitas en ruta para reactivar pedidos.`,
      });
    }

    const grossProfitDec = totalSalesDec.minus(totalCostDec);

    return {
      seller: { id: sellerId, name: sellerName, totalAssignedClients: totalClientsCount },
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        startDateIso: resolved.startDateIso,
        endDateIso: resolved.endDateIso,
      },
      performance: {
        totalSales: roundToIntegerPeso(totalSalesDec).toNumber(),
        totalCost: roundToIntegerPeso(totalCostDec).toNumber(),
        grossProfit: roundToIntegerPeso(grossProfitDec).toNumber(),
        grossMarginPct: computeMarginPercent(grossProfitDec, totalSalesDec, 0),
        totalOrders: sellerOrders.length,
        totalBultos,
        activeBuyingClientsCount,
        portfolioCoveragePct,
        averageTicketPerClient,
        officialSales: roundToIntegerPeso(officialSalesDec).toNumber(),
        internalSales: roundToIntegerPeso(internalSalesDec).toNumber(),
      },
      collections: { totalCollected, totalCarteraDebt },
      topProducts,
      inactiveClients,
      debtorClients,
      actionInsights,
    };
  }
}

export const adminSellerMeetingSubService = new AdminSellerMeetingSubService();
