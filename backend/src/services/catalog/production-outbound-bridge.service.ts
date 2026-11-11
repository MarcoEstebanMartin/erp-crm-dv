import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { ResilientAsyncQueue } from '../../utils/resilient-retry-queue.util';
import {
  buildOutboundProductPayload,
  normalizeWebSku,
  patchCatalogActiveStateJson,
  type CatalogStateItemPatch,
} from '../../engines/catalog-bridge.engine';

export interface PushProductImageInput {
  productId?: number;
  sku: string;
  filename: string;
  imageBuffer: Buffer;
  mimeType: string;
}

interface ExistingWebProductRow {
  sku: string;
  price: number | null;
}

interface MetadataValueRow {
  value: string | null;
}

export class ProductionOutboundBridgeService {
  private readonly queue = new ResilientAsyncQueue(1, 0.1);
  private sharedProdClient: PrismaClient | null = null;
  private sharedProdUrl: string | null = null;
  private seq = 0;

  private getProdClient(overrideUrl?: string): PrismaClient | null {
    const targetUrl = (overrideUrl || env.PRODUCTION_CATALOG_DATABASE_URL || '').trim();
    if (!targetUrl) return null;
    if (overrideUrl && overrideUrl !== this.sharedProdUrl) {
      return new PrismaClient({ datasources: { db: { url: targetUrl } } });
    }
    if (!this.sharedProdClient || this.sharedProdUrl !== targetUrl) {
      this.sharedProdClient = new PrismaClient({ datasources: { db: { url: targetUrl } } });
      this.sharedProdUrl = targetUrl;
    }
    return this.sharedProdClient;
  }

  isAutoBridgeActive(): boolean {
    if (process.env.VITEST || env.NODE_ENV === 'test') return false;
    if (!env.ALLOW_PRODUCTION_CATALOG_WRITE) return false;
    return Boolean(env.PRODUCTION_CATALOG_DATABASE_URL?.trim());
  }

  getBridgeStats() {
    return {
      configured: Boolean(env.PRODUCTION_CATALOG_DATABASE_URL?.trim()),
      writeEnabled: env.ALLOW_PRODUCTION_CATALOG_WRITE,
      autoActive: this.isAutoBridgeActive(),
      queue: this.queue.getStats(),
    };
  }

  enqueueProductSyncById(productId: number): void {
    if (!this.isAutoBridgeActive() || !productId) return;
    this.enqueueBatchProductsSyncByIds([productId]);
  }

