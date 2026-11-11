import { PrismaClient } from '@prisma/client';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { roundToIntegerPeso } from '../../core/money';
import { extractCategoryOrderFromCatalogState } from '../../engines/catalog-sync.engine';
import { productionCatalogSyncService } from './production-catalog-sync.service';

interface LiveProdRow {
  sku: string;
  name: string;
  price: number | string | null;
  category: string | null;
  rubro: string | null;
  subrubro: string | null;
  active: number;
}

interface MetadataRow {
  value: string | null;
}

export interface LivePriceListProductDto {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  barcode: string | null;
  costPrice: number;
  listPrice: number;
  listPriceB: number;
  listPriceC: number;
  stock: number;
  isActive: boolean;
  commercialCategory: string | null;
  rubro: { name: string } | null;
}

export interface LivePriceListCatalogResponse {
  source: 'production' | 'erp';
  categoryOrder: string[];
  products: LivePriceListProductDto[];
}

const SYNC_THROTTLE_MS = 60_000;

class PriceListLiveService {
  private sharedProdClient: PrismaClient | null = null;
  private sharedProdUrl: string | null = null;
  private lastBgSyncAt = 0;
  private bgSyncInFlight: Promise<unknown> | null = null;

  private getProdClient(): PrismaClient | null {
    const targetUrl = (env.PRODUCTION_CATALOG_DATABASE_URL || '').trim();
    if (!targetUrl) return null;
    if (!this.sharedProdClient || this.sharedProdUrl !== targetUrl) {
      this.sharedProdClient = new PrismaClient({ datasources: { db: { url: targetUrl } } });
      this.sharedProdUrl = targetUrl;
    }
    return this.sharedProdClient;
  }

  private triggerBackgroundErpSyncIfDue(): void {
    if (process.env.VITEST || env.NODE_ENV === 'test') return;
    const now = Date.now();
    if (this.bgSyncInFlight || now - this.lastBgSyncAt < SYNC_THROTTLE_MS) return;
    this.lastBgSyncAt = now;
    this.bgSyncInFlight = productionCatalogSyncService
      .syncFromProduction({ skipImages: true })
      .catch((err) => {
        console.warn('[PriceListLive] Aviso en sync de fondo chatbot-dv -> erp-dv:', err?.message);
      })
      .finally(() => {
        this.bgSyncInFlight = null;
      });
  }

  async getPriceListCatalog(): Promise<LivePriceListCatalogResponse> {
    const prodDb = this.getProdClient();
    if (prodDb) {
      try {
        const { rows, stateRows } = await prodDb.$transaction(async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
          const rows = await tx.$queryRawUnsafe<LiveProdRow[]>(`
            SELECT sku, name, price, category, rubro, subrubro, active
            FROM public.products
            WHERE active = 1
            ORDER BY sku ASC
          `);
          const stateRows = await tx.$queryRawUnsafe<MetadataRow[]>(`
            SELECT value FROM public.metadata WHERE key = 'catalog_active_state' LIMIT 1
          `);
          return { rows, stateRows };
        });

        const categoryOrder = extractCategoryOrderFromCatalogState(stateRows[0]?.value);
        const products: LivePriceListProductDto[] = rows.map((r, index) => {
          const cleanPrice = roundToIntegerPeso(r.price || 0).toNumber();
          return {
            id: index + 1,
            sku: String(r.sku || '').trim(),
            name: String(r.name || '').trim(),
            description: r.subrubro ? String(r.subrubro).trim() : null,
            barcode: null,
            costPrice: 0,
            listPrice: cleanPrice,
            listPriceB: cleanPrice,
            listPriceC: cleanPrice,
            stock: 1,
            isActive: true,
            commercialCategory: r.category ? String(r.category).trim() : null,
            rubro: r.rubro ? { name: String(r.rubro).trim() } : null,
          };
        });

        this.triggerBackgroundErpSyncIfDue();
        return { source: 'production', categoryOrder, products };
      } catch (err: any) {
        console.warn('[PriceListLive] Contingencia local ERP activada:', err?.message);
      }
    }

    const erpRows = await prisma.product.findMany({
      where: { isActive: true },
      include: { rubro: true },
      orderBy: { sku: 'asc' },
    });

    return {
      source: 'erp',
      categoryOrder: [],
      products: erpRows.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        costPrice: Number(p.costPrice || 0),
        listPrice: roundToIntegerPeso(p.listPrice || 0).toNumber(),
        listPriceB: roundToIntegerPeso(p.listPriceB || 0).toNumber(),
        listPriceC: roundToIntegerPeso(p.listPriceC || 0).toNumber(),
        stock: p.stock,
        isActive: p.isActive,
        commercialCategory: p.commercialCategory,
        rubro: p.rubro ? { name: p.rubro.name } : null,
      })),
    };
  }
}

export const priceListLiveService = new PriceListLiveService();
