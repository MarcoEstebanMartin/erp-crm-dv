import { BillingType, FuelLogStatus, FuelType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { logAudit } from '../../utils/audit';
import {
  calculateFuelSettlement,
  calculateVehicleFuelStats,
  FuelTypeValue,
} from '../../engines/fuel.engine';
import { roundToTwoDecimals } from '../../core/money';

export interface CreateFuelLogInput {
  userId: number;
  vehicleId: number;
  odometer: number;
  liters: number;
  date?: string | null;
  ticketNumber?: string | null;
  isFullTank?: boolean;
  notes?: string | null;
}

export interface SettleFuelLogsInput {
  userId: number;
  logIds: number[];
  dieselPricePerLiter?: number;
  naftaPricePerLiter?: number;
  dieselTotalCost?: number;
  naftaTotalCost?: number;
  settledDate?: string | null;
  affectFinance?: boolean;
  paymentMethod?: string;
  bankAccountId?: number | null;
  billingType?: string;
  notes?: string | null;
}

export const fuelService = {
  async getFuelLogs(filters: {
    vehicleId?: number;
    status?: FuelLogStatus;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: Record<string, unknown> = {
      vehicle: { trackFuel: true },
    };
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.date = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }

    return prisma.fuelLog.findMany({
      where,
      include: {
        vehicle: {
          select: { id: true, plate: true, brand: true, model: true, fuelType: true },
        },
        transaction: {
          select: { id: true, movementId: true, amount: true, paymentMethod: true },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  },

  async createFuelLog(input: CreateFuelLogInput) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) {
      throw new AppError('Vehículo no encontrado.', 404);
    }
    if (!vehicle.trackFuel) {
      throw new AppError('Este vehículo no participa en el control de combustible.', 400);
    }

    const normalizedTicket = input.ticketNumber ? input.ticketNumber.trim() : null;
    if (normalizedTicket) {
      const duplicate = await prisma.fuelLog.findFirst({
        where: { ticketNumber: normalizedTicket },
        select: { id: true, date: true },
      });
      if (duplicate) {
        throw new AppError(`El ticket ${normalizedTicket} ya fue cargado anteriormente.`, 409);
      }
    }

    const fuelType: FuelType = vehicle.fuelType || FuelType.DIESEL;
    const liters = roundToTwoDecimals(input.liters).toNumber();
    const logDate = input.date ? new Date(input.date) : new Date();

    const fuelLog = await prisma.$transaction(async (tx) => {
      const created = await tx.fuelLog.create({
        data: {
          vehicleId: vehicle.id,
          date: logDate,
          odometer: input.odometer,
          liters,
          fuelType,
          ticketNumber: normalizedTicket,
          status: FuelLogStatus.PENDING,
          totalCost: null,
          pricePerLiter: null,
          isFullTank: input.isFullTank !== undefined ? Boolean(input.isFullTank) : true,
          notes: input.notes ? input.notes.trim() : null,
        },
        include: {
          vehicle: {
            select: { id: true, plate: true, brand: true, model: true, fuelType: true },
          },
        },
      });

      if (input.odometer > vehicle.currentOdometer) {
        await tx.vehicle.update({
          where: { id: vehicle.id },
          data: { currentOdometer: input.odometer },
        });
      }

      return created;
    });

    await logAudit({
      userId: input.userId,
      action: 'CREATE_FUEL_LOG',
      entityType: 'FuelLog',
      entityId: fuelLog.id,
      newValues: {
        vehicleId: vehicle.id,
        odometer: input.odometer,
        liters,
        fuelType,
        ticketNumber: normalizedTicket,
      },
    });

    return fuelLog;
  },

  async settleFuelLogs(input: SettleFuelLogsInput) {
    const uniqueIds = Array.from(new Set(input.logIds));
    const logs = await prisma.fuelLog.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        vehicle: { select: { id: true, plate: true, trackFuel: true } },
      },
    });

    if (logs.length !== uniqueIds.length) {
      throw new AppError('Algunos tickets seleccionados no existen.', 404);
    }

    const alreadySettled = logs.find((l) => l.status !== FuelLogStatus.PENDING);
    if (alreadySettled) {
      throw new AppError(`El ticket #${alreadySettled.id} ya se encuentra liquidado.`, 400);
    }

    let settlement;
    try {
      settlement = calculateFuelSettlement(
        logs.map((l) => ({
          id: l.id,
          fuelType: l.fuelType as FuelTypeValue,
          liters: l.liters.toString(),
        })),
        {
          dieselPricePerLiter: input.dieselPricePerLiter,
          naftaPricePerLiter: input.naftaPricePerLiter,
          dieselTotalCost: input.dieselTotalCost,
          naftaTotalCost: input.naftaTotalCost,
        },
      );
    } catch (err: any) {
      throw new AppError(err.message || 'Datos de liquidación inválidos.', 400);
    }

    const settledAt = input.settledDate ? new Date(input.settledDate) : new Date();
    const grandTotalNum = settlement.grandTotal.toNumber();

    const result = await prisma.$transaction(async (tx) => {
      let transactionId: number | null = null;

      if (input.affectFinance) {
        const pMethod =
          input.paymentMethod === 'TRANSFER' || input.paymentMethod === 'BANK_TRANSFER'
            ? PaymentMethod.BANK_TRANSFER
            : PaymentMethod.CASH;
        const bType = (input.billingType as BillingType) || BillingType.INTERNAL;

        let cashDrawerId: number | null = null;
        let targetBankAccountId: number | null = null;

        if (pMethod === PaymentMethod.CASH) {
          const openDrawer = await tx.cashDrawer.findFirst({
            where: { userId: input.userId, status: 'OPEN' },
          });
          if (!openDrawer) {
            throw new AppError(
              'No tenés una caja abierta para registrar este pago en efectivo.',
              400,
            );
          }
          cashDrawerId = openDrawer.id;
        } else {
          if (!input.bankAccountId) {
            throw new AppError('Seleccioná una cuenta bancaria para la transferencia.', 400);
          }
          targetBankAccountId = input.bankAccountId;
        }

        const parts: string[] = [];
        if (settlement.dieselLiters.greaterThan(0)) {
          parts.push(`Diesel ${settlement.dieselLiters.toFixed(1)} L`);
        }
        if (settlement.naftaLiters.greaterThan(0)) {
          parts.push(`Nafta ${settlement.naftaLiters.toFixed(1)} L`);
        }
        const suffix = input.notes ? ` — ${input.notes.trim()}` : '';
        const txRecord = await tx.transaction.create({
          data: {
            userId: input.userId,
            type: TransactionType.OUTCOME,
            billingType: bType,
            paymentMethod: pMethod,
            amount: grandTotalNum,
            description: `Liquidación Combustible (${logs.length} tickets: ${parts.join(' · ')})${suffix}`,
            cashDrawerId,
            bankAccountId: targetBankAccountId,
          },
        });
        transactionId = txRecord.id;
      }

      for (const item of settlement.items) {
        await tx.fuelLog.update({
          where: { id: item.id },
          data: {
            status: FuelLogStatus.SETTLED,
            settledAt,
            pricePerLiter: item.pricePerLiter.toNumber(),
            totalCost: item.totalCost.toNumber(),
            transactionId,
          },
        });
      }

      return {
        settledCount: settlement.items.length,
        dieselLiters: settlement.dieselLiters.toNumber(),
        naftaLiters: settlement.naftaLiters.toNumber(),
        dieselTotal: settlement.dieselTotal.toNumber(),
        naftaTotal: settlement.naftaTotal.toNumber(),
        grandTotal: grandTotalNum,
        transactionId,
      };
    });

    await logAudit({
      userId: input.userId,
      action: 'SETTLE_FUEL_LOGS',
      entityType: 'FuelLog',
      entityId: uniqueIds[0],
      newValues: {
        logIds: uniqueIds,
        grandTotal: result.grandTotal,
        transactionId: result.transactionId,
      },
    });

    return result;
  },

  async deleteFuelLog(id: number, userId: number) {
    const existing = await prisma.fuelLog.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Registro de combustible no encontrado.', 404);
    }

    await prisma.fuelLog.delete({ where: { id } });

    await logAudit({
      userId,
      action: 'DELETE_FUEL_LOG',
      entityType: 'FuelLog',
      entityId: id,
      oldValues: {
        vehicleId: existing.vehicleId,
        odometer: existing.odometer,
        liters: Number(existing.liters),
        ticketNumber: existing.ticketNumber,
      },
    });
  },

  async getFuelAnalytics() {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        trackFuel: true,
        status: { in: ['ACTIVE', 'MAINTENANCE'] },
      },
      include: {
        fuelLogs: {
          orderBy: { odometer: 'asc' },
        },
      },
      orderBy: [{ fuelType: 'asc' }, { brand: 'asc' }, { model: 'asc' }],
    });

    let totalFleetSpent = 0;
    let totalFleetLiters = 0;
    let totalPendingLiters = 0;
    let totalPendingCount = 0;
    let totalFleetKmTraveled = 0;

    const vehicleStats = vehicles.map((v) => {
      const stats = calculateVehicleFuelStats(
        v.fuelLogs.map((l) => ({
          odometer: l.odometer,
          liters: l.liters.toString(),
          totalCost: l.totalCost ? l.totalCost.toString() : null,
          status: l.status,
        })),
      );

      const spent = stats.vehicleSpent.toNumber();
      const liters = stats.totalLiters.toNumber();
      const pendingLiters = stats.pendingLiters.toNumber();

      totalFleetSpent += spent;
      totalFleetLiters += liters;
      totalPendingLiters += pendingLiters;
      totalPendingCount += stats.pendingCount;
      totalFleetKmTraveled += stats.kmTraveled;

      return {
        vehicleId: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        year: v.year,
        fuelType: v.fuelType || 'DIESEL',
        currentOdometer: v.currentOdometer,
        logsCount: stats.logsCount,
        pendingCount: stats.pendingCount,
        vehicleSpent: spent,
        vehicleLiters: liters,
        pendingLiters,
        kmTraveled: stats.kmTraveled,
        litersPer100Km: stats.litersPer100Km.toNumber(),
        kmPerLiter: stats.kmPerLiter.toNumber(),
        costPerKm: stats.costPerKm.toNumber(),
      };
    });

    const withConsumption = vehicleStats.filter((v) => v.kmTraveled > 0 && v.litersPer100Km > 0);
    const averageFleetLitersPer100Km =
      withConsumption.length > 0
        ? roundToTwoDecimals(
            withConsumption.reduce((sum, v) => sum + v.litersPer100Km, 0) / withConsumption.length,
          ).toNumber()
        : 0;

    return {
      summary: {
        totalFleetSpent,
        totalFleetLiters: roundToTwoDecimals(totalFleetLiters).toNumber(),
        totalPendingLiters: roundToTwoDecimals(totalPendingLiters).toNumber(),
        totalPendingCount,
        totalFleetKmTraveled,
        averageFleetLitersPer100Km,
        activeVehiclesCount: vehicles.length,
      },
      vehicleStats,
    };
  },
};
