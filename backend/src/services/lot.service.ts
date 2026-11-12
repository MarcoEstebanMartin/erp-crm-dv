import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';
import { lockProductsForUpdate } from '../utils/db-locks.util';
import {
  extractBaseLotNumber,
  normalizeWmsLocationCode,
  parseWmsLocationScope,
} from '../engines/stock.engine';
import { validateSlotAllowsStockAssignment } from '../engines/warehouse-layout.engine';

/** Rechaza ubicaciones WMS bloqueadas o no habilitadas para mercadería (S/U siempre es válida). */
async function assertSlotAcceptsStock(tx: Prisma.TransactionClient, location: string) {
  if (location === 'S/U' || typeof (tx as any).warehouseCell?.findUnique !== 'function') return;
  const locScope = parseWmsLocationScope(location);
  const customCell = await tx.warehouseCell.findUnique({ where: { code: locScope.baseSlotCode } });
  const slotCheck = validateSlotAllowsStockAssignment(customCell, location);
  if (!slotCheck.allowed) {
    throw new Error(slotCheck.reason || 'El slot destino no admite mercadería.');
  }
}

/** Asientos simétricos OUT/IN (Δ Product.stock = 0) para que todo traslado físico quede en el Kardex. */
async function recordInternalTransfer(
  tx: Prisma.TransactionClient,
  params: { productId: number; qty: number; fromLotId: number; toLotId: number; reasonOut: string; reasonIn: string; userId: number },
) {
  await tx.stockMovement.create({
    data: {
      productId: params.productId,
      quantity: -params.qty,
      type: 'OUT',
      reason: params.reasonOut,
      userId: params.userId,
      productLotId: params.fromLotId,
    },
  });
  await tx.stockMovement.create({
    data: {
      productId: params.productId,
      quantity: params.qty,
      type: 'IN',
      reason: params.reasonIn,
      userId: params.userId,
      productLotId: params.toLotId,
    },
  });
}

