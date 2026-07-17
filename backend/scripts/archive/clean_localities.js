const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanLocalities() {
  console.log('Iniciando limpieza y unificación de localidades (Lista Oficial)...');

  // 1. Mapeos de nombres antiguos/variaciones a los nombres oficiales
  const mapeos = [
    { from: 'RIVADAVIA AMERICA', to: 'RIVADAVIA' },
    { from: 'EMILIO V. BUNGE', to: 'EMILIO BUNGE' },
    { from: 'BERNARDO LARROUDE', to: 'BERNARDO LARROUDÉ' },
    { from: 'AMEGHINO', to: 'FLORENTINO AMEGHINO' },
    { from: 'BANDERALO', to: 'BANDERALÓ' },
    { from: 'VILLA SAUZE', to: 'VILLA SAUCE' }
  ];

  for (const m of mapeos) {
    const res = await prisma.persona.updateMany({
      where: { city: m.from },
      data: { city: m.to }
    });
    if (res.count > 0) {
      console.log(`Mapeado ${m.from} -> ${m.to} (${res.count} registros)`);
    }
  }

  // 2. Lista blanca oficial
  const listaOficial = [
    "GENERAL VILLEGAS",
    "CARLOS TEJEDOR",
    "FLORENTINO AMEGHINO",
    "VILLA SAUCE",
    "SANSINENA",
    "PIEDRITAS",
    "CORONEL CHARLONE",
    "EMILIO BUNGE",
    "BUCHARDO",
    "BANDERALÓ",
    "BERNARDO LARROUDÉ",
    "TRES ALGARROBOS",
    "RIVADAVIA",
    "FORTIN OLAVARRIA",
    "INTENDENTE ALVEAR",
    "Otros" // Dejamos "Otros" en la lista blanca para no sobreescribir lo que ya es Otros
  ];

  // 3. Todo lo que NO esté en la lista blanca, pasa a "Otros"
  const resOtros = await prisma.persona.updateMany({
    where: { 
      city: { notIn: listaOficial }
    },
    data: { city: 'Otros' }
  });
  console.log(`Movidos a 'Otros' las localidades no oficiales (${resOtros.count} registros)`);

  console.log('Limpieza finalizada con éxito.');
}

cleanLocalities()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
