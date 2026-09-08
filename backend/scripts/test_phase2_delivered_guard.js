const { PrismaClient, OrderStatus, BillingType, MovementType } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Iniciando prueba de Fase 2: Blindaje de DELIVERED y Cuentas Corrientes...');

  try {
    const user = await prisma.user.findFirst({ where: { isActive: true } });
    const persona = await prisma.persona.findFirst({ where: { isClient: true, isActive: true } });
    const product = await prisma.product.findFirst({ where: { isActive: true, stock: { gt: 10 } } });

    if (!user || !persona || !product) {
      console.error('❌ Datos insuficientes para la prueba.');
      return;
    }

    const { updateOrderStatus } = require('../dist/controllers/order.controller');

    // 1. Crear un pedido de prueba
    const order = await prisma.order.create({
      data: {
        personaId: persona.id,
        sellerId: user.id,
        status: OrderStatus.PREPARED,
        billingType: BillingType.INTERNAL,
        totalAmount: 500,
        items: {
          create: [
            {
              productId: product.id,
              quantity: 1,
              unitPrice: 500,
              subtotal: 500,
            }
          ]
        }
      }
    });

    console.log(`✅ Pedido de prueba #${order.id} creado en estado PREPARED.`);

    // 2. Intentar asignarle DELIVERED directamente vía updateOrderStatus
    console.log('\n⚡ Test 1: Intentar pasar pedido a DELIVERED manualmente...');
    let resStatus = 200;
    let resData = null;
    await updateOrderStatus({
      params: { id: order.id.toString() },
      user: { id: user.id, role: 'ADMIN' },
      body: { status: OrderStatus.DELIVERED }
    }, {
      status: (c) => { resStatus = c; return { json: (d) => { resData = d; } }; }
    });

    console.log(`Resultado (Status: ${resStatus}):`, resData?.message);
    if (resStatus === 400 && resData?.message?.includes('no se puede asignar manualmente')) {
      console.log('🎉 ¡Bloqueo exitoso! No se permite pasar pedidos a DELIVERED fuera de Facturación/Logística.');
    } else {
      console.error('❌ Falla: no se bloqueó la transición manual a DELIVERED.');
    }

    // 3. Simular que el pedido está DELIVERED y tiene un cobro registrado en caja
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DELIVERED }
    });

    const txPayment = await prisma.transaction.create({
      data: {
        orderId: order.id,
        personaId: persona.id,
        userId: user.id,
        type: 'INCOME',
        billingType: BillingType.INTERNAL,
        paymentMethod: 'CASH',
        amount: 500,
        description: 'Cobro de prueba',
        verified: true
      }
    });

    console.log('\n⚡ Test 2: Intentar cancelar pedido DELIVERED con cobros registrados...');
    let cancelStatus = 200;
    let cancelData = null;
    await updateOrderStatus({
      params: { id: order.id.toString() },
      user: { id: user.id, role: 'ADMIN' },
      body: { status: OrderStatus.CANCELLED }
    }, {
      status: (c) => { cancelStatus = c; return { json: (d) => { cancelData = d; } }; }
    });

    console.log(`Resultado (Status: ${cancelStatus}):`, cancelData?.message);
    if (cancelStatus === 400 && cancelData?.message?.includes('posee cobros registrados')) {
      console.log('🎉 ¡Bloqueo exitoso! Se protegió la caja y no se permitió cancelar un pedido cobrado.');
    } else {
      console.error('❌ Falla: se permitió cancelar un pedido que ya tenía cobros asentados.');
    }

    // Limpieza
    await prisma.transaction.delete({ where: { id: txPayment.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    console.log('\n🧹 Datos de prueba limpiados exitosamente.');

  } catch (err) {
    console.error('❌ Error en prueba:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
