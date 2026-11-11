import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import prisma from '../../utils/prisma';
import { appCache } from '../../utils/cache';
import { logAudit } from '../../utils/audit';
import { env } from '../../config/env.config';
import { roundToIntegerPeso, roundToThreeDecimalsWeight } from '../../core/money';
import {
  computeErpProductSyncPatch,
  normalizeRubroCanonicalName,
  normalizeRubroLookupKey,
  resolveSyncedImageFilename,
  type ProductionCatalogRow,
} from '../../engines/catalog-sync.engine';
import { writeProductUploadAtomically } from './product-upload-writer.helper';

export { writeProductUploadAtomically };

interface ProdCatalogMetaRow extends ProductionCatalogRow {
  bytea_filename: string | null;
  mime_type: string | null;
  img_bytes: bigint | number | null;
  img_md5: string | null;
}

interface ProdImageBinaryRow {
  sku: string;
  filename: string | null;
  mime_type: string | null;
  byte_len: bigint | number;
  md5_hex: string;
  img_b64: string;
}

export interface ProductionCatalogSyncOptions {
  dryRun?: boolean;
  skipImages?: boolean;
  userId?: number;
  productionDbUrl?: string;
  uploadsDir?: string;
}

export interface ProductionCatalogSyncReport {
  dryRun: boolean;
  totalProductionRows: number;
  activeInProduction: number;
  totalErpRows: number;
  createdProductsCount: number;
  updatedProductsCount: number;
  pricesUpdatedCount: number;
  categoriesUpdatedCount: number;
  rubrosUpdatedCount: number;
  imagesUpdatedCount: number;
  activatedCount: number;
  pausedCount: number;
  namesUpdatedCount: number;
  downloadedImagesCount: number;
  reusedImagesOnDiskCount: number;
  prunedStaleUploadsCount: number;
}

export class ProductionCatalogSyncService {
  private async ensureCleanRubroMap(
    prodRows: ProdCatalogMetaRow[],
    dryRun: boolean,
  ): Promise<Map<string, number>> {
    const existingRubros = await prisma.rubro.findMany({ orderBy: { id: 'asc' } });
    const map = new Map<string, number>();

    for (const r of existingRubros) {
      if (!r.name || r.name.includes('\uFFFD')) continue;
      const key = normalizeRubroLookupKey(r.name);
      if (key && !map.has(key)) map.set(key, r.id);
    }

    if (dryRun) return map;

    const neededCanonical = new Map<string, string>();
    for (const row of prodRows) {
      const canonical = normalizeRubroCanonicalName(row.rubro);
      if (!canonical) continue;
      const key = normalizeRubroLookupKey(canonical);
      if (key && !map.has(key) && !neededCanonical.has(key)) {
        neededCanonical.set(key, canonical);
      }
    }

    for (const [key, canonicalName] of neededCanonical.entries()) {
      const created = await prisma.rubro.create({ data: { name: canonicalName } });
      map.set(key, created.id);
    }

    return map;
  }

  async syncFromProduction(
    options: ProductionCatalogSyncOptions = {},
  ): Promise<ProductionCatalogSyncReport> {
    const dryRun = Boolean(options.dryRun);
    const skipImages = Boolean(options.skipImages);
    const prodDbUrl = options.productionDbUrl || env.PRODUCTION_CATALOG_DATABASE_URL;
    if (!prodDbUrl) {
      throw new Error('PRODUCTION_CATALOG_DATABASE_URL no está configurada.');
    }

    const uploadsDir =
      options.uploadsDir || path.resolve(__dirname, '../../../uploads/products');
    const prodDb = new PrismaClient({ datasources: { db: { url: prodDbUrl } } });

    try {
      const prodMetaRows = await prodDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
        return tx.$queryRawUnsafe<ProdCatalogMetaRow[]>(`
          SELECT
            p.sku, p.name, p.price, p.active, p.category, p.rubro, p.subrubro,
            p.min_qty, p.peso_promedio, p.photo_file, p.has_photo,
            pi.filename AS bytea_filename, pi.mime_type,
            OCTET_LENGTH(pi.image_data) AS img_bytes, MD5(pi.image_data) AS img_md5
          FROM public.products p
          LEFT JOIN public.product_images pi ON TRIM(pi.sku) = TRIM(p.sku)
          ORDER BY p.sku ASC
        `);
      });

