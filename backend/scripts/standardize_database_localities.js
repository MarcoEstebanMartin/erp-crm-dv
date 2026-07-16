const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OFFICIAL_CITIES = [
  "GENERAL VILLEGAS",
  "EMILIO V. BUNGE",
  "BANDERALÓ",
  "BERNARDO LARROUDÉ",
  "PIEDRITAS",
  "CORONEL CHARLONE",
  "BUCHARDO",
  "TRES ALGARROBOS",
  "CARLOS TEJEDOR",
  "FLORENTINO AMEGHINO",
  "BLAQUIER",
  "RIVADAVIA",
  "FORTÍN OLAVARRÍA",
  "INTENDENTE ALVEAR",
  "RUFINO",
  "CEBALLOS",
  "REALICÓ",
  "VILLA SAUZE",
  "SANSINENA",
  "SANTA ELEODORA",
  "SANTA REGINA",
  "VILLA SABOYA",
  "CAÑADA SECA",
  "CABA"
];

function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function standardizeCityName(city) {
  if (!city) return 'OTRAS';
  const clean = city.trim();
  const norm = removeAccents(clean);

  if (norm.includes('VILLEGAS')) return 'GENERAL VILLEGAS';
  if (norm.includes('BUNGE')) return 'EMILIO V. BUNGE';
  if (norm.includes('BANDERALO')) return 'BANDERALÓ';
  if (norm.includes('LARROUDE')) return 'BERNARDO LARROUDÉ';
  if (norm.includes('PIEDRITAS') || norm.includes('PIEDRAS PIEDRITAS')) return 'PIEDRITAS';
  if (norm.includes('CHARLONE')) return 'CORONEL CHARLONE';
  if (norm.includes('BUCHARDO') || norm.includes('BOUCHARD')) return 'BUCHARDO';
  if (norm.includes('ALGARROBOS') || norm.includes('CUENCA')) return 'TRES ALGARROBOS';
  if (norm.includes('TEJEDOR')) return 'CARLOS TEJEDOR';
  if (norm.includes('AMEGHINO')) return 'FLORENTINO AMEGHINO';
  if (norm.includes('BLAQUIER')) return 'BLAQUIER';
  if (norm.includes('FORTIN') || norm.includes('OLAVARRIA')) return 'FORTÍN OLAVARRÍA';
  if (norm.includes('ALVEAR')) return 'INTENDENTE ALVEAR';
  if (norm.includes('RUFINO')) return 'RUFINO';
  if (norm.includes('CEBALLOS')) return 'CEBALLOS';
  if (norm.includes('REALICO')) return 'REALICÓ';
  if (norm.includes('SAUZE') || norm.includes('SAUCE')) return 'VILLA SAUZE';
  if (norm.includes('SANSINENA')) return 'SANSINENA';
  if (norm.includes('ELEODORA')) return 'SANTA ELEODORA';
  if (norm.includes('REGINA')) return 'SANTA REGINA';
  if (norm.includes('SABOYA')) return 'VILLA SABOYA';
  if (norm.includes('CAÑADA SECA') || norm.includes('CANADA SECA')) return 'CAÑADA SECA';
  if (norm.includes('AMERICA') || norm.includes('RIVADAVIA')) return 'RIVADAVIA';
  if (norm.includes('CABA') || norm.includes('CAPITAL FEDERAL') || norm.includes('CIUDAD AUTONOMA')) return 'CABA';

  return clean.toUpperCase();
}

function standardizeRouteName(route) {
  if (!route) return '';
  const norm = removeAccents(route);

  if (norm.includes('BANDERALO') && norm.includes('LARROUDE')) return 'BANDERALÓ Y LARROUDÉ';
  if (norm.includes('BUNGE') && norm.includes('BUCHARDO')) return 'EMILIO V. BUNGE Y BUCHARDO';
  if (norm.includes('BUNGE') && norm.includes('CHARLONE')) return 'EMILIO V. BUNGE Y CORONEL CHARLONE';
  if (norm.includes('SAUCE') || norm.includes('SAUZE') && norm.includes('SANSINENA')) return 'VILLA SAUZE Y SANSINENA';
  if (norm.includes('AMEGHINO') && norm.includes('BLAQUIER')) return 'FLORENTINO AMEGHINO Y BLAQUIER';
  if (norm.includes('AMERICA') || norm.includes('RIVADAVIA') && norm.includes('FORTIN')) return 'RIVADAVIA Y FORTÍN OLAVARRÍA';
  if (norm.includes('ALVEAR')) return 'INTENDENTE ALVEAR';
  if (norm.includes('TRES ALGARROBOS')) return 'TRES ALGARROBOS';
  if (norm.includes('PIEDRITAS')) return 'PIEDRITAS';
  if (norm.includes('CARLOS TEJEDOR')) return 'CARLOS TEJEDOR';

  return route.trim().toUpperCase();
}

async function main() {
  console.log('Iniciando estandarización de base de datos...');

  // 1. Estandarizar Rutas de Venta Estructuradas (SaleRoute)
  const saleRoutes = await prisma.saleRoute.findMany();
  console.log(`Encontradas ${saleRoutes.length} rutas estructuradas en SaleRoute.`);
  
  let routeUpdates = 0;
  for (const sr of saleRoutes) {
    const stdName = standardizeRouteName(sr.name);
    if (stdName && stdName !== sr.name) {
      console.log(`Actualizando SaleRoute ID: ${sr.id} | "${sr.name}" -> "${stdName}"`);
      await prisma.saleRoute.update({
        where: { id: sr.id },
        data: { name: stdName }
      });
      routeUpdates++;
    }
  }
  console.log(`Completado: ${routeUpdates} rutas estructuradas actualizadas.`);

  // 2. Estandarizar Personas
  const personas = await prisma.persona.findMany();
  console.log(`Encontradas ${personas.length} personas totales en BD.`);

  let personaUpdates = 0;
  for (const p of personas) {
    const newCity = p.city ? standardizeCityName(p.city) : p.city;
    const newRoute = p.route ? standardizeRouteName(p.route) : p.route;

    const needsCityUpdate = p.city !== newCity;
    const needsRouteUpdate = p.route !== newRoute;

    if (needsCityUpdate || needsRouteUpdate) {
      const updateData = {};
      if (needsCityUpdate) updateData.city = newCity;
      if (needsRouteUpdate) updateData.route = newRoute;

      await prisma.persona.update({
        where: { id: p.id },
        data: updateData
      });

      if (p.isClient && (p.city?.toUpperCase().includes('BANDERALO') || newCity?.toUpperCase().includes('BANDERALO'))) {
        console.log(`Actualizando Cliente Banderaló [ID: ${p.id}]: "${p.name}"`);
        console.log(`  Ciudad: "${p.city}" -> "${newCity}"`);
        console.log(`  Ruta: "${p.route}" -> "${newRoute}"`);
      }
      personaUpdates++;
    }
  }

  console.log(`Estandarización completada con éxito.`);
  console.log(`Total de personas actualizadas: ${personaUpdates}`);
}

main()
  .catch(e => {
    console.error('Error durante la migración:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
