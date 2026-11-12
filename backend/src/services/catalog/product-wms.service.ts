import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import {
  doesLotMatchWmsScope,
  extractBaseLotNumber,
  parseWmsLocationScope,
  planWmsSafeRelocation,
  resolveTargetLotNumberForLocation,
} from '../../engines/stock.engine';
import { validateSlotAllowsStockAssignment } from '../../engines/warehouse-layout.engine';

export interface ClearWmsLocationInput {
  locationCode: string;
  productId?: number | null;
  lotId?: number | null;
  mode?: 'UNASSIGN' | 'WRITE_OFF';
  reason?: string;
  userRole?: string;
}

export interface AssignWmsLocationInput {
  productId: number;
  locationCode: string;
  quantity: number;
  lotNumber?: string;
  sourceLotId?: number | null;
  expirationDate?: string;
  reason?: string;
  mode?: 'RELOCATE' | 'STOCK_IN';
  userRole?: string;
}

export class ProductWmsSubService {
  /**
   * Liberar una posición WMS (o un lote puntual dentro de ella).
   * - `UNASSIGN` (por defecto): devuelve las unidades a 'S/U' preservando el 100% del stock (`Δ Stock = 0`).
   * - `WRITE_OFF` (exclusivo ADMIN): descuenta en simultáneo lote y `Product.stock` con asiento en Kardex.
   */
  async clearWmsLocation(input: string | ClearWmsLocationInput, userId: number) {
    const normalizedInput: ClearWmsLocationInput =
      typeof input === 'string' ? { locationCode: input } : input || { locationCode: '' };

    const scope = parseWmsLocationScope(normalizedInput.locationCode);
    if (!normalizedInput.locationCode || scope.cleanCode === 'S/U') {
      throw new Error('Debe indicar un código de ubicación WMS válido (distinto de S/U).');
    }

    const mode = normalizedInput.mode || 'UNASSIGN';
    if (mode === 'WRITE_OFF' && normalizedInput.userRole && normalizedInput.userRole !== 'ADMIN') {
      throw new Error('Solo un Administrador puede dar de baja stock físico desde el mapa.');
    }

    const locationWhere =
      scope.level === null
        ? { OR: [{ location: scope.cleanCode }, { location: { startsWith: `${scope.cleanCode}-` } }] }
        : { location: scope.cleanCode };

    const result = await prisma.$transaction(async (tx) => {
      const candidateLots = await tx.productLot.findMany({
        where: {
          ...locationWhere,
          ...(normalizedInput.lotId ? { id: Number(normalizedInput.lotId) } : {}),
          ...(normalizedInput.productId ? { productId: Number(normalizedInput.productId) } : {}),
        },
      });
      const matchingLots = candidateLots.filter((l) => doesLotMatchWmsScope(l.location, scope.cleanCode));

      const defaultLocProducts = await tx.product.findMany({
        where: {
          ...(normalizedInput.productId ? { id: Number(normalizedInput.productId) } : {}),
          ...(scope.level === null
            ? { OR: [{ defaultLocation: scope.cleanCode }, { defaultLocation: { startsWith: `${scope.cleanCode}-` } }] }
            : { defaultLocation: scope.cleanCode }),
        },
        select: { id: true, defaultLocation: true },
      });

      const affectedIds = Array.from(
        new Set([...matchingLots.map((l) => l.productId), ...defaultLocProducts.map((p) => p.id)]),
      );
      await lockProductsForUpdate(tx, affectedIds);

      let movedUnits = 0;
      let writtenOffUnits = 0;

      for (const lot of matchingLots) {
        const freshLot = await tx.productLot.findUnique({ where: { id: lot.id } });
        if (!freshLot) continue;

        if (mode === 'WRITE_OFF') {
          const product = await tx.product.findUnique({ where: { id: freshLot.productId } });
          if (!product) continue;

          const subQty = Math.max(0, freshLot.stock);
          const nextProductStock = Math.max(0, product.stock - subQty);
          const appliedDelta = nextProductStock - product.stock;

          // El lote vaciado conserva su ubicación (stock 0): moverlo a 'S/U' podría colisionar
          // con la clave única (productId, lotNumber, location) del lote genérico ya existente.
          await tx.productLot.update({
            where: { id: freshLot.id },
            data: { stock: 0 },
          });

          if (subQty > 0) {
            await tx.product.update({ where: { id: product.id }, data: { stock: nextProductStock } });
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                quantity: appliedDelta !== 0 ? appliedDelta : -subQty,
                type: 'ADJUSTMENT',
                reason: normalizedInput.reason || `Baja explícita de stock en posición ${scope.cleanCode}`,
                userId,
                productLotId: freshLot.id,
              },
            });
            writtenOffUnits += subQty;
          }
          continue;
        }

        const siblingLots = await tx.productLot.findMany({
          where: { productId: freshLot.productId, id: { not: freshLot.id } },
        });
        const baseCode = extractBaseLotNumber(freshLot.lotNumber);
        const targetResolution = resolveTargetLotNumberForLocation(baseCode, 'S/U', siblingLots);

        if (targetResolution.existingTargetLotId && freshLot.stock > 0) {
          const destLotId = targetResolution.existingTargetLotId;
          const qtyToMove = freshLot.stock;

          await tx.productLot.update({
            where: { id: destLotId },
            data: { stock: { increment: qtyToMove }, location: 'S/U' },
          });
          await tx.stockMovement.create({
            data: {
              productId: freshLot.productId,
              quantity: -qtyToMove,
              type: 'OUT',
              reason: `Liberación de ubicación ${freshLot.location} hacia S/U`,
              userId,
              productLotId: freshLot.id,
            },
          });
          await tx.stockMovement.create({
            data: {
              productId: freshLot.productId,
              quantity: qtyToMove,
              type: 'IN',
              reason: `Recepción en S/U desde ubicación ${freshLot.location}`,
              userId,
              productLotId: destLotId,
            },
          });

          // Fusión: el lote de origen queda en stock 0 en su posición (con historial en Kardex).
          // No se intenta DELETE: un error de FK dentro de la transacción de PostgreSQL la abortaría entera.
          await tx.productLot.update({ where: { id: freshLot.id }, data: { stock: 0 } });
          movedUnits += qtyToMove;
        } else if (!targetResolution.existingTargetLotId) {
          await tx.productLot.update({
            where: { id: freshLot.id },
            data: { location: 'S/U', lotNumber: targetResolution.targetLotNumber },
          });
          movedUnits += Math.max(0, freshLot.stock);
        }
        // Lote vacío con gemelo ya existente en S/U: no requiere cambios (evita colisión de clave única).
      }

