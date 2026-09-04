const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Actualizando imágenes de productos en PostgreSQL...');

  const uploadsPath = path.join(__dirname, '../backend/uploads/products');
  const diskFiles = new Set(fs.readdirSync(uploadsPath));

  const products = await prisma.product.findMany();
  console.log(`📦 Productos en la base de datos: ${products.length}`);

  let updatedCount = 0;
  let clearedCount = 0;

  for (const p of products) {
    const rawSku = p.sku.trim().zfill ? p.sku.trim().zfill(4) : p.sku.trim().padStart(4, '0');
    
    // Lista de SKUs asignados a productos NUEVOS
    const isNewAssigned = [
      '0020', '0072', '0073', '0152', '0153', '0154', '0155', '0199', '0238', 
      '0413', '0424', '0425', '0443', '0444', '0445', '0446', '0460', '0461', 
      '0488', '0540', '0541', '0542', '0543', '0544', '0567', '0568', '0576', 
      '0587', '0588', '0589', '0590', '0591', '0601', '0602', '0603', '0626'
    ].includes(rawSku);

    if (isNewAssigned) {
      // Producto nuevo -> DEJAR IMAGEN EN BLANCO (null)
      await prisma.product.update({
        where: { id: p.id },
        data: { imageUrl: null }
      });
      clearedCount++;
    } else {
      // Producto original -> Buscar su archivo original exacto
      let matchedFile = null;
      for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
        const fname = `${rawSku}${ext}`;
        if (diskFiles.has(fname)) {
          matchedFile = fname;
          break;
        }
      }

      if (matchedFile) {
        const expectedUrl = `/uploads/products/${matchedFile}`;
        await prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: expectedUrl }
        });
        updatedCount++;
      } else {
        await prisma.product.update({
          where: { id: p.id },
          data: { imageUrl: null }
        });
      }
    }
  }

  console.log(`\n🎉 Sincronización de fotos completada:`);
  console.log(` - ${updatedCount} productos originales vinculados con su foto original exacta`);
  console.log(` - ${clearedCount} productos NUEVOS dejados con foto EN BLANCO para subir la nueva imagen`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
