const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const jsonPath = path.join(__dirname, 'excel_products.json');
  const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  console.log(`Starting bulk import of ${products.length} products...`);

  // 1. Manage Rubros
  const rubroMap = new Map();
  const existingRubros = await prisma.rubro.findMany();
  existingRubros.forEach(r => rubroMap.set(r.name.toUpperCase(), r.id));

  const uniqueRubros = [...new Set(products.map(p => p.rubroName).filter(Boolean))];
  for (const rName of uniqueRubros) {
    const rKey = rName.toUpperCase();
    if (!rubroMap.has(rKey)) {
      const matchP = products.find(p => p.rubroName === rName);
      const created = await prisma.rubro.create({
        data: {
          name: rName,
          pickingZone: matchP ? matchP.pickingZone : 'CAJAS'
        }
      });
      rubroMap.set(rKey, created.id);
    }
  }

  // 2. Map existing SKUs & Barcodes
  const existingProducts = await prisma.product.findMany({ select: { id: true, sku: true, barcode: true } });
  const existingSkuSet = new Set(existingProducts.map(p => p.sku));
  const existingBarcodes = new Set(existingProducts.map(p => p.barcode).filter(Boolean));

  const toCreate = [];
  const toUpdate = [];

  for (const p of products) {
    const rubroId = p.rubroName ? rubroMap.get(p.rubroName.toUpperCase()) : null;

    let safeBarcode = p.barcode;
    if (safeBarcode && existingBarcodes.has(safeBarcode)) {
      const matchP = existingProducts.find(ep => ep.sku === p.sku);
      if (!matchP || matchP.barcode !== safeBarcode) {
        safeBarcode = null;
      }
    }
    if (safeBarcode) {
      existingBarcodes.add(safeBarcode);
    }

    const payload = {
      sku: p.sku,
      name: p.name,
      pickingZone: p.pickingZone,
      defaultLocation: p.defaultLocation || 'S/U',
      isPesable: p.isPesable,
      approximateWeight: p.approximateWeight,
      minStock: p.minStock || 0,
      unitsPerBox: p.unitsPerBox || 1,
      minOrderQuantity: p.minOrderQuantity || 1,
      costPrice: p.costPrice || 0,
      listPrice: p.listPrice || 0,
      listPriceB: Math.round((p.listPrice || 0) * 1.05 * 100) / 100,
      listPriceC: Math.round((p.listPrice || 0) * 1.10 * 100) / 100,
      commercialCategory: p.commercialCategory,
      barcode: safeBarcode,
      rubroId: rubroId,
      stock: 100,
      isActive: true
    };

    if (existingSkuSet.has(p.sku)) {
      toUpdate.push(payload);
    } else {
      toCreate.push(payload);
    }
  }

  if (toCreate.length > 0) {
    const res = await prisma.product.createMany({
      data: toCreate,
      skipDuplicates: true
    });
    console.log(`Successfully batch-created ${res.count} new products!`);
  }

  if (toUpdate.length > 0) {
    console.log(`Updating ${toUpdate.length} existing products...`);
    for (const p of toUpdate) {
      const { sku, ...data } = p;
      await prisma.product.update({
        where: { sku },
        data
      });
    }
  }

  console.log('--- Product Import Finished Successfully ---');
}

main()
  .catch(e => {
    console.error('Import error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
