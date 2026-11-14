import { MovementType, Prisma } from '@prisma/client';
import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from '../../core/money';
import { extractBaseLotNumber, normalizeWmsLocationCode } from '../../engines/stock.engine';

export interface FefoSortableLot {
  id: number;
  stock: number;
  lotNumber?: string;
  expirationDate?: Date | string | null;
  location?: string | null;
}

export interface LotAllocationRecord {
  lot: { id: number; lotNumber?: string; location?: string | null };
  quantity: number;
}

/**
 * Ordenamiento FEFO determinístico:
 * 1) expirationDate ascendente, 2) Sin Ubicar ('S/U') primero ante empate, 3) id ascendente.
 */
export function sortLotsDeterministicFefo<T extends FefoSortableLot>(lots: T[]): T[] {
  return [...lots].sort((a, b) => {
    const expA = a.expirationDate ? new Date(a.expirationDate).getTime() : 0;
    const expB = b.expirationDate ? new Date(b.expirationDate).getTime() : 0;
    return (
      expA - expB ||
      Number(normalizeWmsLocationCode(a.location || 'S/U') !== 'S/U') -
        Number(normalizeWmsLocationCode(b.location || 'S/U') !== 'S/U') ||
      a.id - b.id
    );
  });
}

function formatLotReason(lot: { lotNumber?: string; location?: string | null }, orderId: number): string {
  const loc = normalizeWmsLocationCode(lot.location || 'S/U');
  return `Venta - Descuento físico de Lote #${extractBaseLotNumber(lot.lotNumber || 'S/L')}${
    loc !== 'S/U' ? ` (${lot.location})` : ''
  } para Pedido #${orderId}`;
}

async function getOrCreateContingencySlLotInTx(tx: any, productId: number) {
  let slLot = await tx.productLot.findFirst({
    where: { productId, lotNumber: 'S/L', location: 'S/U' },
  });
  if (!slLot) {
    slLot = await tx.productLot.create({
      data: {
        productId,
        lotNumber: 'S/L',
        expirationDate: new Date('2036-12-31T00:00:00Z'),
        stock: 0,
        location: 'S/U',
      },
    });
  }
  return slLot;
}

async function createLotOutMovementInTx(
  tx: any,
  params: { orderId: number; productId: number; sellerId: number; quantity: number; lot: LotAllocationRecord['lot'] },
) {
  await tx.stockMovement.create({
    data: {
      productId: params.productId,
      quantity: -params.quantity,
      type: MovementType.OUT,
      orderId: params.orderId,
      referenceId: `ORDER-${params.orderId}`,
      userId: params.sellerId,
      reason: formatLotReason(params.lot, params.orderId),
      productLotId: params.lot.id,
    },
  });
}

/**
 * Vincula movimientos `ORDER-${orderId}` sin lote a las asignaciones reales sin inflar el Kardex
 * cuando un mismo producto se despacha desde 2 o más lotes.
 */
async function linkOrderLotMovementsInTx(
  tx: any,
  params: { orderId: number; productId: number; sellerId: number; allocations: LotAllocationRecord[] },
): Promise<void> {
  const { orderId, productId, sellerId, allocations } = params;
  if (allocations.length === 0 || !tx.stockMovement) return;

  const originalMov =
    typeof tx.stockMovement.findFirst === 'function'
      ? await tx.stockMovement.findFirst({
          where: { productId, referenceId: `ORDER-${orderId}`, productLotId: null },
        })
      : null;

  if (!originalMov) {
    for (const alloc of allocations) {
      await createLotOutMovementInTx(tx, { orderId, productId, sellerId, quantity: alloc.quantity, lot: alloc.lot });
    }
    return;
  }

  if (allocations.length === 1) {
    await tx.stockMovement.update({
      where: { id: originalMov.id },
      data: { productLotId: allocations[0].lot.id, orderId },
    });
    return;
  }

  const originalAbs = Math.abs(Number(originalMov.quantity || 0));
  const totalAllocated = allocations.reduce((s, a) => s + a.quantity, 0);

  if (totalAllocated <= originalAbs) {
    const shortage = originalAbs - totalAllocated;
    await tx.stockMovement.update({
      where: { id: originalMov.id },
      data: { quantity: -(allocations[0].quantity + shortage), productLotId: allocations[0].lot.id, orderId },
    });
    for (let i = 1; i < allocations.length; i++) {
      await createLotOutMovementInTx(tx, {
        orderId,
        productId,
        sellerId,
        quantity: allocations[i].quantity,
        lot: allocations[i].lot,
      });
    }
    return;
  }

  // Si totalAllocated > originalAbs, la diferencia adicional ya fue asentada en ADJUST-ARMADO.
  let remainingToBind = originalAbs;
  let updatedOriginal = false;
  for (const alloc of allocations) {
    if (remainingToBind <= 0) break;
    const chunk = Math.min(alloc.quantity, remainingToBind);
    remainingToBind -= chunk;
    if (!updatedOriginal) {
      updatedOriginal = true;
      await tx.stockMovement.update({
        where: { id: originalMov.id },
        data: { quantity: -chunk, productLotId: alloc.lot.id, orderId },
      });
    } else {
      await createLotOutMovementInTx(tx, { orderId, productId, sellerId, quantity: chunk, lot: alloc.lot });
    }
  }
}

