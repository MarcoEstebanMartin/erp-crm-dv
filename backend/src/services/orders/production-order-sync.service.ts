import { PrismaClient, SalesChannel } from '@prisma/client';
import prisma from '../../utils/prisma';
import { env } from '../../config/env.config';
import { getTiendaOnlineUser } from '../store/store-auth.service';
import { normalizeWebSku } from '../../engines/catalog-bridge.engine';
import {
  extractComparableArPhoneDigits,
  parseCatalogCombosMap,
  translateWebOrderItemsToErpLines,
  type ErpProductForWebOrder,
  type WebIncomingOrderItem,
} from '../../engines/web-order-sync.engine';
import {
  commitSingleWebOrderAtomically,
  type RawWebOrderRow,
  type SyncWebOrdersOptions,
  type WebOrderPreviewEntry,
  type WebOrderSyncReport,
} from './web-order-commit.helper';

export type {
  SyncWebOrdersOptions,
  WebOrderPreviewEntry,
  WebOrderSyncReport,
} from './web-order-commit.helper';

export class ProductionOrderSyncService {
  async syncIncomingOrders(options: SyncWebOrdersOptions = {}): Promise<WebOrderSyncReport> {
    const dryRun = Boolean(options.dryRun);
    const prodDbUrl = (options.productionDbUrl || env.PRODUCTION_CATALOG_DATABASE_URL || '').trim();
    if (!prodDbUrl) {
      throw new Error(
        'PRODUCTION_CATALOG_DATABASE_URL no está configurada para leer pedidos de Producción.',
      );
    }

    const prodDb = new PrismaClient({ datasources: { db: { url: prodDbUrl } } });

    try {
      const { webOrders, rawCatalogState } = await prodDb.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
        const rows = await tx.$queryRawUnsafe<RawWebOrderRow[]>(`
          SELECT
            o.id,
            o.customer_phone,
            o.customer_name,
            o.delivery_address,
            o.delivery_method,
            o.notes,
            o.total_amount,
            o.status,
            o.source,
            o.created_at,
            COALESCE(
              (SELECT json_agg(oi ORDER BY oi.id ASC) FROM public.order_items oi WHERE oi.order_id = o.id),
              '[]'::json
            ) AS items_json
          FROM public.orders o
          ORDER BY o.created_at ASC, o.id ASC
        `);

        const metaRows = await tx.$queryRawUnsafe<Array<{ value: string | null }>>(
          `SELECT value FROM public.metadata WHERE key = 'catalog_active_state' LIMIT 1`,
        );
        return { webOrders: rows, rawCatalogState: metaRows[0]?.value || null };
      });

      const onlySet = options.onlyOrderIds?.length
        ? new Set(options.onlyOrderIds.map((s) => s.trim().toUpperCase()))
        : null;
      const skipSet = new Set((options.skipOrderIds || []).map((s) => s.trim().toUpperCase()));

      const filteredWebOrders = webOrders.filter((wo) => {
        const cleanId = String(wo.id || '').trim().toUpperCase();
        if (onlySet && !onlySet.has(cleanId)) return false;
        if (skipSet.has(cleanId)) return false;
        if (options.sinceCreatedAt && wo.created_at) {
          const dt = new Date(wo.created_at);
          if (!Number.isNaN(dt.getTime()) && dt < options.sinceCreatedAt) return false;
        }
        return true;
      });

      const [erpProducts, existingClients, existingWebErpOrders] = await Promise.all([
        prisma.product.findMany(),
        prisma.persona.findMany({
          where: { isClient: true },
          select: { id: true, name: true, phone: true },
        }),
        prisma.order.findMany({
          where: { salesChannel: SalesChannel.TIENDA_WEB },
          select: { id: true, bultosDetails: true },
        }),
      ]);

      const erpBySku = new Map<string, ErpProductForWebOrder>();
      for (const p of erpProducts) erpBySku.set(normalizeWebSku(p.sku), p);

      const clientByPhone10 = new Map<string, { id: number; name: string }>();
      for (const c of existingClients) {
        const p10 = extractComparableArPhoneDigits(c.phone);
        if (p10.length >= 8 && !clientByPhone10.has(p10)) {
          clientByPhone10.set(p10, { id: c.id, name: c.name });
        }
      }

