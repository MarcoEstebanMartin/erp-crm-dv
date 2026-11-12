import { Prisma } from '@prisma/client';
import {
  WmsLocationScope,
  extractBaseLotNumber,
  planWmsSafeRelocation,
  resolveTargetLotNumberForLocation,
} from '../../engines/stock.engine';

export interface ExecuteWmsRelocationParams {
  tx: Prisma.TransactionClient;
  product: any;
  existingLots: any[];
  scope: WmsLocationScope;
  qty: number;
  expDate: Date;
  lotNumber?: string;
  sourceLotId?: number | null;
  expirationDateRaw?: string;
  reason?: string;
  mode: 'RELOCATE' | 'STOCK_IN';
  userId: number;
}

const SENTINEL_EXPIRATION = new Date('2036-12-31T00:00:00Z');

/**
 * Ejecuta dentro de `FOR UPDATE` la asignación WMS (`STOCK_IN` o `RELOCATE` con `Δ Stock = 0`),
 * registrando movimientos auditables incluso al normalizar remanente sin lote en `S/U`.
 */
export async function executeWmsAssignmentInTx(params: ExecuteWmsRelocationParams) {
  const { tx, product, existingLots, scope, qty, expDate, mode, userId } = params;

  if (mode === 'STOCK_IN') {
    const requestedLot = params.lotNumber?.trim() || 'S/L';
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
        reason: params.reason || `Ingreso directo en posición WMS ${scope.cleanCode}`,
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
    sourceLotId: params.sourceLotId,
    preferredLotNumber: params.lotNumber,
  });

  if (untrackedGap > 0) {
    const remainderForUnassigned = untrackedGap - plan.fromUntrackedGap;
    if (remainderForUnassigned > 0) {
      const suRes = resolveTargetLotNumberForLocation('S/L', 'S/U', existingLots);
      let suLotId: number;
      if (suRes.existingTargetLotId) {
        await tx.productLot.update({
          where: { id: suRes.existingTargetLotId },
          data: { stock: { increment: remainderForUnassigned }, location: 'S/U' },
        });
        suLotId = suRes.existingTargetLotId;
      } else {
        const createdSu = await tx.productLot.create({
          data: {
            productId: product.id,
            lotNumber: suRes.targetLotNumber,
            expirationDate: SENTINEL_EXPIRATION,
            stock: remainderForUnassigned,
            location: 'S/U',
          },
        });
        existingLots.push(createdSu);
        suLotId = createdSu.id;
      }

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: remainderForUnassigned,
          type: 'ADJUSTMENT',
          reason: 'Normalización interna de stock sin lote previo hacia S/U (Δ Stock comercial = 0)',
          userId,
          productLotId: suLotId,
        },
      });
    }
  }

  if (plan.fromUntrackedGap === 0 && plan.steps.length === 1 && plan.steps[0].remainingInSource === 0) {
    const singleStep = plan.steps[0];
    const otherLots = existingLots.filter((l) => l.id !== singleStep.lotId);
    const targetRes = resolveTargetLotNumberForLocation(
      params.lotNumber?.trim() || singleStep.lotNumber,
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
    params.lotNumber?.trim() ||
    (plan.steps[0] ? extractBaseLotNumber(plan.steps[0].lotNumber) : 'S/L');
  const resolvedExpDate = params.expirationDateRaw?.trim()
    ? expDate
    : plan.steps[0]?.expirationDate || expDate;
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
        reason: `Normalización de lote inicial ubicado en ${scope.cleanCode} (Δ Stock comercial = 0)`,
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
}
