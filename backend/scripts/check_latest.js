const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const msgs = await prisma.crmMessage.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { conversation: true }
  });
  console.log(JSON.stringify(msgs, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
