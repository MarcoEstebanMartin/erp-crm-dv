import {
  BillingType,
  MaintenanceType,
  PaymentMethod,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import { roundToIntegerPeso, roundToTwoDecimals } from '../../core/money';

export interface CreateMaintenanceInput {
  userId: number;
  vehicleId: number;
  type: MaintenanceType | string;
  description: string;
  cost: number | string;
  odometer: number | string;
  date?: string | null;
  supplierId?: number | null;
  affectFinance?: boolean;
  paymentMethod?: PaymentMethod | string;
  bankAccountId?: number | null;
  billingType?: BillingType | string;
}

export const vehicleMaintenanceService = {
  async createMaintenance(input: CreateMaintenanceInput) {
    if (
      !input.type ||
      !input.description ||
      input.cost === undefined ||
      input.odometer === undefined
    ) {
      throw new AppError(
        'Tipo de mantenimiento, descripción, costo y kilometraje son requeridos.',
        400,
      );
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId },
    });
    if (!vehicle) {
      throw new AppError('Vehículo no encontrado.', 404);
    }

    const normalizedCost = roundToIntegerPeso(input.cost).toNumber();
    const normalizedOdometer = roundToIntegerPeso(input.odometer).toNumber();
    const cleanDescription = String(input.description).trim();

    const result = await prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      if (input.affectFinance) {
        const transaction = await tx.transaction.create({
          data: {
            userId: input.userId,
            type: TransactionType.OUTCOME,
            paymentMethod: (input.paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            billingType: (input.billingType as BillingType) || BillingType.INTERNAL,
            amount: normalizedCost,
            description: `Gasto de Flota (${vehicle.plate}) - ${cleanDescription}`,
            verified: true,
            personaId: input.supplierId ? Number(input.supplierId) : null,
            bankAccountId: input.bankAccountId ? Number(input.bankAccountId) : null,
          },
        });
        transactionId = transaction.id;
      }

      const maintenance = await tx.vehicleMaintenance.create({
        data: {
          vehicleId: input.vehicleId,
          type: input.type as MaintenanceType,
          description: cleanDescription,
          cost: normalizedCost,
          odometer: normalizedOdometer,
          date: input.date ? new Date(input.date) : new Date(),
          supplierId: input.supplierId ? Number(input.supplierId) : null,
          transactionId,
        },
      });

      if (normalizedOdometer > vehicle.currentOdometer) {
        await tx.vehicle.update({
          where: { id: input.vehicleId },
          data: { currentOdometer: normalizedOdometer },
        });
      }

      return { maintenance, transactionId };
    });

    await logAudit({
      userId: input.userId,
      action: 'CREATE_VEHICLE_MAINTENANCE',
      entityType: 'VehicleMaintenance',
      entityId: result.maintenance.id,
      newValues: {
        vehicleId: input.vehicleId,
        cost: normalizedCost,
        type: input.type,
      },
    });

    return result;
  },

  async deleteMaintenance(maintenanceId: number, userId: number) {
    const maintenance = await prisma.vehicleMaintenance.findUnique({
      where: { id: maintenanceId },
    });
    if (!maintenance) {
      throw new AppError('Mantenimiento no encontrado.', 404);
    }

    await prisma.$transaction(async (tx) => {
      if (maintenance.transactionId) {
        await tx.transaction.delete({
          where: { id: maintenance.transactionId },
        });
      }

      await tx.vehicleMaintenance.delete({
        where: { id: maintenanceId },
      });
    });

    await logAudit({
      userId,
      action: 'DELETE_VEHICLE_MAINTENANCE',
      entityType: 'VehicleMaintenance',
      entityId: maintenanceId,
      oldValues: { cost: roundToTwoDecimals(maintenance.cost.toString()).toNumber() },
    });
  },
};
