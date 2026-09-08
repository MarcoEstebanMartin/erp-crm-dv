const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runStressTest() {
  console.log('⚡ Iniciando Prueba de Carga y Concurrencia (Simulación de Preventa Móvil)...');

  try {
    // 1. Obtener datos de prueba
    const persona = await prisma.persona.findFirst({ where: { isClient: true, isActive: true } });
    const products = await prisma.product.findMany({ where: { isActive: true }, take: 5 });

    const user = await prisma.user.findFirst({ where: { isActive: true } });
    if (!persona || products.length === 0 || !user) {
      console.error('❌ Se requieren al menos 1 cliente, 1 usuario y 1 producto activo en la base de datos para la prueba.');
      return;
    }

    const CONCURRENT_REQUESTS = 10;
    console.log(`📈 Simulando ${CONCURRENT_REQUESTS} vendedores cargando pedidos en simultáneo para cliente #${persona.id} (${persona.name}) usando usuario #${user.id}...`);

    const startTime = Date.now();

    // Importar dinámicamente el servicio de órdenes compilado o ejecutar via API
    const { OrderService } = require('../dist/services/order.service');

    const promises = Array.from({ length: CONCURRENT_REQUESTS }).map(async (_, idx) => {
      const selectedProduct = products[idx % products.length];
      const startReq = Date.now();
      try {
        const order = await OrderService.createOrder({
          sellerId: user.id,
          userRole: 'ADMIN',
          personaId: persona.id,
          billingType: 'INTERNAL',
          items: [
            {
              productId: selectedProduct.id,
              quantity: selectedProduct.minOrderQuantity || 1,
              isEmergencyOverride: true,
              weight: selectedProduct.isPesable ? 1.25 : undefined
            }
          ]
        });
        const elapsedReq = Date.now() - startReq;
        return { success: true, orderId: order.id, latencyMs: elapsedReq };
      } catch (err) {
        const elapsedReq = Date.now() - startReq;
        return { success: false, error: err.message, latencyMs: elapsedReq };
      }
    });

    const results = await Promise.all(promises);
    const totalTimeMs = Date.now() - startTime;

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const avgLatency = Math.round(results.reduce((acc, r) => acc + r.latencyMs, 0) / results.length);

    console.log('\n📊 RESULTADOS DE LA PRUEBA DE CONCURRENCIA:');
    console.log(`- Solicitudes Totales: ${CONCURRENT_REQUESTS}`);
    console.log(`- Solicitudes Exitosas: ${successful.length}`);
    console.log(`- Solicitudes Fallidas/Rechazadas: ${failed.length}`);
    console.log(`- Tiempo Total de Ejecución: ${totalTimeMs} ms`);
    console.log(`- Latencia Promedio por Pedido: ${avgLatency} ms`);

    if (failed.length > 0) {
      console.log('\n⚠️ Detalle de solicitudes rechazadas (Control de Stock / Límites):');
      failed.forEach((f, i) => console.log(`   [${i + 1}] ${f.error} (${f.latencyMs} ms)`));
    } else {
      console.log('🎉 ¡Todas las solicitudes concurrentes se procesaron sin bloqueos de base de datos!');
    }
  } catch (error) {
    console.error('❌ Error ejecutando la prueba de concurrencia:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

runStressTest();
