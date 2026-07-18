const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const vehicleProviders = [
  { name: "Gonzalo Alvarez", isProvider: true, isClient: false, isActive: true },
  { name: "Jorge Guerrera", isProvider: true, isClient: false, isActive: true },
  { name: "Juan Manuel Ibarra", isProvider: true, isClient: false, isActive: true },
  { name: "YPF Boxes", isProvider: true, isClient: false, isActive: true },
  { name: "Juan Lopez", isProvider: true, isClient: false, isActive: true },
  { name: "Ricardo Beron", isProvider: true, isClient: false, isActive: true },
  { name: "Raul", isProvider: true, isClient: false, isActive: true }
];

async function main() {
  console.log('Sembrando proveedores de vehículos...');
  for (const provider of vehicleProviders) {
    const exists = await prisma.persona.findFirst({
      where: {
        name: {
          equals: provider.name,
          mode: 'insensitive'
        },
        isProvider: true
      }
    });

    if (!exists) {
      const created = await prisma.persona.create({
        data: provider
      });
      console.log(`✅ Proveedor creado: "${created.name}" (ID: ${created.id})`);
    } else {
      console.log(`ℹ️ El proveedor "${exists.name}" ya existe (ID: ${exists.id})`);
    }
  }
  console.log('¡Siembra completada!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