      let clearedProductsCount = 0;
      for (const prod of defaultLocProducts) {
        if (!doesLotMatchWmsScope(prod.defaultLocation, scope.cleanCode)) continue;
        const remainingInSlot = await tx.productLot.count({
          where: { productId: prod.id, stock: { gt: 0 }, ...locationWhere },
        });
        if (remainingInSlot === 0) {
          await tx.product.update({ where: { id: prod.id }, data: { defaultLocation: null } });
          clearedProductsCount++;
        }
      }

      return {
        mode,
        clearedLotsCount: matchingLots.length,
        clearedProductsCount,
        movedUnitsToUnassigned: movedUnits,
        writtenOffUnits,
      };
    });

    await logAudit({
      userId,
      action: 'CLEAR_WMS_LOCATION',
      entityType: 'ProductLot',
      entityId: normalizedInput.productId ? Number(normalizedInput.productId) : 0,
      newValues: { locationCode: scope.cleanCode, ...result },
    });

    return {
      message:
        mode === 'UNASSIGN'
          ? `Posición ${scope.cleanCode} liberada. ${result.movedUnitsToUnassigned} u. quedaron resguardadas como Sin Ubicar (S/U) sin alterar el stock total.`
          : `Posición ${scope.cleanCode} vaciada con baja de ${result.writtenOffUnits} u.`,
      result,
    };
  }

  /**
   * Asignar mercadería a una posición física WMS manteniendo paridad exacta:
   * - `RELOCATE` (por defecto): ubica unidades existentes (priorizando 'S/U' por FEFO) con `Δ Stock = 0`.
   * - `STOCK_IN`: ingresa mercadería nueva incrementando lote y `Product.stock` en simultáneo.
   */
  async assignWmsLocation(data: AssignWmsLocationInput, userId: number) {
    const productId = Math.trunc(Number(data.productId));
    const scope = parseWmsLocationScope(data.locationCode);
    const qty = Math.trunc(Number(data.quantity));
    const mode = data.mode || 'RELOCATE';

    if (!productId || !data.locationCode || scope.cleanCode === 'S/U') {
      throw new Error('Producto y código de ubicación WMS válido son obligatorios.');
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error('La cantidad debe ser un número entero mayor a cero.');
    }

    let expDate = new Date('2036-12-31T00:00:00Z');
    if (data.expirationDate && typeof data.expirationDate === 'string' && data.expirationDate.trim()) {
      const parsed = new Date(data.expirationDate);
      if (!isNaN(parsed.getTime())) expDate = parsed;
    }

    const result = await prisma.$transaction(async (tx) => {
      if (typeof (tx as any).warehouseCell?.findUnique === 'function') {
        const customCell = await tx.warehouseCell.findUnique({
          where: { code: scope.baseSlotCode },
        });
        const slotCheck = validateSlotAllowsStockAssignment(customCell, scope.cleanCode);
        if (!slotCheck.allowed) {
          throw new Error(slotCheck.reason || 'El slot seleccionado no admite mercadería.');
        }
      }

      await lockProductsForUpdate(tx, [productId]);

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Producto no encontrado.');

      const existingLots = await tx.productLot.findMany({
        where: { productId: product.id },
        orderBy: { expirationDate: 'asc' },
      });

      if (mode === 'STOCK_IN') {
        const requestedLot = data.lotNumber?.trim() || 'S/L';
        const targetRes = resolveTargetLotNumberForLocation(requestedLot, scope.cleanCode, existingLots);

        const targetLot = targetRes.existingTargetLotId
          ? await tx.productLot.update({
              where: { id: targetRes.existingTargetLotId },
              data: { stock: { increment: qty }, location: scope.cleanCode },
            })
          : await tx.productLot.create({
              data: {
                productId: product.id,
                lotNumber: targetRes.targetLotNumber,
                expirationDate: expDate,
                stock: qty,
                location: scope.cleanCode,
              },
            });

        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: qty }, defaultLocation: scope.cleanCode },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: qty,
            type: 'IN',
            reason: data.reason || `Ingreso directo en posición WMS ${scope.cleanCode}`,
            userId,
            productLotId: targetLot.id,
          },
        });

        return { product: updatedProduct, lot: targetLot, mode };
      }

      let reservedQty = 0;
      if (typeof (tx as any).orderItem?.aggregate === 'function') {
        const resAgg = await tx.orderItem.aggregate({
          where: { productId: product.id, order: { status: { in: ['PENDING', 'PREPARING'] } } },
          _sum: { quantity: true },
        });
        reservedQty = resAgg._sum.quantity || 0;
      }

      const sumLots = existingLots.reduce((acc, l) => acc + l.stock, 0);
      const untrackedGap = Math.max(0, product.stock + reservedQty - sumLots);

      const plan = planWmsSafeRelocation({
        targetLocation: scope.cleanCode,
        quantity: qty,
        lots: existingLots,
        untrackedCommercialGap: untrackedGap,
        sourceLotId: data.sourceLotId,
        preferredLotNumber: data.lotNumber,
      });

      if (untrackedGap > 0) {
        const remainderForUnassigned = untrackedGap - plan.fromUntrackedGap;
        if (remainderForUnassigned > 0) {
          const suRes = resolveTargetLotNumberForLocation('S/L', 'S/U', existingLots);
          if (suRes.existingTargetLotId) {
            await tx.productLot.update({
              where: { id: suRes.existingTargetLotId },
              data: { stock: { increment: remainderForUnassigned }, location: 'S/U' },
            });
          } else {
            const createdSu = await tx.productLot.create({
              data: {
                productId: product.id,
                lotNumber: suRes.targetLotNumber,
                expirationDate: new Date('2036-12-31T00:00:00Z'),
                stock: remainderForUnassigned,
                location: 'S/U',
              },
            });
            existingLots.push(createdSu);
          }
        }
      }

      if (plan.fromUntrackedGap === 0 && plan.steps.length === 1 && plan.steps[0].remainingInSource === 0) {
        const singleStep = plan.steps[0];
        const otherLots = existingLots.filter((l) => l.id !== singleStep.lotId);
        const targetRes = resolveTargetLotNumberForLocation(
          data.lotNumber?.trim() || singleStep.lotNumber,
          scope.cleanCode,
          otherLots,
        );

        if (!targetRes.existingTargetLotId) {
          const movedLot = await tx.productLot.update({
            where: { id: singleStep.lotId },
            data: { location: scope.cleanCode, lotNumber: targetRes.targetLotNumber },
          });
          const updatedProduct = await tx.product.update({
            where: { id: product.id },
            data: { defaultLocation: scope.cleanCode },
          });
          return { product: updatedProduct, lot: movedLot, mode };
        }
      }

      const preferredBaseLot =
        data.lotNumber?.trim() || (plan.steps[0] ? extractBaseLotNumber(plan.steps[0].lotNumber) : 'S/L');
      const resolvedExpDate = data.expirationDate?.trim() ? expDate : plan.steps[0]?.expirationDate || expDate;
      const targetRes = resolveTargetLotNumberForLocation(preferredBaseLot, scope.cleanCode, existingLots);

      let targetLot = targetRes.existingTargetLotId
        ? await tx.productLot.findUniqueOrThrow({ where: { id: targetRes.existingTargetLotId } })
        : await tx.productLot.create({
            data: {
              productId: product.id,
              lotNumber: targetRes.targetLotNumber,
              expirationDate: resolvedExpDate,
              stock: 0,
              location: scope.cleanCode,
            },
          });

      for (const step of plan.steps) {
        // El lote de origen conserva su ubicación aunque quede en 0 (evita colisión de clave única).
        await tx.productLot.update({
          where: { id: step.lotId },
          data: { stock: step.remainingInSource },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: -step.takeQty,
            type: 'OUT',
            reason: `Traslado interno WMS desde ${step.fromLocation} hacia ${scope.cleanCode}`,
            userId,
            productLotId: step.lotId,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: step.takeQty,
            type: 'IN',
            reason: `Ubicación interna WMS en ${scope.cleanCode} (origen ${step.fromLocation})`,
            userId,
            productLotId: targetLot.id,
          },
        });
      }

      if (plan.fromUntrackedGap > 0) {
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            quantity: plan.fromUntrackedGap,
            type: 'ADJUSTMENT',
            reason: `Normalización de lote inicial ubicado en ${scope.cleanCode}`,
            userId,
            productLotId: targetLot.id,
          },
        });
      }

      targetLot = await tx.productLot.update({
        where: { id: targetLot.id },
        data: { stock: { increment: qty }, location: scope.cleanCode },
      });
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { defaultLocation: scope.cleanCode },
      });

      return { product: updatedProduct, lot: targetLot, mode };
    });

    await logAudit({
      userId,
      action: 'ASSIGN_WMS_LOCATION',
      entityType: 'Product',
      entityId: productId,
      newValues: { locationCode: scope.cleanCode, quantity: qty, mode },
    });

    return {
      message:
        mode === 'RELOCATE'
          ? `Se ubicaron ${qty} u. en la posición ${scope.cleanCode} (stock total conservado sin descalces).`
          : `Se ingresaron ${qty} u. nuevas en la posición ${scope.cleanCode}.`,
      result,
    };
  }
}

export const productWmsSubService = new ProductWmsSubService();
