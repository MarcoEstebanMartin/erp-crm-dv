const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      id: { gte: 160, lte: 252 }
    },
    orderBy: { id: 'asc' },
    select: { id: true, sku: true, name: true, commercialCategory: true }
  });

  console.log(`Products between ID 160 and 252: total ${products.length}`);
  products.forEach((p, idx) => {
    console.log(`Page ${idx + 1} -> ID: ${p.id}, SKU: '${p.sku}', Name: '${p.name}'`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
