const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.persona.findFirst({where: {name: 'ESTEFANIA RODRIGUEZ'}}).then(console.log).finally(() => prisma.$disconnect());
