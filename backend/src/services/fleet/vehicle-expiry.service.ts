import { ExpiryType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';

export interface CreateExpiryInput {
  userId: number;
  vehicleId: number;
  type: ExpiryType | string;
  description: string;
  expirationDate: string | Date;
}

export interface UpdateExpiryInput {
  userId: number;
  expiryId: number;
  type?: ExpiryType | string;
  description?: string;
  expirationDate?: string | Date;
}

export const vehicleExpiryService = {
  async createExpiry(input: CreateExpiryInput) {
    if (!input.type || !input.description || !input.expirationDate) {
      throw new AppError(
        'Tipo de vencimiento, descripción y fecha de vencimiento son requeridos.',
        400,
      );
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
    });
    if (!vehicle) {
      throw new AppError('Vehículo no encontrado.', 404);
    }

    const expiry = await prisma.vehicleExpiry.create({
      data: {
        vehicleId: input.vehicleId,
        type: input.type as ExpiryType,
        description: String(input.description).trim(),
        expirationDate: new Date(input.expirationDate),
      },
    });

    await logAudit({
      userId: input.userId,
      action: 'CREATE_VEHICLE_EXPIRY',
      entityType: 'VehicleExpiry',
      entityId: expiry.id,
      newValues: { vehicleId: input.vehicleId, type: input.type },
    });

    return expiry;
  },

  async updateExpiry(input: UpdateExpiryInput) {
    const existing = await prisma.vehicleExpiry.findUnique({
      where: { id: input.expiryId },
    });
    if (!existing) {
      throw new AppError('Registro de vencimiento no encontrado.', 404);
    }

    const updated = await prisma.vehicleExpiry.update({
      where: { id: input.expiryId },
      data: {
        type: input.type ? (input.type as ExpiryType) : existing.type,
        description:
          input.description !== undefined
            ? String(input.description).trim()
            : existing.description,
        expirationDate: input.expirationDate
          ? new Date(input.expirationDate)
          : existing.expirationDate,
      },
    });

    await logAudit({
      userId: input.userId,
      action: 'UPDATE_VEHICLE_EXPIRY',
      entityType: 'VehicleExpiry',
      entityId: input.expiryId,
      oldValues: { expirationDate: existing.expirationDate },
      newValues: { expirationDate: updated.expirationDate },
    });

    return updated;
  },

  async deleteExpiry(expiryId: number, userId: number) {
    const existing = await prisma.vehicleExpiry.findUnique({
      where: { id: expiryId },
    });
    if (!existing) {
      throw new AppError('Registro de vencimiento no encontrado.', 404);
    }

    await prisma.vehicleExpiry.delete({ where: { id: expiryId } });

    await logAudit({
      userId,
      action: 'DELETE_VEHICLE_EXPIRY',
      entityType: 'VehicleExpiry',
      entityId: expiryId,
      oldValues: { type: existing.type },
    });
  },
};
