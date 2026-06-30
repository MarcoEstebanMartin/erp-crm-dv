require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function exportProducts() {
  const products = await prisma.product.findMany({
    include: { rubro: true }
  });
  
  const mapped = products.map(p => ({
    sku: p.sku,
    name: p.name,
    description: p.description,
    barcode: p.barcode,
    costPrice: Number(p.costPrice),
    listPrice: Number(p.listPrice),
    listPriceB: Number(p.listPriceB),
    listPriceC: Number(p.listPriceC),
    stock: p.stock,
    minStock: p.minStock,
    category: p.rubro ? p.rubro.name : "OTROS"
  }));
  
  const outputPath = path.join(__dirname, 'prisma', 'products_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(mapped, null, 2), 'utf8');
  console.log(`Exportados ${mapped.length} productos a products_data.json`);
  
  await prisma.$disconnect();
}

exportProducts().catch(console.error);