export class LotService {
  /** Edita código/vencimiento/ubicación bajo `FOR UPDATE`; si la terna (productId, lotNumber, location) ya existe, FUSIONA atómicamente. */
  async updateLot(lotId: number, data: any, userId: number) {
    const { lotNumber, expirationDate, location } = data;

    const result = await prisma.$transaction(async (tx) => {
      const peek = await tx.productLot.findUnique({ where: { id: lotId } });
      if (!peek) throw new Error('Lote no encontrado.');
      await lockProductsForUpdate(tx, [peek.productId]);

      const lot = await tx.productLot.findUnique({ where: { id: lotId } });
      if (!lot) throw new Error('Lote no encontrado.');

      const prevLocation = normalizeWmsLocationCode(lot.location);
      const nextLotNumber = extractBaseLotNumber(
        typeof lotNumber === 'string' && lotNumber.trim() ? lotNumber : lot.lotNumber,
      );
      const nextLocation = location !== undefined ? normalizeWmsLocationCode(location) : prevLocation;
      const nextExp = expirationDate ? new Date(expirationDate) : undefined;
      if (nextExp && isNaN(nextExp.getTime())) throw new Error('Fecha de vencimiento inválida.');

      if (nextLocation !== prevLocation) await assertSlotAcceptsStock(tx, nextLocation);

      const collision = await tx.productLot.findUnique({
        where: {
          productId_lotNumber_location: {
            productId: lot.productId,
            lotNumber: nextLotNumber,
            location: nextLocation,
          },
        },
      });

      if (collision && collision.id !== lot.id) {
        const qty = Math.max(0, lot.stock);
        const merged = await tx.productLot.update({
          where: { id: collision.id },
          data: { stock: { increment: qty }, ...(nextExp ? { expirationDate: nextExp } : {}) },
        });

        if (qty > 0) {
          await tx.productLot.update({ where: { id: lot.id }, data: { stock: 0 } });
          await recordInternalTransfer(tx, {
            productId: lot.productId,
            qty,
            fromLotId: lot.id,
            toLotId: collision.id,
            reasonOut: `Traslado interno WMS desde ${prevLocation} hacia ${nextLocation} (fusión de lote)`,
            reasonIn: `Fusión de lote en ${nextLocation} (origen ${prevLocation})`,
            userId,
          });
        } else {
          // Lote vacío sin historial: se elimina limpiamente (sin riesgo de FK que aborte la transacción).
          const [movRefs, pickRefs] = await Promise.all([
            tx.stockMovement.count({ where: { productLotId: lot.id } }),
            tx.orderItemLot.count({ where: { productLotId: lot.id } }),
          ]);
          if (movRefs + pickRefs === 0) {
            await tx.productLot.delete({ where: { id: lot.id } });
          }
        }

        return { original: lot, updated: merged, mergedIntoLotId: collision.id as number | null };
      }

      const updated = await tx.productLot.update({
        where: { id: lotId },
        data: {
          lotNumber: nextLotNumber,
          location: nextLocation,
          ...(nextExp ? { expirationDate: nextExp } : {}),
        },
      });

      if (nextLocation !== prevLocation && lot.stock > 0) {
        await recordInternalTransfer(tx, {
          productId: lot.productId,
          qty: lot.stock,
          fromLotId: lot.id,
          toLotId: lot.id,
          reasonOut: `Traslado interno WMS desde ${prevLocation} hacia ${nextLocation}`,
          reasonIn: `Ubicación interna WMS en ${nextLocation} (origen ${prevLocation})`,
          userId,
        });
      }

      return { original: lot, updated, mergedIntoLotId: null as number | null };
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
        mergedIntoLotId: result.mergedIntoLotId,
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
      throw new Error(
        `No se puede eliminar el lote "${lot.lotNumber}" porque tiene stock disponible (${lot.stock} u.).`,
      );
    }

    try {
      await prisma.productLot.delete({ where: { id: lotId } });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new Error(
          `No se puede eliminar el lote "${lot.lotNumber}" físicamente porque tiene un historial de ventas o movimientos de stock asociado.`,
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
   * Transferir stock entre dos lotes del mismo producto de forma atómica (`Δ Product.stock = 0`).
   */
  async transferStock(productId: number, data: any, userId: number) {
    const { fromLotId, toLotNumber, toExpirationDate, toLocation, quantity } = data;
    const qty = Math.trunc(Number(quantity));

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('La cantidad a transferir debe ser un número entero positivo.');
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockProductsForUpdate(tx, [productId]);

      const fromLot = await tx.productLot.findUnique({ where: { id: Number(fromLotId) } });
      if (!fromLot) throw new Error('El lote de origen no existe.');
      if (fromLot.productId !== productId) {
        throw new Error('El lote de origen no pertenece al producto seleccionado.');
      }
      if (fromLot.stock < qty) {
        throw new Error(
          `Stock insuficiente en el lote de origen "${fromLot.lotNumber}" (Disponible: ${fromLot.stock} u., Solicitado: ${qty} u.).`,
        );
      }

      const cleanToLot = extractBaseLotNumber(String(toLotNumber ?? ''));
      const targetLocation =
        toLocation !== undefined
          ? normalizeWmsLocationCode(toLocation)
          : normalizeWmsLocationCode(fromLot.location);

      let toLot = await tx.productLot.findUnique({
        where: {
          productId_lotNumber_location: { productId, lotNumber: cleanToLot, location: targetLocation },
        },
      });
      // Sin ubicación explícita, el lote destino elegido de la lista puede estar en otro rack.
      if (!toLot && toLocation === undefined) {
        toLot = await tx.productLot.findFirst({
          where: { productId, lotNumber: cleanToLot },
          orderBy: { id: 'asc' },
        });
      }

      if (!toLot) {
        if (!toExpirationDate) {
          throw new Error(
            `La fecha de vencimiento es requerida para crear el lote de destino "${cleanToLot}".`,
          );
        }
        await assertSlotAcceptsStock(tx, targetLocation);
        toLot = await tx.productLot.create({
          data: {
            productId,
            lotNumber: cleanToLot,
            expirationDate: new Date(toExpirationDate),
            stock: 0,
            location: targetLocation,
          },
        });
      }

      if (fromLot.id === toLot.id) {
        throw new Error('No se puede transferir stock al mismo lote de origen.');
      }

      const updatedFrom = await tx.productLot.update({
        where: { id: fromLot.id },
        data: { stock: { decrement: qty } },
      });

      const updatedTo = await tx.productLot.update({
        where: { id: toLot.id },
        data: { stock: { increment: qty } },
      });

      await recordInternalTransfer(tx, {
        productId,
        qty,
        fromLotId: fromLot.id,
        toLotId: toLot.id,
        reasonOut: `Transferencia hacia lote ${updatedTo.lotNumber} (${normalizeWmsLocationCode(updatedTo.location)})`,
        reasonIn: `Transferencia desde lote ${fromLot.lotNumber} (${normalizeWmsLocationCode(fromLot.location)})`,
        userId,
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
