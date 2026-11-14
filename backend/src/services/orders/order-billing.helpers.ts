import { MovementType, BillingType } from '@prisma/client';
import { PricingService } from '../pricing.service';
import {
  calculateOrderLine,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  toDecimal,
} from '../../core/money';
import { isPromoBonusOrderItem } from './order-weekly-promos.helper';
import { sortLotsDeterministicFefo } from './order-lot-picking.helper';

function resolveBillingLineValues(params: {
  item: any;
  product: any;
  persona: any;
  dbRules: any[];
  targetBillingType: BillingType;
  quantity: number;
  weight: number | null;
  unitCost: number;
}) {
  const { item, product, persona, dbRules, targetBillingType, quantity, weight, unitCost } = params;

  if (isPromoBonusOrderItem(item)) {
    return {
      unitPrice: 0,
      subtotal: 0,
      unitCostSnapshot: roundToTwoDecimals(item.unitCostSnapshot ?? unitCost).toNumber(),
      listPriceSnapshot: roundToIntegerPeso(item.listPriceSnapshot ?? product.listPrice).toNumber(),
      discountPctSnapshot: 100,
    };
  }

  const pricing = PricingService.calculatePriceAndDiscountInMemory(
    product,
    persona,
    dbRules,
    targetBillingType,
  );
  const billableQtyDec = product.isPesable
    ? weight
      ? roundToThreeDecimalsWeight(weight)
      : toDecimal(quantity)
    : toDecimal(quantity);

  const hasBillingSpecificRule = dbRules.some(
    (r) =>
      Boolean(r.billingType) &&
      r.billingType === targetBillingType &&
      (!r.productId || r.productId === product.id) &&
      (!r.rubroId || r.rubroId === product.rubroId),
  );

  if (!hasBillingSpecificRule && item.unitPrice !== undefined && item.unitPrice !== null) {
    const frozenUnitInt = roundToIntegerPeso(item.unitPrice);
    const recalcUnitInt = roundToIntegerPeso(pricing.finalPrice);
    if (frozenUnitInt.gt(0) && frozenUnitInt.lt(recalcUnitInt)) {
      return {
        unitPrice: frozenUnitInt.toNumber(),
        subtotal: roundToIntegerPeso(frozenUnitInt.times(billableQtyDec)).toNumber(),
        unitCostSnapshot: roundToTwoDecimals(item.unitCostSnapshot ?? unitCost).toNumber(),
        listPriceSnapshot: roundToIntegerPeso(item.listPriceSnapshot ?? pricing.basePrice).toNumber(),
        discountPctSnapshot: roundToTwoDecimals(item.discountPctSnapshot ?? 0).toNumber(),
      };
    }
  }

  const lc = calculateOrderLine({
    unitCost,
    unitPriceList: pricing.basePrice,
    billableQty: billableQtyDec,
    discountPct: pricing.discount,
  });

  return {
    unitPrice: pricing.finalPrice,
    subtotal: lc.lineSubtotal.toNumber(),
    unitCostSnapshot: lc.unitCostSnapshot.toNumber(),
    listPriceSnapshot: lc.listPriceSnapshot.toNumber(),
    discountPctSnapshot: lc.discountPctSnapshot.toNumber(),
  };
}

