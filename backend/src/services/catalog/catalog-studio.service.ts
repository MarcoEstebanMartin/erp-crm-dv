import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { appCache } from '../../utils/cache';
import { roundToIntegerPeso } from '../../core/money';
import {
  CANONICAL_CATALOG_CATEGORY_ORDER,
  computeMarginPercent,
  formatCurrentEditionSubtitle,
  normalizeCatalogBadge,
  normalizeCatalogCategory,
  type CatalogComboInput,
  type CatalogProductInput,
  type CatalogResumenMode,
} from '../../engines/catalog-studio.engine';
import {
  collapseCatalogVariantFamilies,
  parseVariantSkuBase,
} from '../../engines/catalog-variant-family.engine';
import { renderCatalogMagazinePdf } from './catalog-pdf-magazine.service';
import { renderCatalogResumenPdf } from './catalog-pdf-resumen.service';

export interface CatalogStudioStateDTO {
  title: string;
  subtitle: string;
  hideOutOfStock: boolean;
  categoryOrder: string[];
  itemOrder: string[];
  combos: CatalogComboInput[];
  updatedAt: string | null;
}

export interface CatalogStudioProductDTO extends CatalogProductInput {
  previousListPrice: number | null;
  marginPct: number | null;
  unitsPerBox: number;
  isPesable: boolean;
  rubroName: string | null;
}

const DEFAULT_STATE_KEY = 'default';
const PDF_CACHE_TTL_MS = 60_000;

interface CachedPdfResult {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
}

const pdfResultCache = new Map<string, CachedPdfResult>();
const inFlightPdfJobs = new Map<string, Promise<{ buffer: Buffer; filename: string }>>();

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x || '').trim()).filter(Boolean);
}

function toCombosArray(raw: unknown): CatalogComboInput[] {
  if (!Array.isArray(raw)) return [];
  return raw as CatalogComboInput[];
}

function sanitizeFilenamePart(raw: string): string {
  return String(raw || 'CATALOGO')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'CATALOGO';
}

function applyItemOrder<T extends { sku: string }>(items: T[], itemOrder: string[]): T[] {
  if (!itemOrder.length) return items;
  const rank = new Map<string, number>();
  itemOrder.forEach((sku, idx) => rank.set(sku, idx));
  return [...items].sort((a, b) => {
    const ra = rank.has(a.sku) ? rank.get(a.sku)! : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b.sku) ? rank.get(b.sku)! : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.sku.localeCompare(b.sku);
  });
}

const STUDIO_PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  listPrice: true,
  costPrice: true,
  previousListPrice: true,
  stock: true,
  isActive: true,
  isPesable: true,
  unitsPerBox: true,
  minOrderQuantity: true,
  imageUrl: true,
  commercialCategory: true,
  storeHighlight: true,
  catalogBadge: true,
  catalogVarieties: true,
  catalogMinQtyLabel: true,
  catalogShowOldPrice: true,
  catalogOldPrice: true,
  catalogVisible: true,
  rubro: { select: { name: true } },
} as const;

function mapRowToStudioDto(p: any): CatalogStudioProductDTO {
  const priceInt = roundToIntegerPeso(p.listPrice).toNumber();
  const costNum = Number(p.costPrice || 0);
  const prevListNum = p.previousListPrice ? roundToIntegerPeso(p.previousListPrice).toNumber() : null;
  const customOldNum = p.catalogOldPrice ? roundToIntegerPeso(p.catalogOldPrice).toNumber() : null;
  const effectiveOldPrice = customOldNum ?? prevListNum;
  const rawCat = p.commercialCategory || p.rubro?.name || 'Almacén';

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    price: priceInt,
    costPrice: costNum,
    previousListPrice: prevListNum,
    oldPrice: effectiveOldPrice,
    showOldPrice: Boolean(p.catalogShowOldPrice),
    marginPct: computeMarginPercent(priceInt, costNum),
    category: normalizeCatalogCategory(rawCat),
    rubroName: p.rubro?.name || null,
    badge: normalizeCatalogBadge(p.catalogBadge ?? p.storeHighlight),
    minQty: p.catalogMinQtyLabel || null,
    minOrderQuantity: p.minOrderQuantity,
    unitsPerBox: p.unitsPerBox,
    isPesable: p.isPesable,
    varieties: p.catalogVarieties || null,
    imageUrl: p.imageUrl || null,
    stock: p.stock,
    isActive: p.isActive,
    catalogVisible: p.catalogVisible,
  };
}

