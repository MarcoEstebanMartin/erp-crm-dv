import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { warehouseLayoutService } from '../services/catalog/warehouse-layout.service';

export async function getWarehouseCells(
  _req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const cells = await warehouseLayoutService.getCells();
    res.status(200).json({ status: 'success', data: { cells } });
  } catch {
    res
      .status(500)
      .json({ status: 'error', message: 'Error al obtener la configuración del plano de depósito.' });
  }
}

export async function upsertWarehouseCell(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const cell = await warehouseLayoutService.upsertCell(req.body, userId);
    res.status(200).json({
      status: 'success',
      message: `Posición ${cell.code} guardada correctamente.`,
      data: { cell },
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'No se pudo guardar la configuración del slot.',
    });
  }
}

export async function resetWarehouseCell(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const result = await warehouseLayoutService.deleteCellOverride(
      String(req.params.code),
      userId,
      req.body?.fallbackBlueprint,
    );
    res.status(200).json({
      status: 'success',
      message: `Posición ${result.restoredCode} restaurada a su diseño original.`,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'No se pudo restaurar la posición del plano.',
    });
  }
}
