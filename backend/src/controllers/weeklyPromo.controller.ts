import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { weeklyPromoService } from '../services/weekly-promo.service';

interface ErrorWithStatus extends Error {
  statusCode?: number;
}

const sendControllerError = (res: Response, error: unknown, fallbackMessage: string) => {
  const err = error as ErrorWithStatus;
  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 400;
  const message = err?.message || fallbackMessage;
  return res.status(statusCode).json({ status: 'error', message });
};

const parsePromoId = (rawId: unknown): number | null => {
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Lista todas las ofertas semanales (vigentes, programadas, pausadas y vencidas). */
export const getAllWeeklyPromos = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const promos = await weeklyPromoService.listAllPromos();
    return res.json({ status: 'success', data: promos });
  } catch (error) {
    return sendControllerError(res, error, 'No se pudieron obtener las ofertas semanales');
  }
};

/** Lista únicamente las ofertas semanales activas y dentro de su rango horario vigente. */
export const getActiveWeeklyPromos = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const promos = await weeklyPromoService.listActivePromos();
    return res.json({ status: 'success', data: promos });
  } catch (error) {
    return sendControllerError(res, error, 'No se pudieron obtener las ofertas semanales vigentes');
  }
};

/** Crea una nueva oferta semanal (Precio Oferta, N+M o Combo). */
export const createWeeklyPromo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Usuario no autenticado' });
    }
    const created = await weeklyPromoService.createPromo(req.body, req.user.id);
    return res.status(201).json({ status: 'success', data: created });
  } catch (error) {
    return sendControllerError(res, error, 'No se pudo crear la oferta semanal');
  }
};

/** Pausa o reactiva una oferta semanal sin borrar su historial. */
export const toggleWeeklyPromo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Usuario no autenticado' });
    }
    const promoId = parsePromoId(req.params.id);
    if (!promoId) {
      return res.status(400).json({ status: 'error', message: 'ID de oferta inválido' });
    }
    const updated = await weeklyPromoService.togglePromoActive(promoId, req.user.id);
    return res.json({ status: 'success', data: updated });
  } catch (error) {
    return sendControllerError(res, error, 'No se pudo actualizar el estado de la oferta');
  }
};

/** Elimina definitivamente una oferta semanal. */
export const deleteWeeklyPromo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Usuario no autenticado' });
    }
    const promoId = parsePromoId(req.params.id);
    if (!promoId) {
      return res.status(400).json({ status: 'error', message: 'ID de oferta inválido' });
    }
    const result = await weeklyPromoService.deletePromo(promoId, req.user.id);
    return res.json({ status: 'success', data: result });
  } catch (error) {
    return sendControllerError(res, error, 'No se pudo eliminar la oferta semanal');
  }
};