export function prepareInvoiceSplitItems(params: {
  orderItems: any[];
  dbProducts: any[];
  persona: any;
  dbRules: any[];
  splitConfigs: any[];
  billingType: BillingType;
}) {
  const { orderItems, dbProducts, persona, dbRules, splitConfigs, billingType } = params;
  const hasSplit = splitConfigs.length > 0;
  const oficialItemsData: any[] = [];
  const internoItemsData: any[] = [];

  for (const item of orderItems) {
    const product = dbProducts.find((p) => p.id === item.productId);
    if (!product) throw new Error(`Producto ID ${item.productId} no encontrado.`);

    const config = hasSplit ? splitConfigs.find((c) => c.rubroId === item.product.rubroId) : null;
    const unitCost = Number((product as any).costPrice || 0);

    if (config) {
      const qtyOficial = Math.ceil(item.quantity / 2);
      const qtyInterno = Math.floor(item.quantity / 2);
      let weightOficial: number | null = null;
      let weightInterno: number | null = null;
      if (item.weight) {
        const halfW = roundToThreeDecimalsWeight(toDecimal(item.weight).dividedBy(2));
        weightOficial = halfW.toNumber();
        weightInterno = roundToThreeDecimalsWeight(toDecimal(item.weight).minus(halfW)).toNumber();
      }

      if (qtyOficial > 0) {
        const valsOficial = resolveBillingLineValues({
          item,
          product,
          persona,
          dbRules,
          targetBillingType: BillingType.OFFICIAL,
          quantity: qtyOficial,
          weight: weightOficial,
          unitCost,
        });
        oficialItemsData.push({
          orderItemId: item.id,
          productId: item.productId,
          quantity: qtyOficial,
          weight: weightOficial,
          ...valsOficial,
        });
      }

      if (qtyInterno > 0) {
        const valsInterno = resolveBillingLineValues({
          item,
          product,
          persona,
          dbRules,
          targetBillingType: BillingType.INTERNAL,
          quantity: qtyInterno,
          weight: weightInterno,
          unitCost,
        });
        internoItemsData.push({
          sourceOrderItemId: item.id,
          productId: item.productId,
          quantity: qtyInterno,
          weight: weightInterno,
          ...valsInterno,
        });
      }
    } else {
      const cleanWeight = item.weight ? roundToThreeDecimalsWeight(item.weight).toNumber() : null;
      const vals = resolveBillingLineValues({
        item,
        product,
        persona,
        dbRules,
        targetBillingType: billingType,
        quantity: item.quantity,
        weight: cleanWeight,
        unitCost,
      });
      const itemData = {
        orderItemId: item.id,
        productId: item.productId,
        quantity: item.quantity,
        weight: cleanWeight,
        ...vals,
      };
      if (hasSplit && billingType !== BillingType.OFFICIAL) {
        internoItemsData.push(itemData);
      } else {
        oficialItemsData.push(itemData);
      }
    }
  }

  return { hasSplit, oficialItemsData, internoItemsData };
}

/**
 * Asigna lotes activos FIFO a un OrderItem recién creado en venta directa.
 */
export async function assignFifoLotsToOrderItem(
  tx: any,
  orderItemId: number,
  productId: number,
  quantity: number,
): Promise<Array<{ productLotId: number; quantity: number }>> {
  let remainingToAssign = quantity;
  const allocatedLots: Array<{ productLotId: number; quantity: number }> = [];
  const rawLots = await tx.productLot.findMany({
    where: { productId, stock: { gt: 0 } },
    orderBy: { expirationDate: 'asc' },
  });
  const activeLots = sortLotsDeterministicFefo(rawLots || []);

  for (const lot of activeLots) {
    if (remainingToAssign <= 0) break;
    const allocatedQty = Math.min(lot.stock, remainingToAssign);
    if (allocatedQty <= 0) continue;
    remainingToAssign -= allocatedQty;

    await tx.productLot.update({
      where: { id: lot.id },
      data: { stock: { decrement: allocatedQty } },
    });

    await tx.orderItemLot.create({
      data: {
        orderItemId,
        productLotId: lot.id,
        quantity: allocatedQty,
      },
    });
    allocatedLots.push({ productLotId: lot.id, quantity: allocatedQty });
  }

  if (remainingToAssign > 0 && process.env.IGNORE_STOCK_CHECK === 'true') {
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

    await tx.productLot.update({
      where: { id: slLot.id },
      data: { stock: { decrement: remainingToAssign } },
    });

    await tx.orderItemLot.create({
      data: {
        orderItemId,
        productLotId: slLot.id,
        quantity: remainingToAssign,
      },
    });
    allocatedLots.push({ productLotId: slLot.id, quantity: remainingToAssign });
  }

  return allocatedLots;
}

/**
 * Reasigna movimientos de stock cuando un pedido se divide en Parte Oficial + Parte Interna (Split Billing).
 */
export async function reassignSplitStockMovements(
  tx: any,
  originalOrderId: number,
  internalOrderId: number,
  sellerId: number,
  internoItemsData: { productId: number; quantity: number }[],
) {
  for (const item of internoItemsData) {
    const stockMov = await tx.stockMovement.findFirst({
      where: {
        productId: item.productId,
        referenceId: `ORDER-${originalOrderId}`,
      },
    });

    if (stockMov) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          quantity: -item.quantity,
          type: MovementType.OUT,
          orderId: internalOrderId,
          referenceId: `ORDER-${internalOrderId}`,
          userId: sellerId,
          reason: `Venta - Pedido Interno #${internalOrderId} (Parte Interna de Pedido #${originalOrderId})`,
          productLotId: stockMov.productLotId,
        },
      });

      await tx.stockMovement.update({
        where: { id: stockMov.id },
        data: {
          quantity: stockMov.quantity + item.quantity,
          orderId: originalOrderId,
        },
      });
    }
  }
}
