const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.persona.findMany({
    select: { city: true },
    distinct: ['city']
}).then(cities => {
    console.log(cities.map(c => c.city).sort());
}).finally(() => prisma.$disconnect());
