import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/utils/prisma';
import { productionOrderSyncService } from '../src/services/orders/production-order-sync.service';
import { getSharedProductionDbClient } from '../src/services/orders/web-order-status-bridge.service';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const includeHistoricalTests = process.argv.includes('--include-tests');
  const sinceArg = process.argv.find((a) => a.startsWith('--since='));
  const sinceCreatedAt = sinceArg ? new Date(sinceArg.slice('--since='.length)) : undefined;

  console.log(
    dryRun
      ? '🔍 Ejecutando vista previa en seco (DRY-RUN) de pedidos Web/WhatsApp (chatbot-dv -> erp-dv)...'
      : '🚀 Importando pedidos entrantes Web/WhatsApp (chatbot-dv -> erp-dv)...',
  );

  try {
    const report = await productionOrderSyncService.syncIncomingOrders({
      dryRun,
      sinceCreatedAt,
      includeHistoricalTests,
    });
    console.log('\n✅ Reporte de Sincronización de Pedidos Web/WhatsApp:');
    console.log(JSON.stringify(report, null, 2));
  } catch (err: any) {
    console.error('❌ Error sincronizando pedidos web:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([
      prisma.$disconnect(),
      getSharedProductionDbClient()?.$disconnect() ?? Promise.resolve(),
    ]);
  }
}

void main();
