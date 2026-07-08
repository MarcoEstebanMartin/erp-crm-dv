const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    include: {
      rubro: true,
      _count: {
        select: {
          orderItems: true,
          stockMovements: true,
          lots: true,
          purchaseOrderItems: true,
          creditNoteItems: true,
        }
      }
    }
  });

  // Group by name
  const grouped = {};
  for (const p of products) {
    const key = p.name.trim().toLowerCase();
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(p);
  }

  console.log("DUPLICATE PRODUCTS INFO:");
  let duplicateCount = 0;
  for (const [name, list] of Object.entries(grouped)) {
    if (list.length > 1) {
      duplicateCount++;
      console.log(`\nProduct: "${name}" (Count: ${list.length})`);
      list.forEach(p => {
        console.log(`  - ID: ${p.id} | Code: "${p.code}" | Rubro: "${p.rubro ? p.rubro.name : 'N/A'}" (ID: ${p.rubroId})`);
        console.log(`    References: Orders: ${p._count.orderItems} | StockMovements: ${p._count.stockMovements} | Lots: ${p._count.lots} | Purchases: ${p._count.purchaseOrderItems} | CreditNotes: ${p._count.creditNoteItems}`);
      });
    }
  }
  console.log(`\nTotal duplicate names found: ${duplicateCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
