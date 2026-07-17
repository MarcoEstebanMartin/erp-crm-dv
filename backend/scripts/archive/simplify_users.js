const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Simplificando usuarios y contraseñas...');
  const users = await prisma.user.findMany();
  const salt = await bcrypt.genSalt(10);
  
  for (const user of users) {
    let oldUsername = user.username;
    let newUsername = oldUsername.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let newPasswordBase = newUsername;

    if (oldUsername === 'DIEGO LEJARZA') {
      newUsername = 'diego';
      newPasswordBase = 'lejarza';
    } else if (oldUsername === 'MARIA JOSÉ VIDELA') {
      newUsername = 'mariajose';
      newPasswordBase = 'videla';
    } else if (oldUsername === 'FABIAN MAYA') {
      newUsername = 'fabian';
      newPasswordBase = 'maya';
    } else if (oldUsername === 'NORBERTO') {
      newUsername = 'norberto';
      newPasswordBase = 'norberto';
    } else if (newUsername.includes(' ')) {
      const parts = newUsername.split(' ');
      newUsername = parts[0];
      newPasswordBase = parts[parts.length - 1];
    }

    const newPassword = `${newPasswordBase}!`;
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        username: newUsername,
        passwordHash 
      }
    });
    console.log(`Original: ${oldUsername} -> Usuario: ${newUsername} | Contraseña: ${newPassword}`);
  }
  
  console.log('¡Actualización completada exitosamente!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
