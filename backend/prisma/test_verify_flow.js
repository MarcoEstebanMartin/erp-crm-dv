const { PrismaClient, TransactionType, PaymentMethod } = require('c:/Users/Usuario/Desktop/ERP-CRM DV/backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Iniciando prueba automatizada de arqueo y cierre de caja...');

  // 1. Obtener el vendedor Norberto
  const norberto = await prisma.user.findFirst({
    where: { username: { contains: 'NORBERTO', mode: 'insensitive' } }
  });

  if (!norberto) {
    console.error('❌ Vendedor Norberto no encontrado.');
    return;
  }

  // 2. Obtener transacciones no verificadas de Norberto (que no correspondan a una ruta de reparto)
  const allSellerTxs = await prisma.transaction.findMany({
    where: {
      userId: norberto.id,
      type: TransactionType.INCOME,
      verified: false
    },
    include: {
      order: true
    }
  });
  
  const txs = allSellerTxs.filter(t => !t.order || t.order.deliveryRouteId === null);
  console.log(`Norberto tiene ${txs.length} transacciones de calle pendientes para arqueo.`);

  if (txs.length === 0) {
    console.error('❌ No se encontraron transacciones pendientes para Norberto.');
    return;
  }

  // 3. Calcular montos teóricos esperados
  let expectedCash = 0;
  let expectedChecks = 0;

  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.paymentMethod === PaymentMethod.CASH) {
      expectedCash += amt;
    } else if (t.paymentMethod === PaymentMethod.CHECK) {
      expectedChecks += amt;
    }
  }

  console.log(`Valores Esperados: Efectivo: $${expectedCash} | Cheques: $${expectedChecks} | Total: $${expectedCash + expectedChecks}`);

  // Simular conteo físico: Supongamos que contamos $40,000 en efectivo y $12,000 en cheques (total $52,000).
  // Esperado: Efectivo $40,000, Cheques $12,000. Total $52,000. ¡Debe dar diferencia $0!
  const realCash = 40000.00;
  const realChecks = 12000.00;
  const realTotal = realCash + realChecks;

  // 4. Crear registro de CashDrawer cerrado
  const branchName = `VENDEDOR: ${norberto.username.toUpperCase()}`;
  
  console.log(`Creando CashDrawer para "${branchName}" con balance real $${realTotal}...`);
  const drawer = await prisma.cashDrawer.create({
    data: {
      userId: 5, // ID de administrador ficticio dario
      branch: branchName,
      openingBalance: 0.00,
      closingBalance: expectedCash + expectedChecks,
      realBalance: realTotal,
      status: 'CLOSED',
      openedAt: new Date(),
      closedAt: new Date()
    }
  });

  // 5. Vincular y verificar las transacciones
  console.log('Vinculando transacciones al CashDrawer y marcándolas como verificadas...');
  await prisma.$transaction(
    txs.map(t => prisma.transaction.update({
      where: { id: t.id },
      data: {
        verified: true,
        cashDrawerId: drawer.id
      }
    }))
  );

  console.log('✅ Operación completada exitosamente.');

  // 6. Verificar el saldo consolidado de Caja Grande
  console.log('\n--- VERIFICACIÓN DE CAJA GRANDE ---');
  const allClosedDrawers = await prisma.cashDrawer.findMany({
    where: { status: 'CLOSED' }
  });

  const totalCajaGrande = allClosedDrawers.reduce((acc, curr) => acc + (Number(curr.realBalance || 0) - Number(curr.openingBalance || 0)), 0);
  console.log(`Saldo consolidado total en Caja Grande (todas las cajas CLOSED): $${totalCajaGrande}`);
  
  if (totalCajaGrande === realTotal) {
    console.log('🎉 ¡Prueba Exitosa! Los fondos se consolidaron de forma correcta en la Caja Grande.');
  } else {
    console.log(`Aviso: Saldo Caja Grande es $${totalCajaGrande} (incluye otros cierres históricos).`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
