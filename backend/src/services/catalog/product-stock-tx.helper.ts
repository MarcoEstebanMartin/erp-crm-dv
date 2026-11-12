import { Prisma } from '@prisma/client';
import {
  findLotForExplicitVacate,
  normalizeWmsLocationCode,
  orderPositiveLotsForDeduction,
  resolveAdjustmentLot,
} from '../../engines/stock.engine';

export type StockAdjustMode = 'DELTA' | 'VACATE_LOT';

export interface AtomicStockAdjustmentItem {
  productId: number; quantityChange?: number; targetStock?: number; mode?: StockAdjustMode;
  reason?: string; lotNumber?: string; expirationDate?: string; location?: string | null; lotId?: number | null;
}

export interface AtomicStockAdjustmentOutcome {
  productId: number; originalProduct: any; updatedProduct: any; movement: any; movements: any[];
  previousStock: number; newStock: number; previousPhysical: number; newPhysical: number;
  reservedQty: number; appliedDelta: number;
}

const SENTINEL_EXPIRATION = '2036-12-31T00:00:00Z';

function resolveCreationExpiration(rawDate: unknown, inherited: Date | null): Date {
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return inherited || new Date(SENTINEL_EXPIRATION);
}

async function queryReservedQuantityMap(tx: Prisma.TransactionClient, productIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  const delegate = (tx as any).orderItem;
  if (!delegate || productIds.length === 0) return map;
  if (productIds.length > 1 && typeof delegate.groupBy === 'function') {
    const rows = await delegate.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds }, order: { status: { in: ['PENDING', 'PREPARING'] } } },
      _sum: { quantity: true },
    });
    for (const row of rows) map.set(row.productId, Number(row._sum?.quantity || 0));
    return map;
  }
  if (typeof delegate.aggregate === 'function') {
    for (const pid of productIds) {
      const agg = await delegate.aggregate({
        where: { productId: pid, order: { status: { in: ['PENDING', 'PREPARING'] } } },
        _sum: { quantity: true },
      });
      map.set(pid, Number(agg?._sum?.quantity || 0));
    }
  }
  return map;
}

function resolveRequestedDelta(
  item: AtomicStockAdjustmentItem,
  lots: any[],
  preselectedLot: any,
  cleanLoc: string,
  prevPhysical: number,
): { requestedDelta: number; targetVacateLot: any; hasTargetStock: boolean; mode: StockAdjustMode } {
  const mode: StockAdjustMode = item.mode || 'DELTA';
  const hasTargetStock = item.targetStock !== undefined && item.targetStock !== null;

  if (mode === 'VACATE_LOT') {
    const targetVacateLot = findLotForExplicitVacate(lots, preselectedLot, item.lotNumber, cleanLoc);
    if (!targetVacateLot) throw new Error('No se encontró el lote indicado para vaciar.');
    if (targetVacateLot.stock <= 0) throw new Error(`El lote "${targetVacateLot.lotNumber}" ya tiene stock en 0.`);
    return { requestedDelta: -targetVacateLot.stock, targetVacateLot, hasTargetStock: false, mode };
  }
  if (hasTargetStock) {
    const target = Math.trunc(Number(item.targetStock));
    if (!Number.isFinite(target) || target < 0) {
      throw new Error('El stock físico objetivo (targetStock) debe ser un entero mayor o igual a 0.');
    }
    const baseline = preselectedLot ? Math.max(0, preselectedLot.stock) : prevPhysical;
    return { requestedDelta: target - baseline, targetVacateLot: null, hasTargetStock: true, mode };
  }
  const parsed = Math.trunc(Number(item.quantityChange));
  if (!Number.isFinite(parsed) || parsed === 0) {
    throw new Error('El ajuste de stock debe ser un número entero distinto de cero.');
  }
  return { requestedDelta: parsed, targetVacateLot: null, hasTargetStock: false, mode };
}

/**
 * Motor transaccional único para ajuste individual y conteo rápido masivo.
 * Debe invocarse SIEMPRE después de `lockProductsForUpdate(tx, uniqueProductIds)`.
 * Garantiza invariante estricta: `Product.stock = Math.max(0, Σlotes - reservas)`.
 */
