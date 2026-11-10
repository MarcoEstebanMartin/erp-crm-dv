import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { sumIntegerAmounts, toDecimal } from '../../core/money';

export interface RecordRouteGpsPingInput {
  routeId: number;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
}

export const routeCustodyGpsService = {
  async transferRouteCustody(routeId: number, driverNotes?: string | null, userId?: number) {
    if (isNaN(routeId) || routeId <= 0) {
      throw new AppError('ID de ruta inválido.', 400);
    }

    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      include: {
        orders: {
          select: { id: true, bultosCount: true },
        },
      },
    });

    if (!route) {
      throw new AppError('Hoja de ruta no encontrada.', 404);
    }

    const totalBultos = sumIntegerAmounts(
      route.orders.map((o) => Math.max(1, toDecimal(o.bultosCount ?? 1).toNumber())),
    ).toNumber();

    const updatedRoute = await prisma.deliveryRoute.update({
      where: { id: routeId },
      data: {
        custodyStatus: 'LOADED_IN_TRANSIT',
        status: 'IN_TRANSIT',
        totalBultos,
        signedByDriverAt: new Date(),
        driverNotes: driverNotes ? String(driverNotes).trim() : null,
      },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'TRANSFER_ROUTE_CUSTODY',
        entityType: 'DeliveryRoute',
        entityId: routeId,
        newValues: updatedRoute,
      });
    }

    return updatedRoute;
  },

  async recordRouteGpsPing(input: RecordRouteGpsPingInput) {
    if (isNaN(input.routeId) || input.routeId <= 0) {
      throw new AppError('ID de ruta inválido.', 400);
    }

    const lat = toDecimal(input.latitude).toNumber();
    const lng = toDecimal(input.longitude).toNumber();

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new AppError('Coordenadas GPS inválidas.', 400);
    }

    const spd =
      input.speed !== undefined && input.speed !== null ? toDecimal(input.speed).toNumber() : null;
    const hdg =
      input.heading !== undefined && input.heading !== null
        ? toDecimal(input.heading).toNumber()
        : null;

    const route = await prisma.deliveryRoute.findUnique({
      where: { id: input.routeId },
      select: { id: true },
    });

    if (!route) {
      throw new AppError('Hoja de ruta no encontrada.', 404);
    }

    const now = new Date();

    const { updatedRoute, ping } = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryRoute.update({
        where: { id: input.routeId },
        data: {
          currentLat: lat,
          currentLng: lng,
          currentSpeed: spd,
          lastGpsUpdate: now,
        },
      });

      const createdPing = await tx.routeGpsPing.create({
        data: {
          deliveryRouteId: input.routeId,
          latitude: lat,
          longitude: lng,
          speed: spd,
          heading: hdg,
          createdAt: now,
        },
      });

      return { updatedRoute: updated, ping: createdPing };
    });

    return {
      routeId: updatedRoute.id,
      currentLat: updatedRoute.currentLat,
      currentLng: updatedRoute.currentLng,
      lastGpsUpdate: updatedRoute.lastGpsUpdate,
      pingId: ping.id,
    };
  },

  async getRouteGpsHistory(routeId: number) {
    if (isNaN(routeId) || routeId <= 0) {
      throw new AppError('ID de ruta inválido.', 400);
    }

    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      select: {
        id: true,
        driverName: true,
        vehiclePlate: true,
        status: true,
        custodyStatus: true,
        currentLat: true,
        currentLng: true,
        currentSpeed: true,
        lastGpsUpdate: true,
      },
    });

    if (!route) {
      throw new AppError('Hoja de ruta no encontrada.', 404);
    }

    const pings = await prisma.routeGpsPing.findMany({
      where: { deliveryRouteId: routeId },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    });

    return { route, pings };
  },
};
