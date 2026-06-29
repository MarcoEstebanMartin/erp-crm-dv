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
}

export const adminService = new AdminService();
