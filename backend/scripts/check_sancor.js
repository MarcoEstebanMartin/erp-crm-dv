const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p1 = await prisma.product.findUnique({ where: { id: 367 }, include: { rubro: true } });
  const p2 = await prisma.product.findUnique({ where: { id: 43 }, include: { rubro: true } });

  console.log("Product 1:", p1);
  console.log("Product 2:", p2);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
