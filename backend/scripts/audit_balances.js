const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditBalances() {
  console.log('🔍 Iniciando Auditoría de Integridad de Cuentas Corrientes...');
  const shouldFix = process.argv.includes('--fix');

  try {
    const personas = await prisma.persona.findMany({
      where: { isActive: true },
      select: { id: true, name: true, isClient: true, isProvider: true, outstandingBalance: true }
    });

    let totalInspected = personas.length;
    let mismatchesCount = 0;
    let fixedCount = 0;

    for (const p of personas) {
      // 1. Obtener órdenes entregadas (deuda)
      const orders = await prisma.order.findMany({
        where: { personaId: p.id, status: 'DELIVERED' },
        select: { totalAmount: true }
      });
      const totalInvoices = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

      // 2. Obtener cobros y pagos de la cuenta
      const txs = await prisma.transaction.findMany({
        where: { personaId: p.id },
        select: { type: true, amount: true }
      });
      const totalIncome = txs.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const totalOutcome = txs.filter(t => t.type === 'OUTCOME').reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // 3. Obtener notas de crédito aprobadas
      const creditNotes = await prisma.creditNote.findMany({
        where: { personaId: p.id, status: 'APPROVED' },
        select: { totalAmount: true }
      });
      const totalCreditNotes = creditNotes.reduce((sum, cn) => sum + Number(cn.totalAmount || 0), 0);

      // Saldo teórico = Invoices - Income + Outcome - CreditNotes
      const theoreticalBalance = Math.round((totalInvoices - totalIncome + totalOutcome - totalCreditNotes) * 100) / 100;
      const currentBalance = Math.round(Number(p.outstandingBalance || 0) * 100) / 100;
      const diff = Math.round((currentBalance - theoreticalBalance) * 100) / 100;

      if (Math.abs(diff) > 0.05) {
        mismatchesCount++;
        console.warn(`⚠️ DESCUADRE DETECTADO - Persona ID ${p.id} (${p.name}):`);
        console.warn(`   Saldo en BD: $${currentBalance} | Saldo Teórico: $${theoreticalBalance} | Diferencia: $${diff}`);

        if (shouldFix) {
          await prisma.persona.update({
            where: { id: p.id },
            data: { outstandingBalance: theoreticalBalance }
          });
          fixedCount++;
          console.log(`   ✅ Saldo autoreparado exitosamente a $${theoreticalBalance}`);
        }
      }
    }

    console.log('\n📊 RESUMEN DE AUDITORÍA:');
    console.log(`- Personas Inspeccionadas: ${totalInspected}`);
    console.log(`- Cuentas con Descuadre: ${mismatchesCount}`);
    if (shouldFix) {
      console.log(`- Cuentas Corregidas: ${fixedCount}`);
    } else if (mismatchesCount > 0) {
      console.log('💡 Tip: Para reparar automáticamente los saldos desfasados ejecute: node scripts/audit_balances.js --fix');
    } else {
      console.log('🎉 ¡Todas las cuentas corrientes están 100% integras y sin desfasajes!');
    }
  } catch (error) {
    console.error('❌ Error ejecutando la auditoría de saldos:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

auditBalances();
