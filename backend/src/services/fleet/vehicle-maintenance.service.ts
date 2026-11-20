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
import { resolveExpenseCategoryId } from '../expenses/expense-category.helper';

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
    const maintenanceDate = input.date ? new Date(input.date) : new Date();
    const resolvedMethod = (input.paymentMethod as PaymentMethod) || PaymentMethod.CASH;

    const result = await prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      if (input.affectFinance) {
        if (resolvedMethod === PaymentMethod.BANK_TRANSFER && input.bankAccountId && tx.bankAccount?.update) {
          await tx.bankAccount.update({
            where: { id: Number(input.bankAccountId) },
            data: { balance: { decrement: normalizedCost } },
          });
        }

        const transaction = await tx.transaction.create({
          data: {
            userId: input.userId,
            type: TransactionType.OUTCOME,
            paymentMethod: resolvedMethod,
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
          date: maintenanceDate,
          supplierId: input.supplierId ? Number(input.supplierId) : null,
          transactionId,
        },
      });

      // Sincronización automática con la Planilla de Gastos (sin duplicar movimiento financiero)
      const categoryHint = input.type === 'FUEL' ? 'Combustible' : 'Mantenimiento';
      const categoryId = await resolveExpenseCategoryId(tx as any, categoryHint);
      if (categoryId && tx.expense?.create) {
        await tx.expense.create({
          data: {
            amount: normalizedCost,
            date: maintenanceDate,
            description: `${vehicle.plate} - ${cleanDescription}`,
            categoryId,
            userId: input.userId,
            paymentMethod: resolvedMethod,
            bankAccountId: input.bankAccountId ? Number(input.bankAccountId) : undefined,
            vehicleId: input.vehicleId,
            transactionId: transactionId ?? undefined,
          },
        });
      }

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
        if (tx.expense?.deleteMany) {
          await tx.expense.deleteMany({
            where: { transactionId: maintenance.transactionId },
          });
        }
        const trans = tx.transaction.findUnique
          ? await tx.transaction.findUnique({ where: { id: maintenance.transactionId } })
          : null;
        if (trans?.bankAccountId && tx.bankAccount?.update) {
          const restoreAmt = roundToIntegerPeso(trans.amount.toString()).toNumber();
          await tx.bankAccount.update({
            where: { id: trans.bankAccountId },
            data: { balance: { increment: restoreAmt } },
          });
        }
        await tx.transaction.delete({
          where: { id: maintenance.transactionId },
        });
      } else if (tx.expense?.deleteMany) {
        await tx.expense.deleteMany({
          where: {
            vehicleId: maintenance.vehicleId,
            date: maintenance.date,
            amount: maintenance.cost,
            transactionId: null,
          },
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
