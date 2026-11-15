import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import prisma from '../src/utils/prisma';
import { BillingType, Role, SalesChannel } from '@prisma/client';
import { OrderService } from '../src/services/order.service';

interface SellerPlan {
  username: string;
  count: number;
  channels: SalesChannel[];
  officialRatio: number;
  tag: string;
}

const SELLER_PLANS: SellerPlan[] = [
  {
    username: 'diego',
    count: 8,
    channels: [SalesChannel.PREVENTA_RUTA],
    officialRatio: 0.5,
    tag: 'Pueblos Norte/Oeste',
  },
  {
    username: 'fabian',
    count: 7,
    channels: [SalesChannel.PREVENTA_RUTA],
    officialRatio: 0.6,
    tag: 'Villegas Centro',
  },
  {
    username: 'norberto',
    count: 6,
    channels: [SalesChannel.PREVENTA_RUTA],
    officialRatio: 0.35,
    tag: 'Villegas Sur',
  },
  {
    username: 'maria_jose',
    count: 4,
    channels: [SalesChannel.PREVENTA_RUTA],
    officialRatio: 0.5,
    tag: 'Alvear',
  },
  {
    username: 'OFICINA',
    count: 5,
    channels: [SalesChannel.MOSTRADOR, SalesChannel.MOSTRADOR, SalesChannel.MOSTRADOR, SalesChannel.TELEFONICO, SalesChannel.TELEFONICO],
    officialRatio: 0.6,
    tag: 'Mostrador / Telefónico',
  },
];

function isElevenDigitCuit(raw: string | null | undefined): boolean {
  return (raw || '').replace(/\D/g, '').length === 11;
}

function buildOrderItems(
  orderIndex: number,
  pesables: Array<{ id: number; minOrderQuantity: number; approximateWeight: any }>,
  frioNormales: Array<{ id: number; minOrderQuantity: number }>,
  tablaNormales: Array<{ id: number; minOrderQuantity: number }>,
  cajasNormales: Array<{ id: number; minOrderQuantity: number }>,
) {
  const items: Array<{ productId: number; quantity: number; weight?: number }> = [];
  const usedIds = new Set<number>();

  const pushNormal = (prod: { id: number; minOrderQuantity: number } | undefined, mult = 1) => {
    if (!prod || usedIds.has(prod.id)) return;
    usedIds.add(prod.id);
    const minQ = Math.max(1, prod.minOrderQuantity || 1);
    items.push({ productId: prod.id, quantity: minQ * mult });
  };

  // Incluir un pesable en 2 de cada 3 pedidos para probar balanza en Depósito
  if (pesables.length > 0 && orderIndex % 3 !== 2) {
    const p = pesables[orderIndex % pesables.length];
    const qty = Math.max(1, p.minOrderQuantity || 1);
    const approx = Number(p.approximateWeight || 3.5);
    usedIds.add(p.id);
    items.push({
      productId: p.id,
      quantity: qty,
      weight: Number((approx * qty).toFixed(2)),
    });
  }

  // Mezclar zonas de picking (FRIO, TABLA, CAJAS)
  if (frioNormales.length > 0) pushNormal(frioNormales[orderIndex % frioNormales.length], 1);
  if (tablaNormales.length > 0) pushNormal(tablaNormales[orderIndex % tablaNormales.length], (orderIndex % 2) + 1);
  if (cajasNormales.length > 0) pushNormal(cajasNormales[(orderIndex * 2) % cajasNormales.length], 1);

  if (items.length === 0 && cajasNormales.length > 0) {
    pushNormal(cajasNormales[0], 1);
  }
  return items;
}

