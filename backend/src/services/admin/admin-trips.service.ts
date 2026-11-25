import { OrderStatus } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { roundToIntegerPeso, roundToTwoDecimals } from '../../core/money';
import { VehicleFuelLogMetricInput } from '../../engines/fuel.engine';
import { computeTripProfitabilityMetrics } from '../../engines/reports-trips.engine';
import { resolveReportDateRange } from './admin-report.helpers';

const FUEL_HISTORY_WINDOW_DAYS = 365;

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

    const vehicleIds = Array.from(
      new Set(routes.map((r) => r.vehicleId).filter((id): id is number => typeof id === 'number')),
    );

    const fuelWindowStart = new Date(Date.now() - FUEL_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const fuelLogs =
      vehicleIds.length > 0
        ? await prisma.fuelLog.findMany({
            where: {
              vehicleId: { in: vehicleIds },
              date: { gte: fuelWindowStart },
            },
            select: {
              vehicleId: true,
              odometer: true,
              liters: true,
              totalCost: true,
              status: true,
            },
            orderBy: { odometer: 'asc' },
          })
        : [];

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
      routes: routes.map((route) => ({
        id: route.id,
        routeName: route.routeName,
        driverName: route.driverName,
        vehicleId: route.vehicleId,
        vehiclePlate: route.vehiclePlate,
        vehicleDescription: route.vehicleDescription,
        status: route.status,
        date: route.date,
        tripKm: route.tripKm ?? null,
        tripExpenses: route.tripExpenses ?? 0,
        orders: route.orders,
      })),
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

    await prisma.deliveryRoute.update({
      where: { id: routeId },
      data: {
        tripKm: normalizedKm,
        tripExpenses: normalizedExpenses,
      },
    });

    return {
      id: routeId,
      tripKm: normalizedKm,
      tripExpenses: normalizedExpenses,
    };
  }
}

export const adminTripsSubService = new AdminTripsSubService();
