const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetToTen() {
  console.log('🔄 Iniciando el reinicio de stock a 10 unidades y limpieza de transacciones...');

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
    await prisma.weeklyReport.deleteMany({});
    
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

    // 4. Reiniciar stock de productos a 10
    await prisma.product.updateMany({
      data: {
        stock: 10
      }
    });
    console.log('📦 4. Stock actual de todos los productos establecido a 10 unidades.');

    // 5. Reiniciar las secuencias de autoincremento para empezar desde 1
    const sequencesToReset = [
      'Order_id_seq',
      'OrderItem_id_seq',
      'ProductLot_id_seq',
      'OrderItemLot_id_seq',
      'StockMovement_id_seq',
      'CashDrawer_id_seq',
      'Transaction_id_seq',
      'AuditLog_id_seq',
      'SupplierInvoice_id_seq',
      'TaxWithholding_id_seq',
      'DeliveryRoute_id_seq',
      'PurchaseOrder_id_seq',
      'PurchaseOrderItem_id_seq',
      'CreditNote_id_seq',
      'CreditNoteItem_id_seq',
      'WeeklyReport_id_seq',
      'movement_seq'
    ];

    for (const seq of sequencesToReset) {
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "${seq}" RESTART WITH 1;`);
    }
    console.log('🔄 5. Secuencias de ID y movimientos reiniciadas a 1.');

    console.log('\n✨ ¡Reinicio a 10 unidades completado con éxito! Todo limpio y listo para probar.');
  } catch (error) {
    console.error('❌ Error durante el reinicio:', error);
  }
}

resetToTen()
  .catch((e) => {
    console.error('❌ Error general:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
