const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando migración de SKUs...');
  
  const excelPath = path.resolve(__dirname, '../../ARCHIVOS/IDUO/Productos.xlsx');
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ Archivo Excel no encontrado en: ${excelPath}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { defval: null });

  const excelProducts = [];
  data.forEach(row => {
    const skuKey = Object.keys(row).find(k => k.toLowerCase().includes('sku') || k.toLowerCase().includes('codigo') || k.toLowerCase() === 'id');
    const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('producto') || k.toLowerCase().includes('nombre') || k.toLowerCase().includes('descrip'));
    
    if (skuKey && nameKey && row[skuKey] !== null && row[nameKey] !== null) {
      let rawSku = String(row[skuKey]).trim();
      let rawName = String(row[nameKey]).trim().toLowerCase();
      if (!isNaN(rawSku) && rawSku.length < 4) {
        rawSku = rawSku.padStart(4, '0');
      }
      excelProducts.push({ name: rawName, sku: rawSku });
    }
  });

  console.log(`✅ Se encontraron ${excelProducts.length} productos válidos en el Excel.`);

  const dbProducts = await prisma.product.findMany();
  console.log(`📦 Productos actuales en la BD: ${dbProducts.length}`);

  // Paso 1: Poner un prefijo temporal a TODOS los SKUs en la base de datos
  // Esto evita colisiones de "Unique constraint" cuando un producto toma el viejo SKU de otro.
  console.log('⏳ Aplicando prefijo temporal a SKUs para evitar colisiones...');
  for (const product of dbProducts) {
    if (!product.sku.startsWith('TMP_')) {
      await prisma.product.update({
        where: { id: product.id },
        data: { sku: `TMP_${product.sku}` }
      });
    }
  }

  // Volver a leer la BD con los SKUs temporales
  const tempProducts = await prisma.product.findMany();

  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  const uploadsDir = path.resolve(__dirname, '../uploads/products');

  for (const product of tempProducts) {
    const dbNameLower = product.name.trim().toLowerCase();
    const match = excelProducts.find(ep => ep.name === dbNameLower);

    const oldSku = product.sku.replace('TMP_', ''); // El SKU real viejo (para buscar la imagen)
    
    if (match) {
      const newSku = match.sku;

      if (oldSku !== newSku) {
        console.log(`🔄 Cambiando SKU para "${product.name}": ${oldSku} -> ${newSku}`);
        
        let newImageUrl = product.imageUrl;

        const possibleExtensions = ['.jpg', '.png', '.jpeg', '.webp'];
        for (const ext of possibleExtensions) {
          const oldImagePath = path.join(uploadsDir, `${oldSku}${ext}`);
          if (fs.existsSync(oldImagePath)) {
            const newImagePath = path.join(uploadsDir, `${newSku}${ext}`);
            try {
                fs.renameSync(oldImagePath, newImagePath);
                console.log(`  📸 Imagen renombrada: ${oldSku}${ext} -> ${newSku}${ext}`);
                newImageUrl = `/uploads/products/${newSku}${ext}`;
            } catch (e) {
                console.error(`  ❌ Error al renombrar imagen ${oldImagePath}:`, e.message);
            }
          }
        }

        if (product.imageUrl && product.imageUrl.includes(oldSku) && product.imageUrl === newImageUrl) {
            const ext = path.extname(product.imageUrl);
            newImageUrl = `/uploads/products/${newSku}${ext}`;
        }

        try {
          await prisma.product.update({
            where: { id: product.id },
            data: { 
                sku: newSku,
                imageUrl: newImageUrl
            }
          });
          updatedCount++;
        } catch (error) {
          console.error(`  ❌ Error al actualizar producto ${product.id} en BD:`, error.message);
        }
      } else {
        // Si el viejo y el nuevo son iguales, solo quitamos el TMP_
        await prisma.product.update({
            where: { id: product.id },
            data: { sku: oldSku }
        });
        skippedCount++;
      }
    } else {
      console.log(`⚠️  No se encontró correspondencia en Excel para: "${product.name}" (Restaurando viejo SKU: ${oldSku})`);
      await prisma.product.update({
        where: { id: product.id },
        data: { sku: oldSku }
      });
      notFoundCount++;
    }
  }

  console.log('---');
  console.log('Migración finalizada.');
  console.log(`✅ Actualizados: ${updatedCount}`);
  console.log(`⏭️  Omitidos (ya correctos): ${skippedCount}`);
  console.log(`⚠️  No encontrados en Excel: ${notFoundCount}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
