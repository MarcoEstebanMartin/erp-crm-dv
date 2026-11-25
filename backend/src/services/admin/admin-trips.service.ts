import { OrderStatus, Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { roundToIntegerPeso, roundToTwoDecimals } from '../../core/money';
import { VehicleFuelLogMetricInput } from '../../engines/fuel.engine';
import { computeTripProfitabilityMetrics } from '../../engines/reports-trips.engine';
import { resolveReportDateRange } from './admin-report.helpers';

interface TripCostRow {
  id: number;
  tripKm: Prisma.Decimal | number | string | null;
  tripExpenses: Prisma.Decimal | number | string | null;
}

export class AdminTripsSubService {
  async getTripProfitabilityReport(filters: { startDate?: string; endDate?: string }) {
    const { range } = resolveReportDateRange({
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const routes = await prisma.deliveryRoute.findMany({
      where: range ? { date: range } : {},
      include: {
        orders: {
          where: { status: OrderStatus.DELIVERED },
          include: {
            persona: { select: { city: true } },
            items: {
              include: {
                product: { select: { isPesable: true, costPrice: true } },
              },
            },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    const routeIds = routes.map((r) => r.id);
    const vehicleIds = Array.from(
      new Set(routes.map((r) => r.vehicleId).filter((id): id is number => typeof id === 'number')),
    );

    const [tripCostRows, fuelLogs] = await Promise.all([
      routeIds.length > 0
        ? prisma.$queryRaw<TripCostRow[]>`
            SELECT id, "tripKm", "tripExpenses"
            FROM "DeliveryRoute"
            WHERE id IN (${Prisma.join(routeIds)})
          `
        : Promise.resolve<TripCostRow[]>([]),
      vehicleIds.length > 0
        ? prisma.fuelLog.findMany({
            where: { vehicleId: { in: vehicleIds } },
            select: {
              vehicleId: true,
              odometer: true,
              liters: true,
              totalCost: true,
              status: true,
            },
            orderBy: { odometer: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const tripCostById = new Map<number, TripCostRow>(tripCostRows.map((row) => [row.id, row]));
    const vehicleFuelLogsByVehicleId = new Map<number, VehicleFuelLogMetricInput[]>();
    for (const log of fuelLogs) {
      const list = vehicleFuelLogsByVehicleId.get(log.vehicleId) || [];
      list.push({
        odometer: log.odometer,
        liters: log.liters,
        totalCost: log.totalCost,
        status: log.status,
      });
      vehicleFuelLogsByVehicleId.set(log.vehicleId, list);
    }

    return computeTripProfitabilityMetrics({
      routes: routes.map((route) => {
        const costs = tripCostById.get(route.id);
        return {
          id: route.id,
          routeName: route.routeName,
          driverName: route.driverName,
          vehicleId: route.vehicleId,
          vehiclePlate: route.vehiclePlate,
          vehicleDescription: route.vehicleDescription,
          status: route.status,
          date: route.date,
          tripKm: costs?.tripKm ?? null,
          tripExpenses: costs?.tripExpenses ?? 0,
          orders: route.orders,
        };
      }),
      vehicleFuelLogsByVehicleId,
    });
  }

  async updateRouteTripCosts(
    routeId: number,
    input: { tripKm?: number | null; tripExpenses?: number | null },
  ) {
    const existing = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError('Hoja de ruta no encontrada.', 404);
    }

    const normalizedKm =
      input.tripKm !== undefined && input.tripKm !== null && input.tripKm > 0
        ? roundToTwoDecimals(input.tripKm).toNumber()
        : null;
    const normalizedExpenses =
      input.tripExpenses !== undefined && input.tripExpenses !== null && input.tripExpenses > 0
        ? roundToIntegerPeso(input.tripExpenses).toNumber()
        : 0;

    await prisma.$executeRaw`
      UPDATE "DeliveryRoute"
      SET "tripKm" = ${normalizedKm}, "tripExpenses" = ${normalizedExpenses}, "updatedAt" = NOW()
      WHERE id = ${routeId}
    `;

    return {
      id: routeId,
      tripKm: normalizedKm,
      tripExpenses: normalizedExpenses,
    };
  }
}

export const adminTripsSubService = new AdminTripsSubService();