      const importedIdByWebCode = new Map<string, number>();
      for (const eo of existingWebErpOrders) {
        const details = eo.bultosDetails as Record<string, any> | null;
        const code = details?.webOrderId ? String(details.webOrderId).trim().toUpperCase() : '';
        if (code) importedIdByWebCode.set(code, eo.id);
      }

      const combosMap = parseCatalogCombosMap(rawCatalogState);
      const tiendaUser = dryRun ? null : await getTiendaOnlineUser();

      const previews: WebOrderPreviewEntry[] = [];
      let importedCount = 0;
      let alreadyImportedCount = 0;
      let skippedCancelledCount = 0;
      let newClientsCreatedCount = 0;

      for (const wo of filteredWebOrders) {
        const webOrderId = String(wo.id || '').trim().toUpperCase();
        const webStatus = String(wo.status || 'nuevo').trim().toLowerCase();
        const source = String(wo.source || 'tienda_web').trim();
        const phoneRaw = String(wo.customer_phone || '').trim();
        const phone10 = extractComparableArPhoneDigits(phoneRaw);
        const matchedClient = phone10.length >= 8 ? clientByPhone10.get(phone10) || null : null;

        const rawItems: WebIncomingOrderItem[] = Array.isArray(wo.items_json)
          ? wo.items_json
          : typeof wo.items_json === 'string'
            ? JSON.parse(wo.items_json)
            : [];

        const translated = translateWebOrderItemsToErpLines(rawItems, erpBySku, combosMap);
        const basePreview = {
          webOrderId,
          source,
          webStatus,
          customerName: wo.customer_name,
          customerPhone: phoneRaw,
          matchedPersonaId: matchedClient?.id || null,
          matchedPersonaName: matchedClient?.name || null,
          webTotalAmount: Number(wo.total_amount || 0),
          erpCalculatedTotal: translated.totalAmount,
          linesCount: translated.lines.length,
          unmappedNotes: translated.unmappedNotes,
          stockWarnings: translated.stockWarnings,
        };

        if (importedIdByWebCode.has(webOrderId)) {
          alreadyImportedCount++;
          previews.push({
            ...basePreview,
            willCreateNewClient: false,
            action: 'ALREADY_IMPORTED',
            importedErpOrderId: importedIdByWebCode.get(webOrderId),
          });
          continue;
        }

        if (webStatus === 'cancelado') {
          skippedCancelledCount++;
          previews.push({ ...basePreview, willCreateNewClient: false, action: 'SKIPPED_CANCELLED' });
          continue;
        }

        if (translated.lines.length === 0) {
          previews.push({
            ...basePreview,
            erpCalculatedTotal: 0,
            willCreateNewClient: false,
            action: 'SKIPPED_EMPTY',
          });
          continue;
        }

        if (dryRun) {
          previews.push({ ...basePreview, willCreateNewClient: !matchedClient, action: 'IMPORT' });
          continue;
        }

        const res = await commitSingleWebOrderAtomically({
          wo,
          webOrderId,
          source,
          webStatus,
          phoneRaw,
          phone10,
          matchedClient,
          translated,
          sellerId: tiendaUser!.id,
        });

        if (res.alreadyExisted) {
          alreadyImportedCount++;
        } else {
          importedCount++;
          if (res.createdNewClient && phone10.length >= 8) {
            newClientsCreatedCount++;
            clientByPhone10.set(phone10, { id: res.personaId, name: res.personaName });
          }
        }

        previews.push({
          ...basePreview,
          matchedPersonaId: res.personaId,
          matchedPersonaName: res.personaName,
          willCreateNewClient: res.createdNewClient,
          action: res.alreadyExisted ? 'ALREADY_IMPORTED' : 'IMPORT',
          importedErpOrderId: res.orderId,
        });
      }

      return {
        dryRun,
        scannedWebOrders: filteredWebOrders.length,
        importedCount,
        alreadyImportedCount,
        skippedCancelledCount,
        newClientsCreatedCount,
        previews,
      };
    } finally {
      await prodDb.$disconnect();
    }
  }
}

export const productionOrderSyncService = new ProductionOrderSyncService();
