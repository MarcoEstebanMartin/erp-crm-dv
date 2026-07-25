const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allProducts = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, commercialCategory: true }
  });

  console.log('Total DB products:', allProducts.length);

  // Filter products by SKU prefix or sort them naturally
  // Let's sort SKUs numerically/alphabetically
  const sorted = [...allProducts].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));

  const startIdx = sorted.findIndex(p => p.sku === '0028');
  const endIdx = sorted.findIndex(p => p.sku === '0176');

  console.log(`Sorted SKU start index (0028): ${startIdx}`);
  console.log(`Sorted SKU end index (0176): ${endIdx}`);

  if (startIdx !== -1 && endIdx !== -1) {
    const slice = sorted.slice(startIdx, endIdx + 1);
    console.log(`Count between 0028 and 0176 in SKU order: ${slice.length}`);
    slice.forEach((p, idx) => {
      console.log(`Page ${idx + 1} -> SKU: '${p.sku}', Name: '${p.name}'`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
