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

  const changesPath = path.resolve(__dirname, '../changes.json');
  let changesMap = new Map();
  if (fs.existsSync(changesPath)) {
    const changes = JSON.parse(fs.readFileSync(changesPath, 'utf8'));
    changes.forEach(c => {
      if (c.new) changesMap.set(c.new.padStart(4, '0'), c.old ? c.old.padStart(4, '0') : null);
    });
  }

  const existingProducts = await prisma.product.findMany();
  const skuMap = new Map(existingProducts.map(p => [p.sku.trim(), p]));
  const nameMap = new Map(existingProducts.map(p => [p.name.trim().toLowerCase(), p]));

  const updates = [];
  const creates = [];

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
    let sourceFileName = null;

    if (masterPhotoSet.has(targetFileName)) {
      sourceFileName = targetFileName;
    } else if (oldCode && masterPhotoSet.has(`${oldCode}.jpg`)) {
      sourceFileName = `${oldCode}.jpg`;
    }

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
      updates.push({
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
      });
    } else {
      creates.push({
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
      });
    }
  }

  console.log(`⏳ Procesando ${updates.length} actualizaciones y ${creates.length} creaciones...`);
  
  for (const item of updates) {
    try {
      await prisma.product.update(item);
    } catch (e) {
      if (e.code === 'P2025') continue;
      try {
        const { barcode, ...dataWithoutBarcode } = item.data;
        await prisma.product.update({ where: item.where, data: dataWithoutBarcode });
      } catch (err) {
        console.warn(`[Sync Warning] No se pudo actualizar producto ID ${item.where?.id}`);
      }
    }
  }
  for (const item of creates) {
    await prisma.product.create(item);
  }

  console.log(`\n⚡ ¡Sincronización con Maestro.xlsx Completada Exitosamente!`);
  console.log(`   - Actualizados: ${updates.length}`);
  console.log(`   - Creados: ${creates.length}`);

  await prisma.$disconnect();
}

syncFromMaestro().catch(console.error);
