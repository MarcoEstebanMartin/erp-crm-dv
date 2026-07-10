import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';

/**
 * Obtener todos los tipos de percepciones.
 */
export async function getPerceptionTypes(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const perceptions = await prisma.perceptionType.findMany({
      orderBy: { code: 'asc' },
    });
    res.status(200).json({
      status: 'success',
      data: { perceptions },
    });
  } catch (error: any) {
    console.error('Error in getPerceptionTypes:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener los tipos de percepciones.',
    });
  }
}

/**
 * Actualizar un tipo de percepción (Solo ADMIN).
 */
export async function updatePerceptionType(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, aliquot, affectsIvaBook, jurisdiction } = req.body;
  const userId = req.user?.id;

  try {
    const original = await prisma.perceptionType.findUnique({
      where: { id: Number(id) },
    });

    if (!original) {
      res.status(404).json({
        status: 'error',
        message: 'Tipo de percepción no encontrado.',
      });
      return;
    }

    const updated = await prisma.perceptionType.update({
      where: { id: Number(id) },
      data: {
        name: name !== undefined ? name : undefined,
        aliquot: aliquot !== undefined ? Number(aliquot) : undefined,
        affectsIvaBook: affectsIvaBook !== undefined ? Boolean(affectsIvaBook) : undefined,
        jurisdiction: jurisdiction !== undefined ? jurisdiction : undefined,
      },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_PERCEPTION_TYPE',
        entityType: 'PerceptionType',
        entityId: updated.id,
        oldValues: original,
        newValues: updated,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { perception: updated },
    });
  } catch (error: any) {
    console.error('Error in updatePerceptionType:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el tipo de percepción.',
    });
  }
}
