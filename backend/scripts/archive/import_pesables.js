const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const prisma = new PrismaClient();

async function main() {
  const workbook = xlsx.readFile('C:/Users/Usuario/Desktop/ERP-CRM DV/IDUO/Productos.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);

  for (const row of data) {
    const sku = row['SKU'] ? String(row['SKU']).padStart(4, '0') : null;
    const isPesable = row['PESABLE']?.toUpperCase() === 'SI';
    const approxWeight = row['PESO HORMA APROX.'] ? Number(row['PESO HORMA APROX.']) : 0;
    const cost = row['COSTO'] ? Number(row['COSTO']) : 0;
    const price = row['PRECIO SIN IVA'] ? Number(row['PRECIO SIN IVA']) : 0;
    const name = row['PRODUCTO'];
    
    if (sku && name) {
      // Find rubro if exists, create if not
      let rubroId = null;
      if (row['RUBRO']) {
        let rubro = await prisma.rubro.findUnique({ where: { name: row['RUBRO'] } });
        if (!rubro) {
          const rentabilidad = row['RENTABILIDAD'] ? Number(row['RENTABILIDAD']) : 1.25;
          rubro = await prisma.rubro.create({
            data: {
              name: row['RUBRO'],
              profitMargin: rentabilidad
            }
          });
        }
        rubroId = rubro.id;
      }

      await prisma.product.upsert({
        where: { sku: sku },
        update: {
          name: name,
          isPesable: isPesable,
          approximateWeight: approxWeight,
          costPrice: cost,
          listPrice: price,
          rubroId: rubroId
        },
        create: {
          sku: sku,
          name: name,
          isPesable: isPesable,
          approximateWeight: approxWeight,
          costPrice: cost,
          listPrice: price,
          rubroId: rubroId,
          stock: 0,
          minStock: 0
        }
      });
      console.log(`Updated/Created SKU ${sku}: ${name} (Pesable: ${isPesable}, Approx: ${approxWeight})`);
    }
  }

  console.log('Import completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
