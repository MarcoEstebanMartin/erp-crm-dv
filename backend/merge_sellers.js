const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function mergeSellers() {
  const users = await prisma.user.findMany({ where: { role: 'VENDEDOR' } });
  
  const map = {
    'diego': 'DIEGO LEJARZA',
    'fabian': 'FABIAN MAYA',
    'norberto': 'NORBERTO',
    'maria_jose': 'MARIA JOSÉ VIDELA'
  };

  for (const [oldName, newName] of Object.entries(map)) {
    const oldUser = users.find(u => u.username === oldName);
    const newUser = users.find(u => u.username === newName);

    if (oldUser && newUser && oldUser.id !== newUser.id) {
      console.log(`Fusionando ${oldUser.username} (ID: ${oldUser.id}) -> ${newUser.username} (ID: ${newUser.id})`);

      // Transferir clientes
      await prisma.persona.updateMany({
        where: { sellerId: oldUser.id },
        data: { sellerId: newUser.id }
      });
      console.log(`- Clientes transferidos`);

      // Eliminar al usuario viejo
      // Hay que asegurar que no tenga audits o los eliminamos.
      try {
        await prisma.auditLog.deleteMany({
          where: { userId: oldUser.id }
        });
        
        await prisma.user.delete({
          where: { id: oldUser.id }
        });
        console.log(`- Usuario ${oldUser.username} eliminado correctamente.`);
      } catch (err) {
        console.error(`- Error al eliminar ${oldUser.username}:`, err.message);
      }
    }
  }

  // Ver si existe "norberto" (minuscula) y "NORBERTO" (mayuscula) separados
  // Como Prisma por defecto en postgres o mysql puede ser case sensitive/insensitive
  // hay que chequear bien.
  
  const remaining = await prisma.user.findMany({ where: { role: 'VENDEDOR' } });
  console.log('\nVendedores actuales en la BD:');
  remaining.forEach(u => console.log(`- [${u.id}] ${u.username}`));

  await prisma.$disconnect();
}

mergeSellers().catch(console.error);
