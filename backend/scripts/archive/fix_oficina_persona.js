const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addOficinaPersona() {
  const existing = await prisma.persona.findFirst({
    where: { name: 'OFICINA', isSeller: true }
  });

  if (!existing) {
    await prisma.persona.create({
      data: {
        name: 'OFICINA',
        isSeller: true,
        isClient: false,
        isProvider: false,
        address: 'Sede Central',
        city: 'Oficina Central',
      }
    });
    console.log('Persona OFICINA creada exitosamente.');
  } else {
    console.log('Persona OFICINA ya existe.');
  }

  await prisma.$disconnect();
}

addOficinaPersona().catch(console.error);
