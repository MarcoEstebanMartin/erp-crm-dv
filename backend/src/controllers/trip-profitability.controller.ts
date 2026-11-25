import { Request, Response } from 'express';
import { adminTripsSubService } from '../services/admin/admin-trips.service';

export async function getTripProfitabilityReport(
  req: Request,
  res: Response,
): Promise<void> {
  const { startDate, endDate } = req.query;
  try {
    const report = await adminTripsSubService.getTripProfitabilityReport({
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
    });
    res.status(200).json({ status: 'success', data: report });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Error al generar la rentabilidad por viaje.',
    });
  }
}

export async function updateRouteTripCosts(
  req: Request,
  res: Response,
): Promise<void> {
  const routeId = Number(req.params.routeId);
  const { tripKm, tripExpenses } = req.body || {};
  try {
    const updated = await adminTripsSubService.updateRouteTripCosts(routeId, {
      tripKm: tripKm === null || tripKm === '' || tripKm === undefined ? null : Number(tripKm),
      tripExpenses:
        tripExpenses === null || tripExpenses === '' || tripExpenses === undefined
          ? 0
          : Number(tripExpenses),
    });
    res.status(200).json({ status: 'success', data: updated });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      status: 'error',
      message: error.message || 'Error al actualizar los costos del viaje.',
    });
  }
}
