import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { lotService } from '../services/lot.service';
import { appCache } from '../utils/cache';

/**
 * Modificar un lote (Solo ADMIN y DEPOSITO).
 */
export async function updateLot(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { lotId } = req.params;
  const userId = req.user?.id;
  try {
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'No autenticado.' });
      return;
    }
    const lot = await lotService.updateLot(Number(lotId), req.body, userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: { lot } });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al actualizar el lote.' });
  }
}

/**
 * Eliminar un lote (Solo ADMIN).
 */
export async function deleteLot(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { lotId } = req.params;
  const userId = req.user?.id;
  try {
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'No autenticado.' });
      return;
    }
    await lotService.deleteLot(Number(lotId), userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', message: 'Lote eliminado con éxito.' });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message || 'Error al eliminar el lote.' });
  }
}

/**
 * Transferir stock entre dos lotes del mismo producto (Solo ADMIN y DEPOSITO).
 */
export async function transferLotStock(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { productId } = req.params;
  const userId = req.user?.id;
  try {
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'No autenticado.' });
      return;
    }
    const result = await lotService.transferStock(Number(productId), req.body, userId);
    appCache.invalidateProductCatalog();
    res.status(200).json({ status: 'success', data: result });
  } catch (error: any) {
    res
      .status(400)
      .json({ status: 'error', message: error.message || 'Error al transferir stock entre lotes.' });
  }
}
