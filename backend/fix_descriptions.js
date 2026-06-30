const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: {
      description: {
        not: null
      }
    }
  });
  
  let updatedCount = 0;
  
  for (const p of products) {
    if (p.description) {
      // Regex to match "X.Y - " or "X.Y-" at the beginning of the string
      const match = p.description.match(/^\d+\.\d+\s*-\s*(.*)/);
      if (match) {
        const newDescription = match[1].trim();
        await prisma.product.update({
          where: { id: p.id },
          data: { description: newDescription }
        });
        updatedCount++;
      }
    }
  }
  
  console.log(`Updated ${updatedCount} product descriptions.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
