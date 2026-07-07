const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function fixCities() {
  const data = JSON.parse(fs.readFileSync('prisma/clients_data.json', 'utf-8'));
  
  console.log("Restoring cities from JSON backup...");
  
  // Create a map of name -> original city
  const cityMap = {};
  for(const d of data) {
    if(d.name) {
      cityMap[d.name.trim()] = d.city;
    }
  }

  // Fetch all personas
  const personas = await prisma.persona.findMany();
  
  let restored = 0;
  for (const p of personas) {
    if (p.name && cityMap[p.name.trim()]) {
      const origCity = cityMap[p.name.trim()];
      if (p.city !== origCity) {
         await prisma.persona.update({
           where: { id: p.id },
           data: { city: origCity }
         });
         restored++;
      }
    }
  }
  
  console.log(`Restored ${restored} cities.`);
  
  // Now apply the PROPER mapping.
  console.log("Applying correct mappings...");
  
  const mapeos = [
    { from: 'RIVADAVIA AMERICA', to: 'RIVADAVIA' },
    { from: 'EMILIO V. BUNGE', to: 'EMILIO BUNGE' },
    { from: 'BERNARDO LARROUDE', to: 'BERNARDO LARROUDÉ' },
    { from: 'AMEGHINO', to: 'FLORENTINO AMEGHINO' },
    { from: 'BANDERALO', to: 'BANDERALÓ' },
    { from: 'VILLA SAUZE', to: 'VILLA SAUCE' },
    { from: 'CARLOS TEJEDOR, EST.TEJEDOR', to: 'CARLOS TEJEDOR' },
    { from: 'EST.TEJEDOR', to: 'CARLOS TEJEDOR' },
    { from: 'HIPOLITO BOUCHARD BUCHARDO ,EST.', to: 'BUCHARDO' },
    { from: 'S/N HIPOLITO BOUCHARD BUCHARDO ,EST.', to: 'BUCHARDO' },
    { from: 'TRES ALGARROBOS ,EST.CUENCA', to: 'TRES ALGARROBOS' },
    { from: 'EST.CUENCA', to: 'TRES ALGARROBOS' },
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
    "RUFINO",
    "Otros" 
  ];

  const resOtros = await prisma.persona.updateMany({
    where: { 
      city: { notIn: listaOficial }
    },
    data: { city: 'Otros' }
  });
  console.log(`Movidos a 'Otros' las localidades no oficiales (${resOtros.count} registros)`);
}

fixCities()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
