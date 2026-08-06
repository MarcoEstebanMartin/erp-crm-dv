const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const prod = await prisma.product.findFirst();
  if (!prod) {
    console.log("No products found.");
    return;
  }
  console.log(`Testing with product ID ${prod.id} [${prod.sku}] ${prod.name}`);
  
  // Clean up any test lot if exists
  await prisma.productLot.deleteMany({
    where: { lotNumber: 'L-TEST-VERIFY-001' }
  });

  // Create lot with location
  const lot = await prisma.productLot.create({
    data: {
      productId: prod.id,
      lotNumber: 'L-TEST-VERIFY-001',
      expirationDate: new Date('2026-12-31'),
      stock: 15,
      location: 'D1-R06-C07-B'
    }
  });

  console.log("Created test lot successfully:", {
    id: lot.id,
    lotNumber: lot.lotNumber,
    stock: lot.stock,
    location: lot.location
  });

  const check = await prisma.productLot.findUnique({
    where: { id: lot.id }
  });

  console.log("Verification query from DB location:", check.location);
}

test().finally(() => prisma.$disconnect());
