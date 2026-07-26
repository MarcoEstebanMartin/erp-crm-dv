import prisma from '../src/utils/prisma';
import XLSX from 'xlsx';
import path from 'path';

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
    const approximateWeight = row['PESO HORMA APROX.'] ? parseFloat(row['PESO HORMA APROX.']) : null;
    
    const rubroName = (row.RUBRO || '').toString().trim().toUpperCase();
    const rubroId = rubroName ? (rubroMap[rubroName] || null) : null;

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
          rubroId,
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
          rubroId,
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