      const rubroIdByLookup = await this.ensureCleanRubroMap(prodMetaRows, dryRun);
      const erpProducts = await prisma.product.findMany({ orderBy: { sku: 'asc' } });
      const erpBySku = new Map(erpProducts.map((e) => [e.sku.trim(), e]));
      const prodBySku = new Map(prodMetaRows.map((r) => [r.sku.trim(), r]));

      const resolvedUrlBySku = new Map<string, string>();
      const skusNeedingDownload: string[] = [];
      let reusedImagesOnDiskCount = 0;

      for (const prod of prodMetaRows) {
        const cleanSku = prod.sku.trim();
        const imgBytes = prod.img_bytes ? Number(prod.img_bytes) : 0;
        if (imgBytes <= 0 || !prod.img_md5) continue;

        const resolvedFile = resolveSyncedImageFilename(
          cleanSku,
          prod.bytea_filename || prod.photo_file,
          prod.mime_type,
          prod.img_md5,
        );
        resolvedUrlBySku.set(cleanSku, `/uploads/products/${resolvedFile}`);

        if (skipImages) continue;
        const localUploadPath = path.join(uploadsDir, resolvedFile);
        const alreadyValidOnDisk =
          fs.existsSync(localUploadPath) &&
          crypto.createHash('md5').update(fs.readFileSync(localUploadPath)).digest('hex') ===
            prod.img_md5;

        if (alreadyValidOnDisk) reusedImagesOnDiskCount++;
        else skusNeedingDownload.push(cleanSku);
      }

      let downloadedImagesCount = 0;
      let prunedStaleUploadsCount = 0;

      if (!dryRun && !skipImages && skusNeedingDownload.length > 0) {
        const batchSize = 25;
        for (let i = 0; i < skusNeedingDownload.length; i += batchSize) {
          const quotedList = skusNeedingDownload
            .slice(i, i + batchSize)
            .map((s) => `'${s.replace(/[^a-zA-Z0-9_-]/g, '')}'`)
            .join(',');

          const binRows = await prodDb.$transaction(async (tx) => {
            await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
            return tx.$queryRawUnsafe<ProdImageBinaryRow[]>(`
              SELECT TRIM(sku) AS sku, filename, mime_type,
                     OCTET_LENGTH(image_data) AS byte_len,
                     MD5(image_data) AS md5_hex, ENCODE(image_data, 'base64') AS img_b64
              FROM public.product_images WHERE TRIM(sku) IN (${quotedList})
            `);
          });

          for (const bin of binRows) {
            const buf = Buffer.from(bin.img_b64, 'base64');
            const actualMd5 = crypto.createHash('md5').update(buf).digest('hex');
            if (buf.length !== Number(bin.byte_len) || actualMd5 !== bin.md5_hex) {
              throw new Error(`Integridad MD5 fallida en imagen SKU ${bin.sku}.`);
            }
            const resolvedFile = resolveSyncedImageFilename(bin.sku, bin.filename, bin.mime_type, bin.md5_hex);
            const { prunedCount } = writeProductUploadAtomically(bin.sku, resolvedFile, buf, uploadsDir);
            downloadedImagesCount++;
            prunedStaleUploadsCount += prunedCount;
          }
        }
      }

      const resolveRubroId = (rawRubro?: string | null): number | null => {
        const canonical = normalizeRubroCanonicalName(rawRubro);
        if (!canonical) return null;
        return rubroIdByLookup.get(normalizeRubroLookupKey(canonical)) ?? null;
      };

