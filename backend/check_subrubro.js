const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  console.log("Products with ' - ' in description:", products.filter(p => p.description && p.description.includes(' - ')).map(p => p.description));
  
  const rubros = await prisma.rubro.findMany();
  console.log("Rubros with ' - ' in name:", rubros.filter(r => r.name.includes(' - ')).map(r => r.name));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
