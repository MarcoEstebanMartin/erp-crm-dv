import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { env } from '../../config/env.config';
import {
  buildDispatchDriverCandidates,
  isRoadFleetVehicle,
  type DispatchDriverCandidate,
} from '../../engines/delivery-dispatch.engine';

export interface FleetVehicleOption {
  id: number;
  plate: string;
  brand: string;
  model: string;
  description: string;
  currentOdometer: number;
}

export interface LegacyVehicleOption {
  id?: number;
  plate: string;
  description: string;
}

export interface LogisticsResourcesResponse {
  drivers: string[];
  driverOptions: DispatchDriverCandidate[];
  vehicles: LegacyVehicleOption[];
  fleetVehicles: FleetVehicleOption[];
  googleMapsApiKey: string | null;
}

export const logisticsResourcesService = {
  /**
   * Obtiene flota vial activa (sin autoelevadores ni registros internos) y nómina real
   * de conductores desde PostgreSQL, manteniendo compatibilidad con consumidores legados.
   */
  async getLogisticsResources(): Promise<LogisticsResourcesResponse> {
    const canQueryVehicles = typeof (prisma as any)?.vehicle?.findMany === 'function';
    const canQueryEmployees = typeof (prisma as any)?.employee?.findMany === 'function';
    const canQueryPastRoutes = typeof (prisma as any)?.deliveryRoute?.findMany === 'function';

    const [rawVehicles, rawEmployees, pastRoutes] = await Promise.all([
      canQueryVehicles
        ? prisma.vehicle.findMany({
            where: { status: 'ACTIVE' },
            orderBy: [{ brand: 'asc' }, { plate: 'asc' }],
            select: {
              id: true,
              plate: true,
              brand: true,
              model: true,
              status: true,
              currentOdometer: true,
            },
          })
        : Promise.resolve([]),
      canQueryEmployees
        ? prisma.employee.findMany({
            where: { isActive: true },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              position: true,
              department: true,
              isActive: true,
              userId: true,
            },
          })
        : Promise.resolve([]),
      canQueryPastRoutes
        ? prisma.deliveryRoute
            .findMany({
              select: { vehiclePlate: true, vehicleDescription: true },
              take: 100,
              orderBy: { id: 'desc' },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const fleetVehicles: FleetVehicleOption[] = (rawVehicles || [])
      .filter((v) => isRoadFleetVehicle(v))
      .map((v) => ({
        id: v.id,
        plate: v.plate.trim().toUpperCase(),
        brand: v.brand.trim(),
        model: v.model.trim(),
        description: `${v.brand} ${v.model}`.trim(),
        currentOdometer: v.currentOdometer,
      }));

    const vehicleMap = new Map<string, LegacyVehicleOption>();
    for (const fv of fleetVehicles) {
      vehicleMap.set(fv.plate, {
        id: fv.id,
        plate: fv.plate,
        description: fv.description,
      });
    }

    for (const r of pastRoutes || []) {
      const plate = (r.vehiclePlate || '').trim().toUpperCase();
      if (!plate || vehicleMap.has(plate)) continue;
      if (!isRoadFleetVehicle({ plate, brand: r.vehicleDescription || '', status: 'ACTIVE' })) {
        continue;
      }
      vehicleMap.set(plate, {
        plate,
        description: r.vehicleDescription?.trim() || '',
      });
    }

    const driverOptions = buildDispatchDriverCandidates(rawEmployees || []);
    const drivers = driverOptions.map((d) => d.fullName);

    const googleMapsApiKey =
      (
        env.GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        ''
      ).trim() || null;

    return {
      drivers,
      driverOptions,
      vehicles: Array.from(vehicleMap.values()),
      fleetVehicles,
      googleMapsApiKey,
    };
  },

  /**
   * Resuelve conductor (desde Employee si viene driverEmployeeId) y vehículo (desde Vehicle por ID o patente)
   * preservando siempre snapshot legible para el viaje histórico.
   */
  async resolveRouteDriverAndVehicle(input: {
    driverName?: string | null;
    driverEmployeeId?: number | null;
    vehicleId?: number | null;
    vehiclePlate?: string | null;
    vehicleDescription?: string | null;
  }): Promise<{
    driverName: string;
    driverEmployeeId: number | null;
    vehicleId: number | null;
    vehiclePlate: string;
    vehicleDescription: string | null;
  }> {
    let resolvedDriverName = input.driverName ? String(input.driverName).trim() : '';
    let resolvedDriverEmployeeId: number | null = input.driverEmployeeId
      ? Number(input.driverEmployeeId)
      : null;

    if (resolvedDriverEmployeeId && typeof (prisma as any)?.employee?.findUnique === 'function') {
      const emp = await prisma.employee.findUnique({
        where: { id: resolvedDriverEmployeeId },
        select: { id: true, firstName: true, lastName: true, isActive: true },
      });
      if (!emp || !emp.isActive) {
        throw new AppError('Conductor seleccionado no encontrado o inactivo.', 400);
      }
      if (!resolvedDriverName) {
        resolvedDriverName = [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
      }
    }

    let finalPlate = input.vehiclePlate ? String(input.vehiclePlate).trim().toUpperCase() : '';
    let finalDesc = input.vehicleDescription ? String(input.vehicleDescription).trim() : null;
    let resolvedVehicleId: number | null = input.vehicleId ? Number(input.vehicleId) : null;

    if (resolvedVehicleId && typeof (prisma as any)?.vehicle?.findUnique === 'function') {
      const dbVehicle = await prisma.vehicle.findUnique({ where: { id: resolvedVehicleId } });
      if (dbVehicle) {
        if (!finalPlate) finalPlate = dbVehicle.plate.trim().toUpperCase();
        if (!finalDesc) finalDesc = `${dbVehicle.brand} ${dbVehicle.model}`.trim();
      } else {
        resolvedVehicleId = null;
      }
    } else if (
      !resolvedVehicleId &&
      finalPlate &&
      typeof (prisma as any)?.vehicle?.findFirst === 'function'
    ) {
      const byPlate = await prisma.vehicle.findFirst({
        where: { plate: { equals: finalPlate, mode: 'insensitive' } },
      });
      if (byPlate) {
        resolvedVehicleId = byPlate.id;
        finalPlate = byPlate.plate.trim().toUpperCase();
        if (!finalDesc) finalDesc = `${byPlate.brand} ${byPlate.model}`.trim();
      }
    }

    return {
      driverName: resolvedDriverName,
      driverEmployeeId: resolvedDriverEmployeeId,
      vehicleId: resolvedVehicleId,
      vehiclePlate: finalPlate,
      vehicleDescription: finalDesc,
    };
  },
};
