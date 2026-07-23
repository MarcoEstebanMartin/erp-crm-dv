import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { TransactionType, PaymentMethod, BillingType } from '@prisma/client';

/**
 * Obtener todos los registros de carga de combustible
 */
export async function getFuelLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

    const where: any = {};
    if (vehicleId) where.vehicleId = vehicleId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const logs = await prisma.fuelLog.findMany({
      where,
      include: {
        vehicle: {
          select: { id: true, plate: true, brand: true, model: true }
        },
        transaction: {
          select: { id: true, movementId: true, amount: true, paymentMethod: true }
        }
      },
      orderBy: { odometer: 'desc' }
    });

    res.status(200).json({
      status: 'success',
      data: { logs }
    });
  } catch (error: any) {
    console.error('Error al obtener registros de combustible:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al consultar las cargas de combustible.'
    });
  }
}

/**
 * Registrar una nueva carga de combustible
 */
export async function createFuelLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  const {
    vehicleId,
    odometer,
    liters,
    totalCost,
    pricePerLiter,
    isFullTank,
    notes,
    date,
    affectFinance,
    paymentMethod,
    bankAccountId,
    billingType
  } = req.body;

  const userId = req.user?.id;

  if (!vehicleId || odometer === undefined || !liters || !totalCost) {
    res.status(400).json({
      status: 'error',
      message: 'Vehículo, odómetro (km), litros y costo total son campos requeridos.'
    });
    return;
  }

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const vId = Number(vehicleId);
    const odo = Number(odometer);
    const lit = Number(liters);
    const cost = Number(totalCost);
    const calculatedPricePerLiter = pricePerLiter ? Number(pricePerLiter) : (lit > 0 ? cost / lit : 0);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vId } });
    if (!vehicle) {
      res.status(404).json({ status: 'error', message: 'Vehículo no encontrado.' });
      return;
    }

    // 1. Manejo opcional de transacción financiera si se descuenta de Caja o Banco
    let transactionId: number | null = null;
    if (affectFinance) {
      const pMethod = paymentMethod === 'TRANSFER' ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH;
      const bType = (billingType as BillingType) || BillingType.INTERNAL;
      
      let cashDrawerId: number | null = null;
      let targetBankAccountId: number | null = null;

      if (pMethod === PaymentMethod.CASH) {
        const openDrawer = await prisma.cashDrawer.findFirst({
          where: { userId, status: 'OPEN' }
        });
        if (!openDrawer) {
          res.status(400).json({
            status: 'error',
            message: 'No tienes una caja abierta para registrar este pago en efectivo.'
          });
          return;
        }
        cashDrawerId = openDrawer.id;
      } else if (pMethod === PaymentMethod.BANK_TRANSFER) {
        if (!bankAccountId) {
          res.status(400).json({
            status: 'error',
            message: 'Selecciona una cuenta bancaria para el pago por transferencia.'
          });
          return;
        }
        targetBankAccountId = Number(bankAccountId);
      }

      const tx = await prisma.transaction.create({
        data: {
          userId,
          type: TransactionType.OUTCOME,
          billingType: bType,
          paymentMethod: pMethod,
          amount: cost,
          description: `Carga Combustible ${vehicle.brand} ${vehicle.model} (${vehicle.plate}) - ${lit.toFixed(1)} L`,
          cashDrawerId,
          bankAccountId: targetBankAccountId
        }
      });
      transactionId = tx.id;
    }

    // 2. Crear el registro FuelLog
    const logDate = date ? new Date(date) : new Date();
    const fuelLog = await prisma.fuelLog.create({
      data: {
        vehicleId: vId,
        date: logDate,
        odometer: odo,
        liters: lit,
        totalCost: cost,
        pricePerLiter: calculatedPricePerLiter,
        isFullTank: isFullTank !== undefined ? Boolean(isFullTank) : true,
        notes: notes ? String(notes).trim() : null,
        transactionId
      },
      include: {
        vehicle: {
          select: { id: true, plate: true, brand: true, model: true }
        }
      }
    });

    // 3. Actualizar odómetro del vehículo si la carga reporta mayor kilometraje
    if (odo > vehicle.currentOdometer) {
      await prisma.vehicle.update({
        where: { id: vId },
        data: { currentOdometer: odo }
      });
    }

    await logAudit({
      userId,
      action: 'CREATE_FUEL_LOG',
      entityType: 'FuelLog',
      entityId: fuelLog.id,
      newValues: { vehicleId: vId, odometer: odo, liters: lit, totalCost: cost }
    });

    res.status(201).json({
      status: 'success',
      data: { fuelLog }
    });
  } catch (error: any) {
    console.error('Error al registrar carga de combustible:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al guardar el registro de combustible.'
    });
  }
}