export class CatalogStudioService {
  private static async loadStateRow(): Promise<CatalogStudioStateDTO> {
    const row = await prisma.catalogStudioState.findUnique({
      where: { key: DEFAULT_STATE_KEY },
    });

    return {
      title: row?.title || 'OFERTAS SEMANALES',
      subtitle: row?.subtitle || formatCurrentEditionSubtitle(),
      hideOutOfStock: row ? Boolean(row.hideOutOfStock) : true,
      categoryOrder: toStringArray(row?.categoryOrder),
      itemOrder: toStringArray(row?.itemOrder),
      combos: toCombosArray(row?.combos),
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    };
  }

  private static async loadStudioProducts(itemOrder: string[]): Promise<CatalogStudioProductDTO[]> {
    const activeRows = await prisma.product.findMany({
      where: { isActive: true },
      select: STUDIO_PRODUCT_SELECT,
      orderBy: [{ name: 'asc' }],
    });

    const activeSkus = new Set(activeRows.map((r) => r.sku.trim()));
    const missingParentSkus = Array.from(
      new Set(
        activeRows
          .map((r) => parseVariantSkuBase(r.sku))
          .filter((base): base is string => Boolean(base) && !activeSkus.has(base!)),
      ),
    );

    const parentRows =
      missingParentSkus.length > 0
        ? await prisma.product.findMany({
            where: { sku: { in: missingParentSkus } },
            select: STUDIO_PRODUCT_SELECT,
          })
        : [];

    const mappedActive = activeRows.map(mapRowToStudioDto);
    const mappedParents = parentRows.map(mapRowToStudioDto);
    const collapsed = collapseCatalogVariantFamilies(mappedActive, mappedParents);

    return applyItemOrder(collapsed, itemOrder);
  }

  static async getStudioData() {
    const state = await this.loadStateRow();
    const products = await this.loadStudioProducts(state.itemOrder);

    return {
      state,
      products,
      canonicalCategories: [...CANONICAL_CATALOG_CATEGORY_ORDER],
    };
  }

