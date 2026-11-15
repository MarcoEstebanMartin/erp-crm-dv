const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const INITIAL_STOCK_PER_ACTIVE_PRODUCT = 200;
const DEFAULT_LOT_EXPIRY = new Date('2036-12-31T00:00:00.000Z');

const SEQUENCES_TO_RESET = [
  'AccountLedger_id_seq',
  'AuditLog_id_seq',
  'CashDrawer_id_seq',
  'CreditNoteItem_id_seq',
  'CreditNote_id_seq',
  'CrmOrderDraft_id_seq',
  'DeliveryRoute_id_seq',
  'Expense_id_seq',
  'FuelLog_id_seq',
  'OrderItemLot_id_seq',
  'OrderItem_id_seq',
  'Order_id_seq',
  'Payroll_id_seq',
  'ProductLot_id_seq',
  'PurchaseOrderItem_id_seq',
  'PurchaseOrder_id_seq',
  'RouteGpsPing_id_seq',
  'SalaryAdvance_id_seq',
  'SaleRouteVisit_id_seq',
  'StockMovement_id_seq',
  'SupplierInvoice_id_seq',
  'TaxWithholding_id_seq',
  'Transaction_id_seq',
  'VehicleMaintenance_id_seq',
  'WeeklyReport_id_seq',
  'movement_seq',
];