/**
 * Eliminar un registro de carga de combustible
 */
export async function deleteFuelLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  const id = Number(req.params.id);
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const existing = await prisma.fuelLog.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Registro de combustible no encontrado.' });
      return;
    }

    await prisma.fuelLog.delete({ where: { id } });

    await logAudit({
      userId,
      action: 'DELETE_FUEL_LOG',
      entityType: 'FuelLog',
      entityId: id,
      oldValues: { vehicleId: existing.vehicleId, odometer: existing.odometer, liters: Number(existing.liters) }
    });

    res.status(200).json({
      status: 'success',
      message: 'Registro de combustible eliminado correctamente.'
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de combustible:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el registro.'
    });
  }
}

/**
 * Analíticas y Métricas de Rendimiento de Combustible
 */
export async function getFuelAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: { in: ['ACTIVE', 'MAINTENANCE'] } },
      include: {
        fuelLogs: {
          orderBy: { odometer: 'asc' }
        }
      }
    });

    let totalFleetSpent = 0;
    let totalFleetLiters = 0;
    let totalFleetKmTraveled = 0;

    const vehicleStats = vehicles.map(v => {
      const logs = v.fuelLogs;
      const logsCount = logs.length;

      let vehicleSpent = 0;
      let vehicleLiters = 0;
      let kmTraveled = 0;
      let litersPer100Km = 0;
      let costPerKm = 0;
      let kmPerLiter = 0;

      logs.forEach(log => {
        const cost = Number(log.totalCost);
        const lit = Number(log.liters);
        vehicleSpent += cost;
        vehicleLiters += lit;
      });

      if (logsCount >= 2) {
        const firstOdo = logs[0].odometer;
        const lastOdo = logs[logsCount - 1].odometer;
        kmTraveled = Math.max(0, lastOdo - firstOdo);

        const litersForKm = logs.slice(1).reduce((sum, log) => sum + Number(log.liters), 0);

        if (kmTraveled > 0 && litersForKm > 0) {
          litersPer100Km = (litersForKm / kmTraveled) * 100;
          kmPerLiter = kmTraveled / litersForKm;
          costPerKm = vehicleSpent / kmTraveled;
        }
      }

      totalFleetSpent += vehicleSpent;
      totalFleetLiters += vehicleLiters;
      totalFleetKmTraveled += kmTraveled;

      return {
        vehicleId: v.id,
        plate: v.plate,
        brand: v.brand,
        model: v.model,
        year: v.year,
        currentOdometer: v.currentOdometer,
        logsCount,
        vehicleSpent,
        vehicleLiters,
        kmTraveled,
        litersPer100Km: Number(litersPer100Km.toFixed(2)),
        kmPerLiter: Number(kmPerLiter.toFixed(2)),
        costPerKm: Number(costPerKm.toFixed(2))
      };
    });

    const vehiclesWithCalculatedData = vehicleStats.filter(v => v.kmTraveled > 0 && v.litersPer100Km > 0);
    const averageFleetLitersPer100Km = vehiclesWithCalculatedData.length > 0
      ? vehiclesWithCalculatedData.reduce((sum, v) => sum + v.litersPer100Km, 0) / vehiclesWithCalculatedData.length
      : 0;

    const sortedByConsumption = [...vehicleStats].sort((a, b) => {
      if (b.litersPer100Km !== a.litersPer100Km) {
        return b.litersPer100Km - a.litersPer100Km;
      }
      return b.vehicleSpent - a.vehicleSpent;
    });

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalFleetSpent,
          totalFleetLiters,
          totalFleetKmTraveled,
          averageFleetLitersPer100Km: Number(averageFleetLitersPer100Km.toFixed(2)),
          activeVehiclesCount: vehicles.length
        },
        vehicleStats: sortedByConsumption
      }
    });
  } catch (error: any) {
    console.error('Error al generar analíticas de combustible:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al calcular analíticas de consumo de combustible.'
    });
  }
}
