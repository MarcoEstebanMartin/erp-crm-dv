import prisma from '../../utils/prisma';
import { Role } from '@prisma/client';
import { roundToIntegerPeso } from '../../core/money';

export class PersonaSellersSubService {
  /**
   * Obtiene todos los vendedores activos de la base de datos.
   */
  async getSellers() {
    return prisma.user.findMany({
      where: {
        role: Role.VENDEDOR,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
      },
      orderBy: {
        username: 'asc',
      },
    });
  }

  /**
   * Obtiene el perfil detallado y estadísticas completas de un vendedor.
   */
  async getSellerProfileStats(sellerIdParam: number) {
    let sellerPersona = await prisma.persona.findUnique({
      where: { id: sellerIdParam },
      include: {
        seller: { select: { id: true, username: true } },
        saleRoute: { select: { id: true, name: true, dayOfWeek: true } },
      },
    });

    let sellerUser = await prisma.user.findUnique({
      where: { id: sellerIdParam },
      select: { id: true, username: true, role: true, isActive: true },
    });

    if (sellerPersona && sellerPersona.sellerId && !sellerUser) {
      sellerUser = await prisma.user.findUnique({
        where: { id: sellerPersona.sellerId },
        select: { id: true, username: true, role: true, isActive: true },
      });
    }

    if (!sellerPersona && sellerUser) {
      sellerPersona = await prisma.persona.findFirst({
        where: {
          OR: [
            { isSeller: true, name: { contains: sellerUser.username, mode: 'insensitive' } },
            { sellerId: sellerUser.id },
          ],
        },
        include: {
          seller: { select: { id: true, username: true } },
          saleRoute: { select: { id: true, name: true, dayOfWeek: true } },
        },
      });
    }

    const name = sellerPersona?.name || sellerUser?.username || `Vendedor #${sellerIdParam}`;
    const phone = sellerPersona?.phone || '';
    const email = sellerPersona?.email || '';
    const city = sellerPersona?.city || 'General Villegas';
    const cuit = sellerPersona?.cuit || '';
    const address = sellerPersona?.address || '';

    const userIds = sellerUser ? [sellerUser.id] : [];
    const allIds = [...new Set([...userIds, sellerIdParam])];

    const assignedClients = await prisma.persona.findMany({
      where: {
        isClient: true,
        OR: [
          { sellerId: { in: allIds } },
          ...(sellerUser
            ? [
                {
                  seller: {
                    username: { equals: sellerUser.username, mode: 'insensitive' as const },
                  },
                },
              ]
            : []),
          { seller: { id: sellerIdParam } },
        ],
      },
      select: {
        id: true,
        name: true,
        tradeName: true,
        city: true,
        address: true,
        phone: true,
        route: true,
        cuit: true,
        outstandingBalance: true,
        saleRoute: { select: { name: true, dayOfWeek: true } },
      },
      orderBy: { name: 'asc' },
    });

    const clientIds = assignedClients.map((c) => c.id);

    const assignedRoutes = await prisma.saleRoute.findMany({
      where: {
        OR: [
          { sellerId: { in: allIds } },
          ...(sellerUser
            ? [
                {
                  seller: {
                    username: { equals: sellerUser.username, mode: 'insensitive' as const },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        clients: { select: { id: true } },
      },
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf6MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const orders = await prisma.order.findMany({
      where: {
        status: { not: 'CANCELLED' },
        createdAt: { gte: startOf6MonthsAgo },
        OR: [
          { sellerId: { in: allIds } },
          ...(clientIds.length > 0 ? [{ personaId: { in: clientIds } }] : []),
        ],
      },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
        personaId: true,
        persona: { select: { id: true, name: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const currentMonthOrders = orders.filter((o) => new Date(o.createdAt) >= startOfMonth);
    const totalSalesMonth = currentMonthOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount || 0),
      0,
    );
    const totalOrdersMonth = currentMonthOrders.length;
    const averageTicket =
      totalOrdersMonth > 0 ? roundToIntegerPeso(totalSalesMonth / totalOrdersMonth).toNumber() : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeClientIds = new Set(
      orders.filter((o) => new Date(o.createdAt) >= thirtyDaysAgo).map((o) => o.personaId),
    );
    const activeClientsCount = activeClientIds.size;
    const coveragePercentage =
      assignedClients.length > 0
        ? Math.round((activeClientsCount / assignedClients.length) * 100)
        : 0;

    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const salesEvolutionMap = new Map<string, { period: string; sales: number; orders: number }>();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      salesEvolutionMap.set(key, { period: key, sales: 0, orders: 0 });
    }

    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (salesEvolutionMap.has(key)) {
        const item = salesEvolutionMap.get(key)!;
        item.sales += Number(o.totalAmount || 0);
        item.orders += 1;
      }
    });

    const salesEvolution = Array.from(salesEvolutionMap.values());

    const clientSalesMap = new Map<
      number,
      { id: number; name: string; city: string; totalSpent: number; ordersCount: number }
    >();

    orders.forEach((o) => {
      if (!o.persona) return;
      const existing = clientSalesMap.get(o.persona.id) || {
        id: o.persona.id,
        name: o.persona.name,
        city: o.persona.city || 'S/D',
        totalSpent: 0,
        ordersCount: 0,
      };
      existing.totalSpent += Number(o.totalAmount || 0);
      existing.ordersCount += 1;
      clientSalesMap.set(o.persona.id, existing);
    });

    const topClients = Array.from(clientSalesMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5);

    return {
      seller: {
        id: sellerIdParam,
        personaId: sellerPersona?.id || null,
        userId: sellerUser?.id || null,
        name,
        cuit,
        phone,
        email,
        city,
        address,
        userAccount: sellerUser?.username || null,
        isActive: sellerUser?.isActive ?? true,
      },
      metrics: {
        assignedClientsCount: assignedClients.length,
        activeClientsCount,
        coveragePercentage,
        totalSalesMonth: roundToIntegerPeso(totalSalesMonth).toNumber(),
        totalOrdersMonth,
        averageTicket,
      },
      salesEvolution,
      topClients,
      routes: assignedRoutes.map((r) => ({
        id: r.id,
        name: r.name,
        dayOfWeek: r.dayOfWeek,
        clientsCount: r.clients.length,
      })),
      clients: assignedClients,
    };
  }
}

export const personaSellersSubService = new PersonaSellersSubService();
