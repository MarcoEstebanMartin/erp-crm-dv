import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, roundToTwoDecimals, toDecimal } from '../../core/money';
import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import AppError from '../../utils/AppError';

export interface RubroProductPriceSnapshot {
  id: number;
  costPrice: Decimal | number | string;
  listPrice: Decimal | number | string;
  listPriceB?: Decimal | number | string | null;
  listPriceC?: Decimal | number | string | null;
  profitMargin?: Decimal | number | string | null;
}

export interface RecomputedRubroProductPrices {
  id: number;
  listPrice: number;
  listPriceB: number;
  listPriceC: number;
}

/**
 * Motor puro con Decimal.js para recalcular precios de lista en Pesos Enteros (ROUND_HALF_UP, 0 decimales)
 * cuando cambia el factor de rentabilidad (`profitMargin`, ej. `1.25` = +25%) de un Rubro.
 * - Respeta productos con margen propio personalizado (`profitMargin !== null`).
 * - Preserva proporciones personalizadas existentes de Lista B y Lista C o aplica 0.95 / 0.90 por defecto.
 */
export function computeRubroProductsPriceUpdates(
  products: RubroProductPriceSnapshot[],
  newMarginMultiplier: Decimal | number | string,
): RecomputedRubroProductPrices[] {
  const multiplierDec = toDecimal(newMarginMultiplier);
  if (multiplierDec.lte(0)) {
    throw new AppError('El factor de rentabilidad del rubro debe ser mayor a cero.', 400);
  }

  const updates: RecomputedRubroProductPrices[] = [];

  for (const product of products) {
    if (product.profitMargin !== null && product.profitMargin !== undefined) {
      continue;
    }

    const costDec = Decimal.max(0, toDecimal(product.costPrice ?? 0));
    const nextListPriceDec = Decimal.max(0, roundToIntegerPeso(costDec.times(multiplierDec)));

    const prevListDec = toDecimal(product.listPrice ?? 0);
    const prevListBDec = toDecimal(product.listPriceB ?? 0);
    const prevListCDec = toDecimal(product.listPriceC ?? 0);

    const ratioB =
      prevListBDec.gt(0) && prevListDec.gt(0)
        ? prevListBDec.dividedBy(prevListDec)
        : new Decimal('0.95');

    const ratioC =
      prevListCDec.gt(0) && prevListDec.gt(0)
        ? prevListCDec.dividedBy(prevListDec)
        : new Decimal('0.90');

    const nextListPriceBDec = Decimal.max(0, roundToIntegerPeso(nextListPriceDec.times(ratioB)));
    const nextListPriceCDec = Decimal.max(0, roundToIntegerPeso(nextListPriceDec.times(ratioC)));

    updates.push({
      id: product.id,
      listPrice: nextListPriceDec.toNumber(),
      listPriceB: nextListPriceBDec.toNumber(),
      listPriceC: nextListPriceCDec.toNumber(),
    });
  }

  return updates;
}

export class RubroService {
  static async listRubros() {
    return prisma.rubro.findMany({
      orderBy: { name: 'asc' },
    });
  }

  static async createRubro(
    input: {
      name: string;
      description?: string | null;
      profitMargin?: number;
      pickingZone?: string;
    },
    userId?: number,
  ) {
    const trimmedName = input.name.trim();
    const existing = await prisma.rubro.findUnique({ where: { name: trimmedName } });
    if (existing) {
      throw new AppError(`El rubro "${trimmedName}" ya existe.`, 400);
    }

    const rubro = await prisma.rubro.create({
      data: {
        name: trimmedName,
        description: input.description ?? undefined,
        profitMargin:
          input.profitMargin !== undefined
            ? roundToTwoDecimals(input.profitMargin).toNumber()
            : undefined,
        pickingZone: input.pickingZone ?? undefined,
      },
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_RUBRO',
        entityType: 'Rubro',
        entityId: rubro.id,
        newValues: rubro,
      });
    }

    return rubro;
  }

  static async updateRubro(
    id: number,
    input: {
      name?: string;
      description?: string | null;
      profitMargin?: number;
      pickingZone?: string;
    },
    userId?: number,
  ) {
    const original = await prisma.rubro.findUnique({ where: { id } });
    if (!original) {
      throw new AppError('Rubro no encontrado.', 404);
    }

    const nextName = input.name !== undefined ? input.name.trim() : undefined;
    if (nextName && nextName !== original.name) {
      const existing = await prisma.rubro.findUnique({ where: { name: nextName } });
      if (existing) {
        throw new AppError(`El rubro "${nextName}" ya existe.`, 400);
      }
    }

    const normalizedMargin =
      input.profitMargin !== undefined
        ? roundToTwoDecimals(input.profitMargin).toNumber()
        : undefined;

    const marginChanged =
      normalizedMargin !== undefined &&
      !roundToTwoDecimals(normalizedMargin).equals(
        roundToTwoDecimals(original.profitMargin.toString()),
      );

    const updated = await prisma.$transaction(async (tx) => {
      const savedRubro = await tx.rubro.update({
        where: { id },
        data: {
          name: nextName,
          description: input.description !== undefined ? input.description : undefined,
          profitMargin: normalizedMargin,
          pickingZone: input.pickingZone !== undefined ? input.pickingZone : undefined,
        },
      });

      if (marginChanged && normalizedMargin !== undefined) {
        const products = await tx.product.findMany({
          where: { rubroId: id },
          select: {
            id: true,
            costPrice: true,
            listPrice: true,
            listPriceB: true,
            listPriceC: true,
            profitMargin: true,
          },
        });

        const priceUpdates = computeRubroProductsPriceUpdates(products, normalizedMargin);
        for (const patch of priceUpdates) {
          await tx.product.update({
            where: { id: patch.id },
            data: {
              listPrice: patch.listPrice,
              listPriceB: patch.listPriceB,
              listPriceC: patch.listPriceC,
            },
          });
        }
      }

      return savedRubro;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_RUBRO',
        entityType: 'Rubro',
        entityId: updated.id,
        oldValues: original,
        newValues: updated,
      });
    }

    return updated;
  }

  static async deleteRubro(id: number, userId?: number) {
    const original = await prisma.rubro.findUnique({ where: { id } });
    if (!original) {
      throw new AppError('Rubro no encontrado.', 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { rubroId: id },
        data: { rubroId: null },
      });

      await tx.rubro.delete({
        where: { id },
      });
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'DELETE_RUBRO',
        entityType: 'Rubro',
        entityId: id,
        oldValues: original,
      });
    }
  }
}
