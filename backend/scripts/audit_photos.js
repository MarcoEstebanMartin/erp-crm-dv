const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditPhotos() {
  console.log('🔍 AUDITORÍA AUTOMÁTICA DE INTEGRIDAD DE IMÁGENES');

  const masterDir = path.resolve(__dirname, '../../ARCHIVOS/fotos/Productos');
  const uploadDir = path.resolve(__dirname, '../uploads/products');

  const masterFiles = new Set(fs.existsSync(masterDir) ? fs.readdirSync(masterDir) : []);
  const products = await prisma.product.findMany();

  let okCount = 0;
  let missingCount = 0;
  let corruptCount = 0;

  for (const p of products) {
    if (!p.sku) continue;
    const cleanSku = p.sku.trim();
    const padSku = cleanSku.padStart(4, '0');
    const fileName = `${padSku}.jpg`;

    const masterPath = path.join(masterDir, fileName);
    const uploadPath = path.join(uploadDir, fileName);

    const inMaster = masterFiles.has(fileName);
    const inUpload = fs.existsSync(uploadPath);

    if (inMaster && inUpload) {
      const size = fs.statSync(masterPath).size;
      if (size > 5000) {
        okCount++;
      } else {
        corruptCount++;
        console.log(`⚠️ Foto corrupta o miniatura sospechosa (<5KB): SKU ${padSku} (${p.name}) | Tamaño: ${size} bytes`);
      }
    } else if (inMaster || inUpload) {
      okCount++;
    } else {
      missingCount++;
      console.log(`❌ Foto faltante: SKU ${padSku} (${p.name}) | Master: ${inMaster} | Upload: ${inUpload}`);
    }
  }

  console.log('\n--- RESUMEN AUDITORÍA ---');
  console.log(`✅ Productos con foto 100% válida (>5KB): ${okCount}`);
  console.log(`⚠️ Productos con foto sospechosa (<5KB): ${corruptCount}`);
  console.log(`❌ Productos sin foto en carpeta maestra: ${missingCount}`);

  await prisma.$disconnect();
}

auditPhotos().catch(console.error);
