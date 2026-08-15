const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetMovements() {
  console.log('🔄 Iniciando el reinicio transaccional completo del sistema...');

  try {
    // 1. Eliminar datos transaccionales en orden de dependencia referencial (Foreign Keys)
    console.log('🧹 Eliminando mensajes y borradores CRM...');
    await prisma.crmMessage.deleteMany({});
    await prisma.crmOrderDraft.deleteMany({});
    await prisma.crmConversation.deleteMany({});

    console.log('🧹 Eliminando registros operativos de flota y GPS...');
    await prisma.routeGpsPing.deleteMany({});
    await prisma.saleRouteVisit.deleteMany({});
    await prisma.vehicleMaintenance.deleteMany({});
    await prisma.fuelLog.deleteMany({});
    await prisma.vehicleExpiry.deleteMany({});

    console.log('🧹 Eliminando sueldos y adelantos...');
    await prisma.salaryAdvance.deleteMany({});
    await prisma.payroll.deleteMany({});

    console.log('🧹 Eliminando auditoría, gastos y movimientos financieros...');
    await prisma.auditLog.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.stockMovement.deleteMany({});

    console.log('🧹 Eliminando facturas de venta, notas de crédito y presupuestos...');
    await prisma.orderItemLot.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.productLot.deleteMany({});
    await prisma.creditNoteItem.deleteMany({});
    await prisma.creditNote.deleteMany({});
    await prisma.order.deleteMany({});

    console.log('🧹 Eliminando facturas de compra y órdenes a proveedores...');
    await prisma.supplierInvoice.deleteMany({});
    await prisma.taxWithholding.deleteMany({});
    await prisma.deliveryRoute.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.cashDrawer.deleteMany({});
    await prisma.weeklyReport.deleteMany({});

    console.log('✅ 1. Tablas transaccionales vaciadas con éxito.');

    // 2. Reiniciar los saldos de cuentas corrientes de Clientes y Proveedores a 0.00
    await prisma.persona.updateMany({
      data: {
        outstandingBalance: 0.00
      }
    });
    console.log('💳 2. Saldos de cuentas corrientes (clientes/proveedores) reiniciados a 0.00.');

    // 3. Reiniciar saldo de cuentas bancarias a 0.00
    await prisma.bankAccount.updateMany({
      data: {
        balance: 0.00
      }
    });
    console.log('🏦 3. Saldos de cuentas bancarias reiniciados a 0.00.');

    // 4. Reiniciar stock de productos a 0
    await prisma.product.updateMany({
      data: {
        stock: 0
      }
    });
    console.log('📦 4. Stock actual de todos los productos reiniciado a 0.');

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
      'Expense_id_seq',
      'FuelLog_id_seq',
      'VehicleMaintenance_id_seq',
      'SalaryAdvance_id_seq',
      'Payroll_id_seq',
      'CrmConversation_id_seq',
      'CrmMessage_id_seq',
      'CrmOrderDraft_id_seq',
      'movement_seq'
    ];

    for (const seq of sequencesToReset) {
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "${seq}" RESTART WITH 1;`);
    }
    console.log('🔄 5. Secuencias de ID y numeración de movimientos reiniciadas a 1.');

    console.log('\n✨ ¡Reinicio completado con éxito! Todo listo para iniciar operaciones desde 0.');
    console.log('🛡️  IMPORTANTE: Los Productos, Clientes, Proveedores, Usuarios, Precios e Imágenes fueron preservados intactos.');
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

