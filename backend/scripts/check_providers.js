const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const targetProviders = [
  "Gonzalo Alvarez",
  "Jorge Guerrera",
  "Juan Manuel Ibarra",
  "YPF Boxes",
  "Juan Lopez",
  "Ricardo Beron",
  "Raul"
];

async function main() {
  console.log('Buscando proveedores de vehículos en la base de datos...');
  const providers = await prisma.persona.findMany({
    where: {
      isProvider: true
    }
  });

  console.log(`Total de proveedores encontrados en la base de datos: ${providers.length}`);
  
  targetProviders.forEach(target => {
    const found = providers.filter(p => p.name.toLowerCase().includes(target.toLowerCase()));
    if (found.length > 0) {
      console.log(`✅ Coincidencias para "${target}":`);
      found.forEach(f => console.log(`   - ID: ${f.id}, Nombre: ${f.name}`));
    } else {
      console.log(`❌ No se encontró ninguna coincidencia para "${target}"`);
    }
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
