const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const prods = await prisma.product.findMany({
    where: {
      OR: [{ imageUrl: null }, { imageUrl: '' }],
      isActive: true,
    },
    select: {
      sku: true,
      name: true,
    },
    orderBy: {
      sku: 'asc',
    },
  });

  const headers = ['sku', 'name'];
  const rows = prods.map((p) => [
    `"${String(p.sku || '').replace(/"/g, '""')}"`,
    `"${String(p.name || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const bomCsv = '\uFEFF' + csvContent;

  const targetPath = path.join(__dirname, '..', '..', 'productos_sin_imagen_canva.csv');
  fs.writeFileSync(targetPath, bomCsv, 'utf8');
  console.log(`CSV generado exitosamente con ${prods.length} productos sin foto en: ${targetPath}`);
}

main().finally(() => prisma.$disconnect());
