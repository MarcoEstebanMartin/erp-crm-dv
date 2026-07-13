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
  const { name, description, profitMargin } = req.body;
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
      data: { 
        name, 
        description,
        profitMargin: profitMargin !== undefined ? Number(profitMargin) : undefined
      },
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
  const { name, description, profitMargin } = req.body;
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
        profitMargin: profitMargin !== undefined ? Number(profitMargin) : undefined,
      },
    });

    // Si se actualiza el margen, recalcular los precios de los productos de este rubro
    if (profitMargin !== undefined && Number(profitMargin) !== Number(original.profitMargin)) {
      const products = await prisma.product.findMany({ where: { rubroId: Number(id) } });
      const val = Number(profitMargin);
      
      await prisma.$transaction(async (tx) => {
        for (const p of products) {
          // Omitir si el producto tiene un profitMargin personalizado
          if (p.profitMargin !== null) continue;

          const cost = Number(p.costPrice);
          const precioFinal = cost * val; // PRECIO FINAL = COSTO * RENTABILIDAD
          const roundedFinal = Math.max(0, Math.round(precioFinal * 100) / 100);
          
          // Mantener proporciones si ya existían o aplicar los defaults
          let precioB = Math.max(0, Math.round(roundedFinal * 0.95 * 100) / 100);
          let precioC = Math.max(0, Math.round(roundedFinal * 0.90 * 100) / 100);
          
          if (Number(p.listPriceB) > 0 && Number(p.listPrice) > 0) {
            const ratioB = Number(p.listPriceB) / Number(p.listPrice);
            precioB = Math.max(0, Math.round(roundedFinal * ratioB * 100) / 100);
          }
          if (Number(p.listPriceC) > 0 && Number(p.listPrice) > 0) {
            const ratioC = Number(p.listPriceC) / Number(p.listPrice);
            precioC = Math.max(0, Math.round(roundedFinal * ratioC * 100) / 100);
          }

          await tx.product.update({ 
            where: { id: p.id }, 
            data: { 
              listPrice: roundedFinal,
              listPriceB: precioB,
              listPriceC: precioC
            } 
          });
        }
      });
    }

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
