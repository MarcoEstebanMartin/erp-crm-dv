import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { sumIntegerAmounts, toDecimal } from '../../core/money';
import { normalizeStopSequences } from '../../engines/delivery-dispatch.engine';
import { logisticsResourcesService } from './logistics-resources.service';
import {
  recalculatePendingRoutesInTx,
  validateAndAssignStopsInTx,
} from './delivery-route-stops.helper';

export const SAFE_PERSONA_SELECT = {
  id: true, name: true, cuit: true, address: true, city: true, barrio: true,
  province: true, zipCode: true, phone: true, email: true, rubro: true, birthDate: true,
  isClient: true, isProvider: true, isSeller: true, isCommissionAgent: true,
  creditLimit: true, maxUnpaidInvoices: true, priceList: true, discount: true,
  contacts: true, outstandingBalance: true, route: true, saleRouteId: true,
  routeSequence: true, latitude: true, longitude: true, sellerId: true,
  iibbAliquot: true, paymentTermDays: true, isActive: true, createdAt: true, updatedAt: true,
} satisfies Prisma.PersonaSelect;

export interface GetDeliveryRoutesFilter {
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface CreateDeliveryRouteInput {
  userId?: number;
  routeName?: string | null;
  driverName?: string | null;
  driverEmployeeId?: number | null;
  companionName?: string | null;
  vehiclePlate?: string | null;
  vehicleDescription?: string | null;
  vehicleId?: number | null;
  date?: string | null;
  orderIds: number[];
}

export interface UpdateDeliveryRouteInput {
  routeId: number;
  userId?: number;
  routeName?: string | null;
  driverName?: string;
  driverEmployeeId?: number | null;
  companionName?: string | null;
  vehiclePlate?: string | null;
  vehicleDescription?: string | null;
  vehicleId?: number | null;
  date?: string | null;
  orderIds?: number[];
}

export const deliveryRouteService = {
  async getDeliveryRoutes(filters: GetDeliveryRoutesFilter) {
    const whereClause: Prisma.DeliveryRouteWhereInput = {};
    if (filters.startDate && filters.endDate) {
      whereClause.date = {
        gte: new Date(String(filters.startDate)),
        lte: new Date(String(filters.endDate)),
      };
    }
    if (filters.status) {
      whereClause.status = String(filters.status);
    }

    return prisma.deliveryRoute.findMany({
      where: whereClause,
      include: {
        vehicle: { select: { id: true, plate: true, brand: true, model: true, status: true } },
        driverEmployee: {
          select: { id: true, firstName: true, lastName: true, position: true, phone: true, userId: true },
        },
        orders: {
          orderBy: [{ deliverySequence: 'asc' }, { id: 'asc' }],
          include: {
            persona: { select: SAFE_PERSONA_SELECT },
            items: { include: { product: true } },
          },
        },
        fieldReceipts: {
          where: { status: { not: 'VOIDED' } },
          orderBy: { capturedAt: 'asc' },
          select: {
            id: true,
            receiptNumber: true,
            provisionalCode: true,
            personaId: true,
            collectorUserId: true,
            totalAmount: true,
            status: true,
            notes: true,
            capturedAt: true,
            collector: { select: { id: true, username: true } },
            payments: {
              select: {
                id: true,
                paymentMethod: true,
                amount: true,
                status: true,
                bankAccountId: true,
                transferReference: true,
                checkBank: true,
                checkNumber: true,
                isEcheq: true,
              },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: filters.startDate && filters.endDate ? 500 : 120,
    });
  },

  async createDeliveryRoute(input: CreateDeliveryRouteInput) {
    const hasDriver = Boolean((input.driverName && input.driverName.trim()) || input.driverEmployeeId);
    const hasVehicle = Boolean((input.vehiclePlate && input.vehiclePlate.trim()) || input.vehicleId);
    if (!hasDriver || !hasVehicle || !Array.isArray(input.orderIds)) {
      throw new AppError(
        'Chofer, patente (o vehículo de la flota) y listado de pedidos son obligatorios.',
        400,
      );
    }

    const resolved = await logisticsResourcesService.resolveRouteDriverAndVehicle(input);
    if (!resolved.driverName || (!resolved.vehiclePlate && !resolved.vehicleId)) {
      throw new AppError(
        'Chofer, patente (o vehículo de la flota) y listado de pedidos son obligatorios.',
        400,
      );
    }

    const route = await prisma.$transaction(async (tx) => {
      const newRoute = await tx.deliveryRoute.create({
        data: {
          routeName: input.routeName ? String(input.routeName).trim() : null,
          driverName: resolved.driverName,
          driverEmployeeId: resolved.driverEmployeeId,
          companionName: input.companionName ? input.companionName.trim() : null,
          vehiclePlate: resolved.vehiclePlate || '',
          vehicleDescription: resolved.vehicleDescription || null,
          vehicleId: resolved.vehicleId,
          date: input.date ? new Date(input.date) : new Date(),
          status: 'PENDING',
        },
      });

      const { totalBultos, sourceRouteIdsToRecalc } = await validateAndAssignStopsInTx(
        tx,
        newRoute.id,
        'PENDING',
        input.orderIds,
      );

      const finalRoute =
        totalBultos > 0
          ? await tx.deliveryRoute.update({ where: { id: newRoute.id }, data: { totalBultos } })
          : newRoute;

      if (sourceRouteIdsToRecalc.length > 0) {
        await recalculatePendingRoutesInTx(tx, sourceRouteIdsToRecalc);
      }
      return finalRoute;
    });

    if (input.userId) {
      await logAudit({
        userId: input.userId,
        action: 'CREATE_DELIVERY_ROUTE',
        entityType: 'DeliveryRoute',
        entityId: route.id,
        newValues: route,
      });
    }
    return route;
  },

  async updateDeliveryRoute(input: UpdateDeliveryRouteInput) {
    const existing = await prisma.deliveryRoute.findUnique({
      where: { id: input.routeId },
      include: { orders: { select: { id: true } } },
    });
    if (!existing) throw new AppError('Hoja de ruta no encontrada.', 404);
    if (existing.status !== 'PENDING') {
      throw new AppError('Solo se pueden editar hojas de ruta en estado Pendiente.', 400);
    }

    const resolved = await logisticsResourcesService.resolveRouteDriverAndVehicle({
      driverName: input.driverName !== undefined ? input.driverName : existing.driverName,
      driverEmployeeId:
        input.driverEmployeeId !== undefined ? input.driverEmployeeId : existing.driverEmployeeId,
      vehicleId: input.vehicleId !== undefined ? input.vehicleId : existing.vehicleId,
      vehiclePlate:
        input.vehiclePlate !== undefined
          ? input.vehiclePlate
          : input.vehicleId !== undefined && input.vehicleId !== existing.vehicleId
            ? ''
            : existing.vehiclePlate,
      vehicleDescription:
        input.vehicleDescription !== undefined
          ? input.vehicleDescription
          : input.vehicleId !== undefined && input.vehicleId !== existing.vehicleId
            ? null
            : existing.vehicleDescription,
    });

    const updated = await prisma.$transaction(async (tx) => {
      let nextTotalBultos = existing.totalBultos;
      let sourceRoutesToRecalc: number[] = [];

      if (Array.isArray(input.orderIds)) {
        const nextIds = normalizeStopSequences(input.orderIds).map((s) => s.orderId);
        const nextSet = new Set(nextIds);
        const removedIds = existing.orders.map((o) => o.id).filter((id) => !nextSet.has(id));
        if (removedIds.length > 0) {
          await tx.order.updateMany({
            where: { id: { in: removedIds }, deliveryRouteId: input.routeId },
            data: { deliveryRouteId: null, deliverySequence: null },
          });
        }
        const assigned = await validateAndAssignStopsInTx(
          tx,
          input.routeId,
          existing.status,
          nextIds,
        );
        nextTotalBultos = assigned.totalBultos;
        sourceRoutesToRecalc = assigned.sourceRouteIdsToRecalc;
      }

      const route = await tx.deliveryRoute.update({
        where: { id: input.routeId },
        data: {
          routeName:
            input.routeName !== undefined ? (input.routeName ? input.routeName.trim() : null) : undefined,
          driverName: resolved.driverName || existing.driverName,
          driverEmployeeId: resolved.driverEmployeeId,
          companionName:
            input.companionName !== undefined
              ? input.companionName
                ? input.companionName.trim()
                : null
              : undefined,
          vehicleId: resolved.vehicleId,
          vehiclePlate: resolved.vehiclePlate,
          vehicleDescription: resolved.vehicleDescription,
          date: input.date ? new Date(input.date) : undefined,
          totalBultos: nextTotalBultos,
        },
      });

      if (sourceRoutesToRecalc.length > 0) {
        await recalculatePendingRoutesInTx(tx, sourceRoutesToRecalc);
      }
      return route;
    });

    if (input.userId) {
      await logAudit({
        userId: input.userId,
        action: 'UPDATE_DELIVERY_ROUTE',
        entityType: 'DeliveryRoute',
        entityId: updated.id,
        oldValues: existing,
        newValues: updated,
      });
    }
    return updated;
  },

  async updateRouteStatus(routeId: number, status: string, userId?: number) {
    if (!status || !['PENDING', 'IN_TRANSIT', 'COMPLETED'].includes(status)) {
      throw new AppError('Estado inválido.', 400);
    }
    if (status === 'COMPLETED') {
      throw new AppError(
        'Para finalizar un viaje debés usar "Rendir / Liquidar Viaje" para registrar entregas, cuenta corriente y pedidos no entregados.',
        400,
      );
    }

    const updateData: Prisma.DeliveryRouteUpdateInput = { status };
    if (status === 'IN_TRANSIT') {
      const existing = await prisma.deliveryRoute.findUnique({
        where: { id: routeId },
        select: {
          signedByDriverAt: true,
          orders: { select: { bultosCount: true } },
        },
      });
      if (!existing) throw new AppError('Hoja de ruta no encontrada.', 404);
      const totalBultos = sumIntegerAmounts(
        existing.orders.map((o) => Math.max(1, toDecimal(o.bultosCount ?? 1).toNumber())),
      ).toNumber();
      updateData.custodyStatus = 'LOADED_IN_TRANSIT';
      updateData.totalBultos = totalBultos;
      updateData.signedByDriverAt = existing.signedByDriverAt ?? new Date();
    }

    const route = await prisma.deliveryRoute.update({
      where: { id: routeId },
      data: updateData,
      include: { orders: true },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_DELIVERY_ROUTE_STATUS',
        entityType: 'DeliveryRoute',
        entityId: route.id,
        newValues: route,
      });
    }
    return route;
  },

  async deleteDeliveryRoute(routeId: number, userId?: number) {
    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      include: { orders: true },
    });
    if (!route) throw new AppError('Hoja de ruta no encontrada.', 404);
    if (route.status !== 'PENDING') {
      throw new AppError('Solo se pueden eliminar hojas de ruta en estado Pendiente.', 400);
    }

    await prisma.$transaction(async (tx) => {
      if (route.orders.length > 0) {
        await tx.order.updateMany({
          where: { deliveryRouteId: routeId },
          data: { deliveryRouteId: null, deliverySequence: null },
        });
      }
      await tx.deliveryRoute.delete({ where: { id: routeId } });
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'DELETE_DELIVERY_ROUTE',
        entityType: 'DeliveryRoute',
        entityId: routeId,
        oldValues: route,
      });
    }
  },

  async getLogisticsResources() {
    return logisticsResourcesService.getLogisticsResources();
  },
};
