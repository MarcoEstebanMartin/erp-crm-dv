const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetMovements() {
  console.log('🔄 Iniciando el reinicio de movimientos...');

  try {
    // 1. Eliminar datos transaccionales respetando la integridad referencial (clave foránea)
    await prisma.auditLog.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    
    await prisma.orderItemLot.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.productLot.deleteMany({});
    await prisma.creditNoteItem.deleteMany({});
    await prisma.creditNote.deleteMany({});
    await prisma.order.deleteMany({});
    
    await prisma.supplierInvoice.deleteMany({});
    await prisma.taxWithholding.deleteMany({});
    await prisma.deliveryRoute.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.cashDrawer.deleteMany({});
    
    console.log('🧹 1. Tablas transaccionales vaciadas con éxito.');

    // 2. Reiniciar los saldos de cuentas corrientes de Clientes y Proveedores a 0.00
    await prisma.persona.updateMany({
      data: {
        outstandingBalance: 0.00
      }
    });
    console.log('💳 2. Saldos de cuentas corrientes (personas) reiniciados a 0.00.');

    // 3. Reiniciar saldo de cuentas bancarias a 0.00
    await prisma.bankAccount.updateMany({
      data: {
        balance: 0.00
      }
    });
    console.log('🏦 3. Saldos de cuentas bancarias reiniciados a 0.00.');

    // 4. Reiniciar stock de productos a 0 (para que puedas probar ajustes o ingresos de stock)
    await prisma.product.updateMany({
      data: {
        stock: 0
      }
    });
    console.log('📦 4. Stock actual de todos los productos reiniciado a 0.');

    console.log('\n✨ ¡Reinicio completado con éxito! Todo listo para nuevas pruebas.');
  } catch (error) {
    console.error('❌ Error durante el reinicio:', error);
  }
}

resetMovements()
  .catch((e) => {
    console.error('❌ Error general:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
