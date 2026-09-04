const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const routes = await prisma.saleRoute.findMany({ select: { id: true, name: true, dayOfWeek: true } });
  const clientsCount = await prisma.persona.count({ where: { isClient: true } });
  const clientsWithBarrio = await prisma.persona.count({ where: { isClient: true, barrio: { not: null } } });
  const clientsWithRoute = await prisma.persona.count({ where: { isClient: true, route: { not: null } } });

  console.log(`=== RUTAS MAESTRAS EN BASE DE DATOS (${routes.length}) ===`);
  routes.forEach(r => console.log(`- ID ${r.id}: ${r.name} (${r.dayOfWeek || 'Sin Día'})`));

  console.log('\n=== ESTADÍSTICAS DE CLIENTES ===');
  console.log(`Total Clientes: ${clientsCount}`);
  console.log(`Clientes con Barrio guardado: ${clientsWithBarrio}`);
  console.log(`Clientes con Ruta Maestra vinculada: ${clientsWithRoute}`);

  const sampleVillegas = await prisma.persona.findFirst({
    where: { city: 'GENERAL VILLEGAS', barrio: { not: null } },
    select: { name: true, city: true, barrio: true, route: true, saleRouteId: true }
  });

  const productsWithImage = await prisma.product.count({
    where: { imageUrl: { not: null } }
  });
  console.log(`\n=== FOTOS DE PRODUCTOS ===`);
  console.log(`Total Productos con Foto en DB: ${productsWithImage}`);

  console.log('\n=== MUESTRA DE CLIENTE DE VILLEGAS ===');
  console.log(sampleVillegas);

  const count = await prisma.product.count({ where: { profitMargin: { not: null } } });
  console.log(`Total products with profitMargin assigned in DB: ${count}`);

  const sample = await prisma.product.findMany({
    take: 12,
    select: { sku: true, name: true, profitMargin: true, rubro: { select: { name: true } } }
  });
  console.log('Sample updated products in DB:', JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