async function main() {
  const existingOrders = await prisma.order.count();
  if (existingOrders >= 30 && !process.argv.includes('--force')) {
    console.log(
      `ℹ️ Ya existen ${existingOrders} pedidos en la base de datos (>= 30). Usá --force si querés agregar otros igualmente.`,
    );
    return;
  }

  console.log('🚀 Generando 30 pedidos reales de simulación mediante OrderService.createOrder...\n');

  const [users, activeProducts] = await Promise.all([
    prisma.user.findMany({
      where: { username: { in: SELLER_PLANS.map((s) => s.username) }, isActive: true },
      select: { id: true, username: true, role: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, stock: { gte: 20 } },
      select: {
        id: true,
        sku: true,
        name: true,
        isPesable: true,
        approximateWeight: true,
        minOrderQuantity: true,
        pickingZone: true,
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  const userByName = new Map(users.map((u) => [u.username, u]));
  const pesables = activeProducts.filter((p) => p.isPesable);
  const frioNormales = activeProducts.filter((p) => !p.isPesable && p.pickingZone === 'FRIO');
  const tablaNormales = activeProducts.filter((p) => !p.isPesable && p.pickingZone === 'TABLA');
  const cajasNormales = activeProducts.filter(
    (p) => !p.isPesable && p.pickingZone !== 'FRIO' && p.pickingZone !== 'TABLA',
  );

  const createdSummary: Array<{
    id: number;
    seller: string;
    channel: string;
    billing: string;
    client: string;
    total: number;
    items: number;
  }> = [];

  let globalIdx = 0;

  for (const plan of SELLER_PLANS) {
    const seller = userByName.get(plan.username);
    if (!seller) {
      throw new Error(`No se encontró el vendedor activo "${plan.username}".`);
    }

    const existingSellerOrders = await prisma.order.findMany({
      where: { sellerId: seller.id },
      select: { personaId: true },
    });
    const usedPersonaIds = new Set(existingSellerOrders.map((o) => o.personaId));
    const pendingCount = process.argv.includes('--force')
      ? plan.count
      : Math.max(0, plan.count - existingSellerOrders.length);

    if (pendingCount === 0) {
      globalIdx += plan.count;
      continue;
    }

    const candidates = await prisma.persona.findMany({
      where: {
        isClient: true,
        isActive: true,
        sellerId: seller.id,
        id: { notIn: Array.from(usedPersonaIds) },
      },
      select: { id: true, name: true, cuit: true, creditLimit: true },
      take: 60,
      orderBy: [{ creditLimit: 'asc' }, { id: 'asc' }],
    });

    if (candidates.length < pendingCount) {
      throw new Error(`El vendedor "${plan.username}" tiene menos de ${pendingCount} clientes disponibles.`);
    }

    const withCuit = candidates.filter((c) => isElevenDigitCuit(c.cuit));
    const withoutCuit = candidates.filter((c) => !isElevenDigitCuit(c.cuit));
    const orderedCandidates = [...withCuit, ...withoutCuit];

    const targetOfficial = Math.round(pendingCount * plan.officialRatio);

    for (let i = 0; i < pendingCount; i++) {
      const client = orderedCandidates[i];
      const wantsOfficial = i < targetOfficial;
      const billingType = wantsOfficial ? BillingType.OFFICIAL : BillingType.INTERNAL;
      const salesChannel = plan.channels[i % plan.channels.length];

      const items = buildOrderItems(globalIdx, pesables, frioNormales, tablaNormales, cajasNormales);
      let notes = `Simulación ${plan.tag} #${globalIdx + 1}`;
      if (plan.username === 'norberto' && i === pendingCount - 1) {
        notes += ' [CASO PRUEBA: Devolución parcial en entrega]';
      }
      if (plan.username === 'OFICINA' && i === pendingCount - 1) {
        notes += ' [CASO PRUEBA: Anulación con reversión de stock]';
      }

      const order = await OrderService.createOrder({
        sellerId: seller.id,
        userRole: plan.username === 'OFICINA' ? Role.ADMIN : seller.role,
        personaId: client.id,
        billingType,
        salesChannel,
        notes,
        items,
      });

      createdSummary.push({
        id: order.id,
        seller: seller.username,
        channel: salesChannel,
        billing: billingType,
        client: client.name,
        total: Number(order.totalAmount),
        items: items.length,
      });
      globalIdx++;
    }
  }

  const totalAmount = createdSummary.reduce((acc, o) => acc + o.total, 0);
  const totalOrdersCount = await prisma.order.count();
  const totalStockAfter = await prisma.product.aggregate({
    where: { isActive: true },
    _sum: { stock: true },
  });

  console.table(createdSummary);
  console.log(`\n✅ Pedidos creados en esta corrida: ${createdSummary.length}`);
  console.log(`📦 Total pedidos en BD: ${totalOrdersCount}`);
  console.log(`💰 Monto acumulado estimado: $${totalAmount.toLocaleString('es-AR')}`);
  console.log(`📊 Stock físico total restante (activos): ${totalStockAfter._sum.stock} u.`);
}

main()
  .catch((err) => {
    console.error('❌ Error generando los 30 pedidos de simulación:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
