const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Migración de Datos de Rutas ---');
  try {
    // 1. Obtener clientes que tengan el string 'route' definido
    const clients = await prisma.persona.findMany({
      where: {
        isClient: true,
        route: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        route: true,
        sellerId: true,
      },
    });

    console.log(`Encontrados ${clients.length} clientes con ruta en texto plano.`);

    if (clients.length === 0) {
      console.log('No hay clientes para migrar.');
      return;
    }

    // 2. Agrupar nombres de rutas únicos y determinar el vendedor predominante
    const routeGroups = {};
    for (const client of clients) {
      const rawRouteName = client.route.trim().toUpperCase();
      if (!rawRouteName) continue;

      if (!routeGroups[rawRouteName]) {
        routeGroups[rawRouteName] = {
          name: client.route.trim(), // conservamos el casing original
          clientIds: [],
          sellers: {},
        };
      }
      
      routeGroups[rawRouteName].clientIds.push(client.id);
      if (client.sellerId) {
        routeGroups[rawRouteName].sellers[client.sellerId] = (routeGroups[rawRouteName].sellers[client.sellerId] || 0) + 1;
      }
    }

    console.log(`Detectadas ${Object.keys(routeGroups).length} rutas únicas en los datos actuales.`);

    // 3. Crear las rutas y asociar los clientes secuencialmente
    let routesCreated = 0;
    let clientsMigrated = 0;

    for (const rawName of Object.keys(routeGroups)) {
      const group = routeGroups[rawName];
      
      // Determinar el vendedor más frecuente para esta ruta
      let bestSellerId = null;
      let maxCount = 0;
      for (const [sId, count] of Object.entries(group.sellers)) {
        if (count > maxCount) {
          maxCount = count;
          bestSellerId = Number(sId);
        }
      }

      // Asignar el día de la semana si el nombre coincide con algún día
      let dayOfWeek = null;
      const lowerName = rawName.toLowerCase();
      if (lowerName.includes('lunes')) dayOfWeek = 'LUNES';
      else if (lowerName.includes('martes')) dayOfWeek = 'MARTES';
      else if (lowerName.includes('miercoles') || lowerName.includes('miércoles')) dayOfWeek = 'MIERCOLES';
      else if (lowerName.includes('jueves')) dayOfWeek = 'JUEVES';
      else if (lowerName.includes('viernes')) dayOfWeek = 'VIERNES';
      else if (lowerName.includes('sabado') || lowerName.includes('sábado')) dayOfWeek = 'SABADO';

      // Buscar si la ruta ya existe
      let saleRoute = await prisma.saleRoute.findFirst({
        where: {
          name: {
            equals: group.name,
            mode: 'insensitive',
          },
        },
      });

      if (!saleRoute) {
        saleRoute = await prisma.saleRoute.create({
          data: {
            name: group.name,
            sellerId: bestSellerId,
            dayOfWeek: dayOfWeek,
          },
        });
        routesCreated++;
        console.log(`Creada ruta "${group.name}" asignada al vendedor ID ${bestSellerId || 'NINGUNO'}.`);
      } else {
        console.log(`Ruta "${group.name}" ya existía.`);
      }

      // Asociar clientes secuencialmente
      for (let i = 0; i < group.clientIds.length; i++) {
        const clientId = group.clientIds[i];
        await prisma.persona.update({
          where: { id: clientId },
          data: {
            saleRouteId: saleRoute.id,
            routeSequence: i + 1,
          },
        });
        clientsMigrated++;
      }
    }

    console.log(`\n--- Resumen de Migración ---`);
    console.log(`Rutas creadas/verificadas: ${routesCreated}`);
    console.log(`Clientes asociados a rutas: ${clientsMigrated}`);
    console.log('Migración completada con éxito.');

  } catch (error) {
    console.error('Error durante la migración de rutas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
