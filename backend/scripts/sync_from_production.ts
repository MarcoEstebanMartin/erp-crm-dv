import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/utils/prisma';
import { productionCatalogSyncService } from '../src/services/catalog/production-catalog-sync.service';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(
    dryRun
      ? '🔍 Ejecutando auditoría en seco (DRY-RUN) Producción (chatbot-dv) -> ERP (erp-dv)...'
      : '🚀 Ejecutando sincronización unidireccional segura Producción (chatbot-dv) -> ERP (erp-dv)...',
  );

  try {
    const report = await productionCatalogSyncService.syncFromProduction({ dryRun });
    console.log('\n✅ Reporte de Sincronización Producción -> ERP:');
    console.log(JSON.stringify(report, null, 2));
  } catch (err: any) {
    console.error('❌ Error en sincronización desde Producción:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