export async function executeAtomicStockAdjustmentsInTx(
  tx: Prisma.TransactionClient,
  orderedItems: AtomicStockAdjustmentItem[],
  userId: number,
  defaultReason: string,
): Promise<AtomicStockAdjustmentOutcome[]> {
  const uniqueProductIds = Array.from(new Set(orderedItems.map((i) => i.productId)));
  const canBulkPreload =
    uniqueProductIds.length > 1 &&
    typeof (tx.product as any).findMany === 'function' &&
    typeof (tx.productLot as any).findMany === 'function';

  const reservedMap = await queryReservedQuantityMap(tx, uniqueProductIds);
  const productMap = new Map<number, any>();
  const lotsMap = new Map<number, { hasFullSnapshot: boolean; lots: any[] }>();

  if (canBulkPreload) {
    const [productsList, lotsList] = await Promise.all([
      tx.product.findMany({ where: { id: { in: uniqueProductIds } } }),
      tx.productLot.findMany({
        where: { productId: { in: uniqueProductIds } },
        orderBy: [{ expirationDate: 'asc' }, { id: 'asc' }],
      }),
    ]);
    for (const p of productsList) productMap.set(p.id, { ...p });
    for (const pid of uniqueProductIds) lotsMap.set(pid, { hasFullSnapshot: true, lots: [] });
    for (const lot of lotsList) lotsMap.get(lot.productId)?.lots.push({ ...lot });
  }

  const outcomes: AtomicStockAdjustmentOutcome[] = [];

  for (const item of orderedItems) {
    const loaded = productMap.get(item.productId) || (await tx.product.findUnique({ where: { id: item.productId } }));
    if (!loaded) throw new Error(`Producto #${item.productId} no encontrado.`);
    productMap.set(loaded.id, { ...loaded });

    const state = productMap.get(loaded.id)!;
    const originalSnapshot = { ...state };
    const reservedQty = reservedMap.get(loaded.id) || 0;
    const cleanLoc = normalizeWmsLocationCode(item.location);

    let lotEntry = lotsMap.get(loaded.id);
    if (!lotEntry) {
      if (typeof (tx.productLot as any).findMany === 'function') {
        const fetched = await tx.productLot.findMany({
          where: { productId: loaded.id },
          orderBy: [{ expirationDate: 'asc' }, { id: 'asc' }],
        });
        lotEntry = { hasFullSnapshot: true, lots: fetched.map((l: any) => ({ ...l })) };
      } else {
        lotEntry = { hasFullSnapshot: false, lots: [] };
      }
      lotsMap.set(loaded.id, lotEntry);
    }

    let preselectedLot: any = null;
    if (item.lotId) {
      let inList = lotEntry.lots.find((l) => l.id === Number(item.lotId));
      if (!inList && typeof (tx.productLot as any).findUnique === 'function') {
        const found = await tx.productLot.findUnique({ where: { id: Number(item.lotId) } });
        if (found) {
          inList = { ...found };
          lotEntry.lots.push(inList);
        }
      }
      if (!inList) throw new Error('El lote indicado no existe.');
      if (inList.productId !== loaded.id) throw new Error('El lote indicado no pertenece al producto seleccionado.');
      preselectedLot = inList;
    }

    const prevLotsSum = lotEntry.lots.reduce((acc, l) => acc + Math.max(0, l.stock), 0);
    const prevPhysical = lotEntry.lots.length > 0 ? prevLotsSum : Math.max(0, state.stock + reservedQty);
    const reasonText = item.reason?.trim() || defaultReason;
    const { requestedDelta, targetVacateLot, hasTargetStock, mode } = resolveRequestedDelta(
      item,
      lotEntry.lots,
      preselectedLot,
      cleanLoc,
      prevPhysical,
    );

    if (requestedDelta === 0 && hasTargetStock) {
      const reconciled = Math.max(0, prevPhysical - reservedQty);
      const updatedProduct =
        state.stock !== reconciled
          ? await tx.product.update({ where: { id: loaded.id }, data: { stock: reconciled } })
          : state;
      state.stock = reconciled;
      outcomes.push({
        productId: loaded.id, originalProduct: originalSnapshot, updatedProduct, movement: null, movements: [],
        previousStock: originalSnapshot.stock, newStock: reconciled, previousPhysical: prevPhysical,
        newPhysical: prevPhysical, reservedQty, appliedDelta: 0,
      });
      continue;
    }

    const createdMovements: any[] = [];
    let appliedLotDelta = 0;
    let lastLoc = cleanLoc;
    let lastLotRemaining = 0;

    if (requestedDelta > 0) {
      const res = resolveAdjustmentLot({
        lots: lotEntry.lots, preselectedLot, lotNumber: item.lotNumber, location: cleanLoc, change: requestedDelta,
      });
      let targetLot =
        hasTargetStock && preselectedLot
          ? preselectedLot
          : res.lotId ? lotEntry.lots.find((l) => l.id === res.lotId) || null : null;
      if (!targetLot) {
        const created = await tx.productLot.create({
          data: {
            productId: loaded.id, lotNumber: res.createLotNumber,
            expirationDate: resolveCreationExpiration(item.expirationDate, res.createExpiration),
            stock: requestedDelta, location: cleanLoc,
          },
        });
        targetLot = { ...created };
        lotEntry.lots.push(targetLot);
      } else {
        targetLot.stock += requestedDelta;
        await tx.productLot.update({ where: { id: targetLot.id }, data: { stock: targetLot.stock } });
      }
      appliedLotDelta = requestedDelta;
      lastLoc = normalizeWmsLocationCode(targetLot.location);
      lastLotRemaining = targetLot.stock;
      createdMovements.push(
        await tx.stockMovement.create({
          data: { productId: loaded.id, quantity: requestedDelta, type: 'IN', reason: reasonText, userId, productLotId: targetLot.id },
        }),
      );
    } else {
      if (prevPhysical <= 0 && state.stock <= 0) {
        throw new Error(`El producto "${loaded.name || loaded.id}" ya tiene stock en 0; no hay unidades para descontar.`);
      }
      const lockedLot = mode === 'VACATE_LOT' ? targetVacateLot : preselectedLot;
      let candidates: any[];
      if (lockedLot) {
        if (lockedLot.stock <= 0) {
          throw new Error(`El lote "${lockedLot.lotNumber}" ya tiene stock en 0; no hay unidades para descontar.`);
        }
        candidates = [lockedLot];
      } else {
        const res = resolveAdjustmentLot({
          lots: lotEntry.lots, preselectedLot: null, lotNumber: item.lotNumber, location: cleanLoc, change: requestedDelta,
        });
        candidates = orderPositiveLotsForDeduction(lotEntry.lots, res.lotId);
      }
      if (candidates.length === 0 && !hasTargetStock) {
        throw new Error(`No hay lotes con unidades físicas disponibles para descontar en "${loaded.name || loaded.id}".`);
      }

      let remaining = Math.abs(requestedDelta);
      for (const lot of candidates) {
        if (remaining <= 0) break;
        const takeQty = Math.min(lot.stock, remaining);
        if (takeQty <= 0) continue;
        lot.stock -= takeQty;
        await tx.productLot.update({ where: { id: lot.id }, data: { stock: lot.stock } });
        remaining -= takeQty;
        appliedLotDelta -= takeQty;
        lastLoc = normalizeWmsLocationCode(lot.location);
        lastLotRemaining = lot.stock;
        createdMovements.push(
          await tx.stockMovement.create({
            data: { productId: loaded.id, quantity: -takeQty, type: 'OUT', reason: reasonText, userId, productLotId: lot.id },
          }),
        );
      }
    }

    const nextLotsSum = lotEntry.lots.reduce((acc, l) => acc + Math.max(0, l.stock), 0);
    const nextPhysical = lotEntry.lots.length > 0
      ? nextLotsSum
      : hasTargetStock ? Math.max(0, Math.trunc(Number(item.targetStock))) : Math.max(0, prevPhysical + appliedLotDelta);
    const nextProductStock = lotEntry.hasFullSnapshot || hasTargetStock
      ? Math.max(0, nextPhysical - reservedQty)
      : Math.max(0, state.stock + appliedLotDelta);

    const normDefault = normalizeWmsLocationCode(state.defaultLocation);
    const clearDefault =
      appliedLotDelta < 0 && lastLotRemaining <= 0 && lastLoc !== 'S/U' &&
      (normDefault === lastLoc || normDefault.startsWith(`${lastLoc}-`));

    const updatedProduct = await tx.product.update({
      where: { id: loaded.id },
      data: { stock: nextProductStock, ...(clearDefault ? { defaultLocation: null } : {}) },
    });
    state.stock = nextProductStock;
    if (clearDefault) state.defaultLocation = null;

    outcomes.push({
      productId: loaded.id, originalProduct: originalSnapshot, updatedProduct,
      movement: createdMovements[0] || null, movements: createdMovements,
      previousStock: originalSnapshot.stock, newStock: nextProductStock,
      previousPhysical: prevPhysical, newPhysical: nextPhysical, reservedQty, appliedDelta: appliedLotDelta,
    });
  }

  return outcomes;
}
