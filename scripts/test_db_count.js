const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../backend/node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const prodCount = await prisma.product.count();
  const lotCount = await prisma.productLot.count();
  console.log(`✅ Base de Datos PostgreSQL activa: ${prodCount} Productos | ${lotCount} Lotes.`);
}

main().catch(err => {
  console.error('❌ Error de conexión DB:', err.message);
}).finally(() => prisma.$disconnect());