/**
 * Asigna lotes FEFO determinísticos a un OrderItem si aún no tiene trazabilidad,
 * descontando `ProductLot.stock`, creando `OrderItemLot` y vinculando el Kardex.
 */
export async function ensureFefoLotsForOrderItem(
  tx: Prisma.TransactionClient | any,
  params: { orderId: number; orderItemId: number; productId: number; quantity: number; sellerId: number },
): Promise<LotAllocationRecord[]> {
  const { orderId, orderItemId, productId, quantity, sellerId } = params;
  if (quantity <= 0 || !tx?.productLot?.findMany) return [];

  let remainingToAssign = quantity;
  const rawLots = await tx.productLot.findMany({
    where: { productId, stock: { gt: 0 } },
    orderBy: { expirationDate: 'asc' },
  });
  const allocations: LotAllocationRecord[] = [];

  for (const lot of sortLotsDeterministicFefo(rawLots || [])) {
    if (remainingToAssign <= 0) break;
    const allocatedQty = Math.min(Number(lot.stock || 0), remainingToAssign);
    if (allocatedQty <= 0) continue;

    await tx.productLot.update({ where: { id: lot.id }, data: { stock: { decrement: allocatedQty } } });
    await tx.orderItemLot.create({ data: { orderItemId, productLotId: lot.id, quantity: allocatedQty } });
    allocations.push({ lot, quantity: allocatedQty });
    remainingToAssign -= allocatedQty;
  }

  if (remainingToAssign > 0 && process.env.IGNORE_STOCK_CHECK === 'true') {
    const slLot = await getOrCreateContingencySlLotInTx(tx, productId);
    await tx.productLot.update({ where: { id: slLot.id }, data: { stock: { decrement: remainingToAssign } } });
    await tx.orderItemLot.create({ data: { orderItemId, productLotId: slLot.id, quantity: remainingToAssign } });
    allocations.push({ lot: slLot, quantity: remainingToAssign });
  }

  await linkOrderLotMovementsInTx(tx, { orderId, productId, sellerId, allocations });
  return allocations;
}

/**
 * Sincroniza `OrderItemLot` y `ProductLot.stock` al confirmar armado rápido:
 * preserva lotes existentes si no cambió la cantidad, o ajusta solo el delta.
 */
export async function adjustAssignedOrderItemLotsInTx(
  tx: Prisma.TransactionClient | any,
  params: {
    orderId: number;
    orderItemId: number;
    productId: number;
    existingLots: Array<{ id: number; productLotId: number; quantity: number }>;
    previousQty: number;
    nextQty: number;
    sellerId: number;
  },
): Promise<void> {
  const { orderId, orderItemId, productId, existingLots, previousQty, nextQty, sellerId } = params;

  if (!existingLots || existingLots.length === 0) {
    if (nextQty > 0) {
      await ensureFefoLotsForOrderItem(tx, { orderId, orderItemId, productId, quantity: nextQty, sellerId });
    }
    return;
  }
  if (nextQty === previousQty) return;

  if (nextQty < previousQty) {
    let toRelease = previousQty - nextQty;
    for (const itemLot of [...existingLots].reverse()) {
      if (toRelease <= 0) break;
      const releaseQty = Math.min(itemLot.quantity, toRelease);
      if (releaseQty <= 0) continue;

      await tx.productLot.update({
        where: { id: itemLot.productLotId },
        data: { stock: { increment: releaseQty } },
      });
      const remainingOnLink = itemLot.quantity - releaseQty;
      if (remainingOnLink <= 0) {
        await tx.orderItemLot.delete({ where: { id: itemLot.id } });
      } else {
        await tx.orderItemLot.update({ where: { id: itemLot.id }, data: { quantity: remainingOnLink } });
      }
      toRelease -= releaseQty;
    }
    return;
  }

  await ensureFefoLotsForOrderItem(tx, {
    orderId,
    orderItemId,
    productId,
    quantity: nextQty - previousQty,
    sellerId,
  });
}

