const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const p74 = await prisma.product.findFirst({ where: { sku: '0074' } });
  console.log('SKU 0074 en PostgreSQL DB:', JSON.stringify(p74, null, 2));

  const p131 = await prisma.product.findFirst({ where: { sku: '0131' } });
  console.log('SKU 0131 en PostgreSQL DB:', JSON.stringify(p131, null, 2));

  await prisma.$disconnect();
}

check().catch(console.error);
