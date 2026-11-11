import { describe, it, expect, vi } from 'vitest';
import { OrderStatus } from '@prisma/client';
import {
  extractWebOrderIdFromOrder,
  mapErpStatusToWebOrderStatus,
  mergeOrderBultosPreservingWebMetadata,
  resolveIgnoredWebOrderIds,
} from '../../engines/web-order-lifecycle.engine';
import { pushWebOrderStatusNow } from '../orders/web-order-status-bridge.service';
import {
  getWebOrderPollerStatus,
  runWebOrderSyncExclusive,
} from '../orders/web-order-poller.service';

describe('Paso P2 — Poller Single-Flight, Corte Histórico y Retorno Bidireccional ERP -> Web', () => {
  it('ignora por defecto los pedidos históricos de prueba DV-1004 y DV-1005 salvo que se pida explícitamente', () => {
    const defaultIgnored = resolveIgnoredWebOrderIds({});
    expect(defaultIgnored.has('DV-1004')).toBe(true);
    expect(defaultIgnored.has('DV-1005')).toBe(true);
    expect(defaultIgnored.has('DV-1006')).toBe(false);

    const withIncludeFlag = resolveIgnoredWebOrderIds({ includeHistoricalTests: true });
    expect(withIncludeFlag.size).toBe(0);

    const withExplicitOnly = resolveIgnoredWebOrderIds({ onlyOrderIds: ['DV-1004'] });
    expect(withExplicitOnly.has('DV-1004')).toBe(false);
  });

  it('preserva inmutablemente webOrderId cuando Depósito cierra bultos físicos (frio/secos/tabla/cajas)', () => {
    const existingWebMeta = {
      webOrderId: 'DV-1006',
      webOrderSource: 'tienda_web',
      webCustomerPhone: '5493388501086',
      webDeliveryMethod: 'reparto',
      webOriginalTotal: 48500,
      syncedAt: '2026-11-11T01:00:00.000Z',
    };

    const incomingWarehouseBultos = {
      frio: 2,
      secos: 1,
      tabla: 0,
      cajasCerradas: 3,
    };

    const merged = mergeOrderBultosPreservingWebMetadata(
      existingWebMeta,
      incomingWarehouseBultos,
    ) as Record<string, any>;

    expect(merged.webOrderId).toBe('DV-1006');
    expect(merged.webOrderSource).toBe('tienda_web');
    expect(merged.frio).toBe(2);
    expect(merged.cajasCerradas).toBe(3);

    expect(
      extractWebOrderIdFromOrder({
        bultosDetails: merged,
        notes: null,
      }),
    ).toBe('DV-1006');

    expect(
      extractWebOrderIdFromOrder({
        bultosDetails: null,
        notes: '[DV-1009] Tienda Web | Entrega: Mitre 450',
      }),
    ).toBe('DV-1009');
  });

  it('mapea exactamente todos los estados del ERP al ciclo de vida oficial de chatbot-dv', () => {
    expect(mapErpStatusToWebOrderStatus(OrderStatus.PENDING)).toBe('confirmado');
    expect(mapErpStatusToWebOrderStatus(OrderStatus.PREPARING)).toBe('en_armado');
    expect(mapErpStatusToWebOrderStatus(OrderStatus.PREPARED)).toBe('en_reparto');
    expect(mapErpStatusToWebOrderStatus(OrderStatus.DELIVERED)).toBe('entregado');
    expect(mapErpStatusToWebOrderStatus(OrderStatus.CANCELLED)).toBe('cancelado');
  });

  it('actualiza estado e historial en chatbot-dv de forma atómica e idempotente (sin duplicar si no cambió)', async () => {
    let currentDbStatus = 'confirmado';
    const executedWrites: Array<{ sql: string; args: any[] }> = [];

    const mockProdClient = {
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          $queryRawUnsafe: vi.fn(async () => [{ status: currentDbStatus }]),
          $executeRawUnsafe: vi.fn(async (sql: string, ...args: any[]) => {
            executedWrites.push({ sql, args });
            if (sql.includes('UPDATE public.orders')) {
              currentDbStatus = args[0];
            }
            return 1;
          }),
        };
        return await fn(tx);
      },
    };

    const firstPush = await pushWebOrderStatusNow(
      {
        webOrderId: 'dv-1008',
        targetStatus: 'en_armado',
        notes: 'En preparación en depósito (ERP Pedido #412)',
      },
      mockProdClient as any,
    );

    expect(firstPush).toEqual({
      updated: true,
      fromStatus: 'confirmado',
      toStatus: 'en_armado',
    });
    expect(executedWrites).toHaveLength(2);
    expect(executedWrites[0].args).toEqual(['en_armado', 'DV-1008']);
    expect(executedWrites[1].args).toEqual([
      'DV-1008',
      'confirmado',
      'en_armado',
      'En preparación en depósito (ERP Pedido #412)',
    ]);

    // Segunda ejecución con el mismo estado -> idempotente, 0 escrituras nuevas
    const secondPush = await pushWebOrderStatusNow(
      {
        webOrderId: 'DV-1008',
        targetStatus: 'en_armado',
        notes: 'Reintento',
      },
      mockProdClient as any,
    );

    expect(secondPush.updated).toBe(false);
    expect(secondPush.reason).toBe('UNCHANGED');
    expect(executedWrites).toHaveLength(2);
  });

  it('garantiza ejecución single-flight cuando coinciden un disparo manual y el poller automático', async () => {
    let underlyingRuns = 0;

    const slowExecutor = async () => {
      underlyingRuns += 1;
      await new Promise((r) => setTimeout(r, 40));
      return {
        dryRun: false,
        scannedWebOrders: 1,
        importedCount: 1,
        alreadyImportedCount: 0,
        skippedCancelledCount: 0,
        cancelledInErpCount: 0,
        newClientsCreatedCount: 0,
        ignoredTestOrdersCount: 2,
        previews: [],
      };
    };

    const beforeStatus = getWebOrderPollerStatus();
    const [resA, resB] = await Promise.all([
      runWebOrderSyncExclusive({}, slowExecutor),
      runWebOrderSyncExclusive({}, slowExecutor),
    ]);

    expect(underlyingRuns).toBe(1);
    expect(resA.importedCount).toBe(1);
    expect(resB.importedCount).toBe(1);

    const afterStatus = getWebOrderPollerStatus();
    expect(afterStatus.totalImportedSinceBoot).toBe(beforeStatus.totalImportedSinceBoot + 1);
    expect(afterStatus.syncInFlight).toBe(false);
  });
});
