const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.persona.findMany({
    where: { isClient: true },
    select: { city: true }
  });

  const providers = await prisma.persona.findMany({
    where: { isProvider: true },
    select: { city: true }
  });

  const sellers = await prisma.user.findMany({
    where: { role: 'VENDEDOR' },
    include: {
      personas: {
        where: { isClient: true },
        select: { city: true }
      }
    }
  });

  const allCities = [...clients.map(c => c.city), ...providers.map(p => p.city)];
  const uniqueCities = [...new Set(allCities)];
  const cityCounts = uniqueCities.map(city => ({
    city: city || 'NULL / EMPTY',
    count: allCities.filter(c => c === city).length
  })).sort((a, b) => b.count - a.count);

  console.log('--- CITIES / LOCALITIES ---');
  console.table(cityCounts);

  console.log('\n--- SELLERS AND THEIR ROUTES (CITIES) ---');
  for (const seller of sellers) {
    const sellerCities = [...new Set(seller.personas.map(p => p.city))];
    console.log(`Seller: ${seller.username} - Cities: ${sellerCities.join(', ')}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
