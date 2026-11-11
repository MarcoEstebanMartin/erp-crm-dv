import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import prisma from '../../utils/prisma';
import { appCache } from '../../utils/cache';
import { logAudit } from '../../utils/audit';
import { env } from '../../config/env.config';
import {
  computeErpProductSyncPatch,
  resolveMasterArchiveExtension,
  resolveSyncedImageFilename,
  type ProductionCatalogRow,
} from '../../engines/catalog-sync.engine';

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
  userId?: number;
  productionDbUrl?: string;
  uploadsDir?: string;
  masterPhotosDir?: string;
}

export interface ProductionCatalogSyncReport {
  dryRun: boolean;
  totalProductionRows: number;
  activeInProduction: number;
  totalErpRows: number;
  updatedProductsCount: number;
  pricesUpdatedCount: number;
  imagesUpdatedCount: number;
  activatedCount: number;
  pausedCount: number;
  namesUpdatedCount: number;
  downloadedImagesCount: number;
  reusedImagesOnDiskCount: number;
  newMasterArchiveFilesCount: number;
}

export function writeImageSafelyProtectingMaster(
  sku: string,
  resolvedUploadFilename: string,
  masterExt: string,
  imageBuffer: Buffer,
  uploadsDir: string,
  masterPhotosDir: string | null,
  existingMasterStems: Set<string>,
): { wroteNewMaster: boolean } {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const uploadTarget = path.join(uploadsDir, resolvedUploadFilename);
  const tmpPath = `${uploadTarget}.tmp_${process.pid}`;
  fs.writeFileSync(tmpPath, imageBuffer);
  fs.renameSync(tmpPath, uploadTarget);

  let wroteNewMaster = false;
  const cleanSku = sku.trim();
  if (
    masterPhotosDir &&
    fs.existsSync(masterPhotosDir) &&
    !existingMasterStems.has(cleanSku)
  ) {
    const masterCandidate = path.join(masterPhotosDir, `${cleanSku}${masterExt}`);
    if (!fs.existsSync(masterCandidate)) {
      const masterTmp = `${masterCandidate}.tmp_${process.pid}`;
      fs.writeFileSync(masterTmp, imageBuffer);
      fs.renameSync(masterTmp, masterCandidate);
      existingMasterStems.add(cleanSku);
      wroteNewMaster = true;
    }
  }

  return { wroteNewMaster };
}

export class ProductionCatalogSyncService {
  async syncFromProduction(
    options: ProductionCatalogSyncOptions = {},
  ): Promise<ProductionCatalogSyncReport> {
    const dryRun = Boolean(options.dryRun);
    const prodDbUrl = options.productionDbUrl || env.PRODUCTION_CATALOG_DATABASE_URL;
    if (!prodDbUrl) {
      throw new Error(
        'PRODUCTION_CATALOG_DATABASE_URL no está configurada para leer el catálogo de Producción.',
      );
    }

    const uploadsDir =
      options.uploadsDir || path.resolve(__dirname, '../../../uploads/products');
    const masterPhotosDir =
      options.masterPhotosDir !== undefined
        ? options.masterPhotosDir
        : path.resolve(__dirname, '../../../../ARCHIVOS/fotos/Productos');

    const prodDb = new PrismaClient({ datasources: { db: { url: prodDbUrl } } });

    try {
      const prodMetaRows = await prodDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
        return tx.$queryRawUnsafe<ProdCatalogMetaRow[]>(`
          SELECT
            p.sku,
            p.name,
            p.price,
            p.active,
            p.min_qty,
            p.peso_promedio,
            p.photo_file,
            p.has_photo,
            pi.filename AS bytea_filename,
            pi.mime_type,
            OCTET_LENGTH(pi.image_data) AS img_bytes,
            MD5(pi.image_data) AS img_md5
          FROM public.products p
          LEFT JOIN public.product_images pi ON TRIM(pi.sku) = TRIM(p.sku)
          ORDER BY p.sku ASC
        `);
      });

      const erpProducts = await prisma.product.findMany({ orderBy: { sku: 'asc' } });
      const prodBySku = new Map<string, ProdCatalogMetaRow>();
      for (const row of prodMetaRows) {
        prodBySku.set(row.sku.trim(), row);
      }

      const existingMasterStems = new Set<string>(
        fs.existsSync(masterPhotosDir)
          ? fs.readdirSync(masterPhotosDir).map((f) => path.basename(f, path.extname(f)).trim())
          : [],
      );

      const resolvedUrlBySku = new Map<string, string>();
      const skusNeedingDownload: string[] = [];
      let reusedImagesOnDiskCount = 0;

