import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { roundToIntegerPeso, roundToTwoDecimals } from '../core/money';
import { canViewProductCosts } from '../utils/product-sanitizer.util';

/**
 * Obtener alertas y predicciones de CRM + IA
 */
export async function getCRMAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // 1. Clientes Inactivos (sin compras en los últimos 15 días)
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    const inactiveClients = await prisma.persona.findMany({
      where: {
        isClient: true,
        isActive: true,
        orders: {
          none: {
            createdAt: {
              gte: fifteenDaysAgo,
            },
          },
        },
      },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // 2. Recomendaciones de reabastecimiento (IA) - Productos con stock real debajo del mínimo configurado
    const allActiveProducts = await prisma.product.findMany({
      where: { isActive: true, minStock: { gt: 0 } },
      include: { provider: { select: { id: true, name: true } } },
    });
    const lowStockProducts = allActiveProducts.filter((p) => p.stock < p.minStock);
    const showCosts = canViewProductCosts(req.user?.role);

    const replenishmentSuggestions = lowStockProducts.map((p) => ({
      productId: p.id,
      sku: p.sku,
      productName: p.name,
      currentStock: p.stock,
      minStock: p.minStock,
      suggestedQuantity: Math.max(1, p.minStock * 2 - p.stock),
      suggestedProviderId: p.provider?.id ?? null,
      suggestedProviderName: p.provider?.name ?? 'Sin proveedor asignado',
      costPrice: showCosts ? roundToTwoDecimals(p.costPrice || 0).toNumber() : 0,
    }));

    // 3. Sugerencias de Consumo Personalizadas por Cliente
    // Para cada cliente activo, sugerir productos que compra frecuentemente pero no compró en su último pedido.
    const activeClients = await prisma.persona.findMany({
      where: { isClient: true, isActive: true },
      include: {
        orders: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const consumerSuggestions = activeClients.map(client => {
      if (client.orders.length === 0) {
        return {
          clientId: client.id,
          clientName: client.name,
          suggestedProducts: []
        };
      }

      // Obtener histórico de productos comprados
      const allPurchasedProducts: { [key: number]: { product: any, count: number } } = {};
      client.orders.forEach(order => {
        order.items.forEach(item => {
          if (!allPurchasedProducts[item.productId]) {
            allPurchasedProducts[item.productId] = { product: item.product, count: 0 };
          }
          allPurchasedProducts[item.productId].count += item.quantity;
        });
      });

      // Obtener productos del último pedido
      const lastOrderProductIds = new Set<number>();
      if (client.orders[0]) {
        client.orders[0].items.forEach(item => lastOrderProductIds.add(item.productId));
      }

      // Filtrar productos históricos que no están en el último pedido
      const suggestions = Object.values(allPurchasedProducts)
        .filter(item => !lastOrderProductIds.has(item.product.id))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(item => ({
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          listPrice: roundToIntegerPeso(item.product.listPrice || 0).toNumber(),
          frequency: item.count,
        }));

      return {
        clientId: client.id,
        clientName: client.name,
        suggestedProducts: suggestions,
      };
    }).filter(item => item.suggestedProducts.length > 0);

    // 4. Lotes por vencer (próximos 30 días con stock > 0)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const today = new Date();

    const expiringLots = await prisma.productLot.findMany({
      where: {
        stock: { gt: 0 },
        expirationDate: {
          gte: today,
          lte: thirtyDaysFromNow
        }
      },
      include: {
        product: true
      },
      orderBy: {
        expirationDate: 'asc'
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        inactiveClients: inactiveClients.map(c => ({
          id: c.id,
          name: c.name,
          cuit: c.cuit,
          phone: c.phone,
          outstandingBalance: roundToIntegerPeso(c.outstandingBalance || 0).toNumber(),
          lastOrderDate: c.orders[0]?.createdAt || null,
        })),
        replenishmentSuggestions,
        consumerSuggestions,
        expiringLots: expiringLots.map(l => ({
          id: l.id,
          lotNumber: l.lotNumber,
          expirationDate: l.expirationDate,
          stock: l.stock,
          productId: l.productId,
          productName: l.product.name,
          sku: l.product.sku
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al calcular alertas de CRM + IA.',
    });
  }
}
