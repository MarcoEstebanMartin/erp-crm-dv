import prisma from '../../utils/prisma';
import { CreditNoteStatus, OrderStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, roundToThreeDecimalsWeight, sumIntegerAmounts } from '../../core/money';
import {
  computeMarginPercent,
  findFallbackCostSnapshot,
  MAIN_CITIES,
  resolveCreditNoteCommercialRevenueDec,
  resolveItemHistoricalMetrics,
  resolveOrderCommercialRevenueDec,
} from '../../engines/reports-core.engine';
import { getArgentinaWeekMondayIso, resolveReportDateRange } from './admin-report.helpers';

export class AdminZonesSubService {
  /**
   * Reportes comerciales por Zonas: Decimal.js, semanas en hora AR (-03:00),
   * rangos completos (-03:00) y descuento de Notas de Crédito aprobadas.
   */
  async getZoneReports(filters: {
    sellerId?: number;
    city?: string;
    cities?: string[];
    startDate?: string;
    endDate?: string;
  }) {
    const whereClause: any = { isClient: true };
    const personaFilter: any = {};

    if (filters.sellerId) {
      whereClause.sellerId = filters.sellerId;
      personaFilter.sellerId = filters.sellerId;
    }
    if (filters.cities && filters.cities.length > 0) {
      whereClause.city = { in: filters.cities };
      personaFilter.city = { in: filters.cities };
    } else if (filters.city && filters.city.trim() !== '') {
      whereClause.city = { contains: filters.city, mode: 'insensitive' };
      personaFilter.city = { contains: filters.city, mode: 'insensitive' };
    }

    const createdAtRange =
      filters.startDate || filters.endDate
        ? resolveReportDateRange({ startDate: filters.startDate, endDate: filters.endDate }).range
        : undefined;

    const commonWhere: any = {
      ...(Object.keys(personaFilter).length > 0 ? { persona: personaFilter } : {}),
      ...(createdAtRange ? { createdAt: createdAtRange } : {}),
    };

    const [clients, orders, creditNotes, sellers, activeProducts] = await Promise.all([
      prisma.persona.findMany({
        where: whereClause,
        include: { seller: { select: { id: true, username: true } } },
        orderBy: { city: 'asc' },
      }),
      prisma.order.findMany({
        where: { status: OrderStatus.DELIVERED, ...commonWhere },
        include: {
          persona: {
            select: {
              id: true,
              name: true,
              city: true,
              route: true,
              saleRoute: { select: { id: true, name: true } },
              seller: { select: { id: true, username: true } },
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  isPesable: true,
                  costPrice: true,
                  rubroId: true,
                  rubro: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.creditNote.findMany({
        where: { status: CreditNoteStatus.APPROVED, ...commonWhere },
        include: {
          persona: {
            select: {
              id: true,
              name: true,
              city: true,
              seller: { select: { id: true, username: true } },
            },
          },
          order: {
            select: {
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
                  isPesable: true,
                  costPrice: true,
                  rubroId: true,
                  rubro: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.user.findMany({ where: { role: 'VENDEDOR' }, select: { id: true, username: true } }),
      prisma.product.findMany({
        where: { stock: { gt: 0 } },
        select: { id: true, sku: true, name: true, stock: true, rubro: { select: { name: true } } },
      }),
    ]);

    const totalClients = clients.length;
    const totalDebt = roundToIntegerPeso(
      clients.reduce((acc, curr) => acc.plus(curr.outstandingBalance || 0), new Decimal(0)),
    ).toNumber();

    const clientMap = new Map<
      number,
      { id: number; name: string; city: string; sellerName: string; totalSpentDec: Decimal; ordersCount: number }
    >();
    const productMap = new Map<
      number,
      { id: number; sku: string; name: string; qtyDec: Decimal; revenueDec: Decimal; rubroId: number | null; rubroName: string }
    >();
    const weeklyMap = new Map<string, { weekStart: string; totalDec: Decimal; count: number }>();
    const weeklyRubroMap = new Map<string, Map<string, Decimal>>();
    const rubrosAccumulatedMap = new Map<string, { id: number | null; name: string; totalSalesDec: Decimal; itemsCount: number }>();
    let totalZoneRevenueDec = new Decimal(0);
    let totalZoneCostDec = new Decimal(0);

    for (const order of orders) {
      const totalAmtDec = resolveOrderCommercialRevenueDec(order);
      totalZoneRevenueDec = totalZoneRevenueDec.plus(totalAmtDec);
      const clientId = order.personaId;

      const clientData = clientMap.get(clientId) || {
        id: clientId,
        name: order.persona.name,
        city: order.persona.city || 'Sin especificar',
        sellerName: order.persona.seller?.username || 'Sin preventista',
        totalSpentDec: new Decimal(0),
        ordersCount: 0,
      };
      clientData.totalSpentDec = clientData.totalSpentDec.plus(totalAmtDec);
      clientData.ordersCount += 1;
      clientMap.set(clientId, clientData);

      const weekKey = getArgentinaWeekMondayIso(order.createdAt);
      const weekData = weeklyMap.get(weekKey) || { weekStart: weekKey, totalDec: new Decimal(0), count: 0 };
      weekData.totalDec = weekData.totalDec.plus(totalAmtDec);
      weekData.count += 1;
      weeklyMap.set(weekKey, weekData);

      let weekRubro = weeklyRubroMap.get(weekKey);
      if (!weekRubro) {
        weekRubro = new Map<string, Decimal>();
        weeklyRubroMap.set(weekKey, weekRubro);
      }

      for (const item of order.items) {
        const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics(item);
        totalZoneCostDec = totalZoneCostDec.plus(itemCostDec);
        const rubroName = item.product.rubro?.name || 'VARIOS';
        const rubroId = item.product.rubroId || null;

        const prodData = productMap.get(item.productId) || {
          id: item.productId,
          sku: item.product.sku,
          name: item.product.name,
          qtyDec: new Decimal(0),
          revenueDec: new Decimal(0),
          rubroId,
          rubroName,
        };
        prodData.qtyDec = prodData.qtyDec.plus(qtyDec);
        prodData.revenueDec = prodData.revenueDec.plus(itemRevenueDec);
        productMap.set(item.productId, prodData);

        weekRubro.set(rubroName, (weekRubro.get(rubroName) || new Decimal(0)).plus(itemRevenueDec));

        const rAcc = rubrosAccumulatedMap.get(rubroName) || {
          id: rubroId,
          name: rubroName,
          totalSalesDec: new Decimal(0),
          itemsCount: 0,
        };
        rAcc.totalSalesDec = rAcc.totalSalesDec.plus(itemRevenueDec);
        rAcc.itemsCount += 1;
        rubrosAccumulatedMap.set(rubroName, rAcc);
      }
    }

    for (const cn of creditNotes) {
      const cnAmtDec = resolveCreditNoteCommercialRevenueDec(cn);
      totalZoneRevenueDec = totalZoneRevenueDec.minus(cnAmtDec);
      const clientData = clientMap.get(cn.personaId);
      if (clientData) {
        clientData.totalSpentDec = clientData.totalSpentDec.minus(cnAmtDec);
      }

      const weekKey = getArgentinaWeekMondayIso(cn.createdAt);
      const weekData = weeklyMap.get(weekKey);
      if (weekData) {
        weekData.totalDec = weekData.totalDec.minus(cnAmtDec);
      }
      const weekRubro = weeklyRubroMap.get(weekKey);

      for (const item of cn.items) {
        const fallback = findFallbackCostSnapshot(cn.order?.items, item.productId);
        const { qtyDec, itemRevenueDec, itemCostDec } = resolveItemHistoricalMetrics({
          ...item,
          fallbackUnitCostSnapshot: fallback,
        });
        totalZoneCostDec = totalZoneCostDec.minus(itemCostDec);
        const rubroName = item.product.rubro?.name || 'VARIOS';

        const prodData = productMap.get(item.productId);
        if (prodData) {
          prodData.qtyDec = prodData.qtyDec.minus(qtyDec);
          prodData.revenueDec = prodData.revenueDec.minus(itemRevenueDec);
        }

        if (weekRubro) {
          weekRubro.set(rubroName, (weekRubro.get(rubroName) || new Decimal(0)).minus(itemRevenueDec));
        }

        const rAcc = rubrosAccumulatedMap.get(rubroName);
        if (rAcc) {
          rAcc.totalSalesDec = rAcc.totalSalesDec.minus(itemRevenueDec);
        }
      }
    }

    const clientsWithMovements = Array.from(clientMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: c.city,
        sellerName: c.sellerName,
        totalSpent: roundToIntegerPeso(c.totalSpentDec).toNumber(),
        ordersCount: c.ordersCount,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const formattedProducts = Array.from(productMap.values()).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      qty: roundToThreeDecimalsWeight(p.qtyDec).toNumber(),
      revenue: roundToIntegerPeso(p.revenueDec).toNumber(),
      rubroId: p.rubroId,
      rubroName: p.rubroName,
    }));

    const activeSoldProducts = formattedProducts.filter((p) => p.qty > 0);
    const topProducts = [...activeSoldProducts].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const bottomProducts = [...activeSoldProducts].sort((a, b) => a.qty - b.qty).slice(0, 10);

    const weeklyInvoicing = Array.from(weeklyMap.values())
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
      .map((w) => {
        const weekRubro = weeklyRubroMap.get(w.weekStart);
        const rubrosBreakdown: { [name: string]: number } = {};
        if (weekRubro) {
          for (const [rName, amtDec] of weekRubro.entries()) {
            rubrosBreakdown[rName] = roundToIntegerPeso(amtDec).toNumber();
          }
        }
        return {
          weekStart: w.weekStart,
          total: roundToIntegerPeso(w.totalDec).toNumber(),
          count: w.count,
          rubros: rubrosBreakdown,
        };
      });

    const totalInvoicedInZoneDec = weeklyInvoicing.reduce((sum, w) => sum.plus(w.total), new Decimal(0));

    const rubroMetrics = Array.from(rubrosAccumulatedMap.values())
      .map((r) => {
        const weekSales = weeklyInvoicing.map((w) => w.rubros[r.name] || 0);
        let trend = 0;
        if (weekSales.length > 1) {
          const half = Math.floor(weekSales.length / 2);
          const avg1Dec = sumIntegerAmounts(weekSales.slice(0, half)).dividedBy(half);
          const avg2Dec = sumIntegerAmounts(weekSales.slice(half)).dividedBy(weekSales.length - half);
          trend = avg1Dec.gt(0) ? computeMarginPercent(avg2Dec.minus(avg1Dec), avg1Dec, 0) : 0;
        }
        const topProdsInRubro = formattedProducts
          .filter((p) => p.rubroName === r.name && p.revenue > 0)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3)
          .map((p) => ({ id: p.id, sku: p.sku, name: p.name, qty: p.qty, revenue: p.revenue }));

        return {
          id: r.id,
          name: r.name,
          totalSales: roundToIntegerPeso(r.totalSalesDec).toNumber(),
          percentageOfTotal: computeMarginPercent(r.totalSalesDec, totalInvoicedInZoneDec, 0),
          trend,
          topProducts: topProdsInRubro,
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales);

    const deadStockProducts = activeProducts
      .filter((p) => !productMap.has(p.id))
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        rubroName: p.rubro?.name || 'VARIOS',
        qty: 0,
        revenue: 0,
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10);

    const zoneGrossProfitDec = totalZoneRevenueDec.minus(totalZoneCostDec);

    return {
      totalClients,
      totalDebt,
      profitability: {
        totalRevenue: roundToIntegerPeso(totalZoneRevenueDec).toNumber(),
        totalCost: roundToIntegerPeso(totalZoneCostDec).toNumber(),
        grossProfit: roundToIntegerPeso(zoneGrossProfitDec).toNumber(),
        grossMarginPct: computeMarginPercent(zoneGrossProfitDec, totalZoneRevenueDec, 2),
      },
      clients,
      availableCities: [...MAIN_CITIES, 'OTRAS'].sort(),
      availableSellers: sellers,
      topClients: clientsWithMovements.slice(0, 5),
      clientsWithMovements,
      topProducts,
      bottomProducts,
      weeklyInvoicing,
      rubroMetrics,
      salesRecommendations: [],
      deadStockProducts,
    };
  }
}

export const adminZonesSubService = new AdminZonesSubService();
