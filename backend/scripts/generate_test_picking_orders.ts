import prisma from '../src/utils/prisma';
import { OrderStatus, BillingType, InvoiceType, SalesChannel } from '@prisma/client';

async function main() {
  console.log('🚀 Generando 20 pedidos de prueba para el nuevo flujo de armado (WMS)...');

  // 1. Obtener vendedores y clientes activos
  const sellers = await prisma.user.findMany({ where: { role: 'VENDEDOR', isActive: true } });
  const clients = await prisma.persona.findMany({ where: { isClient: true, isActive: true }, take: 30 });
  const products = await prisma.product.findMany({ where: { isActive: true } });

  if (sellers.length === 0 || clients.length === 0 || products.length === 0) {
    console.error('❌ Falta información básica (vendedores, clientes o productos).');
    process.exit(1);
  }

  // Asegurar que algunos productos tengan zonas y ubicaciones cargadas para la prueba
  const frios = products.filter(p => p.isPesable || p.name.toLowerCase().includes('queso') || p.name.toLowerCase().includes('tybo') || p.name.toLowerCase().includes('cremoso'));
  const tablas = products.filter(p => p.name.toLowerCase().includes('baggio') || p.name.toLowerCase().includes('vino') || p.name.toLowerCase().includes('fernet') || p.name.toLowerCase().includes('aperitivo') || p.name.toLowerCase().includes('leche'));
  const cajas = products.filter(p => !frios.includes(p) && !tablas.includes(p));

  // Actualizar zonas rápidas de prueba para el demo
  for (const p of frios) {
    await prisma.product.update({
      where: { id: p.id },
      data: { pickingZone: 'FRIO', defaultLocation: 'DEP1-CAM1-A' }
    });
  }
  for (const p of tablas) {
    await prisma.product.update({
      where: { id: p.id },
      data: { pickingZone: 'TABLA', defaultLocation: 'DEP1-EST1' }
    });
  }
  for (const p of cajas) {
    await prisma.product.update({
      where: { id: p.id },
      data: { pickingZone: 'CAJAS', defaultLocation: 'DEP2-RACK-AZUL' }
    });
  }

  console.log(`✅ Zonas de prueba asignadas a ${products.length} productos.`);

  let createdOrders = 0;

  for (let i = 1; i <= 20; i++) {
    const client = clients[Math.floor(Math.random() * clients.length)];
    const seller = sellers[Math.floor(Math.random() * sellers.length)];

    // Elegir de 3 a 6 productos al azar para el pedido
    const numItems = Math.floor(Math.random() * 4) + 3;
    const selectedProducts: typeof products = [];
    
    // Asegurar combinación de Frío, Cajas y Tabla en los pedidos de prueba
    if (frios.length > 0) selectedProducts.push(frios[Math.floor(Math.random() * frios.length)]);
    if (cajas.length > 0) selectedProducts.push(cajas[Math.floor(Math.random() * cajas.length)]);
    if (tablas.length > 0) selectedProducts.push(tablas[Math.floor(Math.random() * tablas.length)]);

    while (selectedProducts.length < numItems) {
      const p = products[Math.floor(Math.random() * products.length)];
      if (!selectedProducts.includes(p)) selectedProducts.push(p);
    }

    let totalAmount = 0;
    const itemsData = selectedProducts.map(p => {
      const quantity = Math.floor(Math.random() * 4) + 1;
      const unitPrice = Number(p.listPrice) || 1000;
      const subtotal = Math.round(unitPrice * quantity * 100) / 100;
      totalAmount += subtotal;

      return {
        productId: p.id,
        quantity,
        unitPrice,
        subtotal,
        weight: p.isPesable ? (p.approximateWeight ? Number(p.approximateWeight) * quantity : 4 * quantity) : null
      };
    });

    const isOfficial = i % 2 === 0;

    await prisma.order.create({
      data: {
        personaId: client.id,
        sellerId: seller.id,
        billingType: isOfficial ? BillingType.OFFICIAL : BillingType.INTERNAL,
        invoiceType: isOfficial ? InvoiceType.FACTURA_B : InvoiceType.PRESUPUESTO,
        status: OrderStatus.PENDING,
        totalAmount,
        netAmount: Math.round((totalAmount / 1.21) * 100) / 100,
        taxAmount: Math.round((totalAmount - totalAmount / 1.21) * 100) / 100,
        salesChannel: SalesChannel.PREVENTA_RUTA,
        bultosCount: Math.floor(Math.random() * 3) + 1,
        items: {
          create: itemsData
        }
      }
    });

    createdOrders++;
  }

  console.log(`\n🎉 ¡Se crearon ${createdOrders} pedidos de prueba en estado PENDING (Esperando Armado)!`);
}

main()
  .catch((e) => {
    console.error('❌ Error generando pedidos de prueba:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
