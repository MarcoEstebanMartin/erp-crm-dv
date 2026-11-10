import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';

export const SAFE_PERSONA_SELECT = {
  id: true, name: true, cuit: true, address: true, city: true, barrio: true,
  province: true, zipCode: true, phone: true, email: true, rubro: true, birthDate: true,
  isClient: true, isProvider: true, isSeller: true, isCommissionAgent: true,
  creditLimit: true, maxUnpaidInvoices: true, priceList: true, discount: true,
  contacts: true, outstandingBalance: true, route: true, saleRouteId: true,
  routeSequence: true, latitude: true, longitude: true, sellerId: true,
  iibbAliquot: true, paymentTermDays: true, isActive: true, createdAt: true, updatedAt: true,
} satisfies Prisma.PersonaSelect;

const AUTHORIZED_DRIVERS = ['Agustin', 'Fabian', 'Matias', 'Miguel', 'Norberto'];

const DEFAULT_VEHICLES = [
  { plate: 'AB 919 WO', description: 'MERCEDES ACCELO 1016' },
  { plate: 'AE 178 EC', description: 'MERCEDES ACCELO 815' },
  { plate: 'FUL 385', description: 'MERCEDES 710' },
  { plate: 'AI 148 CP', description: 'KYC MAMUT' },
  { plate: 'AG 422 GS', description: 'PEUGEOT PARTNER BLANCA' },
  { plate: 'AE 764 FE', description: 'PEUGEOT PARTNER' },
];

export interface GetDeliveryRoutesFilter {
  startDate?: string;
  endDate?: string;
  status?: string;
}

export interface CreateDeliveryRouteInput {
  userId?: number;
  driverName: string;
  companionName?: string | null;
  vehiclePlate?: string | null;
  vehicleDescription?: string | null;
  vehicleId?: number | null;
  date?: string | null;
  orderIds: number[];
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
        orders: {
          include: {
            persona: { select: SAFE_PERSONA_SELECT },
            items: { include: { product: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  },

  async createDeliveryRoute(input: CreateDeliveryRouteInput) {
    if (
      !input.driverName ||
      (!input.vehiclePlate && !input.vehicleId) ||
      !Array.isArray(input.orderIds)
    ) {
      throw new AppError(
        'Chofer, patente (o vehículo de la flota) y listado de pedidos son obligatorios.',
        400,
      );
    }

    let finalPlate = input.vehiclePlate ? String(input.vehiclePlate).trim() : '';
    let finalDesc = input.vehicleDescription ? String(input.vehicleDescription).trim() : null;
    let vId = input.vehicleId ? Number(input.vehicleId) : null;

    if (vId) {
      const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vId } });
      if (dbVehicle) {
        if (!finalPlate) finalPlate = dbVehicle.plate;
        if (!finalDesc) finalDesc = `${dbVehicle.brand} ${dbVehicle.model}`;
      } else {
        vId = null;
      }
    }

    const route = await prisma.$transaction(async (tx) => {
      const newRoute = await tx.deliveryRoute.create({
        data: {
          driverName: input.driverName.trim(),
          companionName: input.companionName ? input.companionName.trim() : null,
          vehiclePlate: finalPlate || '',
          vehicleDescription: finalDesc || null,
          vehicleId: vId,
          date: input.date ? new Date(input.date) : new Date(),
          status: 'PENDING',
        },
      });

      if (input.orderIds.length > 0) {
        await tx.order.updateMany({
          where: { id: { in: input.orderIds.map(Number) } },
          data: { deliveryRouteId: newRoute.id },
        });
      }

      return newRoute;
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

  async updateRouteStatus(routeId: number, status: string, userId?: number) {
    if (!status || !['PENDING', 'IN_TRANSIT', 'COMPLETED'].includes(status)) {
      throw new AppError('Estado inválido.', 400);
    }

    const route = await prisma.$transaction(async (tx) => {
      const updatedRoute = await tx.deliveryRoute.update({
        where: { id: routeId },
        data: { status },
        include: { orders: true },
      });

      if (status === 'COMPLETED' && updatedRoute.orders.length > 0) {
        await tx.order.updateMany({
          where: { deliveryRouteId: updatedRoute.id, status: { not: 'CANCELLED' } },
          data: { status: 'DELIVERED' },
        });
      }

      return updatedRoute;
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
          data: { deliveryRouteId: null },
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
    const pastRoutes = await prisma.deliveryRoute.findMany({
      select: { driverName: true, vehiclePlate: true, vehicleDescription: true },
    });

    const vehicleMap = new Map<string, string>();
    DEFAULT_VEHICLES.forEach((v) => vehicleMap.set(v.plate.toUpperCase(), v.description));
    pastRoutes.forEach((r) => {
      if (r.vehiclePlate) {
        const plate = r.vehiclePlate.trim().toUpperCase();
        if (!vehicleMap.has(plate)) {
          vehicleMap.set(plate, r.vehicleDescription?.trim() || '');
        }
      }
    });

    const vehicles = Array.from(vehicleMap.entries())
      .map(([plate, description]) => ({ plate, description }))
      .sort((a, b) => a.plate.localeCompare(b.plate));

    return { drivers: AUTHORIZED_DRIVERS, vehicles };
  },
};
