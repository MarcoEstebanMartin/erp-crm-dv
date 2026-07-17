const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setStockTo100() {
  console.log('🔄 Iniciando la inicialización de stock a 100 unidades para todos los productos...');

  try {
    // 1. Obtener todos los productos
    const products = await prisma.product.findMany();
    console.log(`📦 Se encontraron ${products.length} productos.`);

    // Obtener un usuario Administrador por defecto para registrar los movimientos de stock
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      throw new Error('No se encontró ningún usuario Administrador en la base de datos para registrar los movimientos.');
    }

    let updatedCount = 0;

    for (const product of products) {
      // Calcular la diferencia de stock para registrar el movimiento
      const currentStock = product.stock || 0;
      const difference = 100 - currentStock;

      // Si ya tiene exactamente 100 de stock, podemos omitir o forzar el lote
      // Actualizar el stock del producto a 100
      await prisma.product.update({
        where: { id: product.id },
        data: { stock: 100 }
      });

      // Crear o actualizar el lote 'S/L' (Sin Lote / Lote por Defecto) para este producto a 100 unidades
      const lot = await prisma.productLot.upsert({
        where: {
          productId_lotNumber: {
            productId: product.id,
            lotNumber: 'S/L'
          }
        },
        update: {
          stock: 100,
          expirationDate: new Date('2036-12-31T00:00:00Z')
        },
        create: {
          productId: product.id,
          lotNumber: 'S/L',
          expirationDate: new Date('2036-12-31T00:00:00Z'),
          stock: 100
        }
      });

      // Registrar un movimiento de ajuste si hay diferencia
      if (difference !== 0) {
        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            quantity: difference,
            type: difference > 0 ? 'IN' : 'OUT',
            reason: `Ajuste inicial para pruebas de stock (Establecer a 100)`,
            userId: adminUser.id,
            productLotId: lot.id
          }
        });
      }

      updatedCount++;
    }

    console.log(`✨ ¡Proceso completado! Se actualizaron ${updatedCount} productos con stock de 100 y sus respectivos lotes por defecto.`);
  } catch (error) {
    console.error('❌ Error durante la inicialización del stock:', error);
  }
}

setStockTo100()
  .catch((e) => {
    console.error('❌ Error general:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
