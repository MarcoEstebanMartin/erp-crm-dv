import { VehicleStatus } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso } from '../../core/money';

export interface CreateVehicleInput {
  userId: number;
  plate: string;
  brand: string;
  model: string;
  year: number | string;
  currentOdometer: number | string;
  status?: VehicleStatus | string;
  notes?: string | null;
}

export interface UpdateVehicleInput {
  userId: number;
  vehicleId: number;
  brand?: string;
  model?: string;
  year?: number | string;
  currentOdometer?: number | string;
  status?: VehicleStatus | string;
  notes?: string | null;
}

export const vehicleService = {
  async getVehicles() {
    return prisma.vehicle.findMany({
      include: {
        maintenances: {
          orderBy: { date: 'desc' },
          take: 10,
          include: {
            supplier: {
              select: { id: true, name: true },
            },
          },
        },
        expirations: {
          orderBy: { expirationDate: 'asc' },
        },
        fuelLogs: {
          orderBy: { odometer: 'desc' },
          take: 10,
        },
      },
      orderBy: { brand: 'asc' },
    });
  },

  async createVehicle(input: CreateVehicleInput) {
    if (
      !input.plate ||
      !input.brand ||
      !input.model ||
      !input.year ||
      input.currentOdometer === undefined
    ) {
      throw new AppError(
        'Patente, marca, modelo, año y kilometraje actual son campos requeridos.',
        400,
      );
    }

    const normalizedPlate = String(input.plate).toUpperCase().trim();
    const existing = await prisma.vehicle.findUnique({
      where: { plate: normalizedPlate },
    });

    if (existing) {
      throw new AppError(
        `Ya existe un vehículo registrado con la patente ${input.plate}.`,
        400,
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plate: normalizedPlate,
        brand: String(input.brand).trim(),
        model: String(input.model).trim(),
        year: roundToIntegerPeso(input.year).toNumber(),
        currentOdometer: roundToIntegerPeso(input.currentOdometer).toNumber(),
        status: (input.status as VehicleStatus) || VehicleStatus.ACTIVE,
        notes: input.notes ? String(input.notes).trim() : null,
      },
    });

    await logAudit({
      userId: input.userId,
      action: 'CREATE_VEHICLE',
      entityType: 'Vehicle',
      entityId: vehicle.id,
      newValues: { plate: vehicle.plate },
    });

    return vehicle;
  },

  async updateVehicle(input: UpdateVehicleInput) {
    const existing = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
    });
    if (!existing) {
      throw new AppError('Vehículo no encontrado.', 404);
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: input.vehicleId },
      data: {
        brand: input.brand ? String(input.brand).trim() : undefined,
        model: input.model ? String(input.model).trim() : undefined,
        year: input.year !== undefined ? roundToIntegerPeso(input.year).toNumber() : undefined,
        currentOdometer:
          input.currentOdometer !== undefined
            ? roundToIntegerPeso(input.currentOdometer).toNumber()
            : undefined,
        status: (input.status as VehicleStatus) || undefined,
        notes:
          input.notes !== undefined
            ? input.notes
              ? String(input.notes).trim()
              : null
            : undefined,
      },
    });

    await logAudit({
      userId: input.userId,
      action: 'UPDATE_VEHICLE',
      entityType: 'Vehicle',
      entityId: vehicle.id,
      newValues: { status: vehicle.status, currentOdometer: vehicle.currentOdometer },
    });

    return vehicle;
  },

  async deleteVehicle(vehicleId: number, userId: number) {
    const existing = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!existing) {
      throw new AppError('Vehículo no encontrado.', 404);
    }

    await prisma.vehicle.delete({ where: { id: vehicleId } });

    await logAudit({
      userId,
      action: 'DELETE_VEHICLE',
      entityType: 'Vehicle',
      entityId: vehicleId,
      oldValues: { plate: existing.plate },
    });
  },
};
