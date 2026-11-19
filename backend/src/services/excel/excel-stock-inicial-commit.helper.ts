import { extractBaseLotNumber, normalizeWmsLocationCode } from '../../engines/stock.engine';
import { lockProductsForUpdate } from '../../utils/db-locks.util';
import { assertSlotAcceptsStockInTx } from '../../utils/warehouse-base-layout.util';

const SENTINEL_ISO = '2036-12-31T00:00:00.000Z';

interface ConsolidatedInitialRow {
  productId: number;
  sku: string;
  lotNumber: string;
  location: string;
  expirationDate: string;
  isSentinelExpiration: boolean;
  quantity: number;
}

function isSentinelDateValue(val: Date | string | null | undefined): boolean {
  if (!val) return true;
  const parsed = val instanceof Date ? val : new Date(val);
  return Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() >= 2036;
}

/**
 * Consolida e impacta en DB filas validadas de `STOCK_INICIAL` dentro de `prisma.$transaction`:
 * - Valida ubicaciones contra el plano base + DB overrides.
 * - Bloquea todos los productos con `FOR UPDATE` en orden ascendente.
 * - Crea/incrementa cada `ProductLot`, registra Kardex `IN` (`INV-INICIAL`) y recalcula `Product.stock = max(0, Σlotes - reservas)`.
 */
export async function commitStockInicialRowsInTx(
  tx: any,
  validRows: any[],
  userId: number,
): Promise<{
  createdCount: number;
  updatedCount: number;
  totalUnitsAdded: number;
  touchedSkus: string[];
}> {
  const entries = (validRows || []).filter(
    (r) =>
      r?.status !== 'ERROR' &&
      r?.action !== 'NONE' &&
      Number(r?.data?.productId) > 0 &&
      Math.trunc(Number(r?.data?.quantity || 0)) > 0,
  );

  if (entries.length === 0) {
    throw new Error('No hay filas válidas con cantidad positiva para importar.');
  }

  const consolidated = new Map<string, ConsolidatedInitialRow>();
  const firstRealLocationByProduct = new Map<number, string>();

  for (const row of entries) {
    const productId = Math.trunc(Number(row.data.productId));
    const sku = String(row.data.sku || '').trim();
    const rawLot = String(row.data.lotNumber || 'S/L').trim();
    const lotNumber = !rawLot || rawLot.toUpperCase() === 'S/L' ? 'S/L' : extractBaseLotNumber(rawLot);
    const location = normalizeWmsLocationCode(row.data.location || 'S/U');
    const expIso = String(row.data.expirationDate || SENTINEL_ISO);
    const isSentinel =
      typeof row.data.isSentinelExpiration === 'boolean'
        ? row.data.isSentinelExpiration
        : isSentinelDateValue(expIso);
    const qty = Math.trunc(Number(row.data.quantity));

    if (location !== 'S/U' && !firstRealLocationByProduct.has(productId)) {
      firstRealLocationByProduct.set(productId, location);
    }

    const key = `${productId}::${lotNumber}::${location}`;
    const prev = consolidated.get(key);
    if (prev) {
      if (
        !prev.isSentinelExpiration &&
        !isSentinel &&
        prev.expirationDate.slice(0, 10) !== expIso.slice(0, 10)
      ) {
        throw new Error(
          `Conflicto de fecha de vencimiento para SKU ${sku}, lote ${lotNumber} en ${location}.`,
        );
      }
      if (prev.isSentinelExpiration && !isSentinel) {
        prev.expirationDate = expIso;
        prev.isSentinelExpiration = false;
      }
      prev.quantity += qty;
    } else {
      consolidated.set(key, {
        productId,
        sku,
        lotNumber,
        location,
        expirationDate: expIso,
        isSentinelExpiration: isSentinel,
        quantity: qty,
      });
    }
  }

  const uniqueLocations = new Set<string>(
    Array.from(consolidated.values())
      .map((e) => e.location)
      .filter((loc) => loc !== 'S/U'),
  );
  for (const loc of uniqueLocations) {
    await assertSlotAcceptsStockInTx(tx, loc);
  }

  const uniqueProductIds = Array.from(
    new Set(Array.from(consolidated.values()).map((e) => e.productId)),
  ).sort((a, b) => a - b);

  await lockProductsForUpdate(tx, uniqueProductIds);

  const reservedMap = new Map<number, number>();
  if (typeof tx?.orderItem?.groupBy === 'function') {
    const resRows = await tx.orderItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: uniqueProductIds },
        order: { status: { in: ['PENDING', 'PREPARING'] } },
      },
      _sum: { quantity: true },
    });
    for (const r of resRows || []) {
      reservedMap.set(r.productId, Number(r._sum?.quantity || 0));
    }
  } else if (typeof tx?.orderItem?.aggregate === 'function') {
    for (const pid of uniqueProductIds) {
      const agg = await tx.orderItem.aggregate({
        where: { productId: pid, order: { status: { in: ['PENDING', 'PREPARING'] } } },
        _sum: { quantity: true },
      });
      reservedMap.set(pid, Number(agg?._sum?.quantity || 0));
    }
  }

  let createdCount = 0;
  let updatedCount = 0;
  let totalUnitsAdded = 0;

  for (const entry of consolidated.values()) {
    const incomingExp = new Date(entry.expirationDate);
    const existingLot = await tx.productLot.findUnique({
      where: {
        productId_lotNumber_location: {
          productId: entry.productId,
          lotNumber: entry.lotNumber,
          location: entry.location,
        },
      },
    });

    let targetLot: any;
    if (existingLot) {
      const shouldUpgradeExp =
        !entry.isSentinelExpiration &&
        (Number(existingLot.stock || 0) <= 0 || isSentinelDateValue(existingLot.expirationDate));
      targetLot = await tx.productLot.update({
        where: { id: existingLot.id },
        data: {
          stock: { increment: entry.quantity },
          ...(shouldUpgradeExp ? { expirationDate: incomingExp } : {}),
        },
      });
      updatedCount += 1;
    } else {
      targetLot = await tx.productLot.create({
        data: {
          productId: entry.productId,
          lotNumber: entry.lotNumber,
          location: entry.location,
          stock: entry.quantity,
          expirationDate: incomingExp,
        },
      });
      createdCount += 1;
    }

    await tx.stockMovement.create({
      data: {
        productId: entry.productId,
        quantity: entry.quantity,
        type: 'IN',
        referenceId: 'INV-INICIAL',
        userId,
        reason: 'Carga de Inventario Inicial (Excel)',
        productLotId: targetLot.id,
      },
    });
    totalUnitsAdded += entry.quantity;
  }

  const touchedSkus: string[] = [];
  for (const productId of uniqueProductIds) {
    const prod = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, defaultLocation: true },
    });
    if (!prod) continue;

    const allLots = await tx.productLot.findMany({
      where: { productId },
      select: { stock: true },
    });
    const sumLots = (allLots || []).reduce(
      (sum: number, l: any) => sum + Math.max(0, Number(l.stock || 0)),
      0,
    );
    const reserved = reservedMap.get(productId) || 0;
    const nextStock = Math.max(0, sumLots - reserved);
    const firstRealLoc = firstRealLocationByProduct.get(productId);
    const shouldSetDefault = !prod.defaultLocation && Boolean(firstRealLoc);

    await tx.product.update({
      where: { id: productId },
      data: {
        stock: nextStock,
        ...(shouldSetDefault ? { defaultLocation: firstRealLoc } : {}),
      },
    });

    if (prod.sku) touchedSkus.push(prod.sku);
  }

  return { createdCount, updatedCount, totalUnitsAdded, touchedSkus };
}
