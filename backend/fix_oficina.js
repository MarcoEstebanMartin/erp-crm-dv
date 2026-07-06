const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function fixOficina() {
  console.log('Buscando o creando vendedor OFICINA...');
  
  let oficinaUser = await prisma.user.findFirst({
    where: { username: 'OFICINA' }
  });

  if (!oficinaUser) {
    const passwordHash = await bcrypt.hash('123456', 10);
    oficinaUser = await prisma.user.create({
      data: {
        username: 'OFICINA',
        passwordHash: passwordHash,
        role: 'VENDEDOR'
      }
    });
    console.log('Vendedor OFICINA creado exitosamente con ID:', oficinaUser.id);
  } else {
    console.log('Vendedor OFICINA ya existía con ID:', oficinaUser.id);
  }

  // Ahora asignamos este vendedor a todas las personas que tengan sellerId en null
  console.log('Buscando clientes sin vendedor asignado (sellerId = null)...');
  
  const result = await prisma.persona.updateMany({
    where: {
      sellerId: null,
      isClient: true
    },
    data: {
      sellerId: oficinaUser.id
    }
  });

  console.log(`Se actualizaron ${result.count} clientes, asignándoles el vendedor OFICINA.`);
  
  await prisma.$disconnect();
}

fixOficina().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
