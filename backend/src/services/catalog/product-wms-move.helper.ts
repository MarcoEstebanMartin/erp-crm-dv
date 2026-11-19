import {
  doesLotMatchWmsScope,
  extractBaseLotNumber,
  parseWmsLocationScope,
} from '../../engines/stock.engine';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import { assertSlotAcceptsStockInTx } from '../../utils/warehouse-base-layout.util';

export interface MoveWmsSlotInput {
  fromSlotCode: string;
  toSlotCode: string;
  reason?: string;
}

export interface MoveWmsSlotResult {
  fromSlotCode: string;
  toSlotCode: string;
  movedLotsCount: number;
  movedUnits: number;
  updatedProductsCount: number;
}

/**
 * Muda todos los lotes activos de un slot (o piso puntual) a otro slot en 1 sola transacción atómica,
 * preservando cada piso (`A–F`), el código limpio del lote, la fecha de vencimiento y `Δ Product.stock = 0`.
 */
export async function executeMoveWmsSlotInTx(
  tx: any,
  params: MoveWmsSlotInput & { userId: number },
): Promise<MoveWmsSlotResult> {
  const fromScope = parseWmsLocationScope(params.fromSlotCode);
  const toScope = parseWmsLocationScope(params.toSlotCode);

  if (!fromScope.isStructuredSlot || !toScope.isStructuredSlot) {
    throw new Error('La mudanza completa requiere códigos de slot WMS estructurados válidos.');
  }
  if (
    fromScope.cleanCode === toScope.cleanCode ||
    (!toScope.level && fromScope.baseSlotCode === toScope.baseSlotCode)
  ) {
    throw new Error('El slot de destino debe ser distinto al slot de origen.');
  }

  const candidateLots = await tx.productLot.findMany({
    where: {
      stock: { gt: 0 },
      OR: [
        { location: fromScope.cleanCode },
        { location: { startsWith: `${fromScope.cleanCode}-` } },
      ],
    },
    orderBy: [{ expirationDate: 'asc' }, { id: 'asc' }],
  });

  const activeLots = (candidateLots || []).filter((l: any) =>
    doesLotMatchWmsScope(l.location, fromScope.cleanCode),
  );
  if (activeLots.length === 0) {
    throw new Error(`El slot ${fromScope.cleanCode} no tiene mercadería activa para mudar.`);
  }

  const resolveDestLocation = (currentLoc?: string | null): string => {
    if (toScope.level) return toScope.cleanCode;
    const lotScope = parseWmsLocationScope(currentLoc || fromScope.baseSlotCode);
    const lvl = lotScope.level || 'A';
    return `${toScope.baseSlotCode}-${lvl}`;
  };

  const uniqueDestLocations = new Set<string>(
    activeLots.map((l: any) => resolveDestLocation(l.location)),
  );
  for (const destLoc of uniqueDestLocations) {
    await assertSlotAcceptsStockInTx(tx, destLoc);
  }

  const defaultLocProducts =
    typeof tx?.product?.findMany === 'function'
      ? await tx.product.findMany({
          where: {
            OR: [
              { defaultLocation: fromScope.cleanCode },
              { defaultLocation: { startsWith: `${fromScope.cleanCode}-` } },
            ],
          },
          select: { id: true, defaultLocation: true },
        })
      : [];

  const lockIds = [
    ...activeLots.map((l: any) => Number(l.productId)),
    ...(defaultLocProducts || []).map((p: any) => Number(p.id)),
  ];
  await lockProductsForUpdate(tx, lockIds);

  const reasonSuffix = params.reason?.trim() ? ` (${params.reason.trim()})` : '';
  const hasFindUnique = typeof tx?.productLot?.findUnique === 'function';
  const movedTargetByKey = new Map<string, any>();
  let movedLotsCount = 0;
  let movedUnits = 0;

  for (const lotSnapshot of activeLots) {
    const freshLot = hasFindUnique
      ? (await tx.productLot.findUnique({ where: { id: lotSnapshot.id } })) || lotSnapshot
      : lotSnapshot;
    const qty = Math.max(0, Math.trunc(Number(freshLot.stock || 0)));
    if (qty <= 0) continue;

    const srcLocation = freshLot.location || fromScope.cleanCode;
    const destLoc = resolveDestLocation(srcLocation);
    const cleanBaseLot = extractBaseLotNumber(freshLot.lotNumber);
    const key = `${freshLot.productId}::${cleanBaseLot}::${destLoc}`;

    let collision = movedTargetByKey.get(key) || null;
    if (!collision && hasFindUnique) {
      collision = await tx.productLot.findUnique({
        where: {
          productId_lotNumber_location: {
            productId: freshLot.productId,
            lotNumber: cleanBaseLot,
            location: destLoc,
          },
        },
      });
    }

    if (collision && collision.id !== freshLot.id) {
      await tx.productLot.update({
        where: { id: collision.id },
        data: { stock: { increment: qty } },
      });
      await tx.productLot.update({
        where: { id: freshLot.id },
        data: { stock: 0 },
      });
      if (typeof tx?.stockMovement?.create === 'function') {
        await tx.stockMovement.create({
          data: {
            productId: freshLot.productId,
            quantity: -qty,
            type: 'OUT',
            reason: `Mudanza de slot ${srcLocation} a ${destLoc} (fusión de lote)${reasonSuffix}`,
            userId: params.userId,
            productLotId: freshLot.id,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: freshLot.productId,
            quantity: qty,
            type: 'IN',
            reason: `Recepción por mudanza en ${destLoc} desde ${srcLocation}${reasonSuffix}`,
            userId: params.userId,
            productLotId: collision.id,
          },
        });
      }
      movedTargetByKey.set(key, collision);
    } else {
      const updated = await tx.productLot.update({
        where: { id: freshLot.id },
        data: { location: destLoc, lotNumber: cleanBaseLot },
      });
      if (typeof tx?.stockMovement?.create === 'function') {
        await tx.stockMovement.create({
          data: {
            productId: freshLot.productId,
            quantity: -qty,
            type: 'OUT',
            reason: `Mudanza de slot ${srcLocation} a ${destLoc}${reasonSuffix}`,
            userId: params.userId,
            productLotId: freshLot.id,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: freshLot.productId,
            quantity: qty,
            type: 'IN',
            reason: `Recepción por mudanza en ${destLoc} desde ${srcLocation}${reasonSuffix}`,
            userId: params.userId,
            productLotId: freshLot.id,
          },
        });
      }
      movedTargetByKey.set(key, updated || { ...freshLot, location: destLoc, lotNumber: cleanBaseLot });
    }

    movedLotsCount += 1;
    movedUnits += qty;
  }

  let updatedProductsCount = 0;
  if (typeof tx?.product?.update === 'function') {
    for (const prod of defaultLocProducts || []) {
      if (!doesLotMatchWmsScope(prod.defaultLocation, fromScope.cleanCode)) continue;
      const nextDefault = resolveDestLocation(prod.defaultLocation);
      await tx.product.update({
        where: { id: prod.id },
        data: { defaultLocation: nextDefault },
      });
      updatedProductsCount += 1;
    }
  }

  return {
    fromSlotCode: fromScope.cleanCode,
    toSlotCode: toScope.cleanCode,
    movedLotsCount,
    movedUnits,
    updatedProductsCount,
  };
}
