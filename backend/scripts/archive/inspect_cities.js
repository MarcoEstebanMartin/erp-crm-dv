const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const personas = await prisma.persona.findMany({
    where: {
      isClient: true,
      isActive: true,
      route: {
        in: ['CENTRO 1', 'FEDERAL', 'TROCHA', 'CENTRO 2', 'PARQUE']
      }
    },
    select: {
      id: true,
      name: true,
      city: true,
      route: true,
      sellerId: true
    }
  });

  console.log('Clientes de zonas locales y sus ciudades:');
  const cityCounts = {};
  for (const p of personas) {
    cityCounts[p.city] = (cityCounts[p.city] || 0) + 1;
  }
  console.log(cityCounts);
  console.log('Muestra de 10 personas:', personas.slice(0, 10));
  await prisma.$disconnect();
}
main();
