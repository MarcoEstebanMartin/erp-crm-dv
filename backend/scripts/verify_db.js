const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.product.count({ where: { profitMargin: { not: null } } });
  console.log(`Total products with profitMargin assigned in DB: ${count}`);

  const sample = await prisma.product.findMany({
    take: 12,
    select: { sku: true, name: true, profitMargin: true, rubro: { select: { name: true } } }
  });
  console.log('Sample updated products in DB:', JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
