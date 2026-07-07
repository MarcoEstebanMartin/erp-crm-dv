const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const clients = await prisma.persona.count({ where: { isClient: true }});
  const providers = await prisma.persona.count({ where: { isProvider: true }});
  const sellers = await prisma.user.count({ where: { role: 'VENDEDOR' }});
  console.log({clients, providers, sellers});
}
main().catch(console.error).finally(() => prisma.$disconnect());
