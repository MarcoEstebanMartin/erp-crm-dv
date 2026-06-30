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
          const cost = Number(p.costPrice);
          const newPrice = cost * val; // PRECIO FINAL = COSTO * RENTABILIDAD
          
          // Suponiendo que listPrice es Precio Final, o Precio Sin Iva?
          // El Excel hace: PRECIO FINAL = COSTO * RENTABILIDAD.
          // El backend actualmente maneja listPrice. Actualizaremos listPrice a PRECIO SIN IVA (Final / 1.21)
          // O si listPrice es Precio Final, a newPrice. Dejémoslo igual a la fórmula del BulkUpdatePrices.
          // Pero la fórmula de bulkUpdatePrices (cuando es margin) es: newPrice = cost * (1 + val / 100)
          // Aquí la rentabilidad viene como 1.25. 
          // Ajustaremos a la lógica original: newPrice = cost * (val) si val es un multiplicador (ej. 1.25).
          // Guardaremos la lógica exacta que se usa en Excel:
          // PRECIO SIN IVA = PRECIO FINAL / 1.21
          // listPrice = newPrice / 1.21
          
          const precioFinal = cost * val;
          const precioSinIva = precioFinal / 1.21;

          await tx.product.update({ 
            where: { id: p.id }, 
            data: { 
              listPrice: Math.max(0, Math.round(precioSinIva * 100) / 100),
              // En un futuro listPrice podria ser el precio de venta sin iva, etc.
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
