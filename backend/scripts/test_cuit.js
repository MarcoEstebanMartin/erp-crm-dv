const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.persona.findMany({where: {cuit: '20-27853154-7'}}).then(console.log).finally(() => prisma.$disconnect());
