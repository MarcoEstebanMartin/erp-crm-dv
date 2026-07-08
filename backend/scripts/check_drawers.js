const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const openDrawers = await prisma.cashDrawer.findMany({
    where: { status: 'OPEN' },
    include: { user: true }
  });
  console.log("Open Drawers:", openDrawers.map(d => ({
    id: d.id,
    userId: d.userId,
    username: d.user?.username,
    branch: d.branch
  })));
  
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true }
  });
  console.log("Users:", users);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