      const pendingCreates: Array<Record<string, unknown>> = [];
      for (const prod of prodMetaRows) {
        const cleanSku = prod.sku.trim();
        if (!cleanSku || erpBySku.has(cleanSku)) continue;
        const priceInt = roundToIntegerPeso(prod.price || 0).toNumber();
        const rawWeight = prod.peso_promedio !== null && prod.peso_promedio !== undefined ? Number(prod.peso_promedio) : 0;
        const approxWeight = Number.isFinite(rawWeight) && rawWeight > 0 ? roundToThreeDecimalsWeight(rawWeight).toNumber() : null;
        const minQtyParsed = parseInt(String(prod.min_qty ?? '').trim(), 10);

        pendingCreates.push({
          sku: cleanSku,
          name: (prod.name || cleanSku).trim(),
          description: prod.subrubro ? String(prod.subrubro).trim() : null,
          costPrice: 0,
          listPrice: priceInt,
          listPriceB: priceInt,
          listPriceC: priceInt,
          stock: 0,
          minStock: 0,
          isPesable: approxWeight !== null,
          approximateWeight: approxWeight,
          minOrderQuantity: Number.isInteger(minQtyParsed) && minQtyParsed >= 1 ? minQtyParsed : 1,
          imageUrl: resolvedUrlBySku.get(cleanSku) || null,
          commercialCategory: prod.category ? String(prod.category).trim() : null,
          rubroId: resolveRubroId(prod.rubro),
          isActive: Number(prod.active) === 1,
        });
      }

      const syncNow = new Date();
      const pendingUpdates: Array<{ id: number; data: Record<string, unknown> }> = [];
      let pricesUpdatedCount = 0;
      let categoriesUpdatedCount = 0;
      let rubrosUpdatedCount = 0;
      let imagesUpdatedCount = 0;
      let activatedCount = 0;
      let pausedCount = 0;
      let namesUpdatedCount = 0;

      for (const erp of erpProducts) {
        const cleanSku = erp.sku.trim();
        const prod = prodBySku.get(cleanSku);
        const targetRubroId = prod ? resolveRubroId(prod.rubro) : null;
        const patch = computeErpProductSyncPatch(
          erp,
          prod,
          resolvedUrlBySku.get(cleanSku) || null,
          syncNow,
          targetRubroId,
        );
        if (!patch.hasChanges) continue;
        if (patch.priceChanged) pricesUpdatedCount++;
        if (patch.categoryChanged) categoriesUpdatedCount++;
        if (patch.rubroChanged) rubrosUpdatedCount++;
        if (patch.imageChanged) imagesUpdatedCount++;
        if (patch.nameChanged) namesUpdatedCount++;
        if (patch.activeChanged) {
          if (patch.updateData.isActive === true) activatedCount++;
          else pausedCount++;
        }
        pendingUpdates.push({ id: erp.id, data: patch.updateData });
      }

      if (!dryRun && (pendingCreates.length > 0 || pendingUpdates.length > 0)) {
        const txChunk = 50;
        for (let i = 0; i < pendingCreates.length; i += txChunk) {
          const slice = pendingCreates.slice(i, i + txChunk);
          await prisma.$transaction(slice.map((data) => prisma.product.create({ data: data as any })));
        }
        for (let i = 0; i < pendingUpdates.length; i += txChunk) {
          const slice = pendingUpdates.slice(i, i + txChunk);
          await prisma.$transaction(
            slice.map((item) => prisma.product.update({ where: { id: item.id }, data: item.data as any })),
          );
        }
        appCache.invalidateProductCatalog();

        if (options.userId) {
          await logAudit({
            userId: options.userId,
            action: 'SYNC_FROM_PRODUCTION_CATALOG',
            entityType: 'Product',
            entityId: 0,
            newValues: {
              createdProductsCount: pendingCreates.length,
              updatedProductsCount: pendingUpdates.length,
              pricesUpdatedCount,
              categoriesUpdatedCount,
              rubrosUpdatedCount,
              imagesUpdatedCount,
              activatedCount,
              pausedCount,
            },
          });
        }
      }

      return {
        dryRun,
        totalProductionRows: prodMetaRows.length,
        activeInProduction: prodMetaRows.filter((r) => Number(r.active) === 1).length,
        totalErpRows: erpProducts.length + (dryRun ? 0 : pendingCreates.length),
        createdProductsCount: pendingCreates.length,
        updatedProductsCount: pendingUpdates.length,
        pricesUpdatedCount,
        categoriesUpdatedCount,
        rubrosUpdatedCount,
        imagesUpdatedCount,
        activatedCount,
        pausedCount,
        namesUpdatedCount,
        downloadedImagesCount: dryRun ? skusNeedingDownload.length : downloadedImagesCount,
        reusedImagesOnDiskCount,
        prunedStaleUploadsCount,
      };
    } finally {
      await prodDb.$disconnect();
    }
  }
}

export const productionCatalogSyncService = new ProductionCatalogSyncService();
