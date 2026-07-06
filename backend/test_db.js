const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to Prisma...');
  try {
      const users = await prisma.user.findMany({ take: 1 });
      console.log('Connected successfully. Found users:', users.length);
  } catch (e) {
      console.error('Error connecting to DB:', e);
  } finally {
      await prisma.$disconnect();
  }
}
main();
