const { PrismaClient } = require('@prisma/client');
const Decimal = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const prisma = new PrismaClient();

async function auditBalances() {
  console.log('🔍 Iniciando Auditoría de Integridad de Cuentas Corrientes (Libro Mayor AccountLedger)...');
  const shouldFix = process.argv.includes('--fix');

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        p."outstandingBalance"::text AS bd_balance,
        COALESCE(
          SUM(CASE WHEN l."entryType" = 'DEBIT' THEN l.amount ELSE -l.amount END),
          0
        )::text AS ledger_balance,
        COUNT(l.id)::int AS ledger_count
      FROM "Persona" p
      LEFT JOIN "AccountLedger" l ON l."personaId" = p.id
      WHERE p."isActive" = true
      GROUP BY p.id, p.name, p."outstandingBalance"
      ORDER BY p.id ASC
    `;

    const totalInspected = rows.length;
    let mismatchesCount = 0;
    let fixedCount = 0;

    for (const row of rows) {
      const currentBalance = new Decimal(row.bd_balance || '0').toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      const ledgerBalance = new Decimal(row.ledger_balance || '0').toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
      const diff = currentBalance.minus(ledgerBalance);

      if (!diff.isZero()) {
        mismatchesCount++;
        console.warn(`⚠️ DESCUADRE DETECTADO - Persona ID ${row.id} (${row.name}):`);
        console.warn(
          `   Saldo en BD: $${currentBalance.toFixed(0)} | Libro Mayor (${row.ledger_count} asientos): $${ledgerBalance.toFixed(0)} | Diferencia: $${diff.toFixed(0)}`,
        );

        if (shouldFix) {
          await prisma.persona.update({
            where: { id: row.id },
            data: { outstandingBalance: ledgerBalance.toNumber() },
          });
          fixedCount++;
          console.log(`   ✅ Saldo autoreparado según AccountLedger a $${ledgerBalance.toFixed(0)}`);
        }
      }
    }

    console.log('\n📊 RESUMEN DE AUDITORÍA:');
    console.log(`- Personas Inspeccionadas: ${totalInspected}`);
    console.log(`- Cuentas con Descuadre vs AccountLedger: ${mismatchesCount}`);
    if (shouldFix) {
      console.log(`- Cuentas Corregidas: ${fixedCount}`);
    } else if (mismatchesCount > 0) {
      console.log('💡 Tip: Para reparar automáticamente los saldos desfasados ejecute: node scripts/audit_balances.js --fix');
    } else {
      console.log('🎉 ¡Todas las cuentas corrientes cuadran al 100% con el Libro Mayor (AccountLedger)!');
    }
  } catch (error) {
    console.error('❌ Error ejecutando la auditoría de saldos:', error.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

auditBalances();
