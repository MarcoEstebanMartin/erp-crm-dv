import { WeeklyPromoType } from '@prisma/client';
import prisma from '../utils/prisma';
import { appCache } from '../utils/cache';
import { logAudit } from '../utils/audit';
import { roundToIntegerPeso } from '../core/money';
import {
  buildDefaultWeeklyPromoName,
  type WeeklyPromoTypeValue,
} from '../engines/weekly-promos.engine';

export interface CreateWeeklyPromoItemInput {
  productId: number;
  minQuantity: number;
  freeQuantity?: number;
  promoUnitPrice?: number | null;
}

export interface CreateWeeklyPromoInput {
  type: WeeklyPromoTypeValue;
  name?: string | null;
  startDate: string;
  endDate?: string | null;
  items: CreateWeeklyPromoItemInput[];
}

const PROMO_INCLUDE = {
  items: {
    orderBy: { id: 'asc' as const },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          listPrice: true,
          unitsPerBox: true,
          isPesable: true,
          isActive: true,
        },
      },
    },
  },
};

function parseDateBoundary(raw: string, boundary: 'start' | 'end'): Date {
  const trimmed = raw.trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    const [, y, m, d] = ymd;
    return boundary === 'start'
      ? new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0)
      : new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59, 999);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    const err: any = new Error('Fecha de vigencia inválida.');
    err.statusCode = 400;
    throw err;
  }
  return parsed;
}

function defaultEndDateFromStart(start: Date): Date {
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return end;
}

export const weeklyPromoService = {
  async listAllPromos() {
    return prisma.weeklyPromo.findMany({
      include: PROMO_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  },

  async listActivePromos(now: Date = new Date()) {
    return prisma.weeklyPromo.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: PROMO_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
  },

  async createPromo(input: CreateWeeklyPromoInput, userId: number) {
    const productIds = Array.from(new Set(input.items.map((i) => Number(i.productId))));
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, isPesable: true },
    });

    if (dbProducts.length !== productIds.length) {
      const err: any = new Error('Uno o más productos seleccionados no existen.');
      err.statusCode = 400;
      throw err;
    }

    const productById = new Map(dbProducts.map((p) => [p.id, p]));
    if (input.type === 'BUY_X_GET_Y') {
      const firstProd = productById.get(Number(input.items[0]?.productId));
      if (firstProd?.isPesable) {
        const err: any = new Error(
          'Las promociones N+M sin cargo solo aplican a productos por unidad, no pesables por kg.',
        );
        err.statusCode = 400;
        throw err;
      }
    }

    const startDate = parseDateBoundary(input.startDate, 'start');
    const endDate =
      input.endDate && input.endDate.trim() !== ''
        ? parseDateBoundary(input.endDate, 'end')
        : defaultEndDateFromStart(startDate);

    if (endDate.getTime() < startDate.getTime()) {
      const err: any = new Error('La fecha Hasta debe ser igual o posterior a Desde.');
      err.statusCode = 400;
      throw err;
    }

    const normalizedItems = input.items.map((item) => {
      const product = productById.get(Number(item.productId))!;
      const minQuantity = Math.max(1, Math.trunc(Number(item.minQuantity || 1)));
      const freeQuantity =
        input.type === 'BUY_X_GET_Y'
          ? Math.max(1, Math.trunc(Number(item.freeQuantity || 0)))
          : 0;
      const promoUnitPrice =
        input.type === 'BUY_X_GET_Y' || item.promoUnitPrice == null
          ? null
          : roundToIntegerPeso(item.promoUnitPrice).toNumber();

      return {
        productId: product.id,
        productName: product.name,
        minQuantity,
        freeQuantity,
        promoUnitPrice,
      };
    });

    const trimmedName = (input.name || '').trim();
    const resolvedName =
      trimmedName ||
      buildDefaultWeeklyPromoName({
        type: input.type,
        items: normalizedItems,
      });

    const created = await prisma.$transaction(async (tx) => {
      return tx.weeklyPromo.create({
        data: {
          name: resolvedName,
          type: input.type as WeeklyPromoType,
          startDate,
          endDate,
          isActive: true,
          createdById: userId,
          items: {
            create: normalizedItems.map((it) => ({
              productId: it.productId,
              minQuantity: it.minQuantity,
              freeQuantity: it.freeQuantity,
              promoUnitPrice: it.promoUnitPrice,
            })),
          },
        },
        include: PROMO_INCLUDE,
      });
    });

    appCache.invalidateProductCatalog();
    await logAudit({
      userId,
      action: 'CREATE_WEEKLY_PROMO',
      entityType: 'WeeklyPromo',
      entityId: created.id,
      newValues: {
        name: created.name,
        type: created.type,
        startDate: created.startDate,
        endDate: created.endDate,
        itemsCount: created.items.length,
      },
    });

    return created;
  },

  async togglePromoActive(id: number, userId: number) {
    const existing = await prisma.weeklyPromo.findUnique({ where: { id } });
    if (!existing) {
      const err: any = new Error('Oferta semanal no encontrada.');
      err.statusCode = 404;
      throw err;
    }

    const updated = await prisma.weeklyPromo.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: PROMO_INCLUDE,
    });

    appCache.invalidateProductCatalog();
    await logAudit({
      userId,
      action: 'TOGGLE_WEEKLY_PROMO',
      entityType: 'WeeklyPromo',
      entityId: updated.id,
      oldValues: { isActive: existing.isActive },
      newValues: { isActive: updated.isActive },
    });

    return updated;
  },

  async deletePromo(id: number, userId: number) {
    const existing = await prisma.weeklyPromo.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      const err: any = new Error('Oferta semanal no encontrada.');
      err.statusCode = 404;
      throw err;
    }

    await prisma.weeklyPromo.delete({ where: { id } });
    appCache.invalidateProductCatalog();
    await logAudit({
      userId,
      action: 'DELETE_WEEKLY_PROMO',
      entityType: 'WeeklyPromo',
      entityId: id,
      oldValues: { name: existing.name, type: existing.type, itemsCount: existing.items.length },
    });
  },
};
