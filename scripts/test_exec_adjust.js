const { ProductService } = require('../backend/src/services/product.service');
const productService = new ProductService();
const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const lot = await prisma.productLot.findFirst({
    where: { lotNumber: '999', stock: { gt: 0 } }
  });

  if (!lot) {
    console.log("No lot 999 found with stock > 0");
    return;
  }

  console.log("Before deletion lot:", lot);

  await productService.adjustStock(
    lot.productId,
    {
      quantityChange: -lot.stock,
      reason: 'Test deletion from WMS',
      lotNumber: lot.lotNumber,
      location: lot.location
    },
    1
  );

  const check = await prisma.productLot.findUnique({
    where: { id: lot.id }
  });

  console.log("After deletion query result:", check);
}

run().finally(() => prisma.$disconnect());
