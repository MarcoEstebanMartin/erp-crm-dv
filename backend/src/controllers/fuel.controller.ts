import { Response, NextFunction } from 'express';
import { FuelLogStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { fuelService } from '../services/fleet/fuel.service';

export async function getFuelLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;
    const statusParam = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    const status =
      statusParam === 'PENDING' || statusParam === 'SETTLED'
        ? (statusParam as FuelLogStatus)
        : undefined;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

    const logs = await fuelService.getFuelLogs({ vehicleId, status, startDate, endDate });
    res.status(200).json({ status: 'success', data: { logs } });
  } catch (error) {
    next(error);
  }
}

export async function createFuelLog(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'No autorizado.' });
      return;
    }

    const fuelLog = await fuelService.createFuelLog({
      userId,
      vehicleId: Number(req.body.vehicleId),
      odometer: Number(req.body.odometer),
      liters: Number(req.body.liters),
      date: req.body.date,
      ticketNumber: req.body.ticketNumber,
      isFullTank: req.body.isFullTank,
      notes: req.body.notes,
    });

    res.status(201).json({ status: 'success', data: { fuelLog } });
  } catch (error) {
    next(error);
  }
}

export async function settleFuelLogs(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'No autorizado.' });
      return;
    }

    const settlement = await fuelService.settleFuelLogs({
      userId,
      logIds: req.body.logIds,
      dieselPricePerLiter: req.body.dieselPricePerLiter,
      naftaPricePerLiter: req.body.naftaPricePerLiter,
      dieselTotalCost: req.body.dieselTotalCost,
      naftaTotalCost: req.body.naftaTotalCost,
      settledDate: req.body.settledDate,
      affectFinance: req.body.affectFinance,
      paymentMethod: req.body.paymentMethod,
      bankAccountId: req.body.bankAccountId,
      billingType: req.body.billingType,
      notes: req.body.notes,
    });

    res.status(200).json({ status: 'success', data: { settlement } });
  } catch (error) {
    next(error);
  }
}

export async function deleteFuelLog(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'No autorizado.' });
      return;
    }

    await fuelService.deleteFuelLog(Number(req.params.id), userId);
    res.status(200).json({ status: 'success', message: 'Registro eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
}

export async function getFuelAnalytics(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await fuelService.getFuelAnalytics();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}
