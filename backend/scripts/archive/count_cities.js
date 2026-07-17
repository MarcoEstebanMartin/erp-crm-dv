const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const localidades = await prisma.persona.groupBy({
    by: ['city'],
    _count: {
      city: true,
    },
    orderBy: {
      _count: {
        city: 'desc',
      },
    },
  });

  console.log(localidades.map(l => `${l.city}: ${l._count.city}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
