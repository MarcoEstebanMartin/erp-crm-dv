import prisma from '../../utils/prisma';
import { MAIN_CITIES } from './admin-report.helpers';

export class AdminZonesSubService {
  /**
   * Obtener reportes y recomendaciones comerciales por Zonas.
   */
  async getZoneReports(filters: {
    sellerId?: number;
    city?: string;
    cities?: string[];
    startDate?: string;
    endDate?: string;
  }) {
    const whereClause: any = { isClient: true };
    if (filters.sellerId) whereClause.sellerId = filters.sellerId;
    if (filters.cities && filters.cities.length > 0) {
      whereClause.city = { in: filters.cities };
    } else if (filters.city && filters.city.trim() !== '') {
      whereClause.city = { contains: filters.city, mode: 'insensitive' };
    }

    const clients = await prisma.persona.findMany({
      where: whereClause,
      include: { seller: { select: { id: true, username: true } } },
      orderBy: { city: 'asc' },
    });

    const totalClients = clients.length;
    const totalDebt = clients.reduce((acc, curr) => acc + Number(curr.outstandingBalance || 0), 0);

    const orderWhereClause: any = { status: 'DELIVERED' };
    if (filters.cities && filters.cities.length > 0) {
      orderWhereClause.persona = { city: { in: filters.cities } };
    } else if (filters.city && filters.city.trim() !== '') {
      orderWhereClause.persona = { city: { contains: filters.city, mode: 'insensitive' } };
    }
    if (filters.sellerId) {
      if (!orderWhereClause.persona) orderWhereClause.persona = {};
      orderWhereClause.persona.sellerId = filters.sellerId;
    }
    if (filters.startDate || filters.endDate) {
      orderWhereClause.createdAt = {};
      if (filters.startDate) orderWhereClause.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        orderWhereClause.createdAt.lte = end;
      }
    }

    const orders = await prisma.order.findMany({
      where: orderWhereClause,
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
                rubroId: true,
                rubro: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const clientMap = new Map<
      number,
      { id: number; name: string; city: string; sellerName: string; totalSpent: number; ordersCount: number }
    >();
    const productMap = new Map<
      number,
      { id: number; sku: string; name: string; qty: number; revenue: number; rubroId: number | null; rubroName: string }
    >();
    const weeklyMap = new Map<string, { weekStart: string; dateObj: Date; total: number; count: number }>();
    const weeklyRubroMap = new Map<string, Map<string, number>>();
    const rubrosAccumulatedMap = new Map<string, { id: number | null; name: string; totalSales: number; itemsCount: number }>();
    const clientRubroMap = new Map<number, Map<string, number>>();

    for (const order of orders) {
      const totalAmount = Number(order.totalAmount) || 0;
      const clientId = order.personaId;

      const clientData = clientMap.get(clientId) || {
        id: clientId,
        name: order.persona.name,
        city: order.persona.city || 'Sin especificar',
        sellerName: order.persona.seller?.username || 'Sin preventista',
        totalSpent: 0,
        ordersCount: 0,
      };
      clientData.totalSpent += totalAmount;
      clientData.ordersCount += 1;
      clientMap.set(clientId, clientData);

      const orderDate = new Date(order.createdAt);
      const day = orderDate.getDay();
      const diff = orderDate.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(orderDate.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const weekKey = monday.toISOString().split('T')[0];

      const weekData = weeklyMap.get(weekKey) || { weekStart: weekKey, dateObj: monday, total: 0, count: 0 };
      weekData.total += totalAmount;
      weekData.count += 1;
      weeklyMap.set(weekKey, weekData);

      let clientRubro = clientRubroMap.get(clientId);
      if (!clientRubro) {
        clientRubro = new Map<string, number>();
        clientRubroMap.set(clientId, clientRubro);
      }

      for (const item of order.items) {
        const prodId = item.productId;
        const qty = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
        const subtotal = Number(item.subtotal) || 0;
        const rubroName = item.product.rubro?.name || 'VARIOS';
        const rubroId = item.product.rubroId || null;

        const prodData = productMap.get(prodId) || {
          id: prodId,
          sku: item.product.sku,
          name: item.product.name,
          qty: 0,
          revenue: 0,
          rubroId,
          rubroName,
        };
        prodData.qty += qty;
        prodData.revenue += subtotal;
        productMap.set(prodId, prodData);

        let weekRubro = weeklyRubroMap.get(weekKey);
        if (!weekRubro) {
          weekRubro = new Map<string, number>();
          weeklyRubroMap.set(weekKey, weekRubro);
        }
        weekRubro.set(rubroName, (weekRubro.get(rubroName) || 0) + subtotal);

        const rAcc = rubrosAccumulatedMap.get(rubroName) || {
          id: rubroId,
          name: rubroName,
          totalSales: 0,
          itemsCount: 0,
        };
        rAcc.totalSales += subtotal;
        rAcc.itemsCount += 1;
        rubrosAccumulatedMap.set(rubroName, rAcc);

        clientRubro.set(rubroName, (clientRubro.get(rubroName) || 0) + subtotal);
      }
    }

    const clientsWithMovements = Array.from(clientMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
    const topClients = clientsWithMovements.slice(0, 10);
    const topProducts = Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
    const bottomProducts = Array.from(productMap.values()).sort((a, b) => a.qty - b.qty).slice(0, 10);

    const weeklyInvoicing = Array.from(weeklyMap.values())
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map((w) => {
        const weekRubro = weeklyRubroMap.get(w.weekStart);
        const rubrosBreakdown: { [name: string]: number } = {};
        if (weekRubro) {
          for (const [rName, amount] of weekRubro.entries()) rubrosBreakdown[rName] = Math.round(amount);
        }
        return { weekStart: w.weekStart, total: w.total, count: w.count, rubros: rubrosBreakdown };
      });

    const totalInvoicedInZone = weeklyInvoicing.reduce((sum, w) => sum + w.total, 0);

    const rubroMetrics = Array.from(rubrosAccumulatedMap.values())
      .map((r) => {
        const weekSales = weeklyInvoicing.map((w) => w.rubros[r.name] || 0);
        let trend = 0;
        if (weekSales.length > 1) {
          const half = Math.floor(weekSales.length / 2);
          const avg1 = weekSales.slice(0, half).reduce((s, v) => s + v, 0) / half;
          const avg2 = weekSales.slice(half).reduce((s, v) => s + v, 0) / (weekSales.length - half);
          trend = avg1 > 0 ? Math.round(((avg2 - avg1) / avg1) * 100) : 0;
        }
        const topProdsInRubro = Array.from(productMap.values())
          .filter((p) => p.rubroName === r.name)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3)
          .map((p) => ({ id: p.id, sku: p.sku, name: p.name, qty: p.qty, revenue: Math.round(p.revenue) }));

        return {
          id: r.id,
          name: r.name,
          totalSales: Math.round(r.totalSales),
          percentageOfTotal: totalInvoicedInZone > 0 ? Math.round((r.totalSales / totalInvoicedInZone) * 100) : 0,
          trend,
          topProducts: topProdsInRubro,
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales);

    const [sellers, activeProducts] = await Promise.all([
      prisma.user.findMany({ where: { role: 'VENDEDOR' }, select: { id: true, username: true } }),
      prisma.product.findMany({
        where: { stock: { gt: 0 } },
        select: { id: true, sku: true, name: true, stock: true, rubro: { select: { name: true } } },
      }),
    ]);

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

    return {
      totalClients,
      totalDebt,
      clients,
      availableCities: [...MAIN_CITIES, 'OTRAS'].sort(),
      availableSellers: sellers,
      topClients,
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
