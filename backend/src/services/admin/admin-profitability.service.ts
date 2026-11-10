import prisma from '../../utils/prisma';
import { normalizeCity, resolveOrderItemHistoricalCost } from './admin-report.helpers';

export class AdminProfitabilitySubService {
  /**
   * Obtener reporte de rentabilidad por Clientes y Productos usando unitCostSnapshot (CMV histórico inmutable).
   */
  async getProfitabilityReport(filters: {
    startDate?: string;
    endDate?: string;
    sellerId?: number;
    city?: string;
    rubroId?: number;
    billingType?: string;
  }) {
    const whereOrder: any = { status: 'DELIVERED' };

    if (filters.startDate || filters.endDate) {
      whereOrder.createdAt = {};
      if (filters.startDate) whereOrder.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        whereOrder.createdAt.lte = end;
      }
    }

    if (filters.sellerId) {
      whereOrder.sellerId = Number(filters.sellerId);
    }

    if (filters.billingType && filters.billingType !== 'ALL') {
      whereOrder.billingType = filters.billingType;
    }

    const orders = await prisma.order.findMany({
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
    });

    const whereCreditNote: any = { status: 'APPROVED' };
    if (whereOrder.createdAt) {
      whereCreditNote.createdAt = whereOrder.createdAt;
    }
    const creditNotes = await prisma.creditNote.findMany({
      where: whereCreditNote,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                costPrice: true,
                isPesable: true,
                rubroId: true,
                rubro: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const clientMap = new Map<
      number,
      {
        id: number;
        businessName: string;
        city: string;
        sellerName: string;
        totalRevenue: number;
        totalCost: number;
        orderCount: number;
      }
    >();

    const productMap = new Map<
      number,
      {
        id: number;
        sku: string;
        name: string;
        rubroName: string;
        rubroId: number | null;
        targetMargin: number;
        quantitySold: number;
        totalRevenue: number;
        totalCost: number;
      }
    >();

    for (const order of orders) {
      const personaCity = normalizeCity(order.persona.city);
      if (filters.city && filters.city !== 'ALL' && personaCity !== filters.city) {
        continue;
      }

      if (!clientMap.has(order.personaId)) {
        clientMap.set(order.personaId, {
          id: order.persona.id,
          businessName: order.persona.name || 'Cliente sin nombre',
          city: personaCity,
          sellerName: order.persona.seller?.username || 'Sin Vendedor',
          totalRevenue: 0,
          totalCost: 0,
          orderCount: 0,
        });
      }

      const clientData = clientMap.get(order.personaId)!;
      clientData.orderCount += 1;

      for (const item of order.items) {
        if (filters.rubroId && item.product.rubroId !== Number(filters.rubroId)) {
          continue;
        }

        const { qtyOrWeight, itemRevenue, itemCost } = resolveOrderItemHistoricalCost(item);

        clientData.totalRevenue += itemRevenue;
        clientData.totalCost += itemCost;

        if (!productMap.has(item.productId)) {
          const targetMargin =
            Number(item.product.profitMargin) ||
            (item.product.rubro?.profitMargin
              ? (Number(item.product.rubro.profitMargin) - 1) * 100
              : 30);

          productMap.set(item.productId, {
            id: item.product.id,
            sku: item.product.sku,
            name: item.product.name,
            rubroName: item.product.rubro?.name || 'Sin Rubro',
            rubroId: item.product.rubroId,
            targetMargin,
            quantitySold: 0,
            totalRevenue: 0,
            totalCost: 0,
          });
        }

        const prodData = productMap.get(item.productId)!;
        prodData.quantitySold += qtyOrWeight;
        prodData.totalRevenue += itemRevenue;
        prodData.totalCost += itemCost;
      }
    }

    for (const cn of creditNotes) {
      if (clientMap.has(cn.personaId)) {
        const clientData = clientMap.get(cn.personaId)!;
        for (const item of cn.items) {
          const { qtyOrWeight, itemRevenue, itemCost } = resolveOrderItemHistoricalCost(item);

          clientData.totalRevenue -= itemRevenue;
          clientData.totalCost -= itemCost;

          if (productMap.has(item.productId)) {
            const prodData = productMap.get(item.productId)!;
            prodData.quantitySold -= qtyOrWeight;
            prodData.totalRevenue -= itemRevenue;
            prodData.totalCost -= itemCost;
          }
        }
      }
    }

    const clients = Array.from(clientMap.values())
      .map((c) => {
        const grossProfit = Math.round(c.totalRevenue - c.totalCost);
        const marginPercent = c.totalRevenue > 0 ? (grossProfit / c.totalRevenue) * 100 : 0;
        const averageTicket = c.orderCount > 0 ? Math.round(c.totalRevenue / c.orderCount) : 0;

        return {
          ...c,
          grossProfit,
          marginPercent: Math.round(marginPercent * 100) / 100,
          averageTicket,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit);

    const products = Array.from(productMap.values())
      .map((p) => {
        const grossProfit = Math.round(p.totalRevenue - p.totalCost);
        const marginPercent = p.totalRevenue > 0 ? (grossProfit / p.totalRevenue) * 100 : 0;
        const marginGap = Math.round((marginPercent - p.targetMargin) * 100) / 100;

        let classification: 'STAR' | 'VOLUME' | 'OPPORTUNITY' | 'LOW_MARGIN' = 'OPPORTUNITY';
        if (marginPercent >= 25 && grossProfit > 50000) classification = 'STAR';
        else if (marginPercent < 20 && grossProfit > 50000) classification = 'VOLUME';
        else if (marginPercent < 15) classification = 'LOW_MARGIN';

        return {
          ...p,
          quantitySold: Math.round(p.quantitySold * 100) / 100,
          grossProfit,
          marginPercent: Math.round(marginPercent * 100) / 100,
          marginGap,
          classification,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit);

    const totalRevenue = clients.reduce((acc, c) => acc + c.totalRevenue, 0);
    const totalCost = clients.reduce((acc, c) => acc + c.totalCost, 0);
    const totalGrossProfit = Math.round(totalRevenue - totalCost);
    const overallMarginPercent =
      totalRevenue > 0 ? Math.round((totalGrossProfit / totalRevenue) * 100 * 100) / 100 : 0;

    return {
      kpis: {
        totalRevenue,
        totalCost,
        totalGrossProfit,
        overallMarginPercent,
        topClient: clients.length > 0 ? clients[0] : null,
        topProduct: products.length > 0 ? products[0] : null,
        lowMarginProductsCount: products.filter((p) => p.marginPercent < 15).length,
      },
      clients,
      products,
    };
  }
}

export const adminProfitabilitySubService = new AdminProfitabilitySubService();
