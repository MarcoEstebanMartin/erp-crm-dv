import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';

export class LotService {
  /**
   * Modificar datos de un lote (Código, Fecha de Vencimiento, Ubicación).
   */
  async updateLot(lotId: number, data: any, userId: number) {
    const { lotNumber, expirationDate, location } = data;

    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.productLot.findUnique({ where: { id: lotId } });
      if (!lot) throw new Error('Lote no encontrado.');

      // Validar unicidad si cambia el número de lote
      if (lotNumber && lotNumber.trim() !== lot.lotNumber) {
        const trimmedNewLot = lotNumber.trim();
        const existingWithSameName = await tx.productLot.findFirst({
          where: {
            productId: lot.productId,
            lotNumber: trimmedNewLot,
          },
        });
        if (existingWithSameName) {
          throw new Error(`Ya existe un lote con el código "${trimmedNewLot}" para este producto.`);
        }
      }

      const updated = await tx.productLot.update({
        where: { id: lotId },
        data: {
          lotNumber: lotNumber ? lotNumber.trim() : undefined,
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
          location: location !== undefined ? location.trim() : undefined,
        },
      });

      return { original: lot, updated };
    });

    await logAudit({
      userId,
      action: 'UPDATE_LOT',
      entityType: 'ProductLot',
      entityId: lotId,
      oldValues: {
        lotNumber: result.original.lotNumber,
        expirationDate: result.original.expirationDate,
        location: result.original.location,
      },
      newValues: {
        lotNumber: result.updated.lotNumber,
        expirationDate: result.updated.expirationDate,
        location: result.updated.location,
      },
    });

    return result.updated;
  }

  /**
   * Eliminar un lote físico si tiene stock 0 y no tiene transacciones asociadas.
   */
  async deleteLot(lotId: number, userId: number) {
    const lot = await prisma.productLot.findUnique({ where: { id: lotId } });
    if (!lot) throw new Error('Lote no encontrado.');

    if (lot.stock !== 0) {
      throw new Error(`No se puede eliminar el lote "${lot.lotNumber}" porque tiene stock disponible (${lot.stock} u.).`);
    }

    try {
      await prisma.productLot.delete({ where: { id: lotId } });
    } catch (error: any) {
      // P2003 es el código de error de Prisma para violaciones de restricciones de clave externa
      if (error.code === 'P2003') {
        throw new Error(
          `No se puede eliminar el lote "${lot.lotNumber}" físicamente porque tiene un historial de ventas o movimientos de stock asociado.`
        );
      }
      throw error;
    }

    await logAudit({
      userId,
      action: 'DELETE_LOT',
      entityType: 'ProductLot',
      entityId: lotId,
      oldValues: { lotNumber: lot.lotNumber, productId: lot.productId },
      newValues: {},
    });

    return true;
  }

  /**
   * Transferir stock entre dos lotes de forma atómica.
   */
  async transferStock(productId: number, data: any, userId: number) {
    const { fromLotId, toLotNumber, toExpirationDate, quantity } = data;
    const qty = Number(quantity);

    if (isNaN(qty) || qty <= 0) {
      throw new Error('La cantidad a transferir debe ser un número positivo.');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Obtener y validar lote origen
      const fromLot = await tx.productLot.findUnique({ where: { id: fromLotId } });
      if (!fromLot) throw new Error('El lote de origen no existe.');
      if (fromLot.productId !== productId) {
        throw new Error('El lote de origen no pertenece al producto seleccionado.');
      }
      if (fromLot.stock < qty) {
        throw new Error(`Stock insuficiente en el lote de origen "${fromLot.lotNumber}" (Disponible: ${fromLot.stock} u., Solicitado: ${qty} u.).`);
      }

      // 2. Obtener o crear lote destino
      const trimmedToLot = toLotNumber.trim();
      let toLot = await tx.productLot.findUnique({
        where: {
          productId_lotNumber: { productId, lotNumber: trimmedToLot }
        }
      });

      if (!toLot) {
        if (!toExpirationDate) {
          throw new Error(`La fecha de vencimiento es requerida para crear el lote de destino "${trimmedToLot}".`);
        }
        toLot = await tx.productLot.create({
          data: {
            productId,
            lotNumber: trimmedToLot,
            expirationDate: new Date(toExpirationDate),
            stock: 0,
            location: 'S/U',
          }
        });
      }

      // Evitar transferencia al mismo lote
      if (fromLot.id === toLot.id) {
        throw new Error('No se puede transferir stock al mismo lote de origen.');
      }

      // 3. Modificar stocks de forma atómica
      const updatedFrom = await tx.productLot.update({
        where: { id: fromLot.id },
        data: { stock: { decrement: qty } }
      });

      const updatedTo = await tx.productLot.update({
        where: { id: toLot.id },
        data: { stock: { increment: qty } }
      });

      // 4. Crear los dos movimientos de stock (egreso en origen, ingreso en destino)
      // Nota: El stock total del Product en la tabla Product NO se modifica porque es una transferencia interna.
      await tx.stockMovement.create({
        data: {
          productId,
          quantity: -qty,
          type: 'OUT',
          reason: `Transferencia hacia lote ${updatedTo.lotNumber}`,
          userId,
          productLotId: fromLot.id
        }
      });

      await tx.stockMovement.create({
        data: {
          productId,
          quantity: qty,
          type: 'IN',
          reason: `Transferencia desde lote ${fromLot.lotNumber}`,
          userId,
          productLotId: toLot.id
        }
      });

      return { fromLot: updatedFrom, toLot: updatedTo };
    });

    await logAudit({
      userId,
      action: 'TRANSFER_LOT_STOCK',
      entityType: 'ProductLot',
      entityId: fromLotId,
      oldValues: { fromLotId, quantity: qty },
      newValues: { toLotId: result.toLot.id },
    });

    return result;
  }
}

export const lotService = new LotService();
