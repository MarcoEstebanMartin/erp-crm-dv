const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({ take: 20 });
  products.forEach(p => {
    const lp = Number(p.listPrice);
    const lpb = Number(p.listPriceB);
    const lpc = Number(p.listPriceC);
    const cost = Number(p.costPrice);
    console.log(`SKU: ${p.sku} | Name: "${p.name}"`);
    console.log(`  Cost: ${cost} | List: ${lp} | ListB: ${lpb} | ListC: ${lpc}`);
    if (lp > 0) {
      console.log(`  ListB/List: ${(lpb/lp).toFixed(4)} | ListC/List: ${(lpc/lp).toFixed(4)}`);
    }
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
