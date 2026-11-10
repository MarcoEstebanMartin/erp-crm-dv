import prisma from '../../utils/prisma';
import { BillingType, TransactionType, OrderStatus } from '@prisma/client';
import { normalizeCity, resolveOrderItemHistoricalCost } from './admin-report.helpers';

export class AdminSellerMeetingSubService {
  /**
   * Obtener datos para el Reporte de Reunión por Vendedor usando unitCostSnapshot (CMV histórico real).
   */
  async getSellerMeetingPdfReportData(sellerId: number, startDateStr?: string, endDateStr?: string) {
    let start: Date;
    let end: Date;

    if (startDateStr && endDateStr) {
      start = new Date(startDateStr);
      end = new Date(endDateStr);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const sellerUser = await prisma.user.findUnique({ where: { id: sellerId } });
    const sellerPersona = await prisma.persona.findFirst({
      where: {
        OR: [{ id: sellerId }, { name: { contains: sellerUser?.username || '', mode: 'insensitive' } }],
      },
    });

    const sellerName = sellerUser?.username
      ? sellerUser.username.toUpperCase()
      : sellerPersona?.name || `Vendedor #${sellerId}`;

    const [assignedClients, sellerOrders] = await Promise.all([
      prisma.persona.findMany({
        where: { sellerId },
        include: { saleRoute: true },
      }),
      prisma.order.findMany({
        where: {
          sellerId,
          status: OrderStatus.DELIVERED,
          createdAt: { gte: start, lte: end },
        },
        include: {
          persona: true,
          items: { include: { product: { include: { rubro: true } } } },
        },
      }),
    ]);

    const totalClientsCount = assignedClients.length;

    let totalSales = 0;
    let totalCost = 0;
    let totalBultos = 0;
    let officialSales = 0;
    let internalSales = 0;
    const buyingClientsSet = new Set<number>();
    const productSalesMap: Record<number, { name: string; category: string; quantity: number; amount: number }> = {};

    sellerOrders.forEach((order) => {
      const orderAmt = Number(order.totalAmount) || 0;
      totalSales += orderAmt;
      if (order.personaId) buyingClientsSet.add(order.personaId);

      if (order.billingType === BillingType.OFFICIAL) {
        officialSales += orderAmt;
      } else {
        internalSales += orderAmt;
      }

      order.items.forEach((item) => {
        const { itemRevenue, itemCost } = resolveOrderItemHistoricalCost(item);
        totalCost += itemCost;
        totalBultos += item.quantity;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.product.name,
            category: item.product.rubro?.name || 'Sin Categoría',
            quantity: 0,
            amount: 0,
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].amount += itemRevenue;
      });
    });

    const activeBuyingClientsCount = buyingClientsSet.size;
    const portfolioCoveragePct =
      totalClientsCount > 0 ? Math.round((activeBuyingClientsCount / totalClientsCount) * 100) : 0;
    const averageTicketPerClient =
      activeBuyingClientsCount > 0 ? Math.round(totalSales / activeBuyingClientsCount) : 0;

    const clientIds = assignedClients.map((c) => c.id);
    const [sellerCollections, carteraDebtAggregate] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId: sellerId,
          type: TransactionType.INCOME,
          createdAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.persona.aggregate({
        where: { id: { in: clientIds }, outstandingBalance: { gt: 0 } },
        _sum: { outstandingBalance: true },
      }),
    ]);

    const totalCollected = Math.round(Number(sellerCollections._sum.amount || 0));
    const totalCarteraDebt = Math.round(Number(carteraDebtAggregate._sum?.outstandingBalance || 0));

    const inactiveClients = assignedClients
      .filter((c) => !buyingClientsSet.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: normalizeCity(c.city || c.route),
        balance: Math.round(Number(c.outstandingBalance || 0)),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    const debtorClients = assignedClients
      .filter((c) => Number(c.outstandingBalance || 0) > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        city: normalizeCity(c.city || c.route),
        balance: Math.round(Number(c.outstandingBalance || 0)),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 8);

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map((p) => ({ ...p, amount: Math.round(p.amount) }));

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

    const grossProfit = totalSales - totalCost;
    const grossMarginPct = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;

    return {
      seller: { id: sellerId, name: sellerName, totalAssignedClients: totalClientsCount },
      period: { startDate: start.toISOString(), endDate: end.toISOString() },
      performance: {
        totalSales: Math.round(totalSales),
        totalCost: Math.round(totalCost),
        grossProfit: Math.round(grossProfit),
        grossMarginPct,
        totalOrders: sellerOrders.length,
        totalBultos,
        activeBuyingClientsCount,
        portfolioCoveragePct,
        averageTicketPerClient,
        officialSales: Math.round(officialSales),
        internalSales: Math.round(internalSales),
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
