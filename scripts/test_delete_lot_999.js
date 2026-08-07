const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function checkLot999() {
  const lots = await prisma.productLot.findMany({
    where: {
      OR: [
        { lotNumber: '999' },
        { lotNumber: '1111' }
      ]
    },
    include: { product: true }
  });

  console.log("Found lots in DB:", lots.map(l => ({
    id: l.id,
    productId: l.productId,
    sku: l.product.sku,
    name: l.product.name,
    lotNumber: l.lotNumber,
    stock: l.stock,
    location: l.location
  })));
}

checkLot999().finally(() => prisma.$disconnect());
