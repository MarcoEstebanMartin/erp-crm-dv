const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runAudit() {
  const shouldFix = process.argv.includes('--fix');
  console.log('🔍 Iniciando Auditoría General de Integridad de Recibos y Rendiciones...');
  if (shouldFix) {
    console.log('🛠️  Modo --fix activado (solo corrige estados de FieldReceipt seguros).');
  }

  let totalIssues = 0;
  let fixedCount = 0;

  try {
    // 1. Recibos de calle con todos los pagos CLEARED pero sin status VERIFIED
    const shouldBeVerified = await prisma.$queryRaw`
      SELECT fr.id, fr."receiptNumber", fr.status
      FROM "FieldReceipt" fr
      WHERE fr.status NOT IN ('VOIDED', 'VERIFIED')
        AND EXISTS (SELECT 1 FROM "FieldReceiptPayment" p WHERE p."fieldReceiptId" = fr.id AND p.status = 'CLEARED')
        AND NOT EXISTS (SELECT 1 FROM "FieldReceiptPayment" p WHERE p."fieldReceiptId" = fr.id AND p.status IN ('IN_TRANSIT', 'PENDING_BANK'))
      ORDER BY fr.id
    `;
    if (shouldBeVerified.length > 0) {
      totalIssues += shouldBeVerified.length;
      console.warn(`⚠️  [1] ${shouldBeVerified.length} recibo(s) con pagos acreditados pero sin pasar a VERIFIED:`);
      for (const r of shouldBeVerified) {
        console.warn(`   - ID ${r.id} (${r.receiptNumber || 'S/N'}) estado actual: ${r.status}`);
        if (shouldFix) {
          await prisma.fieldReceipt.update({ where: { id: r.id }, data: { status: 'VERIFIED' } });
          fixedCount++;
          console.log(`     ✅ Actualizado a VERIFIED`);
        }
      }
    }

    // 2. Recibos de calle con todos los pagos REJECTED pero sin status VOIDED
    const allRejectedNotVoided = await prisma.$queryRaw`
      SELECT fr.id, fr."receiptNumber", fr.status
      FROM "FieldReceipt" fr
      WHERE fr.status <> 'VOIDED'
        AND EXISTS (SELECT 1 FROM "FieldReceiptPayment" p WHERE p."fieldReceiptId" = fr.id AND p.status = 'REJECTED')
        AND NOT EXISTS (SELECT 1 FROM "FieldReceiptPayment" p WHERE p."fieldReceiptId" = fr.id AND p.status <> 'REJECTED')
      ORDER BY fr.id
    `;
    if (allRejectedNotVoided.length > 0) {
      totalIssues += allRejectedNotVoided.length;
      console.warn(`⚠️  [2] ${allRejectedNotVoided.length} recibo(s) con todos sus pagos REJECTED pero no marcados VOIDED:`);
      for (const r of allRejectedNotVoided) {
        console.warn(`   - ID ${r.id} (${r.receiptNumber || 'S/N'}) estado actual: ${r.status}`);
        if (shouldFix) {
          await prisma.fieldReceipt.update({
            where: { id: r.id },
            data: { status: 'VOIDED', voidReason: 'Todos los medios de pago fueron rechazados', voidedAt: new Date() },
          });
          fixedCount++;
          console.log(`     ✅ Actualizado a VOIDED`);
        }
      }
    }

    // 3. Recibos VERIFIED que todavía tienen pagos pendientes
    const verifiedWithPending = await prisma.$queryRaw`
      SELECT fr.id, fr."receiptNumber"
      FROM "FieldReceipt" fr
      WHERE fr.status = 'VERIFIED'
        AND EXISTS (SELECT 1 FROM "FieldReceiptPayment" p WHERE p."fieldReceiptId" = fr.id AND p.status IN ('IN_TRANSIT', 'PENDING_BANK'))
    `;
    if (verifiedWithPending.length > 0) {
      totalIssues += verifiedWithPending.length;
      console.warn(`⚠️  [3] ${verifiedWithPending.length} recibo(s) VERIFIED con pagos aún pendientes:`, verifiedWithPending);
    }

    // 4. Desfase entre FieldReceipt.status y Transaction espejo
    const mirrorMismatch = await prisma.$queryRaw`
      SELECT fr.id, fr."receiptNumber", fr.status AS receipt_status, t.id AS tx_id, t.verified AS tx_verified
      FROM "FieldReceipt" fr
      LEFT JOIN "Transaction" t ON t.id = fr."transactionId"
      WHERE fr.status <> 'VOIDED'
        AND (
          (fr.status = 'VERIFIED' AND (t.id IS NULL OR t.verified = false))
          OR (fr.status IN ('ISSUED', 'PENDING_VERIFICATION') AND t.verified = true)
        )
    `;
    if (mirrorMismatch.length > 0) {
      totalIssues += mirrorMismatch.length;
      console.warn(`⚠️  [4] ${mirrorMismatch.length} recibo(s) con desfase respecto a su Transaction espejo:`, mirrorMismatch);
    }

    // 5. Rendiciones cerradas con pagos todavía IN_TRANSIT
    const closedWithInTransit = await prisma.$queryRaw`
      SELECT cs.id AS settlement_id, fr.id AS receipt_id, fr."receiptNumber", p.id AS payment_id
      FROM "CollectorSettlement" cs
      JOIN "FieldReceipt" fr ON fr."settlementId" = cs.id
      JOIN "FieldReceiptPayment" p ON p."fieldReceiptId" = fr.id
      WHERE cs.status IN ('APPROVED', 'DISCREPANCY')
        AND fr.status <> 'VOIDED'
        AND p.status = 'IN_TRANSIT'
    `;
    if (closedWithInTransit.length > 0) {
      totalIssues += closedWithInTransit.length;
      console.warn(`⚠️  [5] ${closedWithInTransit.length} pago(s) IN_TRANSIT dentro de rendiciones ya cerradas:`, closedWithInTransit);
    }

    // 6. Recibos de oficina sin verificar dentro de cajas cerradas
    const officeUnverifiedClosed = await prisma.$queryRaw`
      SELECT t.id, t."receiptNumber", t."cashDrawerId"
      FROM "Transaction" t
      JOIN "CashDrawer" cd ON cd.id = t."cashDrawerId"
      WHERE t.type = 'INCOME' AND t.verified = false AND cd.status = 'CLOSED'
    `;
    if (officeUnverifiedClosed.length > 0) {
      totalIssues += officeUnverifiedClosed.length;
      console.warn(`⚠️  [6] ${officeUnverifiedClosed.length} recibo(s) de oficina sin verificar en caja cerrada:`, officeUnverifiedClosed);
    }

    // 7. Recibos anulados que todavía apuntan a una Transaction espejo activa
    const voidedWithActiveTx = await prisma.$queryRaw`
      SELECT fr.id, fr."receiptNumber", fr."transactionId"
      FROM "FieldReceipt" fr
      JOIN "Transaction" t ON t.id = fr."transactionId"
      WHERE fr.status = 'VOIDED'
    `;
    if (voidedWithActiveTx.length > 0) {
      totalIssues += voidedWithActiveTx.length;
      console.warn(`⚠️  [7] ${voidedWithActiveTx.length} recibo(s) VOIDED con Transaction espejo aún activa:`, voidedWithActiveTx);
    }

    // 8. Recibos VERIFIED cuyo totalAmount difiere de la suma de pagos CLEARED
    const totalMismatch = await prisma.$queryRaw`
      SELECT fr.id, fr."receiptNumber", fr."totalAmount",
        COALESCE((SELECT SUM(p.amount) FROM "FieldReceiptPayment" p WHERE p."fieldReceiptId" = fr.id AND p.status = 'CLEARED'), 0) AS cleared_sum
      FROM "FieldReceipt" fr
      WHERE fr.status = 'VERIFIED'
        AND fr."totalAmount" <> COALESCE((SELECT SUM(p.amount) FROM "FieldReceiptPayment" p WHERE p."fieldReceiptId" = fr.id AND p.status = 'CLEARED'), 0)
    `;
    if (totalMismatch.length > 0) {
      totalIssues += totalMismatch.length;
      console.warn(`⚠️  [8] ${totalMismatch.length} recibo(s) VERIFIED con diferencia entre totalAmount y pagos acreditados:`, totalMismatch);
    }

    // 9. Recibos VERIFIED sin asiento en AccountLedger
    const missingLedger = await prisma.$queryRaw`
      SELECT fr.id, fr."receiptNumber", fr."transactionId"
      FROM "FieldReceipt" fr
      WHERE fr.status = 'VERIFIED'
        AND fr."transactionId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "AccountLedger" al WHERE al."transactionId" = fr."transactionId")
    `;
    if (missingLedger.length > 0) {
      totalIssues += missingLedger.length;
      console.warn(`⚠️  [9] ${missingLedger.length} recibo(s) VERIFIED sin asiento en AccountLedger:`, missingLedger);
    }

    console.log('\n📊 RESUMEN DE AUDITORÍA DE RECIBOS:');
    console.log(`- Controles ejecutados: 9`);
    console.log(`- Inconsistencias detectadas: ${totalIssues}`);
    if (shouldFix) {
      console.log(`- Estados corregidos automáticamente: ${fixedCount}`);
    } else if (totalIssues > 0) {
      console.log('💡 Tip: Para corregir automáticamente estados seguros ejecutá: npm run db:audit-receipts -- --fix');
    } else {
      console.log('🎉 ¡Todos los recibos, rendiciones y asientos están 100% consistentes!');
    }

    if (totalIssues > 0 && !shouldFix) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Error ejecutando la auditoría de recibos:', error.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runAudit();
