const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const tempDir = path.join(__dirname, '../../ARCHIVOS/temp_bulk1');
  const targetDir = path.join(__dirname, '../uploads/products');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const allProducts = await prisma.product.findMany({
    select: { id: true, sku: true, name: true }
  });

  const sorted = [...allProducts].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }));

  const startIdx = sorted.findIndex(p => p.sku === '0028');
  const endIdx = sorted.findIndex(p => p.sku === '0176');

  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Range SKUs 0028 to 0176 not found!');
  }

  const targetProducts = sorted.slice(startIdx, endIdx + 1);
  console.log(`Mapping ${targetProducts.length} products from (Bulk 1) Title.zip...`);

  let updatedCount = 0;

  for (let i = 0; i < targetProducts.length; i++) {
    const pageNum = i + 1;
    const imgName = `${pageNum}.jpg`;
    const sourcePath = path.join(tempDir, imgName);

    if (!fs.existsSync(sourcePath)) {
      console.warn(`Warning: ${imgName} not found in temp_bulk1!`);
      continue;
    }

    const product = targetProducts[i];
    const targetFileName = `${product.sku}.jpg`;
    const destinationPath = path.join(targetDir, targetFileName);
    const dbImageUrl = `/uploads/products/${targetFileName}`;

    // Copy file
    fs.copyFileSync(sourcePath, destinationPath);

    // Update DB
    await prisma.product.update({
      where: { id: product.id },
      data: { imageUrl: dbImageUrl }
    });

    updatedCount++;
    console.log(`[${pageNum}/80] Linked Page ${pageNum} -> SKU ${product.sku} (${product.name}) => ${dbImageUrl}`);
  }

  console.log(`\n✅ SUCCESS! Processed and linked ${updatedCount} product images in DB.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