      for (const erp of erpProducts) {
        const cleanSku = erp.sku.trim();
        const prod = prodBySku.get(cleanSku);
        const imgBytes = prod?.img_bytes ? Number(prod.img_bytes) : 0;
        if (!prod || imgBytes <= 0 || !prod.img_md5) continue;

        const resolvedFile = resolveSyncedImageFilename(
          cleanSku,
          prod.bytea_filename || prod.photo_file,
          prod.mime_type,
          prod.img_md5,
        );
        resolvedUrlBySku.set(cleanSku, `/uploads/products/${resolvedFile}`);

        const localUploadPath = path.join(uploadsDir, resolvedFile);
        const alreadyValidOnDisk =
          fs.existsSync(localUploadPath) &&
          crypto.createHash('md5').update(fs.readFileSync(localUploadPath)).digest('hex') ===
            prod.img_md5;

        const needsMasterBackfill =
          fs.existsSync(masterPhotosDir) && !existingMasterStems.has(cleanSku);

        if (alreadyValidOnDisk && !needsMasterBackfill) {
          reusedImagesOnDiskCount++;
        } else {
          skusNeedingDownload.push(cleanSku);
        }
      }

      let downloadedImagesCount = 0;
      let newMasterArchiveFilesCount = 0;

      if (!dryRun && skusNeedingDownload.length > 0) {
        const batchSize = 25;
        for (let i = 0; i < skusNeedingDownload.length; i += batchSize) {
          const batchSkus = skusNeedingDownload.slice(i, i + batchSize);
          const quotedList = batchSkus
            .map((s) => `'${s.replace(/[^a-zA-Z0-9_-]/g, '')}'`)
            .join(',');

          const binRows = await prodDb.$transaction(async (tx) => {
            await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
            return tx.$queryRawUnsafe<ProdImageBinaryRow[]>(`
              SELECT
                TRIM(sku) AS sku,
                filename,
                mime_type,
                OCTET_LENGTH(image_data) AS byte_len,
                MD5(image_data) AS md5_hex,
                ENCODE(image_data, 'base64') AS img_b64
              FROM public.product_images
              WHERE TRIM(sku) IN (${quotedList})
            `);
          });

          for (const bin of binRows) {
            const buf = Buffer.from(bin.img_b64, 'base64');
            const actualMd5 = crypto.createHash('md5').update(buf).digest('hex');
            if (buf.length !== Number(bin.byte_len) || actualMd5 !== bin.md5_hex) {
              throw new Error(`Integridad MD5 fallida al descargar imagen del SKU ${bin.sku}.`);
            }
            const resolvedFile = resolveSyncedImageFilename(
              bin.sku,
              bin.filename,
              bin.mime_type,
              bin.md5_hex,
            );
            const masterExt = resolveMasterArchiveExtension(bin.filename, bin.mime_type);
            const { wroteNewMaster } = writeImageSafelyProtectingMaster(
              bin.sku,
              resolvedFile,
              masterExt,
              buf,
              uploadsDir,
              masterPhotosDir,
              existingMasterStems,
            );
            downloadedImagesCount++;
            if (wroteNewMaster) newMasterArchiveFilesCount++;
          }
        }
      }

      const syncNow = new Date();
      const pendingUpdates: Array<{ id: number; data: Record<string, unknown> }> = [];
      let pricesUpdatedCount = 0;
      let imagesUpdatedCount = 0;
      let activatedCount = 0;
      let pausedCount = 0;
      let namesUpdatedCount = 0;

      for (const erp of erpProducts) {
        const cleanSku = erp.sku.trim();
        const prod = prodBySku.get(cleanSku);
        const resolvedUrl = resolvedUrlBySku.get(cleanSku) || null;
        const patch = computeErpProductSyncPatch(erp, prod, resolvedUrl, syncNow);

        if (!patch.hasChanges) continue;
        if (patch.priceChanged) pricesUpdatedCount++;
        if (patch.imageChanged) imagesUpdatedCount++;
        if (patch.nameChanged) namesUpdatedCount++;
        if (patch.activeChanged) {
          if (patch.updateData.isActive === true) activatedCount++;
          else pausedCount++;
        }
        pendingUpdates.push({ id: erp.id, data: patch.updateData });
      }

      if (!dryRun && pendingUpdates.length > 0) {
        const txChunk = 50;
        for (let i = 0; i < pendingUpdates.length; i += txChunk) {
          const slice = pendingUpdates.slice(i, i + txChunk);
          await prisma.$transaction(
            slice.map((item) =>
              prisma.product.update({ where: { id: item.id }, data: item.data as any }),
            ),
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
              updatedProductsCount: pendingUpdates.length,
              pricesUpdatedCount,
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
        totalErpRows: erpProducts.length,
        updatedProductsCount: pendingUpdates.length,
        pricesUpdatedCount,
        imagesUpdatedCount,
        activatedCount,
        pausedCount,
        namesUpdatedCount,
        downloadedImagesCount: dryRun ? skusNeedingDownload.length : downloadedImagesCount,
        reusedImagesOnDiskCount,
        newMasterArchiveFilesCount,
      };
    } finally {
      await prodDb.$disconnect();
    }
  }
}

export const productionCatalogSyncService = new ProductionCatalogSyncService();
