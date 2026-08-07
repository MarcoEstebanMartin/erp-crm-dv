const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSlotFlow() {
  console.log('--- DB INSPECTION: SLOT D1-R04-C07 & D1-R06-C07 ---');
  const slots = ['D1-R04-C07', 'D1-R06-C07'];

  for (const slotCode of slots) {
    const productsInSlot = await prisma.product.findMany({
      where: {
        OR: [
          { defaultLocation: { startsWith: slotCode } },
          { lots: { some: { location: { startsWith: slotCode } } } }
        ]
      },
      include: { lots: true }
    });

    console.log(`\nSlot ${slotCode}: ${productsInSlot.length} productos vinculados.`);
    for (const p of productsInSlot) {
      console.log(`  Producto ID ${p.id} [${p.sku}] ${p.name}: defaultLocation=${p.defaultLocation}, stock=${p.stock}`);
      for (const l of p.lots) {
        console.log(`    * Lote ID ${l.id} (${l.lotNumber}): stock=${l.stock}, location=${l.location}`);
      }
    }
  }

  await prisma.$disconnect();
}

testSlotFlow().catch(console.error);
