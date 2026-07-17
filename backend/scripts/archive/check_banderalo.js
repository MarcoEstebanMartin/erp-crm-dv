const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const personas = await prisma.persona.findMany({
    where: {
      OR: [
        { city: { contains: 'BANDERALO', mode: 'insensitive' } },
        { route: { contains: 'BANDERALO', mode: 'insensitive' } }
      ]
    },
    include: {
      saleRoute: true,
      seller: true
    }
  });

  console.log(`Encontrados ${personas.length} clientes relacionados con BANDERALO en DB:`);
  personas.forEach(p => {
    console.log(`- ID: ${p.id}, Nombre: ${p.name}, Ciudad: ${p.city}, Ruta (Texto): ${p.route}, SaleRouteId: ${p.saleRouteId}, Ruta Relacionada: ${p.saleRoute?.name}, Vendedor: ${p.seller?.username}, Active: ${p.isActive}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
