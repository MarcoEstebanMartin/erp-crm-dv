const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const productLots = await prisma.productLot.count();
  const purchaseOrderItems = await prisma.purchaseOrderItem.count();
  const creditNoteItems = await prisma.creditNoteItem.count();
  console.log(`ProductLots: ${productLots}`);
  console.log(`PurchaseOrderItems: ${purchaseOrderItems}`);
  console.log(`CreditNoteItems: ${creditNoteItems}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
