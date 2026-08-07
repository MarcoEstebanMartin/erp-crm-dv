const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning legacy defaultLocations from Product table...');
  const updated = await prisma.product.updateMany({
    where: {
      defaultLocation: { not: null }
    },
    data: {
      defaultLocation: null
    }
  });
  console.log(`Cleaned ${updated.count} legacy defaultLocation fields from Product table!`);
}

main().finally(() => prisma.$disconnect());