  enqueueBatchProductsSyncByIds(productIds: number[]): void {
    const uniqueIds = Array.from(new Set(productIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!this.isAutoBridgeActive() || uniqueIds.length === 0) return;
    this.queue.enqueue({
      key: `bridge:products:${++this.seq}`,
      label: `Puente ERP->Web (${uniqueIds.length} producto/s)`,
      maxAttempts: 4,
      baseDelayMs: 800,
      run: async () => {
        await this.pushProductsBatchToProductionNow(uniqueIds);
      },
    });
  }

  enqueueBatchProductsSyncBySkus(skus: string[]): void {
    const cleanSkus = Array.from(new Set(skus.map((s) => String(s || '').trim()).filter(Boolean)));
    if (!this.isAutoBridgeActive() || cleanSkus.length === 0) return;
    this.queue.enqueue({
      key: `bridge:skus:${++this.seq}`,
      label: `Puente ERP->Web por SKU (${cleanSkus.length} ítem/s)`,
      maxAttempts: 4,
      baseDelayMs: 800,
      run: async () => {
        const found = await prisma.product.findMany({
          where: { sku: { in: cleanSkus } },
          select: { id: true },
        });
        if (found.length > 0) {
          await this.pushProductsBatchToProductionNow(found.map((p) => p.id));
        }
      },
    });
  }

  enqueueProductImageSync(input: PushProductImageInput): void {
    if (!this.isAutoBridgeActive() || !input.sku || !input.imageBuffer?.length) return;
    this.queue.enqueue({
      key: `bridge:image:${normalizeWebSku(input.sku)}:${++this.seq}`,
      label: `Puente Foto ERP->Web SKU ${input.sku}`,
      maxAttempts: 4,
      baseDelayMs: 800,
      run: async () => {
        await this.pushProductImageToProductionNow(input);
      },
    });
  }

  async pushProductsBatchToProductionNow(
    productIds: number[],
    options?: { productionDbUrl?: string },
  ): Promise<{ syncedCount: number; statePatched: boolean }> {
    if (!env.ALLOW_PRODUCTION_CATALOG_WRITE && !options?.productionDbUrl) {
      return { syncedCount: 0, statePatched: false };
    }
    const uniqueIds = Array.from(new Set(productIds.filter((id) => id > 0)));
    if (uniqueIds.length === 0) return { syncedCount: 0, statePatched: false };

    const prodDb = this.getProdClient(options?.productionDbUrl);
    if (!prodDb) return { syncedCount: 0, statePatched: false };
    const ownsTempClient = Boolean(
      options?.productionDbUrl && options.productionDbUrl !== this.sharedProdUrl,
    );

    try {
      const erpProducts = await prisma.product.findMany({
        where: { id: { in: uniqueIds } },
        include: { rubro: true },
      });
      if (erpProducts.length === 0) return { syncedCount: 0, statePatched: false };

      const payloads = erpProducts.map((p) =>
        buildOutboundProductPayload({
          sku: p.sku,
          name: p.name,
          listPrice: p.listPrice.toString(),
          isActive: p.isActive,
          minOrderQuantity: p.minOrderQuantity,
          approximateWeight: p.approximateWeight ? p.approximateWeight.toString() : null,
          imageUrl: p.imageUrl,
          commercialCategory: p.commercialCategory,
          rubroName: p.rubro?.name || null,
        }),
      );

      let statePatched = false;
      await prodDb.$transaction(async (tx) => {
        const statePatches: CatalogStateItemPatch[] = [];

        for (const item of payloads) {
          const existingRows = await tx.$queryRawUnsafe<ExistingWebProductRow[]>(
            `SELECT sku, price FROM public.products WHERE sku = $1 LIMIT 1`,
            item.sku,
          );
          const existing = existingRows[0];

          if (existing) {
            await tx.$executeRawUnsafe(
              `UPDATE public.products
               SET name = $2, price = $3, price_formatted = $4, active = $5,
                   min_qty = $6, peso_promedio = $7, updated_at = CURRENT_TIMESTAMP
               WHERE sku = $1`,
              item.sku,
              item.name,
              item.price,
              item.priceFormatted,
              item.active,
              item.minQty,
              item.pesoPromedio,
            );

            const oldPrice = existing.price !== null ? Number(existing.price) : null;
            if (oldPrice !== null && Math.abs(oldPrice - item.price) > 0.001) {
              await tx.$executeRawUnsafe(
                `INSERT INTO public.price_history (sku, old_price, new_price, changed_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
                item.sku,
                oldPrice,
                item.price,
              );
            }
          } else {
            const hasFallbackPhoto = item.fallbackPhotoFile ? 1 : 0;
            await tx.$executeRawUnsafe(
              `INSERT INTO public.products (
                 sku, name, price, price_formatted, category, rubro, subrubro,
                 photo_file, has_photo, active, photo_updated_manually,
                 min_qty, peso_promedio, created_at, updated_at
               ) VALUES (
                 $1, $2, $3, $4, $5, $6, $7,
                 $8, $9, $10, 0, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
               )`,
              item.sku,
              item.name,
              item.price,
              item.priceFormatted,
              item.category,
              item.rubro,
              item.category,
              item.fallbackPhotoFile,
              hasFallbackPhoto,
              item.active,
              item.minQty,
              item.pesoPromedio,
            );
          }

          statePatches.push({
            sku: item.sku,
            name: item.name,
            price: item.price,
            priceFormatted: item.priceFormatted,
            minQty: item.minQty,
            pesoPromedio: item.pesoPromedio,
          });
        }

        statePatched = await this.applyMetadataStatePatchesInTx(tx, statePatches);
      });

      return { syncedCount: payloads.length, statePatched };
    } finally {
      if (ownsTempClient) await prodDb.$disconnect();
    }
  }

  async pushProductImageToProductionNow(
    input: PushProductImageInput,
    options?: { productionDbUrl?: string },
  ): Promise<{ uploaded: boolean; statePatched: boolean }> {
    if (!env.ALLOW_PRODUCTION_CATALOG_WRITE && !options?.productionDbUrl) {
      return { uploaded: false, statePatched: false };
    }
    const prodDb = this.getProdClient(options?.productionDbUrl);
    if (!prodDb) return { uploaded: false, statePatched: false };
    const ownsTempClient = Boolean(
      options?.productionDbUrl && options.productionDbUrl !== this.sharedProdUrl,
    );

    const cleanSku = normalizeWebSku(input.sku);
    const b64Data = input.imageBuffer.toString('base64');
    const mime =
      input.mimeType || (input.filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');

    try {
      if (input.productId) {
        await this.pushProductsBatchToProductionNow([input.productId], options);
      }

      let statePatched = false;
      await prodDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `INSERT INTO public.product_images (sku, filename, image_data, mime_type, updated_at)
           VALUES ($1, $2, DECODE($3, 'base64'), $4, CURRENT_TIMESTAMP)
           ON CONFLICT (sku) DO UPDATE SET
             filename = EXCLUDED.filename,
             image_data = EXCLUDED.image_data,
             mime_type = EXCLUDED.mime_type,
             updated_at = CURRENT_TIMESTAMP`,
          cleanSku,
          input.filename,
          b64Data,
          mime,
        );

        await tx.$executeRawUnsafe(
          `UPDATE public.products
           SET photo_file = $2, has_photo = 1, photo_updated_manually = 1, updated_at = CURRENT_TIMESTAMP
           WHERE sku = $1`,
          cleanSku,
          input.filename,
        );

        statePatched = await this.applyMetadataStatePatchesInTx(tx, [
          { sku: cleanSku, photoFile: input.filename, hasPhoto: true },
        ]);
      });

      return { uploaded: true, statePatched };
    } finally {
      if (ownsTempClient) await prodDb.$disconnect();
    }
  }

  private async applyMetadataStatePatchesInTx(
    tx: Prisma.TransactionClient,
    patches: CatalogStateItemPatch[],
  ): Promise<boolean> {
    if (patches.length === 0) return false;
    const rows = await tx.$queryRawUnsafe<MetadataValueRow[]>(
      `SELECT value FROM public.metadata WHERE key = 'catalog_active_state' FOR UPDATE`,
    );
    const rawJson = rows[0]?.value;
    if (!rawJson) return false;

    const { changed, nextJson } = patchCatalogActiveStateJson(rawJson, patches);
    if (!changed) return false;

    await tx.$executeRawUnsafe(
      `UPDATE public.metadata SET value = $1, updated_at = CURRENT_TIMESTAMP WHERE key = 'catalog_active_state'`,
      nextJson,
    );
    return true;
  }
}

export const productionOutboundBridgeService = new ProductionOutboundBridgeService();
