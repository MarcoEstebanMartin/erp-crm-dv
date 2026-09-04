const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Sincronizando imágenes y dejando nuevos productos en blanco...');

  const uploadsPath = path.join(__dirname, '../backend/uploads/products');
  const diskFiles = new Set(fs.readdirSync(uploadsPath));

  const products = await prisma.product.findMany();
  console.log(`📦 Productos en BD: ${products.length}`);

  const newSkus = new Set([
    '0020', '0072', '0073', '0152', '0153', '0154', '0155', '0199', '0238', 
    '0413', '0424', '0425', '0443', '0444', '0445', '0446', '0460', '0461', 
    '0488', '0540', '0541', '0542', '0543', '0544', '0567', '0568', '0576', 
    '0587', '0588', '0589', '0590', '0591', '0601', '0602', '0603', '0626'
  ]);

  let updatedCount = 0;
  let clearedCount = 0;

  const chunkSize = 50;
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (p) => {
      const rawSku = String(p.sku).trim().padStart(4, '0');

      if (newSkus.has(rawSku)) {
        // Producto NUEVO -> DEJAR EN BLANCO (imageUrl: null)
        await prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: null }
        });
        clearedCount++;
      } else {
        // Producto ORIGINAL -> Buscar su foto original exacta
        let matchedFile = null;
        for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
          const fname = `${rawSku}${ext}`;
          if (diskFiles.has(fname)) {
            matchedFile = fname;
            break;
          }
        }

        const expectedUrl = matchedFile ? `/uploads/products/${matchedFile}` : null;
        await prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: expectedUrl }
        });
        if (matchedFile) updatedCount++;
      }
    }));
  }

  console.log(`\n🎉 Sincronización de fotos finalizada:`);
  console.log(` - ${updatedCount} productos originales vinculados con su foto exacta`);
  console.log(` - ${clearedCount} productos NUEVOS dejados con foto EN BLANCO`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
