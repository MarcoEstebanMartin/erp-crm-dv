const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const lots = await prisma.productLot.findMany({
    include: { product: true }
  });
  console.log('Total ProductLots in DB:', lots.length);
  lots.forEach(l => {
    console.log(`- Lot ID ${l.id}: Product [${l.product.sku}] ${l.product.name} | Lot: ${l.lotNumber} | Stock: ${l.stock} | Loc: ${l.location}`);
  });
}

test().finally(() => prisma.$disconnect());
