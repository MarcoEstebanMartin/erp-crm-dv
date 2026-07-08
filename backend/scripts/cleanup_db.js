const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting database cleanup and synchronization...");

  // --- STEP 1: MERGE DUPLICATE RUBROS ---
  console.log("\n--- Step 1: Merging duplicate rubros ---");
  const rubros = await prisma.rubro.findMany();
  const rubroGroups = {};

  rubros.forEach(r => {
    const normName = r.name.trim().toUpperCase();
    if (!rubroGroups[normName]) {
      rubroGroups[normName] = [];
    }
    rubroGroups[normName].push(r);
  });

  for (const [normName, list] of Object.entries(rubroGroups)) {
    if (list.length > 1) {
      console.log(`Found duplicate rubro group: "${normName}" (${list.length} rubros)`);
      // Keep the one with the lowest ID
      list.sort((a, b) => a.id - b.id);
      const keeper = list[0];
      const duplicates = list.slice(1);

      for (const dup of duplicates) {
        console.log(`  Merging rubro ID ${dup.id} "${dup.name}" into keeper ID ${keeper.id} "${normName}"`);
        // Move products to keeper
        await prisma.product.updateMany({
          where: { rubroId: dup.id },
          data: { rubroId: keeper.id }
        });
        // Delete duplicate rubro
        await prisma.rubro.delete({
          where: { id: dup.id }
        });
      }

      // Rename keeper to standard name
      await prisma.rubro.update({
        where: { id: keeper.id },
        data: { name: normName }
      });
    } else {
      // Just standardize the name of single rubros to uppercase and trimmed
      const r = list[0];
      const standardizedName = r.name.trim().toUpperCase();
      if (r.name !== standardizedName) {
        try {
          await prisma.rubro.update({
            where: { id: r.id },
            data: { name: standardizedName }
          });
        } catch (e) {
          console.error(`Error renaming rubro ${r.id} to ${standardizedName}: ${e.message}`);
        }
      }
    }
  }

  // --- STEP 2: MERGE DUPLICATE PRODUCTS ---
  console.log("\n--- Step 2: Merging duplicate products ---");
  const products = await prisma.product.findMany({
    include: { rubro: true }
  });

  const productGroups = {};
  products.forEach(p => {
    const normName = p.name.trim().toLowerCase();
    if (!productGroups[normName]) {
      productGroups[normName] = [];
    }
    productGroups[normName].push(p);
  });

  const isNumericSku = (sku) => /^\d+$/.test(sku.trim());

  for (const [normName, list] of Object.entries(productGroups)) {
    if (list.length > 1) {
      console.log(`Found duplicate product group: "${normName}" (${list.length} products)`);
      
      // Select keeper: prefer numeric SKU (from Excel), then lowest ID
      let keeper = list.find(p => isNumericSku(p.sku));
      if (!keeper) {
        list.sort((a, b) => a.id - b.id);
        keeper = list[0];
      }
      
      const duplicates = list.filter(p => p.id !== keeper.id);

      // Gather merged info from duplicates
      let mergedBarcode = keeper.barcode;
      let mergedDescription = keeper.description;
      let mergedMinStock = keeper.minStock;
      let mergedIsPesable = keeper.isPesable;
      let mergedApproxWeight = keeper.approximateWeight;

      duplicates.forEach(dup => {
        if (!mergedBarcode && dup.barcode) mergedBarcode = dup.barcode;
        if (!mergedDescription && dup.description) mergedDescription = dup.description;
        if (dup.minStock > mergedMinStock) mergedMinStock = dup.minStock;
        if (dup.isPesable) mergedIsPesable = true;
        if ((!mergedApproxWeight || Number(mergedApproxWeight) === 0) && dup.approximateWeight) {
          mergedApproxWeight = dup.approximateWeight;
        }
      });

      // Redirect relations and delete duplicates FIRST
      for (const dup of duplicates) {
        console.log(`  Merging product ID ${dup.id} (SKU: ${dup.sku}) into keeper ID ${keeper.id} (SKU: ${keeper.sku})`);
        
        await prisma.orderItem.updateMany({
          where: { productId: dup.id },
          data: { productId: keeper.id }
        });
        await prisma.stockMovement.updateMany({
          where: { productId: dup.id },
          data: { productId: keeper.id }
        });
        await prisma.productLot.updateMany({
          where: { productId: dup.id },
          data: { productId: keeper.id }
        });
        await prisma.purchaseOrderItem.updateMany({
          where: { productId: dup.id },
          data: { productId: keeper.id }
        });
        await prisma.creditNoteItem.updateMany({
          where: { productId: dup.id },
          data: { productId: keeper.id }
        });

        // Delete duplicate product (frees up the barcode/sku)
        await prisma.product.delete({
          where: { id: dup.id }
        });
      }

      // Update keeper with merged info AFTER deleting duplicates
      await prisma.product.update({
        where: { id: keeper.id },
        data: {
          barcode: mergedBarcode,
          description: mergedDescription,
          minStock: mergedMinStock,
          isPesable: mergedIsPesable,
          approximateWeight: mergedApproxWeight
        }
      });
    }
  }

  // --- STEP 3: STANDARDIZE ALL PRICES TO FINAL PRICES (CON IVA) ---
  console.log("\n--- Step 3: Standardizing all product prices to final prices (Con IVA) ---");
  const allProducts = await prisma.product.findMany({
    include: { rubro: true }
  });

  let priceUpdatedCount = 0;
  for (const p of allProducts) {
    const margin = p.rubro ? Number(p.rubro.profitMargin) : 1.25;
    const cost = Number(p.costPrice) || 0;
    
    // Final price = Cost * Rubro Margin
    const calculatedFinalPrice = Math.max(0, Math.round(cost * margin * 100) / 100);
    const calculatedPriceB = Math.max(0, Math.round(calculatedFinalPrice * 0.95 * 100) / 100);
    const calculatedPriceC = Math.max(0, Math.round(calculatedFinalPrice * 0.90 * 100) / 100);

    await prisma.product.update({
      where: { id: p.id },
      data: {
        listPrice: calculatedFinalPrice,
        listPriceB: calculatedPriceB,
        listPriceC: calculatedPriceC
      }
    });
    priceUpdatedCount++;
  }

  console.log(`\nSuccessfully standardized prices for ${priceUpdatedCount} products.`);
  console.log("Database cleanup completed successfully.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
