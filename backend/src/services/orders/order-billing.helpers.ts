import { MovementType, BillingType } from '@prisma/client';
import { PricingService } from '../pricing.service';
import {
  calculateOrderLine,
  roundToThreeDecimalsWeight,
  toDecimal,
} from '../../core/money';

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

      const pOficial = PricingService.calculatePriceAndDiscountInMemory(
        product,
        persona,
        dbRules,
        BillingType.OFFICIAL,
      );
      const pInterno = PricingService.calculatePriceAndDiscountInMemory(
        product,
        persona,
        dbRules,
        BillingType.INTERNAL,
      );

      if (qtyOficial > 0) {
        const actualQty = product.isPesable ? weightOficial || qtyOficial : qtyOficial;
        const lc = calculateOrderLine({
          unitCost,
          unitPriceList: pOficial.basePrice,
          billableQty: actualQty,
          discountPct: pOficial.discount,
        });
        oficialItemsData.push({
          orderItemId: item.id,
          productId: item.productId,
          quantity: qtyOficial,
          weight: weightOficial,
          unitPrice: pOficial.finalPrice,
          subtotal: lc.lineSubtotal.toNumber(),
          unitCostSnapshot: lc.unitCostSnapshot.toNumber(),
          listPriceSnapshot: lc.listPriceSnapshot.toNumber(),
          discountPctSnapshot: lc.discountPctSnapshot.toNumber(),
        });
      }

      if (qtyInterno > 0) {
        const actualQty = product.isPesable ? weightInterno || qtyInterno : qtyInterno;
        const lc = calculateOrderLine({
          unitCost,
          unitPriceList: pInterno.basePrice,
          billableQty: actualQty,
          discountPct: pInterno.discount,
        });
        internoItemsData.push({
          productId: item.productId,
          quantity: qtyInterno,
          weight: weightInterno,
          unitPrice: pInterno.finalPrice,
          subtotal: lc.lineSubtotal.toNumber(),
          unitCostSnapshot: lc.unitCostSnapshot.toNumber(),
          listPriceSnapshot: lc.listPriceSnapshot.toNumber(),
          discountPctSnapshot: lc.discountPctSnapshot.toNumber(),
        });
      }
    } else {
      const pricing = PricingService.calculatePriceAndDiscountInMemory(
        product,
        persona,
        dbRules,
        billingType,
      );
      const actualQty = product.isPesable
        ? item.weight
          ? Number(item.weight)
          : item.quantity
        : item.quantity;
      const lc = calculateOrderLine({
        unitCost,
        unitPriceList: pricing.basePrice,
        billableQty: actualQty,
        discountPct: pricing.discount,
      });
      const itemData = {
        orderItemId: item.id,
        productId: item.productId,
        quantity: item.quantity,
        weight: item.weight ? roundToThreeDecimalsWeight(item.weight).toNumber() : null,
        unitPrice: pricing.finalPrice,
        subtotal: lc.lineSubtotal.toNumber(),
        unitCostSnapshot: lc.unitCostSnapshot.toNumber(),
        listPriceSnapshot: lc.listPriceSnapshot.toNumber(),
        discountPctSnapshot: lc.discountPctSnapshot.toNumber(),
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
) {
  let remainingToAssign = quantity;
  const activeLots = await tx.productLot.findMany({
    where: { productId, stock: { gt: 0 } },
    orderBy: { expirationDate: 'asc' },
  });

  for (const lot of activeLots) {
    if (remainingToAssign <= 0) break;
    const allocatedQty = Math.min(lot.stock, remainingToAssign);
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
  }
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
