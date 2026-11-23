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
    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [inactiveClients, allActiveProducts, activeClients, expiringLots] = await Promise.all([
      // 1. Clientes Inactivos (sin compras en los últimos 15 días)
      prisma.persona.findMany({
        where: {
          isClient: true,
          isActive: true,
          orders: { none: { createdAt: { gte: fifteenDaysAgo } } },
        },
        select: {
          id: true,
          name: true,
          cuit: true,
          phone: true,
          outstandingBalance: true,
          orders: {
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      // 2. Productos con stock mínimo configurado para reabastecimiento
      prisma.product.findMany({
        where: { isActive: true, minStock: { gt: 0 } },
        select: {
          id: true,
          sku: true,
          name: true,
          stock: true,
          minStock: true,
          costPrice: true,
          provider: { select: { id: true, name: true } },
        },
      }),
      // 3. Clientes con al menos un pedido (últimos 10 pedidos para evitar escaneo ilimitado)
      prisma.persona.findMany({
        where: { isClient: true, isActive: true, orders: { some: {} } },
        select: {
          id: true,
          name: true,
          orders: {
            select: {
              items: {
                select: {
                  productId: true,
                  quantity: true,
                  product: { select: { id: true, name: true, sku: true, listPrice: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      }),
      // 4. Lotes por vencer (próximos 30 días con stock > 0)
      prisma.productLot.findMany({
        where: {
          stock: { gt: 0 },
          expirationDate: { gte: today, lte: thirtyDaysFromNow },
        },
        select: {
          id: true,
          lotNumber: true,
          expirationDate: true,
          stock: true,
          productId: true,
          product: { select: { name: true, sku: true } },
        },
        orderBy: { expirationDate: 'asc' },
      }),
    ]);

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

    const consumerSuggestions = activeClients
      .map((client) => {
        if (client.orders.length === 0) {
          return { clientId: client.id, clientName: client.name, suggestedProducts: [] };
        }

        const allPurchasedProducts: Record<number, { product: { id: number; name: string; sku: string; listPrice: any }; count: number }> = {};
        client.orders.forEach((order) => {
          order.items.forEach((item) => {
            if (!allPurchasedProducts[item.productId]) {
              allPurchasedProducts[item.productId] = { product: item.product, count: 0 };
            }
            allPurchasedProducts[item.productId].count += item.quantity;
          });
        });

        const lastOrderProductIds = new Set<number>();
        if (client.orders[0]) {
          client.orders[0].items.forEach((item) => lastOrderProductIds.add(item.productId));
        }

        const suggestions = Object.values(allPurchasedProducts)
          .filter((item) => !lastOrderProductIds.has(item.product.id))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
            listPrice: roundToIntegerPeso(item.product.listPrice || 0).toNumber(),
            frequency: item.count,
          }));

        return { clientId: client.id, clientName: client.name, suggestedProducts: suggestions };
      })
      .filter((item) => item.suggestedProducts.length > 0);

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
