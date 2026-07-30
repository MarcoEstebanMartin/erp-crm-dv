import prisma from '../src/utils/prisma';
import fs from 'fs';
import path from 'path';

async function main() {
  const uploadsPath = path.join(__dirname, '../uploads/products');
  if (!fs.existsSync(uploadsPath)) {
    console.error('❌ No existe la carpeta /uploads/products');
    return;
  }

  const files = fs.readdirSync(uploadsPath);
  console.log(`📁 Archivos de imagen encontrados en disco: ${files.length}`);

  const products = await prisma.product.findMany();
  console.log(`📦 Productos en la base de datos: ${products.length}`);

  const fileMap = new Map<string, string>();
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

  const updates: Array<Promise<any>> = [];
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

  console.log(`⏳ Vinculando ${updates.length} productos con sus imágenes en lotes...`);

  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    await Promise.all(updates.slice(i, i + batchSize));
  }

  const totalWithImg = await prisma.product.count({
    where: { imageUrl: { not: null }, NOT: { imageUrl: '' } }
  });

  console.log(`✅ ¡Proceso completado!`);
  console.log(`   - Productos re-vinculados con su foto real: ${updatedCount}`);
  console.log(`   - Total de productos con imagen en el ERP ahora: ${totalWithImg}/${products.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
