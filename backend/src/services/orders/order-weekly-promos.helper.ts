import {
  type CartBasePricingInfo,
  type CartPromoInputLine,
  type CartPromoProductCatalogItem,
  type EvaluateCartWeeklyPromosResult,
  type WeeklyPromoSpec,
  type WeeklyPromoTypeValue,
  evaluateCartWeeklyPromos,
} from '../../engines/weekly-promos.engine';
import { toDecimal } from '../../core/money';

/**
 * Determina si un renglón de pedido/factura corresponde a bonificación sin cargo de promo N+M ($0).
 */
export function isPromoBonusOrderItem(
  item: { unitPrice?: any; discountPctSnapshot?: any } | null | undefined,
): boolean {
  if (!item) return false;
  return (
    toDecimal(item.unitPrice ?? 0).eq(0) &&
    toDecimal(item.discountPctSnapshot ?? 0).gte(100)
  );
}

/**
 * Obtiene las ofertas semanales vigentes dentro o fuera de una transacción Prisma.
 * Si el cliente/mock de tests legados no implementa `weeklyPromo`, retorna lista vacía de forma segura.
 */
export async function fetchActiveWeeklyPromosSafe(
  dbOrTx: any,
  now: Date = new Date(),
): Promise<WeeklyPromoSpec[]> {
  if (!dbOrTx?.weeklyPromo?.findMany) {
    return [];
  }

  const rows = await dbOrTx.weeklyPromo.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    include: {
      items: {
        orderBy: { id: 'asc' },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  if (!Array.isArray(rows)) return [];

  return rows.map((row: any) => ({
    id: Number(row.id),
    name: String(row.name || ''),
    type: row.type as WeeklyPromoTypeValue,
    startDate: row.startDate,
    endDate: row.endDate ?? null,
    isActive: Boolean(row.isActive),
    items: Array.isArray(row.items)
      ? row.items.map((item: any) => ({
          productId: Number(item.productId),
          minQuantity: Number(item.minQuantity || 1),
          freeQuantity: Number(item.freeQuantity || 0),
          promoUnitPrice:
            item.promoUnitPrice !== undefined && item.promoUnitPrice !== null
              ? Number(item.promoUnitPrice)
              : null,
        }))
      : [],
  }));
}

/**
 * Evalúa Ofertas Semanales vigentes sobre un carrito validado en servidor y verifica stock físico total
 * (incluyendo unidades bonificadas de promos N+M).
 */
export async function evaluateOrderCartWithWeeklyPromos(params: {
  tx: any;
  items: CartPromoInputLine[];
  dbProducts: any[];
  basePricingByProductId: Map<number, CartBasePricingInfo>;
  ignoreStockCheck?: boolean;
  now?: Date;
}): Promise<EvaluateCartWeeklyPromosResult> {
  const { tx, items, dbProducts, basePricingByProductId, ignoreStockCheck = false, now = new Date() } = params;

  const promos = await fetchActiveWeeklyPromosSafe(tx, now);
  const productsById = new Map<number, CartPromoProductCatalogItem>(
    dbProducts.map((p) => [
      Number(p.id),
      {
        id: Number(p.id),
        isPesable: Boolean(p.isPesable),
        approximateWeight: p.approximateWeight ?? 1,
        costPrice: p.costPrice ?? 0,
        listPrice: p.listPrice ?? 0,
      },
    ]),
  );

  const evaluated = evaluateCartWeeklyPromos({
    lines: items,
    productsById,
    basePricingByProductId,
    promos,
    now,
  });

  if (!ignoreStockCheck) {
    for (const [productIdStr, totalRequiredQty] of Object.entries(evaluated.stockRequiredByProduct)) {
      const productId = Number(productIdStr);
      const product = dbProducts.find((p) => Number(p.id) === productId);
      if (!product) continue;
      if (Number(product.stock || 0) < totalRequiredQty) {
        throw new Error(
          `Stock insuficiente para "${product.name}" incluyendo unidades sin cargo de promoción (Disponible: ${product.stock}, Requerido: ${totalRequiredQty}).`,
        );
      }
    }
  }

  return evaluated;
}

/**
 * Descuenta el stock físico de `Product` una única vez por producto (sumando unidades pagas + bonificadas).
 */
export async function decrementStockByProductMapInTx(params: {
  tx: any;
  stockRequiredByProduct: Record<number, number>;
  dbProducts: any[];
  ignoreStockCheck?: boolean;
  formatConcurrentError?: (productName: string) => string;
}): Promise<void> {
  const {
    tx,
    stockRequiredByProduct,
    dbProducts,
    ignoreStockCheck = false,
    formatConcurrentError,
  } = params;

  for (const [productIdStr, qtyToDecrement] of Object.entries(stockRequiredByProduct)) {
    const productId = Number(productIdStr);
    if (!qtyToDecrement || qtyToDecrement <= 0) continue;

    if (ignoreStockCheck) {
      await tx.product.update({
        where: { id: productId },
        data: { stock: { decrement: qtyToDecrement } },
      });
    } else {
      const res = await tx.product.updateMany({
        where: {
          id: productId,
          stock: { gte: qtyToDecrement },
        },
        data: {
          stock: { decrement: qtyToDecrement },
        },
      });

      if (res.count === 0) {
        const prod = dbProducts.find((p) => Number(p.id) === productId);
        const prodName = prod?.name || 'Producto';
        throw new Error(
          formatConcurrentError
            ? formatConcurrentError(prodName)
            : `Stock insuficiente para "${prodName}" debido a una operación concurrente. Por favor reintente la carga del pedido.`,
        );
      }
    }
  }
}
