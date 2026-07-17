const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ select: { id: true, description: true } });
  
  const weirdDescriptions = products.filter(p => {
    const desc = p.description || '';
    return desc.match(/^\d/) || desc.includes(' - ');
  });
  
  console.log("Products with numbers/dashes in description (Sample of 15):", weirdDescriptions.slice(0, 15));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
