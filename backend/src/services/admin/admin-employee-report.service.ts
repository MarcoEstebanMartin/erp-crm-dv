import {
  CreditNoteStatus,
  FieldReceiptStatus,
  OrderStatus,
  Role,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { computeEmployeeReportMetrics } from '../../engines/reports-employee.engine';
import {
  buildOperatingCreditNoteWhere,
  buildOperatingOrderWhere,
  resolveReportDateRange,
} from './admin-report.helpers';

export class AdminEmployeeReportSubService {
  /**
   * Reporte PDF de Actividad por Empleado: ventas netas (Decimal.js), margen histórico,
   * cobranzas, operación (repartos, recibos digitales, cajas, stock) y Top 5 clientes/productos.
   */
  async getEmployeePdfReportData(
    userId: number,
    startDateStr?: string,
    endDateStr?: string,
  ) {
    const resolved = resolveReportDateRange({
      startDate: startDateStr,
      endDate: endDateStr,
      defaultCurrentMonth: true,
    });
    const start = resolved.start!;
    const end = resolved.end!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            position: true,
            department: true,
          },
        },
      },
    });
    if (!user) {
      throw new AppError('Empleado no encontrado.', 404);
    }

    const assignedClients =
      user.role === Role.VENDEDOR
        ? await prisma.persona.findMany({
            where: { sellerId: userId, isClient: true },
            select: { id: true },
          })
        : [];
    const assignedIds = assignedClients.map((c) => c.id);

    const empFullName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : '';
    const driverNames = Array.from(
      new Set([user.username, empFullName].filter((s) => s.length > 0)),
    );

    const [
      orders,
      creditNotes,
      collectionsGrouped,
      routes,
      fieldReceiptsAgg,
      cashDrawersCount,
      stockMovementsCount,
    ] = await Promise.all([
      prisma.order.findMany({
        where: {
          sellerId: userId,
          status: OrderStatus.DELIVERED,
          createdAt: { gte: start, lte: end },
          AND: [buildOperatingOrderWhere()],
        },
        include: {
          persona: true,
          items: { include: { product: { include: { rubro: true } } } },
        },
      }),
      prisma.creditNote.findMany({
        where: {
          status: CreditNoteStatus.APPROVED,
          createdAt: { gte: start, lte: end },
          OR: [{ order: { sellerId: userId } }, { orderId: null, persona: { sellerId: userId } }],
          AND: [buildOperatingCreditNoteWhere()],
        },
        include: {
          persona: true,
          order: { select: { deliveryMethod: true, salesChannel: true, deliveryRouteId: true, items: { select: { productId: true, unitCostSnapshot: true } } } },
          items: { include: { product: { include: { rubro: true } } } },
        },
      }),
      prisma.transaction.groupBy({
        by: ['paymentMethod'],
        where: {
          type: TransactionType.INCOME,
          voidedAt: null,
          createdAt: { gte: start, lte: end },
          ...(assignedIds.length > 0
            ? { OR: [{ userId }, { personaId: { in: assignedIds } }] }
            : { userId }),
        },
        _sum: { amount: true },
      }),
      prisma.deliveryRoute.findMany({
        where: {
          date: { gte: start, lte: end },
          OR: [
            ...(user.employee ? [{ driverEmployeeId: user.employee.id }] : []),
            ...driverNames.map((name) => ({
              driverName: { equals: name, mode: 'insensitive' as const },
            })),
          ],
        },
        select: {
          id: true,
          orders: {
            where: { status: OrderStatus.DELIVERED },
            select: { id: true },
          },
        },
      }),
      prisma.fieldReceipt.aggregate({
        where: {
          collectorUserId: userId,
          status: { not: FieldReceiptStatus.VOIDED },
          receiptNumber: { not: null },
          capturedAt: { gte: start, lte: end },
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.cashDrawer.count({
        where: { userId, openedAt: { gte: start, lte: end } },
      }),
      prisma.stockMovement.count({
        where: { userId, createdAt: { gte: start, lte: end } },
      }),
    ]);

    const routeOrdersDelivered = routes.reduce((sum, r) => sum + r.orders.length, 0);

    const metrics = computeEmployeeReportMetrics({
      orders,
      creditNotes,
      collectionsGrouped,
      routesCount: routes.length,
      routeOrdersDelivered,
      fieldReceiptsCount: fieldReceiptsAgg._count?._all ?? 0,
      fieldReceiptsAmount: fieldReceiptsAgg._sum?.totalAmount ?? 0,
      cashDrawersCount,
      stockMovementsCount,
    });

    return {
      employee: {
        id: user.id,
        username: user.username,
        fullName: empFullName || user.username,
        role: user.role,
        position: user.employee?.position || null,
        department: user.employee?.department || null,
        assignedClientsCount: assignedIds.length,
      },
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        startDateIso: resolved.startDateIso,
        endDateIso: resolved.endDateIso,
      },
      ...metrics,
    };
  }
}

export const adminEmployeeReportSubService = new AdminEmployeeReportSubService();
