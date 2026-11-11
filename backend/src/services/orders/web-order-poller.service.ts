import { env } from '../../config/env.config';
import {
  productionOrderSyncService,
  type SyncWebOrdersOptions,
  type WebOrderSyncReport,
} from './production-order-sync.service';
import { getWebOrderStatusBridgeMetrics } from './web-order-status-bridge.service';

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const MIN_POLL_INTERVAL_MS = 10_000;

let activeSyncPromise: Promise<WebOrderSyncReport> | null = null;
let pollerIntervalHandle: NodeJS.Timeout | null = null;
let initialKickoffHandle: NodeJS.Timeout | null = null;

interface PollerTelemetry {
  pollerActive: boolean;
  pollIntervalMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  totalRuns: number;
  totalImportedSinceBoot: number;
  totalCancelledInErpSinceBoot: number;
  lastSummary: Omit<WebOrderSyncReport, 'previews'> | null;
}

const telemetry: PollerTelemetry = {
  pollerActive: false,
  pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  totalRuns: 0,
  totalImportedSinceBoot: 0,
  totalCancelledInErpSinceBoot: 0,
  lastSummary: null,
};

function resolvePollIntervalMs(): number {
  const parsed = Number(process.env.WEB_ORDER_POLL_INTERVAL_MS || DEFAULT_POLL_INTERVAL_MS);
  if (!Number.isFinite(parsed) || parsed < MIN_POLL_INTERVAL_MS) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  return Math.floor(parsed);
}

/**
 * Ejecuta una pasada de sincronización garantizando concurrencia 1 (single-flight).
 * Si ya hay una sincronización en vivo corriendo y llega otra petición en vivo,
 * reutiliza la misma promesa en curso evitando colisiones de red/DB.
 */
export async function runWebOrderSyncExclusive(
  options: SyncWebOrdersOptions = {},
  customExecutor?: (opts: SyncWebOrdersOptions) => Promise<WebOrderSyncReport>,
): Promise<WebOrderSyncReport> {
  const executor =
    customExecutor || ((opts: SyncWebOrdersOptions) => productionOrderSyncService.syncIncomingOrders(opts));

  if (options.dryRun) {
    return await executor(options);
  }

  if (activeSyncPromise) {
    return await activeSyncPromise;
  }

  telemetry.lastRunAt = new Date().toISOString();
  telemetry.totalRuns += 1;

  activeSyncPromise = (async () => {
    try {
      const report = await executor(options);
      telemetry.lastSuccessAt = new Date().toISOString();
      telemetry.lastError = null;
      telemetry.totalImportedSinceBoot += report.importedCount;
      telemetry.totalCancelledInErpSinceBoot += report.cancelledInErpCount;
      const { previews: _previews, ...summaryOnly } = report;
      telemetry.lastSummary = summaryOnly;

      if (report.importedCount > 0 || report.cancelledInErpCount > 0) {
        console.log(
          `🌐 [WebOrderBridge] Nuevos importados: ${report.importedCount} | Cancelados en ERP: ${report.cancelledInErpCount}`,
        );
      }
      return report;
    } catch (err: any) {
      telemetry.lastError = err?.message || String(err);
      throw err;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return await activeSyncPromise;
}

export function startWebOrderPollerIfEnabled(): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return;
  if (process.env.WEB_ORDER_POLLER_ENABLED === 'false') return;
  if (!(env.PRODUCTION_CATALOG_DATABASE_URL || '').trim()) return;
  if (pollerIntervalHandle) return;

  const intervalMs = resolvePollIntervalMs();
  telemetry.pollIntervalMs = intervalMs;
  telemetry.pollerActive = true;

  const safePollTick = () => {
    void runWebOrderSyncExclusive().catch((err) => {
      console.warn(
        `⚠️ [WebOrderPoller] Reintentará en ${Math.round(intervalMs / 1000)}s: ${err?.message || err}`,
      );
    });
  };

  initialKickoffHandle = setTimeout(safePollTick, 2500);
  initialKickoffHandle.unref?.();

  pollerIntervalHandle = setInterval(safePollTick, intervalMs);
  pollerIntervalHandle.unref?.();

  console.log(
    `🌐 [WebOrderPoller] Puente automático Web/WhatsApp activo cada ${Math.round(intervalMs / 1000)}s (ignorando pruebas históricas DV-1004, DV-1005).`,
  );
}

export function stopWebOrderPoller(): void {
  if (initialKickoffHandle) {
    clearTimeout(initialKickoffHandle);
    initialKickoffHandle = null;
  }
  if (pollerIntervalHandle) {
    clearInterval(pollerIntervalHandle);
    pollerIntervalHandle = null;
  }
  telemetry.pollerActive = false;
}

export function getWebOrderPollerStatus() {
  return {
    ...telemetry,
    syncInFlight: Boolean(activeSyncPromise),
    statusBridge: getWebOrderStatusBridgeMetrics(),
  };
}
