import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/utils/prisma';

interface VariantDefinition {
  parentSku: string;
  sku: string;
  name: string;
}

const MISSING_VARIANTS: VariantDefinition[] = [
  // 0149 — LA HUERTA MERMELADA X 454 CC
  { parentSku: '0149', sku: '0149-1', name: 'LA HUERTA MERMELADA CIRUELA X 454 CC' },
  { parentSku: '0149', sku: '0149-2', name: 'LA HUERTA MERMELADA DAMASCO X 454 CC' },
  { parentSku: '0149', sku: '0149-3', name: 'LA HUERTA MERMELADA DURAZNO X 454 CC' },
  { parentSku: '0149', sku: '0149-4', name: 'LA HUERTA MERMELADA MULTIFRUTA X 454 CC' },
  // 0311 — CUMANÁ ATUN DESM. X 170 GR
  { parentSku: '0311', sku: '0311-1', name: 'CUMANÁ ATUN DESM. EN ACEITE X 170 GR' },
  { parentSku: '0311', sku: '0311-2', name: 'CUMANÁ ATUN DESM. AL NATURAL X 170 GR' },
  // 0313 — CUMANÁ ATUN LOMO X 170 GR
  { parentSku: '0313', sku: '0313-1', name: 'CUMANÁ ATUN LOMO EN ACEITE X 170 GR' },
  { parentSku: '0313', sku: '0313-2', name: 'CUMANÁ ATUN LOMO AL NATURAL X 170 GR' },
  // 0585 — VIÑA DE BALBO X 1125 ML
  { parentSku: '0585', sku: '0585-1', name: 'VIÑA DE BALBO TINTO X 1125 ML' },
  { parentSku: '0585', sku: '0585-2', name: 'VIÑA DE BALBO BLANCO X 1125 ML' },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const parentSkus = [...new Set(MISSING_VARIANTS.map((v) => v.parentSku))];
  const variantSkus = MISSING_VARIANTS.map((v) => v.sku);

  const [parents, existingVariants] = await Promise.all([
    prisma.product.findMany({ where: { sku: { in: parentSkus } } }),
    prisma.product.findMany({ where: { sku: { in: variantSkus } }, select: { sku: true } }),
  ]);

  const parentBySku = new Map(parents.map((p) => [p.sku.trim(), p]));
  const existingSet = new Set(existingVariants.map((v) => v.sku.trim()));

  const toCreate = MISSING_VARIANTS.filter((def) => !existingSet.has(def.sku));
  if (toCreate.length === 0) {
    console.log('✅ Las 10 variantes ya existen en el ERP. Nada para crear.');
    return;
  }

  for (const def of toCreate) {
    const parent = parentBySku.get(def.parentSku);
    if (!parent) {
      throw new Error(`No se encontró el producto padre ${def.parentSku} en el ERP.`);
    }
    if (dryRun) {
      console.log(`[DRY-RUN] Crearía ${def.sku}: ${def.name} (hereda de ${def.parentSku}, $${parent.listPrice})`);
      continue;
    }
    await prisma.product.create({
      data: {
        sku: def.sku,
        name: def.name,
        description: parent.description,
        costPrice: parent.costPrice,
        listPrice: parent.listPrice,
        listPriceB: parent.listPriceB,
        listPriceC: parent.listPriceC,
        profitMargin: parent.profitMargin,
        stock: 0,
        minStock: parent.minStock,
        isPesable: parent.isPesable,
        unitsPerBox: parent.unitsPerBox,
        minOrderQuantity: parent.minOrderQuantity,
        approximateWeight: parent.approximateWeight,
        imageUrl: parent.imageUrl,
        commercialCategory: parent.commercialCategory,
        pickingZone: parent.pickingZone,
        defaultLocation: parent.defaultLocation,
        rubroId: parent.rubroId,
        providerId: parent.providerId,
        isActive: parent.isActive,
      },
    });
    console.log(`✅ Creada variante ${def.sku}: ${def.name}`);
  }
}

void main()
  .catch((err) => {
    console.error('❌ Error creando variantes:', err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
