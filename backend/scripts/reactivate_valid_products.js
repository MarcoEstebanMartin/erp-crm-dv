const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando reactivación de productos válidos según Maestro.xlsx...');

  const maestroPath = path.resolve(__dirname, '../../Maestro.xlsx');
  if (!fs.existsSync(maestroPath)) {
    console.error('❌ Archivo Maestro.xlsx no encontrado.');
    return;
  }

  const wb = xlsx.readFile(maestroPath);
  const sheet = wb.Sheets['Productos'];
  if (!sheet) {
    console.error('❌ Hoja "Productos" no encontrada.');
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

  console.log(`📊 Total de SKUs válidos en Maestro.xlsx: ${validExcelSkus.size}`);

  const inactiveProducts = await prisma.product.findMany({
    where: { isActive: false }
  });

  console.log(`🔎 Total de productos inactivos en BD: ${inactiveProducts.length}`);

  let reactivatedCount = 0;
  let remainingInactiveCount = 0;

  for (const prod of inactiveProducts) {
    const skuClean = prod.sku.trim();
    if (validExcelSkus.has(skuClean)) {
      await prisma.product.update({
        where: { id: prod.id },
        data: { isActive: true }
      });
      console.log(`✅ Reactivado SKU ${prod.sku} - ${prod.name}`);
      reactivatedCount++;
    } else {
      console.log(`⏸️ Mantenido inactivo (No está en Excel): SKU ${prod.sku} - ${prod.name}`);
      remainingInactiveCount++;
    }
  }

  console.log(`\n🎉 Resumen:`);
  console.log(`   - Reactivados con éxito: ${reactivatedCount}`);
  console.log(`   - Permanecen inactivos (quitados del Excel): ${remainingInactiveCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en script de reactivación:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
