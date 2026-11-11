import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { RubroService } from '../services/catalog/rubro.service';
import AppError from '../utils/AppError';

export async function getRubros(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rubros = await RubroService.listRubros();
    res.status(200).json({
      status: 'success',
      data: { rubros },
    });
  } catch {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los rubros.',
    });
  }
}

export async function createRubro(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, description, profitMargin, pickingZone } = req.body;
  const userId = req.user?.id;

  if (!name || !String(name).trim()) {
    res.status(400).json({
      status: 'error',
      message: 'El nombre del rubro es requerido.',
    });
    return;
  }

  try {
    const rubro = await RubroService.createRubro(
      {
        name: String(name),
        description,
        profitMargin: profitMargin !== undefined ? Number(profitMargin) : undefined,
        pickingZone,
      },
      userId,
    );

    res.status(201).json({
      status: 'success',
      data: { rubro },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el rubro.',
    });
  }
}

export async function updateRubro(req: AuthenticatedRequest, res: Response): Promise<void> {
  const rubroId = Number(req.params.id);
  const { name, description, profitMargin, pickingZone } = req.body;
  const userId = req.user?.id;

  try {
    const rubro = await RubroService.updateRubro(
      rubroId,
      {
        name: name !== undefined ? String(name) : undefined,
        description,
        profitMargin: profitMargin !== undefined ? Number(profitMargin) : undefined,
        pickingZone,
      },
      userId,
    );

    res.status(200).json({
      status: 'success',
      data: { rubro },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el rubro.',
    });
  }
}

export async function deleteRubro(req: AuthenticatedRequest, res: Response): Promise<void> {
  const rubroId = Number(req.params.id);
  const userId = req.user?.id;

  try {
    await RubroService.deleteRubro(rubroId, userId);
    res.status(200).json({
      status: 'success',
      message: 'Rubro eliminado correctamente.',
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ status: 'error', message: error.message });
      return;
    }
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el rubro.',
    });
  }
}
