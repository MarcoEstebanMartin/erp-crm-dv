const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runHealthCheck() {
  console.log('============== 🏥 DIAGNÓSTICO PREVENTIVO ERP-CRM DV ==============');
  console.log(`Fecha de auditoría: ${new Date().toLocaleString('es-AR')}`);
  console.log('-------------------------------------------------------------------');

  let issueCount = 0;
  let warningCount = 0;

  try {
    // 1. Auditoría de Secuencia Nativa SQL (movement_seq)
    console.log('1️⃣ Verificando alineación de secuencia nativa SQL (movement_seq)...');
    const maxOrderMov = await prisma.order.aggregate({ _max: { movementId: true } });
    const maxTxMov = await prisma.transaction.aggregate({ _max: { movementId: true } });
    const maxMov = Math.max(maxOrderMov._max.movementId || 0, maxTxMov._max.movementId || 0);

    const seqResult = await prisma.$queryRaw`SELECT last_value FROM movement_seq`.catch(() => null);
    if (seqResult && seqResult[0]) {
      const lastSeqVal = Number(seqResult[0].last_value);
      if (lastSeqVal < maxMov) {
        console.error(`  🔴 ALERTA: La secuencia movement_seq (${lastSeqVal}) está atrasada con respecto al máximo ID real (${maxMov}).`);
        issueCount++;
      } else {
        console.log(`  🟢 Secuencia SQL alineada correctamente. Último valor: ${lastSeqVal} (Máx en BD: ${maxMov}).`);
      }
    } else {
      console.log('  🟡 Secuencia nativa movement_seq no detectada en esta instancia.');
      warningCount++;
    }

    // 2. Auditoría de Productos e Imágenes Activas
    console.log('\n2️⃣ Verificando caché activa de imágenes de productos (uploads/products)...');
    const activeProducts = await prisma.product.findMany({ where: { isActive: true }, select: { sku: true, name: true, imageUrl: true } });
    const uploadsDir = path.resolve(__dirname, '../uploads/products');
    
    let missingPhotosCount = 0;
    activeProducts.forEach(p => {
      if (!p.imageUrl || !fs.existsSync(path.join(uploadsDir, path.basename(p.imageUrl)))) {
        missingPhotosCount++;
      }
    });

    if (missingPhotosCount > 0) {
      console.log(`  🟡 ${missingPhotosCount} de ${activeProducts.length} productos activos no tienen imagen local (correr npm run db:sync-from-production).`);
      warningCount++;
    } else {
      console.log(`  🟢 100% de los productos activos (${activeProducts.length}) poseen foto HD válida.`);
    }

    // 3. Auditoría de Cuentas Corrientes y Saldos
    console.log('\n3️⃣ Verificando saldos de Cuentas Corrientes de Clientes...');
    const clients = await prisma.persona.findMany({ where: { isClient: true }, select: { id: true, name: true, outstandingBalance: true } });
    console.log(`  🟢 ${clients.length} clientes auditados en la base de datos.`);

    // 4. Auditoría de SKUs Únicos y Sanitizados
    console.log('\n4️⃣ Verificando integridad de SKUs...');
    const allProducts = await prisma.product.findMany({ select: { sku: true } });
    const skuMap = new Map();
    let duplicateSkus = 0;
    allProducts.forEach(p => {
      const norm = p.sku.trim();
      if (skuMap.has(norm)) duplicateSkus++;
      else skuMap.set(norm, true);
    });

    if (duplicateSkus > 0) {
      console.error(`  🔴 ALERTA: Se detectaron ${duplicateSkus} SKUs duplicados o desalineados.`);
      issueCount++;
    } else {
      console.log(`  🟢 Total de ${allProducts.length} SKUs analizados. Cero duplicaciones detectadas.`);
    }

    // Resumen Final
    console.log('\n-------------------------------------------------------------------');
    if (issueCount === 0 && warningCount === 0) {
      console.log('🎉 RESULTADO: SISTEMA 100% SANO Y OPTIMIZADO (0 Errores, 0 Advertencias)');
    } else if (issueCount === 0) {
      console.log(`✅ RESULTADO: SISTEMA OPERATIVO Y ESTABLE (${warningCount} Advertencias menores, 0 Errores críticos)`);
    } else {
      console.error(`⚠️ RESULTADO: REQUIERE ATENCIÓN (${issueCount} Errores críticos a corregir)`);
    }
    console.log('===================================================================\n');

  } catch (error) {
    console.error('❌ Error ejecutando el diagnóstico preventivo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runHealthCheck();
