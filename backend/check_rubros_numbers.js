const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rubros = await prisma.rubro.findMany();
  console.log("Rubros with numbers:", rubros.filter(r => r.name.match(/\d/)).map(r => r.name));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
