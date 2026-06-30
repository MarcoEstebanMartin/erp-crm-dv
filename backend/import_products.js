require('dotenv').config();
const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function importProducts() {
  const filePath = path.join(__dirname, '..', 'IDUO', 'Productos.xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  console.log(`Leyendo ${data.length} productos del archivo Excel...`);

  let countNew = 0;
  let countUpdated = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const productName = row['Producto']?.trim();
    if (!productName) continue;

    let rawRubro = row['Rubro']?.trim() || 'OTROS';
    let cleanRubro = rawRubro.replace(/^\d+\s*-\s*/, '').trim().toUpperCase();

    let rubro = await prisma.rubro.findUnique({ where: { name: cleanRubro } });
    if (!rubro) {
      rubro = await prisma.rubro.create({
        data: { name: cleanRubro, description: cleanRubro }
      });
    }

    let precio = parseFloat(row['PRECIO FINAL']) || 0;
    precio = Math.round(precio);

    const existingProduct = await prisma.product.findFirst({
      where: { name: productName }
    });

    if (existingProduct) {
      await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          listPrice: precio,
          rubroId: rubro.id,
          costPrice: Math.round(Number(existingProduct.costPrice)),
          listPriceB: Math.round(Number(existingProduct.listPriceB)),
          listPriceC: Math.round(Number(existingProduct.listPriceC))
        }
      });
      countUpdated++;
    } else {
      const sku = 'SKU-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await prisma.product.create({
        data: {
          sku: sku,
          name: productName,
          listPrice: precio,
          costPrice: 0,
          rubroId: rubro.id,
          stock: 0,
          minStock: 0,
          description: row['Subrubro'] ? row['Subrubro'].trim() : null
        }
      });
      countNew++;
    }
  }

  const allProducts = await prisma.product.findMany();
  for (const prod of allProducts) {
    const pCosto = Math.round(Number(prod.costPrice));
    const pVenta = Math.round(Number(prod.listPrice));
    const pB = Math.round(Number(prod.listPriceB));
    const pC = Math.round(Number(prod.listPriceC));
    if (
      Number(prod.costPrice) !== pCosto ||
      Number(prod.listPrice) !== pVenta ||
      Number(prod.listPriceB) !== pB ||
      Number(prod.listPriceC) !== pC
    ) {
      await prisma.product.update({
        where: { id: prod.id },
        data: {
          costPrice: pCosto,
          listPrice: pVenta,
          listPriceB: pB,
          listPriceC: pC
        }
      });
    }
  }

  console.log(`Importación finalizada. Nuevos: ${countNew}, Actualizados: ${countUpdated}. Precios redondeados.`);
  await prisma.$disconnect();
}

importProducts().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
