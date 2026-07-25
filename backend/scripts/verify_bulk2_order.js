const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allProducts = await prisma.product.findMany({
    select: { id: true, sku: true, name: true, commercialCategory: true }
  });

  const sorted = [...allProducts].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));

  const prevEndIdx = sorted.findIndex(p => p.sku === '0176');

  if (prevEndIdx === -1) {
    throw new Error('SKU 0176 not found!');
  }

  const bulk2StartIdx = prevEndIdx + 1;
  const bulk2EndIdx = bulk2StartIdx + 79; // 80 items

  console.log(`Bulk 2 start index: ${bulk2StartIdx} (SKU: ${sorted[bulk2StartIdx]?.sku})`);
  console.log(`Bulk 2 end index: ${bulk2EndIdx} (SKU: ${sorted[bulk2EndIdx]?.sku})`);

  const slice = sorted.slice(bulk2StartIdx, bulk2EndIdx + 1);
  console.log(`Count in Bulk 2 range: ${slice.length}`);

  slice.forEach((p, idx) => {
    console.log(`Page ${idx + 1} -> SKU: '${p.sku}', Name: '${p.name}'`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
