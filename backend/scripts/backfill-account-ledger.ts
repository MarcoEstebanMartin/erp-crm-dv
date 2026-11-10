import prisma from '../src/utils/prisma';
import { ledgerBackfillService } from '../src/services/ledger/ledger-backfill.service';

async function main() {
  console.log('[AccountLedger] Iniciando backfill idempotente y verificación de paridad...');
  const result = await ledgerBackfillService.backfillAllPersonas();
  console.log('[AccountLedger] Resultado:', JSON.stringify(result, null, 2));

  if (result.mismatches.length > 0) {
    console.error('[AccountLedger] ERROR: Se detectaron diferencias de paridad:', result.mismatches);
    process.exit(1);
  }

  console.log('[AccountLedger] PARIDAD 100.00% VERIFICADA EN TODAS LAS PERSONAS (0 discrepancias).');
}

main()
  .catch((err) => {
    console.error('[AccountLedger] Fallo crítico:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
