/**
 * Auditoría Integral Nocturna de Salud Contable y Operativa (ERP-CRM DV).
 * Ejecuta en secuencia los 3 controles oficiales:
 *   1. db_health_check.js (salud general PostgreSQL)
 *   2. audit_balances.js (paridad de cuentas corrientes vs AccountLedger)
 *   3. audit_receipts.js (9 controles de recibos de calle/oficina y cajas)
 * Finaliza con código 0 solo si todos los controles pasan sin errores.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const scripts = [
  { name: 'Salud General DB', file: 'db_health_check.js' },
  { name: 'Integridad de Saldos', file: 'audit_balances.js' },
  { name: 'Integridad de Recibos y Cajas', file: 'audit_receipts.js' },
];

const startedAt = Date.now();
const failures = [];

console.log('====================================================');
console.log(`🌙 Auditoría Nocturna ERP-CRM DV (${new Date().toISOString()})`);
console.log('====================================================');

for (const step of scripts) {
  const scriptPath = path.join(__dirname, step.file);
  console.log(`\n▶ Ejecutando: ${step.name} (${step.file})...`);
  try {
    execFileSync(process.execPath, [scriptPath], { stdio: 'inherit' });
    console.log(`✅ ${step.name}: OK`);
  } catch (err) {
    console.error(`❌ ${step.name}: FALLÓ (exit=${err.status ?? 1})`);
    failures.push(step.name);
  }
}

const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log('\n====================================================');
if (failures.length > 0) {
  console.error(`🔴 Auditoría finalizada en ${elapsedSec}s con ${failures.length} alerta(s): ${failures.join(', ')}`);
  process.exit(1);
}
console.log(`🟢 Auditoría integral aprobada al 100% en ${elapsedSec}s (0 discrepancias).`);
