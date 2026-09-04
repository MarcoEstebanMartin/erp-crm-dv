const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncFromMaestro() {
  const maestroPath = path.resolve(__dirname, '../../Maestro.xlsx');
  if (!fs.existsSync(maestroPath)) {
    console.error('❌ Archivo Maestro.xlsx no encontrado.');
    return;
  }

  console.log('📊 Leyendo Maestro.xlsx...');
  const workbook = xlsx.readFile(maestroPath);
  const sheet = workbook.Sheets['Productos'];
  if (!sheet) {
    console.error('❌ Hoja "Productos" no encontrada en Maestro.xlsx');
    return;
  }

  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
  console.log(`📦 Se encontraron ${rows.length} filas en la hoja Productos de Maestro.xlsx`);

  const masterPhotoDir = path.resolve(__dirname, '../../ARCHIVOS/fotos/Productos');
  const targetUploadDir = path.resolve(__dirname, '../uploads/products');
  if (!fs.existsSync(targetUploadDir)) {
    fs.mkdirSync(targetUploadDir, { recursive: true });
  }

  const masterPhotoFiles = fs.readdirSync(masterPhotoDir);
  const masterPhotoSet = new Set(masterPhotoFiles);

  const existingProducts = await prisma.product.findMany();
  const skuMap = new Map(existingProducts.map(p => [p.sku.trim(), p]));
  const nameMap = new Map(existingProducts.map(p => [p.name.trim().toLowerCase(), p]));

  const updatePromises = [];
  const createPromises = [];

  for (const row of rows) {
    if (!row.PRODUCTO || row.SKU === null || row.SKU === undefined) continue;

    let sku = String(row.SKU).trim();
    if (!isNaN(sku) && sku.length > 0) {
      sku = sku.padStart(4, '0');
    }

    const productName = String(row.PRODUCTO).trim();
    const barcode = row['COD.BARRAS'] ? String(row['COD.BARRAS']).trim() : null;
    const costPrice = Number(row.COSTO || 0);
    const listPrice = Number(row['PRECIO FINAL'] || row['PRECIO SIN IVA'] || 0);
    const isPesable = String(row.PESABLE || '').toUpperCase().includes('SI');
    const approximateWeight = row['PESO APROXIMADO'] ? Number(row['PESO APROXIMADO']) : null;
    const unitsPerBox = row['UNIDADES POR CAJA'] ? Number(row['UNIDADES POR CAJA']) : 1;
    const minOrderQuantity = row['MINIMO VENTA'] ? Number(row['MINIMO VENTA']) : 1;

    const targetFileName = `${sku}.jpg`;
    let sourceFileName = masterPhotoSet.has(targetFileName) ? targetFileName : null;

    if (sourceFileName) {
      const srcPath = path.join(masterPhotoDir, sourceFileName);
      const dstPath = path.join(targetUploadDir, targetFileName);
      try {
        fs.copyFileSync(srcPath, dstPath);
      } catch (e) {}
    }

    const imageUrl = sourceFileName ? `/uploads/products/${targetFileName}` : null;
    const existing = skuMap.get(sku) || nameMap.get(productName.toLowerCase());

    if (existing) {
      updatePromises.push(
        prisma.product.update({
          where: { id: existing.id },
          data: {
            sku: sku,
            name: productName,
            barcode: barcode || existing.barcode,
            costPrice: costPrice > 0 ? costPrice : existing.costPrice,
            listPrice: listPrice > 0 ? listPrice : existing.listPrice,
            isPesable: isPesable,
            approximateWeight: approximateWeight,
            unitsPerBox: unitsPerBox,
            minOrderQuantity: minOrderQuantity,
            imageUrl: imageUrl || existing.imageUrl
          }
        }).catch(() => {
          return prisma.product.update({
            where: { id: existing.id },
            data: {
              sku: sku,
              name: productName,
              costPrice: costPrice > 0 ? costPrice : existing.costPrice,
              listPrice: listPrice > 0 ? listPrice : existing.listPrice,
              isPesable: isPesable,
              approximateWeight: approximateWeight,
              unitsPerBox: unitsPerBox,
              minOrderQuantity: minOrderQuantity,
              imageUrl: imageUrl || existing.imageUrl
            }
          });
        })
      );
    } else {
      createPromises.push(
        prisma.product.create({
          data: {
            sku: sku,
            name: productName,
            description: row.SUBRUBRO || row.RUBRO || 'PRODUCTO',
            barcode: barcode,
            costPrice: costPrice,
            listPrice: listPrice,
            listPriceB: listPrice * 0.95,
            listPriceC: listPrice * 0.90,
            stock: 100,
            minStock: Number(row['STOCK MINIMO'] || 10),
            isPesable: isPesable,
            approximateWeight: approximateWeight,
            unitsPerBox: unitsPerBox,
            minOrderQuantity: minOrderQuantity,
            imageUrl: imageUrl,
            commercialCategory: row.RUBRO || 'GENERAL'
          }
        }).catch(() => {})
      );
    }
  }

  console.log(`⏳ Procesando ${updatePromises.length} actualizaciones y ${createPromises.length} creaciones en paralelo...`);
  
  const batchSize = 30;
  for (let i = 0; i < updatePromises.length; i += batchSize) {
    await Promise.all(updatePromises.slice(i, i + batchSize));
  }
  for (let i = 0; i < createPromises.length; i += batchSize) {
    await Promise.all(createPromises.slice(i, i + batchSize));
  }

  console.log(`\n⚡ ¡Sincronización con Maestro.xlsx Completada Exitosamente!`);
  console.log(`   - Actualizados: ${updatePromises.length}`);
  console.log(`   - Creados: ${createPromises.length}`);

  await prisma.$disconnect();
}

syncFromMaestro().catch(console.error);
