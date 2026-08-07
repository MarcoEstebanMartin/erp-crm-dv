const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function debugExactError() {
  const lot = await prisma.productLot.findFirst({
    where: { stock: { gt: 0 } }
  });

  if (!lot) {
    console.log("No lot with stock > 0 found.");
    return;
  }

  console.log("Testing adjustStock simulation for lot:", {
    id: lot.id,
    productId: lot.productId,
    lotNumber: lot.lotNumber,
    stock: lot.stock,
    location: lot.location
  });

  try {
    const product = await prisma.product.findUnique({ where: { id: lot.productId } });
    const change = -lot.stock;
    const newStock = Math.max(0, product.stock + change);

    console.log("Product before:", { id: product.id, stock: product.stock, defaultLocation: product.defaultLocation });

    const result = await prisma.$transaction(async (tx) => {
      let lotToUpdate = await tx.productLot.findUnique({
        where: { id: lot.id }
      });

      console.log("Found lot in tx:", lotToUpdate);

      const updatedLotStock = Math.max(0, lotToUpdate.stock + change);

      if (updatedLotStock <= 0) {
        console.log("Deleting lot ID:", lotToUpdate.id);
        await tx.productLot.delete({
          where: { id: lotToUpdate.id }
        });
      } else {
        await tx.productLot.update({
          where: { id: lotToUpdate.id },
          data: { stock: updatedLotStock }
        });
      }

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: { stock: newStock }
      });

      console.log("Creating stock movement...");
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: change,
          type: 'OUT',
          reason: 'Eliminación completa desde WMS',
          userId: 1,
          productLotId: null
        }
      });

      return { updatedProduct, movement };
    });

    console.log("Transaction succeeded cleanly!", result.movement.id);
  } catch (err) {
    console.error("EXACT ERROR CAUGHT:", err);
  }
}

debugExactError().finally(() => prisma.$disconnect());
