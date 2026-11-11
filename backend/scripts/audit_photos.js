const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditPhotos() {
  console.log('🔍 AUDITORÍA AUTOMÁTICA DE INTEGRIDAD DE IMÁGENES ACTIVAS');

  const uploadDir = path.resolve(__dirname, '../uploads/products');
  const products = await prisma.product.findMany({ where: { isActive: true } });

  let okCount = 0;
  let missingCount = 0;
  let corruptCount = 0;

  for (const p of products) {
    if (!p.imageUrl) {
      missingCount++;
      console.log(`❌ Sin imageUrl en BD: SKU ${p.sku} (${p.name})`);
      continue;
    }

    const fileName = path.basename(p.imageUrl);
    const uploadPath = path.join(uploadDir, fileName);

    if (fs.existsSync(uploadPath)) {
      const size = fs.statSync(uploadPath).size;
      if (size > 1000) {
        okCount++;
      } else {
        corruptCount++;
        console.log(`⚠️ Foto sospechosa (<1KB): SKU ${p.sku} (${p.name}) | Tamaño: ${size} bytes`);
      }
    } else {
      missingCount++;
      console.log(`❌ Archivo faltante en uploads/products: SKU ${p.sku} (${fileName}) — correr npm run db:sync-from-production`);
    }
  }

  console.log('\n--- RESUMEN AUDITORÍA DE PRODUCTOS ACTIVOS ---');
  console.log(`✅ Productos activos con foto válida en caché local: ${okCount}`);
  console.log(`⚠️ Productos con foto sospechosa (<1KB): ${corruptCount}`);
  console.log(`❌ Productos activos sin foto: ${missingCount}`);

  await prisma.$disconnect();
}

auditPhotos().catch(console.error);
