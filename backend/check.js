const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rubros = await prisma.rubro.findMany();
  console.log("Rubros with numbers:");
  console.log(rubros.filter(r => /\d/.test(r.name)));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
