import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { vehicleService } from '../services/fleet/vehicle.service';
import { vehicleMaintenanceService } from '../services/fleet/vehicle-maintenance.service';
import { vehicleExpiryService } from '../services/fleet/vehicle-expiry.service';

function handleFleetError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ status: 'error', message: fallbackMessage });
}

function requireUserId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return null;
  }
  return req.user.id;
}

const paramId = (req: AuthenticatedRequest): number => parseInt(String(req.params.id), 10);

export async function getVehicles(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const vehicles = await vehicleService.getVehicles();
    res.status(200).json({ status: 'success', data: { vehicles } });
  } catch (error) {
    handleFleetError(res, error, 'Error al obtener la flota de vehículos.');
  }
}

export async function createVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const vehicle = await vehicleService.createVehicle({ userId, ...req.body });
    res.status(201).json({ status: 'success', data: { vehicle } });
  } catch (error) {
    handleFleetError(res, error, 'Error al registrar el vehículo.');
  }
}

export async function updateVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const vehicle = await vehicleService.updateVehicle({ userId, vehicleId: paramId(req), ...req.body });
    res.status(200).json({ status: 'success', data: { vehicle } });
  } catch (error) {
    handleFleetError(res, error, 'Error al actualizar el vehículo.');
  }
}

export async function deleteVehicle(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    await vehicleService.deleteVehicle(paramId(req), userId);
    res.status(200).json({ status: 'success', message: 'Vehículo eliminado con éxito de la flota.' });
  } catch (error) {
    handleFleetError(res, error, 'Error al eliminar el vehículo. Verifique que no tenga hojas de reparto asociadas.');
  }
}

export async function createMaintenance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const data = await vehicleMaintenanceService.createMaintenance({ userId, vehicleId: paramId(req), ...req.body });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    handleFleetError(res, error, 'Error al registrar el mantenimiento en la flota.');
  }
}

export async function deleteMaintenance(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    await vehicleMaintenanceService.deleteMaintenance(paramId(req), userId);
    res.status(200).json({ status: 'success', message: 'Mantenimiento y su transacción contable asociada eliminados con éxito.' });
  } catch (error) {
    handleFleetError(res, error, 'Error al eliminar el registro de mantenimiento.');
  }
}

export async function createExpiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const expiry = await vehicleExpiryService.createExpiry({ userId, vehicleId: paramId(req), ...req.body });
    res.status(201).json({ status: 'success', data: { expiry } });
  } catch (error) {
    handleFleetError(res, error, 'Error al registrar el vencimiento de documentación.');
  }
}

export async function updateExpiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const expiry = await vehicleExpiryService.updateExpiry({ userId, expiryId: paramId(req), ...req.body });
    res.status(200).json({ status: 'success', data: { expiry } });
  } catch (error) {
    handleFleetError(res, error, 'Error al actualizar el registro de vencimiento.');
  }
}

export async function deleteExpiry(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    await vehicleExpiryService.deleteExpiry(paramId(req), userId);
    res.status(200).json({ status: 'success', message: 'Vencimiento de documentación eliminado con éxito.' });
  } catch (error) {
    handleFleetError(res, error, 'Error al eliminar el registro de vencimiento.');
  }
}
