const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Corrección de Migración de Rutas de Venta (Mejorado) ---');
  try {
    // 1. Eliminar todas las rutas de preventa previas (pone a null el saleRouteId en cascada)
    await prisma.saleRouteVisit.deleteMany({});
    await prisma.saleRoute.deleteMany({});
    console.log('Limpiadas las rutas de preventa previas.');

    // Zonas locales conocidas de General Villegas
    const localZones = ['FEDERAL', 'PARQUE', 'CENTRO 1', 'CENTRO 2', 'CENTRO 3', 'CENTRO 4', 'FONAVI', 'PROGRESO', 'TROCHA', 'CICLON', 'CRUCE'];

    // 2. Definición de rutas específicas de Villegas
    const villegasRoutesDefs = [
      { name: 'VILLEGAS DIEGO', sellerId: 1, dayOfWeek: 'LUNES' },
      { name: 'VILLEGAS FABIAN', sellerId: 2, dayOfWeek: 'LUNES' },
      { name: 'VILLEGAS NORBER', sellerId: 3, dayOfWeek: 'LUNES' },
      { name: 'OFICINA', sellerId: 5, dayOfWeek: 'LUNES' },
      { name: 'VILLEGAS TOTAL', sellerId: null, dayOfWeek: null }
    ];

    const routeMap = {}; // Guardará las instancias de rutas creadas

    for (const def of villegasRoutesDefs) {
      const route = await prisma.saleRoute.create({
        data: {
          name: def.name,
          sellerId: def.sellerId,
          dayOfWeek: def.dayOfWeek,
        }
      });
      routeMap[def.name] = route;
      console.log(`Creada ruta de Villegas: "${route.name}" (Vendedor ID: ${route.sellerId || 'NINGUNO'})`);
    }

    // 3. Obtener todos los clientes activos
    const clients = await prisma.persona.findMany({
      where: {
        isClient: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        city: true,
        route: true,
        sellerId: true,
      }
    });

    console.log(`Procesando ${clients.length} clientes activos...`);

    // Contadores para secuencias por ruta
    const sequences = {};
    const getNextSequence = (routeName) => {
      sequences[routeName] = (sequences[routeName] || 0) + 1;
      return sequences[routeName];
    };

    let localMigrated = 0;
    let foreignMigrated = 0;
    let noRouteCount = 0;

    for (const client of clients) {
      const cityClean = (client.city || '').toUpperCase().trim();
      const rawRouteName = (client.route || '').trim().toUpperCase();

      // Es Villegas si la ciudad es Villegas O si la zona de reparto coincide con una zona local conocida
      const isVillegas = cityClean === 'GENERAL VILLEGAS' || 
                         cityClean === 'GRAL VILLEGAS' || 
                         cityClean === 'VILLEGAS' || 
                         cityClean === '' || 
                         localZones.includes(rawRouteName);

      if (isVillegas) {
        // --- CLIENTE DE GENERAL VILLEGAS ---
        // Se asocia a la ruta de preventa del vendedor asignado
        let targetRouteName = 'VILLEGAS TOTAL';
        if (client.sellerId === 1) targetRouteName = 'VILLEGAS DIEGO';
        else if (client.sellerId === 2) targetRouteName = 'VILLEGAS FABIAN';
        else if (client.sellerId === 3) targetRouteName = 'VILLEGAS NORBER';
        else if (client.sellerId === 5) targetRouteName = 'OFICINA';

        const routeObj = routeMap[targetRouteName];
        const seq = getNextSequence(targetRouteName);

        await prisma.persona.update({
          where: { id: client.id },
          data: {
            saleRouteId: routeObj.id,
            routeSequence: seq
          }
        });
        localMigrated++;
      } else {
        // --- CLIENTE DE AFUERA DE VILLEGAS (PUEBLOS) ---
        // Su ruta de preventa coincide con su zona/pueblo (ej: "BUNGE Y BUCHARDO")
        if (!rawRouteName) {
          noRouteCount++;
          continue;
        }

        // Si no existe la ruta del pueblo en la base de datos, la creamos
        if (!routeMap[rawRouteName]) {
          // Determinar vendedor por defecto para pueblos
          let sellerId = null;
          const lowerRoute = rawRouteName.toLowerCase();
          if (lowerRoute.includes('bunge') || lowerRoute.includes('tres algarrobos') || lowerRoute.includes('banderalo')) {
            sellerId = 1; // Diego
          } else if (lowerRoute.includes('alvear')) {
            sellerId = 4; // Maria Jose
          } else if (lowerRoute.includes('ameghino') || lowerRoute.includes('america')) {
            sellerId = 5; // Oficina / Admin
          }

          let dayOfWeek = null;
          if (lowerRoute.includes('lunes')) dayOfWeek = 'LUNES';
          else if (lowerRoute.includes('martes')) dayOfWeek = 'MARTES';
          else if (lowerRoute.includes('miercoles')) dayOfWeek = 'MIERCOLES';
          else if (lowerRoute.includes('jueves')) dayOfWeek = 'JUEVES';
          else if (lowerRoute.includes('viernes')) dayOfWeek = 'VIERNES';

          const newRoute = await prisma.saleRoute.create({
            data: {
              name: client.route.trim(),
              sellerId: sellerId,
              dayOfWeek: dayOfWeek
            }
          });
          routeMap[rawRouteName] = newRoute;
          console.log(`Creada ruta de pueblo: "${newRoute.name}" (Vendedor ID: ${newRoute.sellerId || 'NINGUNO'})`);
        }

        const routeObj = routeMap[rawRouteName];
        const seq = getNextSequence(rawRouteName);

        await prisma.persona.update({
          where: { id: client.id },
          data: {
            saleRouteId: routeObj.id,
            routeSequence: seq
          }
        });
        foreignMigrated++;
      }
    }

    console.log(`\n--- Resumen de Migración Corregida ---`);
    console.log(`Clientes de Villegas asociados a rutas de preventa: ${localMigrated}`);
    console.log(`Clientes de Pueblos asociados a rutas de pueblos: ${foreignMigrated}`);
    console.log(`Clientes sin ruta (fuera de Villegas sin zona cargada): ${noRouteCount}`);
    console.log('Migración completada exitosamente.');

  } catch (error) {
    console.error('Error durante la migración de rutas corregidas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
