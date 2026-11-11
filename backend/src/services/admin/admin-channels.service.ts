import prisma from '../../utils/prisma';
import { OrderStatus } from '@prisma/client';
import { roundToIntegerPeso, roundToThreeDecimalsWeight, toDecimal } from '../../core/money';
import { resolveOrderItemHistoricalCost } from './admin-report.helpers';

export class AdminChannelsSubService {
  /**
   * Obtener estadísticas avanzadas por Canales de Venta usando unitCostSnapshot (CMV histórico real).
   */
  async getSalesChannelStats(year?: number, month?: number) {
    const whereClause: any = { status: OrderStatus.DELIVERED };

    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      whereClause.createdAt = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999),
      };
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        persona: { select: { id: true, name: true, city: true } },
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
          select: { id: true, paymentMethod: true, amount: true, cashDrawerId: true },
        },
      },
    });

    const channelSummaryMap: Record<
      string,
      { sales: number; cost: number; profit: number; ordersCount: number }
    > = {
      MOSTRADOR: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
      PREVENTA_RUTA: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
      TIENDA_WEB: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
      TELEFONICO: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
    };

    const topMostradorProductsMap: Record<
      number,
      { product: any; unitsSold: number; weightSold: number; totalRevenue: number }
    > = {};
    const topMostradorClientsMap: Record<
      number,
      { id: number; name: string; city: string | null; ordersCount: number; totalAmount: number }
    > = {};
    const mostradorPaymentMethods: Record<string, number> = {
      CASH: 0,
      BANK_TRANSFER: 0,
      CHECK: 0,
      CTA_CORRIENTE: 0,
      OTHER: 0,
    };

    let totalRevenueOverall = 0;

    for (const order of orders) {
      const channelKey = (order.salesChannel ||
        (order.deliveryRouteId ? 'PREVENTA_RUTA' : 'MOSTRADOR')) as string;
      if (!channelSummaryMap[channelKey]) {
        channelSummaryMap[channelKey] = { sales: 0, cost: 0, profit: 0, ordersCount: 0 };
      }

      const orderTotal = roundToIntegerPeso(order.totalAmount || 0).toNumber();
      let orderCost = 0;

      for (const item of order.items) {
        const { itemCost } = resolveOrderItemHistoricalCost(item);
        orderCost += itemCost;

        if (channelKey === 'MOSTRADOR') {
          const pId = item.productId;
          if (!topMostradorProductsMap[pId]) {
            topMostradorProductsMap[pId] = {
              product: item.product,
              unitsSold: 0,
              weightSold: 0,
              totalRevenue: 0,
            };
          }
          topMostradorProductsMap[pId].unitsSold += item.quantity;
          topMostradorProductsMap[pId].weightSold = roundToThreeDecimalsWeight(
            toDecimal(topMostradorProductsMap[pId].weightSold).plus(
              item.weight ? item.weight.toString() : 0,
            ),
          ).toNumber();
          topMostradorProductsMap[pId].totalRevenue = roundToIntegerPeso(
            toDecimal(topMostradorProductsMap[pId].totalRevenue).plus(
              item.subtotal ? item.subtotal.toString() : 0,
            ),
          ).toNumber();
        }
      }

      const orderCostInt = roundToIntegerPeso(orderCost).toNumber();
      channelSummaryMap[channelKey].sales = roundToIntegerPeso(
        toDecimal(channelSummaryMap[channelKey].sales).plus(orderTotal),
      ).toNumber();
      channelSummaryMap[channelKey].cost = roundToIntegerPeso(
        toDecimal(channelSummaryMap[channelKey].cost).plus(orderCostInt),
      ).toNumber();
      channelSummaryMap[channelKey].profit = roundToIntegerPeso(
        toDecimal(channelSummaryMap[channelKey].sales).minus(channelSummaryMap[channelKey].cost),
      ).toNumber();
      channelSummaryMap[channelKey].ordersCount += 1;
      totalRevenueOverall = roundToIntegerPeso(
        toDecimal(totalRevenueOverall).plus(orderTotal),
      ).toNumber();

      if (channelKey === 'MOSTRADOR') {
        const cId = order.personaId;
        if (!topMostradorClientsMap[cId]) {
          topMostradorClientsMap[cId] = {
            id: order.persona.id,
            name: order.persona.name,
            city: order.persona.city,
            ordersCount: 0,
            totalAmount: 0,
          };
        }
        topMostradorClientsMap[cId].ordersCount += 1;
        topMostradorClientsMap[cId].totalAmount = roundToIntegerPeso(
          toDecimal(topMostradorClientsMap[cId].totalAmount).plus(orderTotal),
        ).toNumber();

        if (order.transactions && order.transactions.length > 0) {
          for (const tx of order.transactions) {
            const method = tx.paymentMethod || 'OTHER';
            mostradorPaymentMethods[method] = roundToIntegerPeso(
              toDecimal(mostradorPaymentMethods[method] || 0).plus(
                tx.amount ? tx.amount.toString() : 0,
              ),
            ).toNumber();
          }
        } else {
          mostradorPaymentMethods['CTA_CORRIENTE'] = roundToIntegerPeso(
            toDecimal(mostradorPaymentMethods['CTA_CORRIENTE'] || 0).plus(orderTotal),
          ).toNumber();
        }
      }
    }

    const topProducts = Object.values(topMostradorProductsMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const topClients = Object.values(topMostradorClientsMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    const mostradorSales = channelSummaryMap['MOSTRADOR']?.sales || 0;
    const mostradorOrders = channelSummaryMap['MOSTRADOR']?.ordersCount || 0;

    return {
      period: { year, month },
      channels: Object.entries(channelSummaryMap).map(([channel, data]) => ({
        channel,
        sales: roundToIntegerPeso(data.sales).toNumber(),
        cost: roundToIntegerPeso(data.cost).toNumber(),
        profit: roundToIntegerPeso(data.profit).toNumber(),
        ordersCount: data.ordersCount,
        averageTicket:
          data.ordersCount > 0
            ? roundToIntegerPeso(toDecimal(data.sales).dividedBy(data.ordersCount)).toNumber()
            : 0,
        percentage:
          totalRevenueOverall > 0
            ? roundToIntegerPeso(
                toDecimal(data.sales).dividedBy(totalRevenueOverall).times(100),
              ).toNumber()
            : 0,
      })),
      mostrador: {
        totalSales: roundToIntegerPeso(mostradorSales).toNumber(),
        totalOrders: mostradorOrders,
        averageTicket:
          mostradorOrders > 0
            ? roundToIntegerPeso(toDecimal(mostradorSales).dividedBy(mostradorOrders)).toNumber()
            : 0,
        topProducts,
        topClients,
        paymentMethods: Object.entries(mostradorPaymentMethods).map(([method, amount]) => ({
          method,
          amount: roundToIntegerPeso(amount).toNumber(),
        })),
      },
    };
  }
}

export const adminChannelsSubService = new AdminChannelsSubService();
