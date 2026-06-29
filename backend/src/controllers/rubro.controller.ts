import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';

/**
 * Obtener todos los rubros.
 */
export async function getRubros(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const rubros = await prisma.rubro.findMany({
      orderBy: { name: 'asc' },
    });
    res.status(200).json({
      status: 'success',
      data: { rubros },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los rubros.',
    });
  }
}

/**
 * Crear un nuevo rubro (Solo ADMIN).
 */
export async function createRubro(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, description } = req.body;
  const userId = req.user?.id;

  if (!name) {
    res.status(400).json({
      status: 'error',
      message: 'El nombre del rubro es requerido.',
    });
    return;
  }

  try {
    const existing = await prisma.rubro.findUnique({ where: { name } });
    if (existing) {
      res.status(400).json({
        status: 'error',
        message: `El rubro "${name}" ya existe.`,
      });
      return;
    }

    const rubro = await prisma.rubro.create({
      data: { name, description },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_RUBRO',
        entityType: 'Rubro',
        entityId: rubro.id,
        newValues: rubro,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { rubro },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear el rubro.',
    });
  }
}

/**
 * Actualizar un rubro (Solo ADMIN).
 */
export async function updateRubro(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, description } = req.body;
  const userId = req.user?.id;

  try {
    const original = await prisma.rubro.findUnique({
      where: { id: Number(id) },
    });

    if (!original) {
      res.status(404).json({
        status: 'error',
        message: 'Rubro no encontrado.',
      });
      return;
    }

    if (name && name !== original.name) {
      const existing = await prisma.rubro.findUnique({ where: { name } });
      if (existing) {
        res.status(400).json({
          status: 'error',
          message: `El rubro "${name}" ya existe.`,
        });
        return;
      }
    }

    const updated = await prisma.rubro.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name : undefined,
        description: description !== undefined ? description : undefined,
      },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_RUBRO',
        entityType: 'Rubro',
        entityId: updated.id,
        oldValues: original,
        newValues: updated,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { rubro: updated },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el rubro.',
    });
  }
}

/**
 * Eliminar un rubro (Solo ADMIN).
 * Desvincula los productos que pertenecen a este rubro antes de borrarlo.
 */
export async function deleteRubro(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const original = await prisma.rubro.findUnique({
      where: { id: Number(id) },
    });

    if (!original) {
      res.status(404).json({
        status: 'error',
        message: 'Rubro no encontrado.',
      });
      return;
    }

    // Desvincular productos pertenecientes al rubro
    await prisma.product.updateMany({
      where: { rubroId: Number(id) },
      data: { rubroId: null },
    });

    await prisma.rubro.delete({
      where: { id: Number(id) },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'DELETE_RUBRO',
        entityType: 'Rubro',
        entityId: Number(id),
        oldValues: original,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Rubro eliminado correctamente.',
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar el rubro.',
    });
  }
}
