const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Actualizando contraseñas de todos los usuarios...');
  const users = await prisma.user.findMany();
  const salt = await bcrypt.genSalt(10);
  
  for (const user of users) {
    const newPassword = `${user.username}2026-Erp!`;
    const passwordHash = await bcrypt.hash(newPassword, salt);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    console.log(`Contraseña actualizada para: ${user.username}`);
  }
  
  console.log('¡Todas las contraseñas han sido actualizadas!');
  console.log('Las nuevas contraseñas tienen el formato: [nombre_de_usuario]2026-Erp!');
  console.log('Ejemplo: admin2026-Erp!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