export async function processOrderPreparedLotAssignments(
  tx: Prisma.TransactionClient,
  params: {
    orderId: number;
    sellerId: number;
    userId: number;
    lotAssignments?: Record<number, { lotId: number; quantity: number }[]>;
  },
): Promise<number> {
  const { orderId, sellerId, userId, lotAssignments } = params;
  if (!lotAssignments) {
    throw new Error('Las asignaciones de lote son requeridas para marcar el pedido como Armado.');
  }

  const items = await tx.orderItem.findMany({ where: { orderId }, include: { product: true } });
  const updatedSubtotals: number[] = [];

  for (const item of items) {
    const userAssignments = lotAssignments[item.id] || [];
    const totalUserAssigned = userAssignments.reduce((sum: number, a: any) => sum + Number(a.quantity), 0);
    if (totalUserAssigned > item.quantity) {
      throw new Error(
        `Asignación inválida para "${item.product.name}". Cantidad asignada (${totalUserAssigned}) supera la cantidad pedida (${item.quantity}).`,
      );
    }

    const finalAssignments: { lotId: number; quantity: number }[] = [];
    for (const uAs of userAssignments) {
      const q = Number(uAs.quantity);
      if (q > 0) finalAssignments.push({ lotId: Number(uAs.lotId), quantity: q });
    }

    let remainingToAssign = item.quantity - totalUserAssigned;
    if (remainingToAssign > 0) {
      const rawLots = await tx.productLot.findMany({
        where: { productId: item.productId, stock: { gt: 0 }, id: { notIn: finalAssignments.map((fa) => fa.lotId) } },
        orderBy: { expirationDate: 'asc' },
      });
      for (const lot of sortLotsDeterministicFefo(rawLots)) {
        if (remainingToAssign <= 0) break;
        const allocatedQty = Math.min(lot.stock, remainingToAssign);
        if (allocatedQty > 0) {
          finalAssignments.push({ lotId: lot.id, quantity: allocatedQty });
          remainingToAssign -= allocatedQty;
        }
      }
      if (remainingToAssign > 0 && process.env.IGNORE_STOCK_CHECK === 'true') {
        const slLot = await getOrCreateContingencySlLotInTx(tx, item.productId);
        finalAssignments.push({ lotId: slLot.id, quantity: remainingToAssign });
      }
    }

    const totalAssigned = finalAssignments.reduce((sum, a) => sum + a.quantity, 0);
    const diff = item.quantity - totalAssigned;
    if (diff > 0) {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: diff } } });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: diff,
          type: MovementType.IN,
          orderId,
          referenceId: `PICK-SHORT-${orderId}`,
          userId,
          reason: `Devolución por faltante en preparación de Pedido #${orderId}`,
        },
      });
    }

    let newSubtotal = roundToIntegerPeso(item.subtotal).toNumber();
    let newWeight = item.weight ? roundToThreeDecimalsWeight(item.weight).toNumber() : null;
    if (totalAssigned === 0) {
      newSubtotal = 0;
      newWeight = 0;
    } else if (item.product.isPesable && newWeight !== null && newWeight > 0) {
      newSubtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(newWeight)).toNumber();
    } else {
      newSubtotal = roundToIntegerPeso(toDecimal(item.unitPrice).times(totalAssigned)).toNumber();
    }

    await tx.orderItem.update({
      where: { id: item.id },
      data: { quantity: totalAssigned, subtotal: newSubtotal, weight: newWeight },
    });
    updatedSubtotals.push(newSubtotal);

    const allocations: LotAllocationRecord[] = [];
    for (const assignment of finalAssignments) {
      const lot = await tx.productLot.findUnique({ where: { id: assignment.lotId } });
      if (!lot) continue;
      await tx.productLot.update({ where: { id: lot.id }, data: { stock: { decrement: assignment.quantity } } });
      await tx.orderItemLot.create({
        data: { orderItemId: item.id, productLotId: lot.id, quantity: assignment.quantity },
      });
      allocations.push({ lot, quantity: assignment.quantity });
    }
    await linkOrderLotMovementsInTx(tx, { orderId, productId: item.productId, sellerId, allocations });
  }

  return sumIntegerAmounts(updatedSubtotals).toNumber();
}
