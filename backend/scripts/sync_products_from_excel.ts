import prisma from '../src/utils/prisma';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

async function main() {
  const excelPath = path.join(__dirname, '../../ARCHIVOS/IDUO/Productos.xlsx');
  console.log(`🚀 Leyendo archivo Excel desde: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet);

  console.log(`📦 Se encontraron ${rows.length} productos en el Excel.`);

  // 1. Asegurar la existencia de todos los Rubros
  const excelRubros = [...new Set(rows.map(r => (r.RUBRO || '').toString().trim()).filter(Boolean))];
  const rubroMap: Record<string, number> = {};

  for (const rName of excelRubros) {
    let rubro = await prisma.rubro.findFirst({
      where: { name: { equals: rName, mode: 'insensitive' } }
    });

    if (!rubro) {
      rubro = await prisma.rubro.create({
        data: { name: rName, description: `Rubro ${rName}` }
      });
      console.log(`✨ Creado nuevo Rubro en BD: "${rName}" (#${rubro.id})`);
    }
    rubroMap[rName.toUpperCase()] = rubro.id;
  }

  // 1.b Cargar proveedores existentes para mapear por nombre
  const existingProviders = await prisma.persona.findMany({
    where: { isProvider: true }
  });
  const providerMap: Record<string, number> = {};
  for (const prov of existingProviders) {
    providerMap[prov.name.toUpperCase()] = prov.id;
  }

  const getOrCreateProviderId = async (rawProviderName?: string): Promise<number | null> => {
    if (!rawProviderName) return null;
    const cleanName = rawProviderName.toString().trim().toUpperCase();
    if (!cleanName) return null;

    // Buscar coincidencia exacta
    if (providerMap[cleanName]) return providerMap[cleanName];

    // Buscar coincidencia parcial (ej: "REMOTTI" -> "REMOTTI S. A.")
    const matched = existingProviders.find(p => p.name.toUpperCase().includes(cleanName) || cleanName.includes(p.name.toUpperCase()));
    if (matched) {
      providerMap[cleanName] = matched.id;
      return matched.id;
    }

    // Crear proveedor si no existe
    const newProv = await prisma.persona.create({
      data: {
        name: rawProviderName.toString().trim(),
        isProvider: true,
        isClient: false,
        isActive: true
      }
    });
    console.log(`✨ Creado nuevo Proveedor en BD: "${newProv.name}" (#${newProv.id})`);
    providerMap[cleanName] = newProv.id;
    existingProviders.push(newProv);
    return newProv.id;
  };

  // Pre-resolver proveedores únicos del Excel
  const excelProviders = [...new Set(rows.map(r => (r.PROVEEDOR || '').toString().trim()).filter(Boolean))];
  for (const pName of excelProviders) {
    await getOrCreateProviderId(pName);
  }

  // Cargar SKUs existentes para saber si update o create rápido
  const existingProducts = await prisma.product.findMany({
    select: { id: true, sku: true }
  });
  const existingSkuMap = new Map(existingProducts.map(p => [p.sku, p.id]));

  let createdCount = 0;
  let updatedCount = 0;
  const categoryCounts: Record<string, number> = {};

  // Preparar todas las operaciones
  const operations = rows.map(row => {
    const rawSku = (row.SKU || '').toString().trim();
    if (!rawSku) return null;

    const sku = /^\d+$/.test(rawSku) ? rawSku.padStart(4, '0') : rawSku;
    const name = (row.PRODUCTO || '').toString().trim();
    const commercialCategory = (row.GRUPO_OFERTA || 'Varios').toString().trim();
    const costPrice = parseFloat(row.COSTO) || 0;
    const listPrice = parseFloat(row['PRECIO FINAL']) || 0;
    const profitMargin = row.RENTABILIDAD ? parseFloat(row.RENTABILIDAD) : null;
    const isPesable = (row.PESABLE || '').toString().toUpperCase().trim() === 'SI';
    const approximateWeight = row['PESO HORMA '] ? parseFloat(row['PESO HORMA ']) : (row['PESO HORMA'] ? parseFloat(row['PESO HORMA']) : (row['PESO HORMA APROX.'] ? parseFloat(row['PESO HORMA APROX.']) : null));
    const rawBarcode = (row['COD.BARRAS'] || row['CODIGO BARRAS'] || row['EAN'] || row['BARCODE'] || '').toString().trim();
    const barcode = rawBarcode && rawBarcode !== '0' ? rawBarcode : null;
    
    const rawMinQty = row['MINIMO VENTA'] || row['MINIMO_VENTA'] || row['MINIMO'] || row['MINIMO DE VENTA'] || row['MÍNIMO DE VENTA'];
    const minOrderQuantity = rawMinQty ? parseInt(rawMinQty) : undefined;
    
    const rubroName = (row.RUBRO || '').toString().trim().toUpperCase();
    const rubroId = rubroName ? (rubroMap[rubroName] || null) : null;

    const providerName = (row.PROVEEDOR || '').toString().trim().toUpperCase();
    const providerId = providerName ? (providerMap[providerName] || null) : null;

    const rawPickingZone = (row['ZONA ARMADO'] || row['ZONA_ARMADO'] || row['ZONA DE ARMADO'] || row['ZONA'] || '').toString().trim().toUpperCase();
    const pickingZone = ['FRIO', 'CAJAS', 'TABLA'].includes(rawPickingZone) ? rawPickingZone : null;

    const rawLocation = (row['SECTOR DEPOSITO'] || row['AREA DEPOSITO'] || row['SECTOR_DEPOSITO'] || row['AREA_DEPOSITO'] || row['UBICACION'] || '').toString().trim();
    const defaultLocation = rawLocation && rawLocation !== '-' ? rawLocation : null;

    categoryCounts[commercialCategory] = (categoryCounts[commercialCategory] || 0) + 1;

    const existingId = existingSkuMap.get(sku);

    if (existingId) {
      updatedCount++;
      return prisma.product.update({
        where: { id: existingId },
        data: {
          name,
          commercialCategory,
          costPrice,
          listPrice,
          profitMargin,
          isPesable,
          approximateWeight,
          ...(minOrderQuantity && minOrderQuantity > 0 ? { minOrderQuantity } : {}),
          barcode,
          rubroId,
          providerId,
          ...(pickingZone ? { pickingZone } : {}),
          ...(defaultLocation ? { defaultLocation } : {}),
          isActive: true
        }
      });
    } else {
      createdCount++;
      return prisma.product.create({
        data: {
          sku,
          name,
          commercialCategory,
          costPrice,
          listPrice,
          profitMargin,
          isPesable,
          approximateWeight,
          minOrderQuantity: minOrderQuantity && minOrderQuantity > 0 ? minOrderQuantity : 1,
          barcode,
          rubroId,
          providerId,
          ...(pickingZone ? { pickingZone } : {}),
          ...(defaultLocation ? { defaultLocation } : {}),
          isActive: true
        }
      });
    }
  }).filter(Boolean);

  // Ejecutar en lotes de 40 en paralelo
  const batchSize = 40;
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    await Promise.all(batch);
  }

  // 3. Limpiar overrides manuales en items de campañas para usar las nuevas categorías fojas
  const resetItems = await prisma.offerCampaignItem.updateMany({
    data: { campaignGroup: null }
  });

  // 4. Re-vincular automáticamente las imágenes existentes en disco por SKU
  const uploadsPath = path.join(__dirname, '../uploads/products');
  let relinkedImagesCount = 0;
  if (fs.existsSync(uploadsPath)) {
    const files = fs.readdirSync(uploadsPath);
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

    const allProducts = await prisma.product.findMany();
    const relinkPromises: Array<Promise<any>> = [];
    for (const p of allProducts) {
      const rawSku = p.sku.trim();
      let matchedFile = fileMap.get(rawSku);
      if (!matchedFile && /^\d+$/.test(rawSku)) {
        matchedFile = fileMap.get(rawSku.padStart(4, '0')) || fileMap.get(parseInt(rawSku, 10).toString());
      }
      if (matchedFile) {
        const expectedUrl = `/uploads/products/${matchedFile}`;
        if (p.imageUrl !== expectedUrl) {
          relinkedImagesCount++;
          relinkPromises.push(
            prisma.product.update({
              where: { id: p.id },
              data: { imageUrl: expectedUrl }
            })
          );
        }
      }
    }
    for (let i = 0; i < relinkPromises.length; i += 40) {
      await Promise.all(relinkPromises.slice(i, i + 40));
    }
  }

  console.log(`\n✅ ¡Sincronización completada con éxito!`);
  console.log(`   - Productos actualizados: ${updatedCount}`);
  console.log(`   - Productos creados: ${createdCount}`);
  console.log(`   - Ítems de ofertas alineados a categoría fija: ${resetItems.count}\n`);
  console.log(`📊 Distribución por Categoría Comercial (GRUPO_OFERTA):`);
  console.table(categoryCounts);
}

main()
  .catch((e) => {
    console.error('❌ Error actualizando productos desde Excel:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
