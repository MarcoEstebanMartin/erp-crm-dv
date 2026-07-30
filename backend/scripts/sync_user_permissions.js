const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Sincronizando Matriz de Permisos Granulares para el Personal...');

  const userPermissionsMap = {
    norberto: { canSell: true, canPick: false, canDeliver: true, canCollect: true, canManageStock: false },
    miguel: { canSell: true, canPick: true, canDeliver: true, canCollect: true, canManageStock: false },
    matias: { canSell: false, canPick: true, canDeliver: true, canCollect: true, canManageStock: true },
    fabian: { canSell: true, canPick: false, canDeliver: true, canCollect: true, canManageStock: false },
    thiago: { canSell: false, canPick: true, canDeliver: true, canCollect: false, canManageStock: true },
    diego: { canSell: true, canPick: false, canDeliver: false, canCollect: true, canManageStock: false },
    admin: { canSell: true, canPick: true, canDeliver: true, canCollect: true, canManageStock: true },
    agustin: { canSell: true, canPick: true, canDeliver: true, canCollect: true, canManageStock: true },
    dario: { canSell: true, canPick: true, canDeliver: true, canCollect: true, canManageStock: true },
  };

  for (const [username, perms] of Object.entries(userPermissionsMap)) {
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } }
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { permissions: perms }
      });
      console.log(`✅ Permisos actualizados para '${user.username}':`, perms);
    } else {
      console.log(`⚠️ Usuario '${username}' no encontrado en BD.`);
    }
  }

  console.log('✨ Sincronización finalizada exitosamente.');
}

main()
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
