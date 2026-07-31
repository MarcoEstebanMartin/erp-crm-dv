const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const masterPath = path.join(__dirname, '../../ARCHIVOS/fotos/Productos');
  const uploadsPath = path.join(__dirname, '../uploads/products');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }

  if (fs.existsSync(masterPath)) {
    const masterFiles = fs.readdirSync(masterPath);
    let restoredMaster = 0;
    masterFiles.forEach(f => {
      const srcFile = path.join(masterPath, f);
      const dstFile = path.join(uploadsPath, f);
      if (!fs.existsSync(dstFile) || fs.statSync(srcFile).size !== fs.statSync(dstFile).size) {
        fs.copyFileSync(srcFile, dstFile);
        restoredMaster++;
      }
    });
    if (restoredMaster > 0) {
      console.log(`🛡️ Sincronizadas ${restoredMaster} fotos maestras originales desde ARCHIVOS/fotos/Productos`);
    }
  }

  const files = fs.readdirSync(uploadsPath);
  console.log(`📁 Archivos de imagen en disco: ${files.length}`);

  const products = await prisma.product.findMany();
  console.log(`📦 Productos en BD: ${products.length}`);

  const fileMap = new Map();
  files.forEach(f => {
    const ext = path.extname(f).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      const base = path.basename(f, ext);
      fileMap.set(base, f);
      if (/^\d+$/.test(base)) {
        const numStr = parseInt(base, 10).toString();
        fileMap.set(numStr, f);
        fileMap.set(numStr.padStart(4, '0'), f);
      }
    }
  });

  const updates = [];
  let updatedCount = 0;

  for (const p of products) {
    const rawSku = p.sku.trim();
    let matchedFile = fileMap.get(rawSku);

    if (!matchedFile && /^\d+$/.test(rawSku)) {
      matchedFile = fileMap.get(rawSku.padStart(4, '0')) || fileMap.get(parseInt(rawSku, 10).toString());
    }

    if (matchedFile) {
      const expectedUrl = `/uploads/products/${matchedFile}`;
      if (p.imageUrl !== expectedUrl) {
        updatedCount++;
        updates.push(
          prisma.product.update({
            where: { id: p.id },
            data: { imageUrl: expectedUrl }
          })
        );
      }
    }
  }

  console.log(`⏳ Re-vinculando ${updates.length} productos con su imagen real...`);

  const batchSize = 40;
  for (let i = 0; i < updates.length; i += batchSize) {
    await Promise.all(updates.slice(i, i + batchSize));
  }

  const totalWithImg = await prisma.product.count({
    where: { imageUrl: { not: null }, NOT: { imageUrl: '' } }
  });

  console.log(`✅ ¡Proceso completado exitosamente!`);
  console.log(`   - Imágenes restauradas: ${updatedCount}`);
  console.log(`   - Total con imagen en ERP: ${totalWithImg}/${products.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
