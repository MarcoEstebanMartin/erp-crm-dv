const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function purgeOrphanInactiveProducts() {
  console.log('🧹 Iniciando depuración definitiva de productos inactivos sin historial comercial...');

  const maestroPath = path.resolve(__dirname, '../../Maestro.xlsx');
  if (!fs.existsSync(maestroPath)) {
    console.error('❌ Archivo Maestro.xlsx no encontrado en la raíz.');
    return;
  }

  const wb = xlsx.readFile(maestroPath);
  const sheet = wb.Sheets['Productos'];
  if (!sheet) {
    console.error('❌ Hoja "Productos" no encontrada en Maestro.xlsx');
    return;
  }

  const rows = xlsx.utils.sheet_to_json(sheet);
  const validExcelSkus = new Set();

  rows.forEach((r) => {
    if (r.SKU !== undefined && r.SKU !== null) {
      let sku = String(r.SKU).trim();
      if (!isNaN(Number(sku)) && sku.length > 0) {
        sku = sku.padStart(4, '0');
      }
      validExcelSkus.add(sku);
    }
  });

  console.log(`📊 SKUs válidos en Maestro.xlsx: ${validExcelSkus.size}`);

  const inactiveProducts = await prisma.product.findMany({
    where: { isActive: false },
    include: {
      _count: {
        select: {
          orderItems: true,
          purchaseOrderItems: true,
          creditNoteItems: true
        }
      }
    }
  });

  console.log(`🔎 Encontrados ${inactiveProducts.length} productos inactivos en DB.`);

  let deletedCount = 0;
  let skippedCount = 0;

  for (const prod of inactiveProducts) {
    const skuClean = prod.sku.trim();

    // Si NO está en Maestro.xlsx
    if (!validExcelSkus.has(skuClean)) {
      const hasCommercialHistory =
        prod._count.orderItems > 0 ||
        prod._count.purchaseOrderItems > 0 ||
        (prod._count.creditNoteItems || 0) > 0;

      if (!hasCommercialHistory) {
        // Borrar movimientos iniciales de seed y lotes asociados
        await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
        await prisma.productLot.deleteMany({ where: { productId: prod.id } });
        await prisma.product.delete({ where: { id: prod.id } });
        console.log(`🗑️ Eliminado producto huérfano: SKU ${prod.sku} - ${prod.name}`);
        deletedCount++;
      } else {
        console.log(`⚠️ Conservado inactivo por tener historial de ventas: SKU ${prod.sku} - ${prod.name}`);
        skippedCount++;
      }
    }
  }

  const finalActiveCount = await prisma.product.count({ where: { isActive: true } });
  const finalInactiveCount = await prisma.product.count({ where: { isActive: false } });
  const finalTotalCount = await prisma.product.count();

  console.log(`\n🎉 Depuración completada con éxito:`);
  console.log(`   - Productos eliminados definitivamente: ${deletedCount}`);
  console.log(`   - Productos inactivos conservados con ventas: ${skippedCount}`);
  console.log(`   - Total Productos en DB: ${finalTotalCount} (Activos: ${finalActiveCount} | Inactivos: ${finalInactiveCount})`);
}

purgeOrphanInactiveProducts()
  .catch((e) => {
    console.error('❌ Error durante la depuración:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
