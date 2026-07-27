import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { saleRouteService } from '../services/saleRoute.service';

/**
 * Obtener listado de todas las rutas (Admin/Facturación).
 */
export async function getSaleRoutes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const routes = await saleRouteService.getSaleRoutes();
    res.status(200).json({ status: 'success', data: { routes } });
  } catch (error: any) {
    console.error('Error al obtener rutas:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener rutas.' });
  }
}

/**
 * Obtener rutas asignadas al vendedor autenticado.
 */
export async function getSellerSaleRoutes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const routes = await saleRouteService.getSellerSaleRoutes(userId);
    res.status(200).json({ status: 'success', data: { routes } });
  } catch (error: any) {
    console.error('Error al obtener mis rutas:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener rutas del vendedor.' });
  }
}

/**
 * Obtener los detalles de una ruta de venta por ID.
 */
export async function getSaleRouteById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const route = await saleRouteService.getSaleRouteById(Number(id));

    // Si es vendedor, verificar que tenga acceso a la ruta (le pertenece o es administrador)
    if (userRole === 'VENDEDOR' && route.sellerId !== userId) {
      res.status(403).json({ status: 'error', message: 'Acceso denegado a esta ruta.' });
      return;
    }

    res.status(200).json({ status: 'success', data: { route } });
  } catch (error: any) {
    console.error('Error al obtener detalle de ruta:', error);
    if (error.message === 'Ruta de venta no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al obtener detalle de la ruta.' });
  }
}

/**
 * Crear nueva ruta de preventa.
 */
export async function createSaleRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const route = await saleRouteService.createSaleRoute(req.body, userId);
    res.status(201).json({ status: 'success', data: { route } });
  } catch (error: any) {
    console.error('Error al crear ruta:', error);
    res.status(500).json({ status: 'error', message: 'Error al crear ruta.' });
  }
}

/**
 * Actualizar ruta de preventa.
 */
export async function updateSaleRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const route = await saleRouteService.updateSaleRoute(Number(id), req.body, userId);
    res.status(200).json({ status: 'success', data: { route } });
  } catch (error: any) {
    console.error('Error al actualizar ruta:', error);
    if (error.message === 'Ruta de venta no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al actualizar ruta.' });
  }
}

/**
 * Eliminar ruta de preventa.
 */
export async function deleteSaleRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await saleRouteService.deleteSaleRoute(Number(id), userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error al eliminar ruta:', error);
    if (error.message === 'Ruta de venta no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al eliminar ruta.' });
  }
}

/**
 * Reordenar secuencia de clientes en una ruta.
 */
export async function updateClientSequence(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const { clientIds } = req.body;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await saleRouteService.updateClientSequence(Number(id), clientIds, userId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error al reordenar secuencia:', error);
    if (error.message === 'Ruta de venta no encontrada.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al actualizar la secuencia.' });
  }
}

/**
 * Asociar un cliente a una ruta de preventa.
 */
export async function addClientToRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params; // ID de la ruta
  const userId = req.user?.id;
  const { clientId } = req.body;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const client = await saleRouteService.addClientToRoute(Number(id), Number(clientId), userId);
    res.status(200).json({ status: 'success', data: { client } });
  } catch (error: any) {
    console.error('Error al agregar cliente a la ruta:', error);
    if (error.message === 'Ruta de venta no encontrada.' || error.message === 'Cliente no encontrado.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al agregar cliente a la ruta.' });
  }
}

/**
 * Registrar una visita (fallida o exitosa) asociada a la ruta de preventa.
 */
export async function recordRouteVisit(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params; // ID de la ruta
  const sellerId = req.user?.id;

  if (!sellerId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const visit = await saleRouteService.recordRouteVisit(Number(id), req.body, sellerId);
    res.status(201).json({ status: 'success', data: { visit } });
  } catch (error: any) {
    console.error('Error al registrar visita de preventa:', error);
    if (error.message === 'Cliente no encontrado.') {
      res.status(404).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({ status: 'error', message: 'Error al registrar visita.' });
  }
}

/**
 * Obtener visitas del día de hoy del vendedor autenticado.
 */
export async function getTodayVisits(req: AuthenticatedRequest, res: Response): Promise<void> {
  const sellerId = req.user?.id;
  if (!sellerId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const visits = await saleRouteService.getTodayVisits(sellerId);
    res.status(200).json({ status: 'success', data: { visits } });
  } catch (error: any) {
    console.error('Error al obtener visitas de hoy:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener visitas.' });
  }
}

/**
 * Optimizar secuencia de ruta por algoritmo de mapa (TSP Haversine).
 */
export async function optimizeRouteSequence(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const { startCoords } = req.body || {};

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await saleRouteService.optimizeRouteSequence(Number(id), startCoords);
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    console.error('Error al optimizar secuencia de la ruta:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al optimizar ruta por mapa.' });
  }
}
