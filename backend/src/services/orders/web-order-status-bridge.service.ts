import { OrderStatus, PrismaClient } from '@prisma/client';
import { env } from '../../config/env.config';
import { ResilientAsyncQueue } from '../../utils/resilient-retry-queue.util';
import {
  buildWebOrderStatusHistoryNote,
  extractWebOrderIdFromOrder,
  mapErpStatusToWebOrderStatus,
  type WebOrderStatusCode,
} from '../../engines/web-order-lifecycle.engine';

export interface WebOrderStatusPushPayload {
  webOrderId: string;
  targetStatus: WebOrderStatusCode;
  notes: string;
}

export interface WebOrderStatusPushResult {
  updated: boolean;
  reason?: 'NOT_CONFIGURED' | 'NOT_FOUND' | 'UNCHANGED';
  fromStatus?: string;
  toStatus?: WebOrderStatusCode;
}

const VALID_WEB_STATUSES = new Set<WebOrderStatusCode>([
  'nuevo',
  'confirmado',
  'en_armado',
  'en_reparto',
  'entregado',
  'cancelado',
]);

let sharedProdDb: PrismaClient | null = null;
let sharedProdDbUrl = '';

export function getSharedProductionDbClient(overrideUrl?: string): PrismaClient | null {
  const targetUrl = (overrideUrl || env.PRODUCTION_CATALOG_DATABASE_URL || '').trim();
  if (!targetUrl) return null;

  if (overrideUrl && overrideUrl.trim() !== (env.PRODUCTION_CATALOG_DATABASE_URL || '').trim()) {
    return new PrismaClient({ datasources: { db: { url: targetUrl } } });
  }

  if (!sharedProdDb || sharedProdDbUrl !== targetUrl) {
    sharedProdDb = new PrismaClient({ datasources: { db: { url: targetUrl } } });
    sharedProdDbUrl = targetUrl;
  }
  return sharedProdDb;
}

function isAutomatedTestRuntime(): boolean {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}

export async function pushWebOrderStatusNow(
  payload: WebOrderStatusPushPayload,
  customClient?: Pick<PrismaClient, '$transaction'>,
): Promise<WebOrderStatusPushResult> {
  const cleanId = String(payload.webOrderId || '')
    .trim()
    .toUpperCase()
    .replace(/^#/, '');

  if (!cleanId || !VALID_WEB_STATUSES.has(payload.targetStatus)) {
    throw new Error(`Estado o ID de pedido web inválido: ${cleanId} -> ${payload.targetStatus}`);
  }

  if (!customClient && !env.ALLOW_PRODUCTION_CATALOG_WRITE) {
    return { updated: false, reason: 'NOT_CONFIGURED' };
  }

  const client = customClient || getSharedProductionDbClient();
  if (!client) {
    return { updated: false, reason: 'NOT_CONFIGURED' };
  }

  return await client.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ status: string | null }>>(
      `SELECT status FROM public.orders WHERE id = $1 FOR UPDATE`,
      cleanId,
    );

    if (!rows || rows.length === 0) {
      return { updated: false, reason: 'NOT_FOUND' };
    }

    const oldStatus = String(rows[0].status || 'nuevo').trim().toLowerCase();
    if (oldStatus === payload.targetStatus) {
      return {
        updated: false,
        reason: 'UNCHANGED',
        fromStatus: oldStatus,
        toStatus: payload.targetStatus,
      };
    }

    await tx.$executeRawUnsafe(
      `UPDATE public.orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      payload.targetStatus,
      cleanId,
    );

    await tx.$executeRawUnsafe(
      `INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, notes, changed_at)
       VALUES ($1, $2, $3, 'erp_dv', $4, NOW())`,
      cleanId,
      oldStatus,
      payload.targetStatus,
      payload.notes,
    );

    return {
      updated: true,
      fromStatus: oldStatus,
      toStatus: payload.targetStatus,
    };
  });
}

const outboundStatusQueue = new ResilientAsyncQueue(1);

export function enqueueWebOrderStatusSyncByCode(payload: WebOrderStatusPushPayload): boolean {
  if (isAutomatedTestRuntime()) return false;
  if (!env.ALLOW_PRODUCTION_CATALOG_WRITE) return false;
  if (!(env.PRODUCTION_CATALOG_DATABASE_URL || '').trim()) return false;

  const cleanId = payload.webOrderId.trim().toUpperCase();
  return outboundStatusQueue.enqueue({
    key: `web-order-status:${cleanId}:${payload.targetStatus}`,
    label: `Sincronizar estado ${cleanId} -> ${payload.targetStatus}`,
    maxAttempts: 4,
    baseDelayMs: 1200,
    maxDelayMs: 12_000,
    run: async () => {
      await pushWebOrderStatusNow(payload);
    },
  });
}

export function notifyWebOrderStatusForErpOrder(
  order: { id: number; bultosDetails?: unknown; notes?: string | null },
  erpStatus: OrderStatus,
  extraNote?: string,
): boolean {
  const webOrderId = extractWebOrderIdFromOrder(order);
  if (!webOrderId) return false;

  const targetStatus = mapErpStatusToWebOrderStatus(erpStatus);
  const notes = buildWebOrderStatusHistoryNote(order.id, erpStatus, extraNote);

  return enqueueWebOrderStatusSyncByCode({
    webOrderId,
    targetStatus,
    notes,
  });
}

export function getWebOrderStatusBridgeMetrics() {
  const stats = outboundStatusQueue.getStats();
  return {
    configured: Boolean((env.PRODUCTION_CATALOG_DATABASE_URL || '').trim()),
    pendingStatusUpdates: stats.pending + stats.inFlight,
    completedStatusUpdates: stats.completed,
    failedStatusUpdates: stats.failedPermanently,
  };
}