  static async saveStudioState(
    payload: {
      title?: string;
      subtitle?: string | null;
      hideOutOfStock?: boolean;
      categoryOrder?: string[] | null;
      itemOrder?: string[] | null;
      combos?: CatalogComboInput[] | null;
    },
    userId?: number,
  ): Promise<CatalogStudioStateDTO> {
    const existing = await this.loadStateRow();
    const nextTitle = payload.title !== undefined ? payload.title : existing.title;
    const nextSubtitle =
      payload.subtitle !== undefined ? (payload.subtitle || formatCurrentEditionSubtitle()) : existing.subtitle;
    const nextHideOutOfStock =
      payload.hideOutOfStock !== undefined ? payload.hideOutOfStock : existing.hideOutOfStock;
    const nextCategoryOrder =
      payload.categoryOrder !== undefined ? (payload.categoryOrder || []) : existing.categoryOrder;
    const nextItemOrder =
      payload.itemOrder !== undefined ? (payload.itemOrder || []) : existing.itemOrder;
    const nextCombos =
      payload.combos !== undefined ? (payload.combos || []) : existing.combos;

    const saved = await prisma.catalogStudioState.upsert({
      where: { key: DEFAULT_STATE_KEY },
      create: {
        key: DEFAULT_STATE_KEY,
        title: nextTitle,
        subtitle: nextSubtitle,
        hideOutOfStock: nextHideOutOfStock,
        categoryOrder: nextCategoryOrder as any,
        itemOrder: nextItemOrder as any,
        combos: nextCombos as any,
        updatedById: userId ?? null,
      },
      update: {
        title: nextTitle,
        subtitle: nextSubtitle,
        hideOutOfStock: nextHideOutOfStock,
        categoryOrder: nextCategoryOrder as any,
        itemOrder: nextItemOrder as any,
        combos: nextCombos as any,
        updatedById: userId ?? null,
      },
    });

    this.invalidatePdfCache();

    return {
      title: saved.title,
      subtitle: saved.subtitle || formatCurrentEditionSubtitle(),
      hideOutOfStock: saved.hideOutOfStock,
      categoryOrder: toStringArray(saved.categoryOrder),
      itemOrder: toStringArray(saved.itemOrder),
      combos: toCombosArray(saved.combos),
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  static async updateProductCatalogFields(
    productId: number,
    payload: {
      catalogBadge?: 'OFERTON' | 'DESTACADO' | null;
      catalogVarieties?: string | null;
      catalogMinQtyLabel?: string | null;
      catalogShowOldPrice?: boolean;
      catalogOldPrice?: number | null;
      catalogVisible?: boolean;
      commercialCategory?: string | null;
    },
  ) {
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!existing) {
      throw new AppError('Producto no encontrado.', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (payload.catalogBadge !== undefined) {
      updateData.catalogBadge = payload.catalogBadge;
      updateData.storeHighlight = payload.catalogBadge;
    }
    if (payload.catalogVarieties !== undefined) {
      updateData.catalogVarieties = payload.catalogVarieties ? payload.catalogVarieties.trim() : null;
    }
    if (payload.catalogMinQtyLabel !== undefined) {
      updateData.catalogMinQtyLabel = payload.catalogMinQtyLabel ? payload.catalogMinQtyLabel.trim() : null;
    }
    if (payload.catalogShowOldPrice !== undefined) {
      updateData.catalogShowOldPrice = payload.catalogShowOldPrice;
    }
    if (payload.catalogOldPrice !== undefined) {
      updateData.catalogOldPrice = payload.catalogOldPrice !== null ? roundToIntegerPeso(payload.catalogOldPrice) : null;
    }
    if (payload.catalogVisible !== undefined) updateData.catalogVisible = payload.catalogVisible;
    if (payload.commercialCategory !== undefined) {
      updateData.commercialCategory = payload.commercialCategory
        ? normalizeCatalogCategory(payload.commercialCategory)
        : null;
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: updateData,
      select: {
        id: true,
        sku: true,
        storeHighlight: true,
        catalogBadge: true,
        catalogVarieties: true,
        catalogMinQtyLabel: true,
        catalogShowOldPrice: true,
        catalogOldPrice: true,
        catalogVisible: true,
        commercialCategory: true,
      },
    });

    if (payload.catalogBadge !== undefined && !parseVariantSkuBase(updated.sku)) {
      await prisma.product.updateMany({
        where: {
          isActive: true,
          sku: { startsWith: `${updated.sku}-` },
        },
        data: {
          catalogBadge: payload.catalogBadge,
          storeHighlight: payload.catalogBadge,
        },
      });
    }

    appCache.invalidateProductCatalogThrottled();
    this.invalidatePdfCache();
    return updated;
  }

  static invalidatePdfCache(): void {
    pdfResultCache.clear();
  }

  private static async runSingleFlightPdf(
    cacheKey: string,
    builder: () => Promise<{ buffer: Buffer; filename: string }>,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const cached = pdfResultCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { buffer: cached.buffer, filename: cached.filename };
    }

    const existingJob = inFlightPdfJobs.get(cacheKey);
    if (existingJob) {
      return existingJob;
    }

    const job = builder()
      .then((result) => {
        pdfResultCache.set(cacheKey, {
          buffer: result.buffer,
          filename: result.filename,
          expiresAt: Date.now() + PDF_CACHE_TTL_MS,
        });
        return result;
      })
      .finally(() => {
        inFlightPdfJobs.delete(cacheKey);
      });

    inFlightPdfJobs.set(cacheKey, job);
    return job;
  }

  static async generateMagazinePdf(): Promise<{ buffer: Buffer; filename: string }> {
    return this.runSingleFlightPdf('magazine', async () => {
      const { state, products } = await this.getStudioData();
      const visibleProducts = products.filter((p) => {
        if (!p.isActive || !p.catalogVisible) return false;
        if (state.hideOutOfStock && Number(p.stock || 0) <= 0) return false;
        return true;
      });

      const buffer = await renderCatalogMagazinePdf(visibleProducts, state.combos, {
        title: state.title,
        subtitle: state.subtitle,
        categoryOrder: state.categoryOrder.length > 0 ? state.categoryOrder : undefined,
      });

      const suffix = sanitizeFilenamePart(state.subtitle || formatCurrentEditionSubtitle());
      return {
        buffer,
        filename: `OFERTA_SEMANAL_DON_VENANCIO_${suffix}.pdf`,
      };
    });
  }

  static async generateResumenPdf(
    modeOrOnlyOferton: CatalogResumenMode | boolean = 'all',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const mode: CatalogResumenMode =
      typeof modeOrOnlyOferton === 'boolean'
        ? modeOrOnlyOferton
          ? 'ofertones'
          : 'all'
        : modeOrOnlyOferton;

    const cacheKey = `resumen:${mode}`;
    return this.runSingleFlightPdf(cacheKey, async () => {
      const { state, products } = await this.getStudioData();
      const visibleProducts = products.filter((p) => {
        if (!p.isActive || !p.catalogVisible) return false;
        if (state.hideOutOfStock && Number(p.stock || 0) <= 0) return false;
        return true;
      });

      const buffer = await renderCatalogResumenPdf(visibleProducts, {
        subtitle: state.subtitle,
        categoryOrder: state.categoryOrder.length > 0 ? state.categoryOrder : undefined,
        resumenMode: mode,
      });

      const suffix = sanitizeFilenamePart(state.subtitle || formatCurrentEditionSubtitle());
      const prefix =
        mode === 'ofertones'
          ? 'OFERTONES_DON_VENANCIO'
          : mode === 'destacados'
            ? 'DESTACADOS_DON_VENANCIO'
            : 'RESUMEN_OFERTAS_DON_VENANCIO';
      return {
        buffer,
        filename: `${prefix}_${suffix}.pdf`,
      };
    });
  }
}
