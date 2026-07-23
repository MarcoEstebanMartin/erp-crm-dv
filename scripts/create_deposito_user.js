const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const bcrypt = require('../backend/node_modules/bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  await prisma.user.upsert({
    where: { username: 'deposito' },
    update: { passwordHash: hash, role: 'DEPOSITO', isActive: true },
    create: { username: 'deposito', passwordHash: hash, role: 'DEPOSITO', isActive: true }
  });
  console.log('User deposito created/updated successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
