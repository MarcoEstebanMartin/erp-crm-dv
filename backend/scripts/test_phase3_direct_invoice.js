const { PrismaClient, BillingType } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Iniciando prueba de Fase 3: Pre-validación de Stock en Facturación Directa...');

  try {
    const user = await prisma.user.findFirst({ where: { isActive: true } });
    const persona = await prisma.persona.findFirst({ where: { isClient: true, isActive: true } });
    const product = await prisma.product.findFirst({ where: { isActive: true, stock: { gt: 0 } } });

    if (!user || !persona || !product) {
      console.error('❌ Datos insuficientes para la prueba.');
      return;
    }

    const { createDirectInvoice } = require('../dist/controllers/order.controller');

    const ordersCountBefore = await prisma.order.count();

    // 1. Probar venta directa con cantidad que excede el stock disponible
    console.log(`\n⚡ Test: Intentar facturación directa con 999999 unidades de "${product.name}" (Stock: ${product.stock})...`);
    process.env.IGNORE_STOCK_CHECK = 'false';

    let resStatus = 200;
    let resData = null;
    await createDirectInvoice({
      user: { id: user.id, role: 'ADMIN' },
      body: {
        personaId: persona.id,
        billingType: BillingType.INTERNAL,
        items: [
          {
            productId: product.id,
            quantity: 999999
          }
        ]
      }
    }, {
      status: (c) => { resStatus = c; return { json: (d) => { resData = d; } }; }
    });

    console.log(`Resultado (Status: ${resStatus}):`, resData?.message);
    const ordersCountAfter = await prisma.order.count();

    if (resStatus === 400 && resData?.message?.includes('Stock insuficiente')) {
      console.log('🎉 ¡Rechazo preventivo correcto antes de crear órdenes o invocar facturación!');
    } else {
      console.error('❌ Falla: no se rechazó por stock insuficiente.');
    }

    if (ordersCountAfter === ordersCountBefore) {
      console.log('🎉 ¡Cero órdenes huérfanas creadas! La base de datos permaneció 100% limpia.');
    } else {
      console.error('❌ Falla: se creó una orden en la base de datos a pesar del error de stock.');
    }

  } catch (err) {
    console.error('❌ Error en prueba:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
