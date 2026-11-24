import { OrderStatus, Role, SalesChannel } from '@prisma/client';
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
  extractWebOrderIdFromOrder,
  resolveIgnoredWebOrderIds,
} from '../../engines/web-order-lifecycle.engine';
import {
  commitSingleWebOrderAtomically,
  fetchProductionOrderHeaders,
  fetchProductionOrdersBatch,
  resolveWebOrderLookbackDate,
  type SyncWebOrdersOptions,
  type WebOrderPreviewEntry,
  type WebOrderSyncReport,
} from './web-order-commit.helper';
import {
  getSharedProductionDbClient,
  notifyWebOrderStatusForErpOrder,
} from './web-order-status-bridge.service';
import { OrderStatusService } from './order-status.service';
import { appCache } from '../../utils/cache';

export type {
  SyncWebOrdersOptions,
  WebOrderPreviewEntry,
  WebOrderSyncReport,
} from './web-order-commit.helper';

export class ProductionOrderSyncService {
  async syncIncomingOrders(options: SyncWebOrdersOptions = {}): Promise<WebOrderSyncReport> {
    const dryRun = Boolean(options.dryRun);
    const defaultUrl = (env.PRODUCTION_CATALOG_DATABASE_URL || '').trim();
    const customUrl = options.productionDbUrl?.trim();
    const isCustomClient = Boolean(customUrl && customUrl !== defaultUrl);
    const prodDb = getSharedProductionDbClient(customUrl);

    if (!prodDb) {
      throw new Error(
        'PRODUCTION_CATALOG_DATABASE_URL no está configurada para leer pedidos de Producción.',
      );
    }

    try {
      const onlySet = options.onlyOrderIds?.length
        ? new Set(options.onlyOrderIds.map((s) => s.trim().toUpperCase()))
        : null;
      const ignoreSet = resolveIgnoredWebOrderIds({
        skipOrderIds: options.skipOrderIds,
        onlyOrderIds: options.onlyOrderIds,
        includeHistoricalTests: options.includeHistoricalTests,
        envIgnoreRaw: process.env.WEB_ORDER_SYNC_IGNORE_IDS,
      });

      const effectiveSince = resolveWebOrderLookbackDate(options);
      const erpLookupSince = effectiveSince
        ? new Date(effectiveSince.getTime() - 2 * 24 * 60 * 60 * 1000)
        : undefined;

      const [webHeaders, existingWebErpOrders] = await Promise.all([
        fetchProductionOrderHeaders(prodDb, effectiveSince),
        prisma.order.findMany({
          where: {
            salesChannel: SalesChannel.TIENDA_WEB,
            ...(erpLookupSince ? { createdAt: { gte: erpLookupSince } } : {}),
          },
          select: { id: true, status: true, bultosDetails: true, notes: true },
        }),
      ]);

      const importedByWebCode = new Map<string, { id: number; status: OrderStatus }>();
      for (const eo of existingWebErpOrders) {
        const code = extractWebOrderIdFromOrder(eo);
        if (code) importedByWebCode.set(code, { id: eo.id, status: eo.status });
      }

      let ignoredTestOrdersCount = 0;
      const candidateHeaders = webHeaders.filter((wh) => {
        const cleanId = String(wh.id || '').trim().toUpperCase();
        if (onlySet && !onlySet.has(cleanId)) return false;
        if (ignoreSet.has(cleanId)) {
          ignoredTestOrdersCount++;
          return false;
        }
        if (options.sinceCreatedAt && wh.created_at) {
          const dt = new Date(wh.created_at);
          if (!Number.isNaN(dt.getTime()) && dt < options.sinceCreatedAt) return false;
        }
        return true;
      });

      let preAlreadyImportedCount = 0;
      let preSkippedCancelledCount = 0;
      let upperIds: string[];

      if (!dryRun) {
        const actionableIds: string[] = [];

        for (const wh of candidateHeaders) {
          const code = String(wh.id || '').trim().toUpperCase();
          const webSt = String(wh.status || 'nuevo').trim().toLowerCase();
          const existing = importedByWebCode.get(code);
          if (existing) {
            if (webSt === 'cancelado' && existing.status === OrderStatus.PENDING) {
              actionableIds.push(code);
            } else {
              preAlreadyImportedCount++;
            }
          } else if (webSt === 'cancelado') {
            preSkippedCancelledCount++;
          } else {
            actionableIds.push(code);
          }
        }

        if (actionableIds.length === 0) {
          return {
            dryRun: false,
            scannedWebOrders: candidateHeaders.length,
            importedCount: 0,
            alreadyImportedCount: preAlreadyImportedCount,
            skippedCancelledCount: preSkippedCancelledCount,
            cancelledInErpCount: 0,
            newClientsCreatedCount: 0,
            ignoredTestOrdersCount,
            previews: [],
          };
        }

        upperIds = actionableIds;
      } else {
        upperIds = candidateHeaders.map((h) => String(h.id || '').trim().toUpperCase());
      }

      if (upperIds.length === 0) {
        return {
          dryRun,
          scannedWebOrders: 0,
          importedCount: 0,
          alreadyImportedCount: 0,
          skippedCancelledCount: 0,
          cancelledInErpCount: 0,
          newClientsCreatedCount: 0,
          ignoredTestOrdersCount,
          previews: [],
        };
      }

      const [{ webOrders, rawCatalogState }, erpProducts, existingClients, tiendaUser] =
        await Promise.all([
          fetchProductionOrdersBatch(prodDb, upperIds),
          prisma.product.findMany(),
          prisma.persona.findMany({
            where: { isClient: true },
            select: { id: true, name: true, phone: true },
          }),
          dryRun ? Promise.resolve(null) : getTiendaOnlineUser(),
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

      const combosMap = parseCatalogCombosMap(rawCatalogState);
      const previews: WebOrderPreviewEntry[] = [];
      let importedCount = 0;
      let alreadyImportedCount = preAlreadyImportedCount;
      let skippedCancelledCount = preSkippedCancelledCount;
      let cancelledInErpCount = 0;
      let newClientsCreatedCount = 0;

      for (const wo of webOrders) {
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

        const existingErp = importedByWebCode.get(webOrderId);
        if (existingErp) {
          if (webStatus === 'cancelado' && existingErp.status === OrderStatus.PENDING) {
            if (!dryRun && tiendaUser) {
              await OrderStatusService.updateOrderStatus({
                orderId: existingErp.id,
                userId: tiendaUser.id,
                userRole: Role.ADMIN,
                status: OrderStatus.CANCELLED,
              });
            }
            cancelledInErpCount++;
            previews.push({ ...basePreview, willCreateNewClient: false, action: 'CANCELLED_IN_ERP', importedErpOrderId: existingErp.id });
          } else {
            alreadyImportedCount++;
            previews.push({ ...basePreview, willCreateNewClient: false, action: 'ALREADY_IMPORTED', importedErpOrderId: existingErp.id });
          }
          continue;
        }

        if (webStatus === 'cancelado') {
          skippedCancelledCount++;
          previews.push({ ...basePreview, willCreateNewClient: false, action: 'SKIPPED_CANCELLED' });
          continue;
        }

        if (translated.lines.length === 0) {
          previews.push({ ...basePreview, erpCalculatedTotal: 0, willCreateNewClient: false, action: 'SKIPPED_EMPTY' });
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
          if (webStatus === 'nuevo') {
            notifyWebOrderStatusForErpOrder({ id: res.orderId, bultosDetails: { webOrderId } }, OrderStatus.PENDING);
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

      if (!dryRun && (importedCount > 0 || cancelledInErpCount > 0)) {
        appCache.invalidateProductCatalogThrottled();
      }

      return {
        dryRun,
        scannedWebOrders: webOrders.length,
        importedCount,
        alreadyImportedCount,
        skippedCancelledCount,
        cancelledInErpCount,
        newClientsCreatedCount,
        ignoredTestOrdersCount,
        previews,
      };
    } finally {
      if (isCustomClient) await prodDb.$disconnect();
    }
  }
}

export const productionOrderSyncService = new ProductionOrderSyncService();
