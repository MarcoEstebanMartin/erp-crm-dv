import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import bcrypt from 'bcryptjs';
import { Role, BillingType, TransactionType } from '@prisma/client';
import { logAudit } from '../utils/audit';

/**
 * Obtener reporte consolidado financiero (Solo ADMIN).
 * Agrupa por Blanco (OFFICIAL) e Interno (INTERNAL) y calcula totales.
 */
export async function getFinancialReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // 1. Obtener suma de pedidos entregados agrupados por canal
    const salesGrouped = await prisma.order.groupBy({
      by: ['billingType'],
      where: { status: 'DELIVERED' },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    // 2. Obtener movimientos de caja agrupados por canal y tipo (Ingreso/Egreso)
    const transactionsGrouped = await prisma.transaction.groupBy({
      by: ['billingType', 'type'],
      _sum: { amount: true },
    });

    // 3. Detalle de ingresos por método de pago y canal
    const paymentMethodsGrouped = await prisma.transaction.groupBy({
      by: ['billingType', 'paymentMethod'],
      where: { type: TransactionType.INCOME },
      _sum: { amount: true },
    });

    // Formatear la respuesta limpia y legible
    const report = {
      sales: {
        official: salesGrouped.find(g => g.billingType === BillingType.OFFICIAL)?._sum.totalAmount || 0,
        officialCount: salesGrouped.find(g => g.billingType === BillingType.OFFICIAL)?._count.id || 0,
        internal: salesGrouped.find(g => g.billingType === BillingType.INTERNAL)?._sum.totalAmount || 0,
        internalCount: salesGrouped.find(g => g.billingType === BillingType.INTERNAL)?._count.id || 0,
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

    res.status(200).json({
      status: 'success',
      data: { report },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al procesar el reporte financiero.',
    });
  }
}

/**
 * Obtener logs de auditoría (Solo ADMIN).
 */
export async function getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        skip,
        take: Number(limit),
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        logs,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los registros de auditoría.',
    });
  }
}

/**
 * Obtener listado de usuarios (Solo ADMIN).
 */
export async function getUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { username: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { users },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener usuarios.',
    });
  }
}

/**
 * Crear un nuevo usuario (Solo ADMIN).
 */
export async function createUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { username, password, role } = req.body;
  const adminId = req.user?.id;

  if (!username || !password || !role) {
    res.status(400).json({
      status: 'error',
      message: 'Usuario, contraseña y rol son obligatorios.',
    });
    return;
  }

  if (!Object.values(Role).includes(role)) {
    res.status(400).json({ status: 'error', message: 'Rol inválido.' });
    return;
  }

  try {
    // Validar usuario único
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      res.status(400).json({
        status: 'error',
        message: 'El nombre de usuario ya está registrado.',
      });
      return;
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

    // Auditoría
    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: newUser.id,
        newValues: { username: newUser.username, role: newUser.role },
      });
    }

    res.status(201).json({
      status: 'success',
      data: { user: newUser },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el usuario.',
    });
  }
}

/**
 * Habilitar/Deshabilitar usuario (Solo ADMIN).
 */
export async function toggleUserStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(id) },
    });

    if (!user) {
      res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
      return;
    }

    // Un administrador no debería desactivarse a sí mismo
    if (user.id === adminId) {
      res.status(400).json({
        status: 'error',
        message: 'No podés desactivar tu propio usuario administrador.',
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, isActive: true },
    });

    // Auditoría
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

    res.status(200).json({
      status: 'success',
      data: { user: updated },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al modificar el estado del usuario.',
    });
  }
}