function buildInitialLotsPlan(activeProducts, wmsLots) {
  const lotsByProduct = new Map();
  for (const lot of wmsLots) {
    if (!lotsByProduct.has(lot.productId)) lotsByProduct.set(lot.productId, []);
    lotsByProduct.get(lot.productId).push(lot);
  }

  const lotsToCreate = [];
  for (const prod of activeProducts) {
    let remaining = INITIAL_STOCK_PER_ACTIVE_PRODUCT;
    const seenKeys = new Set();

    for (const wms of lotsByProduct.get(prod.id) || []) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, Math.max(0, Number(wms.stock) || 0));
      if (alloc <= 0) continue;
      const key = `${prod.id}::${wms.lotNumber}::${wms.location}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      lotsToCreate.push({
        productId: prod.id,
        lotNumber: wms.lotNumber,
        location: wms.location,
        expirationDate: wms.expirationDate || DEFAULT_LOT_EXPIRY,
        stock: alloc,
      });
      remaining -= alloc;
    }

    if (remaining > 0) {
      lotsToCreate.push({
        productId: prod.id,
        lotNumber: 'S/L',
        location: 'S/U',
        expirationDate: DEFAULT_LOT_EXPIRY,
        stock: remaining,
      });
    }
  }
  return lotsToCreate;
}

async function runPostResetAudit(expectedActiveCount, expectedVehicleExpiries) {
  const [
    orders,
    accountLedger,
    transactions,
    cashDrawers,
    deliveryRoutes,
    creditNotes,
    personasNonZero,
    banksNonZero,
    activeProductsCount,
    activeNot200,
    inactiveWithStock,
    vehicleExpiries,
    allProducts,
    lotSums,
    movSums,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.accountLedger.count(),
    prisma.transaction.count(),
    prisma.cashDrawer.count(),
    prisma.deliveryRoute.count(),
    prisma.creditNote.count(),
    prisma.persona.count({ where: { NOT: { outstandingBalance: 0 } } }),
    prisma.bankAccount.count({ where: { NOT: { balance: 0 } } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, stock: { not: INITIAL_STOCK_PER_ACTIVE_PRODUCT } } }),
    prisma.product.count({ where: { isActive: false, stock: { not: 0 } } }),
    prisma.vehicleExpiry.count(),
    prisma.product.findMany({ select: { id: true, stock: true } }),
    prisma.productLot.groupBy({ by: ['productId'], _sum: { stock: true } }),
    prisma.stockMovement.groupBy({ by: ['productId'], _sum: { quantity: true } }),
  ]);

  const lotMap = new Map(lotSums.map((r) => [r.productId, Number(r._sum.stock || 0)]));
  const movMap = new Map(movSums.map((r) => [r.productId, Number(r._sum.quantity || 0)]));
  let stockVsLotsMismatches = 0;
  let stockVsKardexMismatches = 0;
  let totalStockUnits = 0;

  for (const prod of allProducts) {
    totalStockUnits += prod.stock;
    if (prod.stock !== (lotMap.get(prod.id) || 0)) stockVsLotsMismatches++;
    if (prod.stock !== (movMap.get(prod.id) || 0)) stockVsKardexMismatches++;
  }

  const audit = {
    orders,
    accountLedger,
    transactions,
    cashDrawers,
    deliveryRoutes,
    creditNotes,
    personasConSaldoDistintoDeCero: personasNonZero,
    bancosConSaldoDistintoDeCero: banksNonZero,
    productosActivos: activeProductsCount,
    productosActivosDistintosDe200: activeNot200,
    productosInactivosConStock: inactiveWithStock,
    totalUnidadesStock: totalStockUnits,
    descalcesStockVsLotes: stockVsLotsMismatches,
    descalcesStockVsKardex: stockVsKardexMismatches,
    vehicleExpiries,
  };

  console.log('\n📊 AUDITORÍA POST-REINICIO:', JSON.stringify(audit, null, 2));

  const failed =
    orders !== 0 ||
    accountLedger !== 0 ||
    transactions !== 0 ||
    cashDrawers !== 0 ||
    deliveryRoutes !== 0 ||
    creditNotes !== 0 ||
    personasNonZero !== 0 ||
    banksNonZero !== 0 ||
    activeProductsCount !== expectedActiveCount ||
    activeNot200 !== 0 ||
    inactiveWithStock !== 0 ||
    stockVsLotsMismatches !== 0 ||
    stockVsKardexMismatches !== 0 ||
    vehicleExpiries !== expectedVehicleExpiries;

  if (failed) {
    throw new Error('La auditoría post-reinicio detectó discrepancias contables o de stock.');
  }
}

async function resetMovements() {
  console.log('🔄 Iniciando reinicio atómico del sistema para simulación (200 u. iniciales)...');

  const adminUser =
    (await prisma.user.findFirst({ where: { username: 'admin', isActive: true } })) ||
    (await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } })) ||
    (await prisma.user.findFirst({ where: { isActive: true } }));

  if (!adminUser) {
    throw new Error('No se encontró un usuario administrador activo para imputar el inventario inicial.');
  }

  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, sku: true },
    orderBy: { id: 'asc' },
  });
  const activeIds = activeProducts.map((p) => p.id);

  const [wmsLotsSnapshot, expectedVehicleExpiries] = await Promise.all([
    prisma.productLot.findMany({
      where: { location: { not: 'S/U' }, stock: { gt: 0 }, productId: { in: activeIds } },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      select: { productId: true, lotNumber: true, expirationDate: true, location: true, stock: true },
    }),
    prisma.vehicleExpiry.count(),
  ]);

  const lotsToCreate = buildInitialLotsPlan(activeProducts, wmsLotsSnapshot);

  await prisma.$transaction(
    async (tx) => {
      await tx.accountLedger.deleteMany({});
      await tx.crmOrderDraft.deleteMany({});
      await tx.routeGpsPing.deleteMany({});
      await tx.saleRouteVisit.deleteMany({});
      await tx.vehicleMaintenance.deleteMany({});
      await tx.fuelLog.deleteMany({});
      await tx.salaryAdvance.deleteMany({});
      await tx.payroll.deleteMany({});
      await tx.auditLog.deleteMany({});
      await tx.expense.deleteMany({});
      await tx.stockMovement.deleteMany({});
      await tx.orderItemLot.deleteMany({});
      await tx.creditNoteItem.deleteMany({});
      await tx.creditNote.deleteMany({});
      await tx.orderItem.deleteMany({});
      await tx.transaction.deleteMany({});
      await tx.productLot.deleteMany({});
      await tx.order.deleteMany({});
      await tx.supplierInvoice.deleteMany({});
      await tx.taxWithholding.deleteMany({});
      await tx.deliveryRoute.deleteMany({});
      await tx.purchaseOrderItem.deleteMany({});
      await tx.purchaseOrder.deleteMany({});
      await tx.cashDrawer.deleteMany({});
      await tx.weeklyReport.deleteMany({});

      await tx.persona.updateMany({ data: { outstandingBalance: 0.0 } });
      await tx.bankAccount.updateMany({ data: { balance: 0.0 } });
      await tx.product.updateMany({ where: { isActive: false }, data: { stock: 0 } });
      await tx.product.updateMany({
        where: { isActive: true },
        data: { stock: INITIAL_STOCK_PER_ACTIVE_PRODUCT },
      });

      for (const seq of SEQUENCES_TO_RESET) {
        await tx.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS "${seq}" RESTART WITH 1;`);
      }

      if (lotsToCreate.length > 0) {
        await tx.productLot.createMany({ data: lotsToCreate });
        const createdLots = await tx.productLot.findMany({
          select: { id: true, productId: true, stock: true },
        });
        await tx.stockMovement.createMany({
          data: createdLots.map((lot) => ({
            productId: lot.productId,
            quantity: lot.stock,
            type: 'IN',
            userId: adminUser.id,
            reason: `Inventario Inicial Simulación Operativa (${INITIAL_STOCK_PER_ACTIVE_PRODUCT} u.)`,
            productLotId: lot.id,
          })),
        });
      }

      await tx.systemSetting.upsert({
        where: { key: 'afip_mock_mode' },
        update: { value: 'true' },
        create: { key: 'afip_mock_mode', value: 'true' },
      });
    },
    { maxWait: 15000, timeout: 60000 },
  );

  await runPostResetAudit(activeProducts.length, expectedVehicleExpiries);
  console.log('\n✨ Reinicio limpio completado con éxito. Sistema listo para simulación con 0 discrepancias.');
}

resetMovements()
  .catch((e) => {
    console.error('❌ Error durante el reinicio:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
