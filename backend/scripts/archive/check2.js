const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  
  const withNumbers = products.filter(p => p.description && /\d\.\d\s*-/.test(p.description));
  console.log("Products with 'X.Y -' in description:", withNumbers.length);
  if (withNumbers.length > 0) {
    console.log("Example:", withNumbers[0].description);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
