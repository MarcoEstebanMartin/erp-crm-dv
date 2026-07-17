const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      rubroId: null,
      description: { not: null }
    }
  });
  console.log(`Found ${products.length} products with a description but NO rubro.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
