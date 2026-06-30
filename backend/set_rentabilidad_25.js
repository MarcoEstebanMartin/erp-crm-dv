const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  let count = 0;
  for (const p of products) {
    // We want 25% rentabilidad
    // rentabilidad = precioFinal / costo - 1
    // precioFinal = costo * 1.25
    // precioSinIva = precioFinal / 1.21
    if (p.costPrice && p.costPrice > 0) {
      const precioFinal = p.costPrice * 1.25;
      const precioSinIva = Math.round(precioFinal / 1.21);
      
      await prisma.product.update({
        where: { id: p.id },
        data: {
          listPrice: precioSinIva
        }
      });
      count++;
    }
  }
  console.log(`Updated ${count} products to have 25% rentabilidad.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
