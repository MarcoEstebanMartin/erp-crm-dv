import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';
import { Role, BillingType, TransactionType } from '@prisma/client';
import { logAudit } from '../utils/audit';

export class AdminService {
  /**
   * Obtener reporte consolidado financiero.
   */
  async getFinancialReports() {
    const deliveredOrders = await prisma.order.findMany({
      where: { status: 'DELIVERED' },
      include: { items: { include: { product: true } } }
    });

    let officialSales = 0;
    let officialCost = 0;
    let officialCount = 0;
    let internalSales = 0;
    let internalCost = 0;
    let internalCount = 0;

    for (const order of deliveredOrders) {
      const amount = Number(order.totalAmount) || 0;
      let cost = 0;
      for (const item of order.items) {
        cost += Number(item.product.costPrice || 0) * item.quantity;
      }

      if (order.billingType === BillingType.OFFICIAL) {
        officialSales += amount;
        officialCost += cost;
        officialCount++;
      } else {
        internalSales += amount;
        internalCost += cost;
        internalCount++;
      }
    }

    const transactionsGrouped = await prisma.transaction.groupBy({
      by: ['billingType', 'type'],
      _sum: { amount: true },
    });

    const paymentMethodsGrouped = await prisma.transaction.groupBy({
      by: ['billingType', 'paymentMethod'],
      where: { type: TransactionType.INCOME },
      _sum: { amount: true },
    });

    return {
      sales: {
        official: officialSales,
        officialCost: officialCost,
        officialCount: officialCount,
        internal: internalSales,
        internalCost: internalCost,
        internalCount: internalCount,
      },
      cashflow: {
        officialIncome: transactionsGrouped.find(g => g.billingType === BillingType.OFFICIAL && g.type === TransactionType.INCOME)?._sum.amount || 0,
        officialOutcome: transactionsGrouped.find(g => g.billingType === BillingType.OFFICIAL && g.type === TransactionType.OUTCOME)?._sum.amount || 0,
        internalIncome: transactionsGrouped.find(g => g.billingType === BillingType.INTERNAL && g.type === TransactionType.INCOME)?._sum.amount || 0,
        internalOutcome: transactionsGrouped.find(g => g.billingType === BillingType.INTERNAL && g.type === TransactionType.OUTCOME)?._sum.amount || 0,
      },
      paymentMethods: paymentMethodsGrouped.map(m => ({
        channel: m.billingType,
        method: m.paymentMethod,
        total: m._sum.amount || 0,
      })),
    };
  }

