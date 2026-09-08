const { PrismaClient, OrderStatus, MovementType, BillingType } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Iniciando prueba de edición atómica de pedidos (updateOrder)...');

  try {
    const user = await prisma.user.findFirst({ where: { isActive: true } });
    const persona = await prisma.persona.findFirst({ where: { isClient: true, isActive: true } });
    const product = await prisma.product.findFirst({ where: { isActive: true, stock: { gt: 10 } } });

    if (!user || !persona || !product) {
      console.error('❌ Datos insuficientes para la prueba.');
      return;
    }

    console.log(`📦 Producto de prueba: "${product.name}" (ID ${product.id}), Stock actual: ${product.stock}`);
    const initialStock = product.stock;

    // 1. Crear pedido inicial de 3 unidades
    const order = await prisma.order.create({
      data: {
        personaId: persona.id,
        sellerId: user.id,
        status: OrderStatus.PENDING,
        billingType: BillingType.INTERNAL,
        totalAmount: 100,
        items: {
          create: [
            {
              productId: product.id,
              quantity: 3,
              unitPrice: 33.33,
              subtotal: 100,
            }
          ]
        }
      },
      include: { items: true }
    });

    // Descontar las 3 unidades manualmente como lo hace createOrder
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: { decrement: 3 } }
    });

    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        quantity: -3,
        type: MovementType.OUT,
        orderId: order.id,
        referenceId: `ORDER-${order.id}`,
        userId: user.id,
        reason: `Venta - Reserva de Pedido #${order.id}`,
      }
    });

    const stockAfterCreate = (await prisma.product.findUnique({ where: { id: product.id } })).stock;
    console.log(`✅ Pedido #${order.id} creado con 3 unidades. Stock post-creación: ${stockAfterCreate} (esperado: ${initialStock - 3})`);

    // 2. Simular llamada a updateOrder para cambiar la cantidad a 5 unidades
    // Importamos la función compilada desde dist
    const { updateOrder } = require('../dist/controllers/order.controller');

    const reqMock = {
      params: { id: order.id.toString() },
      user: { id: user.id, role: 'ADMIN' },
      body: {
        items: [
          {
            productId: product.id,
            quantity: 5,
            isEmergencyOverride: true
          }
        ]
      }
    };

    let responseData = null;
    let statusCode = 200;
    const resMock = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      }
    };

    await updateOrder(reqMock, resMock);

    if (statusCode !== 200) {
      console.error('❌ Error ejecutando updateOrder:', responseData);
      return;
    }

    const stockAfterUpdate = (await prisma.product.findUnique({ where: { id: product.id } })).stock;
    console.log(`✅ Pedido actualizado a 5 unidades. Stock post-update: ${stockAfterUpdate} (esperado: ${initialStock - 5})`);

    if (stockAfterUpdate !== initialStock - 5) {
      console.error(`❌ El stock no coincide. Esperado: ${initialStock - 5}, obtenido: ${stockAfterUpdate}`);
    } else {
      console.log('🎉 ¡El stock fue restaurado y descontado atómicamente con precisión!');
    }

    // 3. Verificar sincronización de StockMovement
    const movements = await prisma.stockMovement.findMany({
      where: { orderId: order.id, referenceId: `ORDER-${order.id}` }
    });
    console.log(`📊 Movimientos de stock para Pedido #${order.id}:`, movements.map(m => ({ id: m.id, qty: m.quantity, reason: m.reason })));
    if (movements.length === 1 && movements[0].quantity === -5) {
      console.log('🎉 ¡StockMovement sincronizado correctamente con las 5 unidades!');
    } else {
      console.error('❌ StockMovement no refleja las 5 unidades del pedido.');
    }

    // 4. Probar intento de sobrepasar el stock disponible
    console.log('\n⚡ Probando rechazo por stock insuficiente (con IGNORE_STOCK_CHECK=false)...');
    process.env.IGNORE_STOCK_CHECK = 'false';
    const reqOversell = {
      params: { id: order.id.toString() },
      user: { id: user.id, role: 'ADMIN' },
      body: {
        items: [
          {
            productId: product.id,
            quantity: 999999, // Supera con creces el stock
            isEmergencyOverride: true
          }
        ]
      }
    };

    let oversellResponse = null;
    let oversellStatus = 200;
    const resOversellMock = {
      status: (code) => {
        oversellStatus = code;
        return {
          json: (data) => {
            oversellResponse = data;
          }
        };
      }
    };

    await updateOrder(reqOversell, resOversellMock);
    console.log(`Respuesta al intentar oversell (Status: ${oversellStatus}):`, oversellResponse?.message);

    const stockAfterOversellAttempt = (await prisma.product.findUnique({ where: { id: product.id } })).stock;
    console.log(`Stock post-intento de oversell: ${stockAfterOversellAttempt} (debe seguir siendo ${initialStock - 5})`);

    if (oversellStatus === 400 && stockAfterOversellAttempt === initialStock - 5) {
      console.log('🎉 ¡Oversell rechazado y transacción revertida con éxito (Rollback intacto)!');
    } else {
      console.error('❌ Falla en el control de oversell.');
    }

    // Limpieza
    await prisma.stockMovement.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: initialStock }
    });
    console.log('\n🧹 Datos de prueba limpiados exitosamente.');

  } catch (err) {
    console.error('❌ Error en prueba:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
