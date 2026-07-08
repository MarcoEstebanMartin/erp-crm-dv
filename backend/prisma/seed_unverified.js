const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando carga de transacciones no verificadas (recibos y repartos)...');

  // 1. Limpiar transacciones existentes no verificadas para evitar duplicados en pruebas
  await prisma.transaction.deleteMany({
    where: { verified: false }
  });
  console.log('🧹 Transacciones no verificadas anteriores eliminadas.');

  // 2. Buscar Vendedores
  const norberto = await prisma.user.findFirst({
    where: { username: { contains: 'NORBERTO', mode: 'insensitive' } }
  });
  const fabian = await prisma.user.findFirst({
    where: { username: { contains: 'FABIAN', mode: 'insensitive' } }
  });

  if (!norberto || !fabian) {
    console.error('❌ Error: No se encontraron los usuarios NORBERTO o FABIAN. Asegúrese de haber corrido el seed principal.');
    return;
  }

  // 3. Buscar clientes realistas
  const clients = await prisma.persona.findMany({
    where: { isClient: true },
    take: 5
  });

  if (clients.length < 3) {
    console.error('❌ Error: Se necesitan al menos 3 clientes para generar los recibos.');
    return;
  }

  const p1 = clients[0];
  const p2 = clients[1];
  const p3 = clients[2];
  const p4 = clients[3] || clients[0];

  // 4. Crear Recibos de Vendedores (verified: false)
  // Norberto
  await prisma.transaction.create({
    data: {
      userId: norberto.id,
      personaId: p1.id,
      billingType: 'OFFICIAL', // A
      type: 'INCOME',
      paymentMethod: 'CASH',
      amount: 15000.00,
      description: `Cobro en efectivo - Recibo Oficial - Vendedor: ${norberto.username}`,
      receiptNumber: 'REC-00000101',
      verified: false
    }
  });

  await prisma.transaction.create({
    data: {
      userId: norberto.id,
      personaId: p2.id,
      billingType: 'INTERNAL', // X
      type: 'INCOME',
      paymentMethod: 'CASH',
      amount: 25000.00,
      description: `Cobro en efectivo - Recibo Interno - Vendedor: ${norberto.username}`,
      receiptNumber: 'REC-00000102',
      verified: false
    }
  });

  await prisma.transaction.create({
    data: {
      userId: norberto.id,
      personaId: p3.id,
      billingType: 'OFFICIAL', // A
      type: 'INCOME',
      paymentMethod: 'CHECK',
      amount: 12000.00,
      description: `Cheque N° 77651 (Banco Galicia) - Recibo Oficial - Vendedor: ${norberto.username}`,
      receiptNumber: 'REC-00000103',
      verified: false
    }
  });

  // Fabian
  await prisma.transaction.create({
    data: {
      userId: fabian.id,
      personaId: p2.id,
      billingType: 'INTERNAL', // X
      type: 'INCOME',
      paymentMethod: 'CASH',
      amount: 32000.00,
      description: `Cobro en efectivo - Recibo Interno - Vendedor: ${fabian.username}`,
      receiptNumber: 'REC-00000104',
      verified: false
    }
  });

  await prisma.transaction.create({
    data: {
      userId: fabian.id,
      personaId: p4.id,
      billingType: 'INTERNAL', // X
      type: 'INCOME',
      paymentMethod: 'CHECK',
      amount: 18000.00,
      description: `Cheque N° 99120 (Banco Provincia) - Recibo Interno - Vendedor: ${fabian.username}`,
      receiptNumber: 'REC-00000105',
      verified: false
    }
  });

  console.log('👤 Recibos no verificados creados para Vendedores: Norberto y Fabian.');

  // 5. Crear una Hoja de Ruta completada con Cobros pendientes
  const route = await prisma.deliveryRoute.create({
    data: {
      driverName: 'Miguel (Repartidor)',
      vehiclePlate: 'AD-998-XX',
      vehicleDescription: 'Camión Mercedes Benz 710',
      status: 'COMPLETED',
      date: new Date()
    }
  });

  // Pedido 1 del Reparto: Factura A en efectivo
  const order1 = await prisma.order.create({
    data: {
      personaId: p1.id,
      sellerId: norberto.id,
      billingType: 'OFFICIAL',
      invoiceType: 'FACTURA_A',
      invoiceNumber: '0001-00000214',
      status: 'DELIVERED',
      totalAmount: 42000.00,
      netAmount: 34710.74,
      taxAmount: 7289.26,
      deliveryRouteId: route.id
    }
  });

  await prisma.transaction.create({
    data: {
      orderId: order1.id,
      personaId: p1.id,
      userId: norberto.id, // Vendedor asignado o admin
      billingType: 'OFFICIAL',
      type: 'INCOME',
      paymentMethod: 'CASH',
      amount: 42000.00,
      description: `Rendición Reparto - Chofer: Miguel - Ruta #${route.id} - Pago de ${p1.name}`,
      verified: false
    }
  });

  // Pedido 2 del Reparto: Presupuesto (Interno X) con Cheque
  const order2 = await prisma.order.create({
    data: {
      personaId: p3.id,
      sellerId: norberto.id,
      billingType: 'INTERNAL',
      invoiceType: 'PRESUPUESTO',
      invoiceNumber: `INT-${Date.now().toString().slice(-6)}`,
      status: 'DELIVERED',
      totalAmount: 23000.00,
      deliveryRouteId: route.id
    }
  });

  await prisma.transaction.create({
    data: {
      orderId: order2.id,
      personaId: p3.id,
      userId: norberto.id,
      billingType: 'INTERNAL',
      type: 'INCOME',
      paymentMethod: 'CHECK',
      amount: 23000.00,
      description: `Rendición Reparto - Cheque N° 455201 (Emisor: ${p3.name}) - Chofer: Miguel - Ruta #${route.id}`,
      verified: false
    }
  });

  console.log(`🚚 Hoja de ruta #${route.id} creada para Miguel con 2 pedidos entregados y cobros pendientes.`);
  console.log('✨ Seed unverified finalizado con éxito.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
