require('dotenv').config();
const { PrismaClient, OrderStatus, TransactionType, CreditNoteStatus } = require('@prisma/client');
const { Decimal } = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const prisma = new PrismaClient();

function toDec(v) {
  return new Decimal(v == null ? 0 : v.toString());
}

function round2(v) {
  return toDec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

async function backfillClient(persona) {
  return prisma.$transaction(async (tx) => {
    const [orders, incomeTxs] = await Promise.all([
      tx.order.findMany({
        where: { personaId: persona.id, status: OrderStatus.DELIVERED },
        include: {
          creditNotes: {
            where: { status: CreditNoteStatus.APPROVED },
            select: { totalAmount: true },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      tx.transaction.findMany({
        where: { personaId: persona.id, type: TransactionType.INCOME },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const txIds = incomeTxs.map((t) => t.id);
    if (txIds.length > 0) {
      await tx.paymentAllocation.deleteMany({
        where: { transactionId: { in: txIds } },
      });
    }

    if (orders.length === 0 || incomeTxs.length === 0) {
      return { allocations: 0, pendingInvoicesCount: orders.length, totalPending: 0, availableCredit: 0 };
    }

    const orderState = orders.map((o) => {
      const cnSum = o.creditNotes.reduce((acc, cn) => acc.plus(toDec(cn.totalAmount)), new Decimal(0));
      return {
        id: o.id,
        invoiceNumber: o.invoiceNumber || `INT-${o.id.toString().padStart(5, '0')}`,
        totalAmount: toDec(o.totalAmount),
        creditNotesAmount: cnSum,
        allocatedAmount: new Decimal(0),
      };
    });
    const orderById = new Map(orderState.map((o) => [o.id, o]));

    const pendingOf = (o) =>
      Decimal.max(0, round2(o.totalAmount.minus(o.allocatedAmount).minus(o.creditNotesAmount)));

    const rawRows = [];
    const overflowTxs = [];

    // Fase 1: cobros con orderId explícito
    for (const incomeTx of incomeTxs) {
      let left = Decimal.max(0, round2(incomeTx.amount));
      if (left.lte(0)) continue;

      if (incomeTx.orderId && orderById.has(incomeTx.orderId)) {
        const target = orderById.get(incomeTx.orderId);
        const pending = pendingOf(target);
        if (pending.gt(0)) {
          const applied = round2(Decimal.min(left, pending));
          if (applied.gt(0)) {
            target.allocatedAmount = target.allocatedAmount.plus(applied);
            left = round2(left.minus(applied));
            rawRows.push({ transactionId: incomeTx.id, orderId: target.id, amount: applied });
          }
        }
      }

      if (left.gt(0)) {
        overflowTxs.push({ transactionId: incomeTx.id, remaining: left });
      }
    }

    // Fase 2: cobros sin orderId y excedentes aplicados en FIFO cronológico
    let availableCredit = new Decimal(0);
    for (const item of overflowTxs) {
      let left = item.remaining;
      for (const order of orderState) {
        if (left.lte(0)) break;
        const pending = pendingOf(order);
        if (pending.lte(0)) continue;

        const applied = round2(Decimal.min(left, pending));
        if (applied.gt(0)) {
          order.allocatedAmount = order.allocatedAmount.plus(applied);
          left = round2(left.minus(applied));
          rawRows.push({ transactionId: item.transactionId, orderId: order.id, amount: applied });
        }
      }
      if (left.gt(0)) {
        availableCredit = availableCredit.plus(left);
      }
    }

    // Consolidar por (transactionId, orderId)
    const consolidated = new Map();
    for (const row of rawRows) {
      const key = `${row.transactionId}:${row.orderId}`;
      const prev = consolidated.get(key);
      if (prev) {
        prev.amount = prev.amount.plus(row.amount);
      } else {
        consolidated.set(key, { ...row });
      }
    }

    const data = Array.from(consolidated.values()).map((r) => ({
      transactionId: r.transactionId,
      orderId: r.orderId,
      amount: round2(r.amount).toNumber(),
    }));

    if (data.length > 0) {
      await tx.paymentAllocation.createMany({ data });
    }

    let totalPending = new Decimal(0);
    let pendingInvoicesCount = 0;
    for (const o of orderState) {
      const p = pendingOf(o);
      if (p.gt(0)) {
        pendingInvoicesCount += 1;
        totalPending = totalPending.plus(p);
      }
    }

    return {
      allocations: data.length,
      pendingInvoicesCount,
      totalPending: round2(totalPending).toNumber(),
      availableCredit: round2(availableCredit).toNumber(),
    };
  });
}

async function main() {
  const clients = await prisma.persona.findMany({
    where: { isClient: true },
    select: { id: true, name: true, outstandingBalance: true },
    orderBy: { id: 'asc' },
  });

  let processed = 0;
  let totalAllocations = 0;
  let mismatches = 0;

  for (const client of clients) {
    const res = await backfillClient(client);
    if (res.allocations > 0 || res.pendingInvoicesCount > 0 || Number(client.outstandingBalance) !== 0) {
      processed += 1;
      totalAllocations += res.allocations;

      const netFromInvoices = round2(toDec(res.totalPending).minus(toDec(res.availableCredit))).toNumber();
      const dbBalance = round2(client.outstandingBalance).toNumber();
      const diff = round2(toDec(dbBalance).minus(toDec(netFromInvoices))).toNumber();

      if (Math.abs(diff) >= 1) {
        mismatches += 1;
        console.log(
          `[INFO DIFF] #${client.id} ${client.name}: saldoDB=$${dbBalance}, facturasPendientes=$${res.totalPending}, creditoFavor=$${res.availableCredit}, neto=$${netFromInvoices}, diff=$${diff}`,
        );
      }
    }
  }

  console.log('\n=== BACKFILL PAYMENT ALLOCATIONS COMPLETADO ===');
  console.log(`Clientes con actividad: ${processed}`);
  console.log(`Imputaciones creadas:   ${totalAllocations}`);
  console.log(`Diferencias vs saldoDB: ${mismatches} (pueden deberse a saldos iniciales o ajustes manuales sin pedido)`);
}

main()
  .catch((err) => {
    console.error('Error en backfill:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
