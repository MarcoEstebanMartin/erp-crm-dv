const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const lot = await prisma.productLot.findFirst({
    where: { stock: { gt: 0 } }
  });

  if (!lot) {
    console.log("No lot found with stock > 0");
    return;
  }

  console.log("Testing with lot:", lot);
}

run().finally(() => prisma.$disconnect());
