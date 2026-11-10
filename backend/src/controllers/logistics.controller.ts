import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { deliveryRouteService } from '../services/logistics/delivery-route.service';
import { routeSettlementService } from '../services/logistics/route-settlement.service';
import { routeCustodyGpsService } from '../services/logistics/route-custody-gps.service';

function handleLogisticsError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({
    status: 'error',
    message: error instanceof Error && error.message ? error.message : fallbackMessage,
  });
}

export async function getDeliveryRoutes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const routes = await deliveryRouteService.getDeliveryRoutes({
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.status(200).json({ status: 'success', data: { routes } });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al obtener las hojas de ruta de reparto.');
  }
}

export async function createDeliveryRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const route = await deliveryRouteService.createDeliveryRoute({
      userId: req.user?.id,
      driverName: req.body.driverName,
      companionName: req.body.companionName,
      vehiclePlate: req.body.vehiclePlate,
      vehicleDescription: req.body.vehicleDescription,
      vehicleId: req.body.vehicleId ? parseInt(String(req.body.vehicleId), 10) : null,
      date: req.body.date,
      orderIds: req.body.orderIds,
    });
    res.status(201).json({ status: 'success', data: { route } });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al crear la hoja de ruta de reparto.');
  }
}

export async function updateRouteStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const route = await deliveryRouteService.updateRouteStatus(
      parseInt(String(req.params.id), 10),
      req.body.status,
      req.user?.id,
    );
    res.status(200).json({ status: 'success', data: { route } });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al actualizar el estado de la hoja de ruta.');
  }
}

export async function settleDeliveryRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id || !req.user?.role) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    await routeSettlementService.settleDeliveryRoute({
      routeId: parseInt(String(req.params.id), 10),
      userId: req.user.id,
      settlements: req.body.settlements,
      cashDeclared: req.body.cashDeclared,
      checksDeclared: req.body.checksDeclared,
      transfersDeclared: req.body.transfersDeclared,
    });
    res.status(200).json({
      status: 'success',
      message: 'Hoja de ruta liquidada y completada con éxito.',
    });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al liquidar la hoja de ruta.');
  }
}

export async function deleteDeliveryRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    await deliveryRouteService.deleteDeliveryRoute(
      parseInt(String(req.params.id), 10),
      req.user?.id,
    );
    res.status(200).json({
      status: 'success',
      message: 'Hoja de ruta eliminada exitosamente y pedidos liberados.',
    });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al eliminar la hoja de ruta de reparto.');
  }
}

export async function getLogisticsResources(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const data = await deliveryRouteService.getLogisticsResources();
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al obtener recursos de logística.');
  }
}

export async function transferRouteCustody(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const route = await routeCustodyGpsService.transferRouteCustody(
      parseInt(String(req.params.id), 10),
      req.body.driverNotes,
      req.user?.id,
    );
    res.status(200).json({ status: 'success', data: { route } });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al transferir la custodia de la ruta.');
  }
}

export async function recordRouteGpsPing(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await routeCustodyGpsService.recordRouteGpsPing({
      routeId: parseInt(String(req.params.id), 10),
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      speed: req.body.speed,
      heading: req.body.heading,
    });
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    handleLogisticsError(res, error, 'Error interno al registrar telemetría GPS.');
  }
}

export async function getRouteGpsHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await routeCustodyGpsService.getRouteGpsHistory(
      parseInt(String(req.params.id), 10),
    );
    res.status(200).json({ status: 'success', data });
  } catch (error) {
    handleLogisticsError(res, error, 'Error al obtener historial GPS.');
  }
}