  /**
   * Obtener logs de auditoría.
   */
  async getAuditLogs(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener listado de usuarios.
   */
  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { username: 'asc' },
    });
  }

  /**
   * Crear un nuevo usuario.
   */
  async createUser(data: any, adminId?: number) {
    const { username, password, role } = data;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new Error('El nombre de usuario ya está registrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: role as Role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: newUser.id,
        newValues: { username: newUser.username, role: newUser.role },
      });
    }

    return newUser;
  }

  /**
   * Habilitar/Deshabilitar usuario.
   */
  async toggleUserStatus(id: number, adminId?: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('Usuario no encontrado.');

    if (user.id === adminId) {
      throw new Error('No podés desactivar tu propio usuario administrador.');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, isActive: true },
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'TOGGLE_USER_STATUS',
        entityType: 'User',
        entityId: user.id,
        oldValues: { isActive: user.isActive },
        newValues: { isActive: updated.isActive },
      });
    }

    return updated;
  }

  /**
   * Obtener reportes por zonas (estadísticas robustas).
   */
  async getZoneReports(filters: { sellerId?: number; city?: string; cities?: string[]; startDate?: string; endDate?: string }) {
    const whereClause: any = { isClient: true };
    if (filters.sellerId) whereClause.sellerId = filters.sellerId;
    if (filters.cities && filters.cities.length > 0) {
      whereClause.city = { in: filters.cities };
    } else if (filters.city && filters.city.trim() !== '') {
      whereClause.city = { contains: filters.city, mode: 'insensitive' };
    }

    const clients = await prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: { select: { id: true, username: true } }
      },
      orderBy: { city: 'asc' }
    });

    const totalClients = clients.length;
    const totalDebt = clients.reduce((acc, curr) => acc + Number(curr.outstandingBalance || 0), 0);

    // Query orders for this zone to build metrics
    const orderWhereClause: any = {
      status: 'DELIVERED',
    };
    if (filters.cities && filters.cities.length > 0) {
      orderWhereClause.persona = {
        city: { in: filters.cities }
      };
    } else if (filters.city && filters.city.trim() !== '') {
      orderWhereClause.persona = {
        city: { contains: filters.city, mode: 'insensitive' }
      };
    }
    if (filters.sellerId) {
      if (!orderWhereClause.persona) {
        orderWhereClause.persona = {};
      }
      orderWhereClause.persona.sellerId = filters.sellerId;
    }
    if (filters.startDate || filters.endDate) {
      orderWhereClause.createdAt = {};
      if (filters.startDate) {
        orderWhereClause.createdAt.gte = new Date(filters.startDate);
      }
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
            seller: {
              select: { id: true, username: true }
            }
          }
        },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Aggregations
    const clientMap = new Map<number, { id: number; name: string; city: string; sellerName: string; totalSpent: number; ordersCount: number }>();
    const productMap = new Map<number, { id: number; sku: string; name: string; qty: number; revenue: number }>();
    const weeklyMap = new Map<string, { weekStart: string; dateObj: Date; total: number; count: number }>();

    for (const order of orders) {
      const totalAmount = Number(order.totalAmount) || 0;
      const clientId = order.personaId;
      const clientName = order.persona.name;
      const clientCity = order.persona.city || 'Sin especificar';
      const sellerName = order.persona.seller?.username || 'Sin preventista';

      // 1. Client
      const clientData = clientMap.get(clientId) || {
        id: clientId,
        name: clientName,
        city: clientCity,
        sellerName: sellerName,
        totalSpent: 0,
        ordersCount: 0
      };
      clientData.totalSpent += totalAmount;
      clientData.ordersCount += 1;
      clientMap.set(clientId, clientData);

      // 2. Weekly
      const orderDate = new Date(order.createdAt);
      const day = orderDate.getDay();
      const diff = orderDate.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(orderDate.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const weekKey = monday.toISOString().split('T')[0];

      const weekData = weeklyMap.get(weekKey) || {
        weekStart: weekKey,
        dateObj: monday,
        total: 0,
        count: 0
      };
      weekData.total += totalAmount;
      weekData.count += 1;
      weeklyMap.set(weekKey, weekData);

      // 3. Products
      for (const item of order.items) {
        const prodId = item.productId;
        const qty = item.quantity;
        const subtotal = Number(item.subtotal) || 0;

        const prodData = productMap.get(prodId) || {
          id: prodId,
          sku: item.product.sku,
          name: item.product.name,
          qty: 0,
          revenue: 0
        };
        prodData.qty += qty;
        prodData.revenue += subtotal;
        productMap.set(prodId, prodData);
      }
    }

    const clientsWithMovements = Array.from(clientMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const topClients = clientsWithMovements.slice(0, 10);

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const bottomProducts = Array.from(productMap.values())
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 10);

    const weeklyInvoicing = Array.from(weeklyMap.values())
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map(w => ({
        weekStart: w.weekStart,
        total: w.total,
        count: w.count
      }));

    // Get unique cities for filters
    const allCitiesResult = await prisma.persona.findMany({
      where: { isClient: true, city: { not: null } },
      select: { city: true },
      distinct: ['city']
    });
    
    // Get unique sellers
    const sellers = await prisma.user.findMany({
      where: { role: 'VENDEDOR' },
      select: { id: true, username: true }
    });

    // Query active products in deposit (stock > 0) to check for zero sales in this zone
    const activeProducts = await prisma.product.findMany({
      where: { stock: { gt: 0 } },
      select: { id: true, sku: true, name: true, stock: true }
    });

    const deadStockProducts = activeProducts
      .filter(p => !productMap.has(p.id))
      .map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        qty: 0,
        revenue: 0
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10);

    return {
      totalClients,
      totalDebt,
      clients,
      availableCities: allCitiesResult.map(c => c.city).filter(Boolean),
      availableSellers: sellers,
      topClients,
      clientsWithMovements,
      topProducts,
      bottomProducts,
      weeklyInvoicing,
      deadStockProducts
    };
  }
}

export const adminService = new AdminService();
