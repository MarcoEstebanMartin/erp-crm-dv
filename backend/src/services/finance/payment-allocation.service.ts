import { CreditNoteStatus, OrderStatus, TransactionType } from '@prisma/client';
import { Decimal } from 'decimal.js';
import prisma from '../../utils/prisma';
import { roundToIntegerPeso, roundToTwoDecimals, toDecimal, type NumericInput } from '../../core/money';
import {
  computeClientReceivablesSummary,
  computeOrderPendingAmount,
  planCreditApplicationToNewOrder,
  planPaymentAllocations,
  type AllocatableOrderInput,
  type AvailableCreditTransactionInput,
  type InvoicePaymentStatus,
  type ManualAllocationInput,
} from '../../engines/payment-allocation.engine';

type DbClient = Pick<typeof prisma, 'order' | 'transaction' | 'paymentAllocation'>;

export interface AllocateTransactionParams {
  transactionId: number;
  personaId: number;
  amount: NumericInput;
  preferredOrderId?: number | null;
  allocateOverflowToFifo?: boolean;
  manualAllocations?: ManualAllocationInput[];
}

export interface PendingInvoiceViewItem {
  id: number;
  invoiceNumber: string;
  billingType: string;
  invoiceType: string;
  totalAmount: number;
  paidAmount: number;
  creditNotesAmount: number;
  pendingAmount: number;
  status: InvoicePaymentStatus;
  createdAt: Date;
}

export interface ClientPendingInvoicesResult {
  invoices: PendingInvoiceViewItem[];
  totalPendingOnInvoices: number;
  totalAvailableCredit: number;
  netBalance: number;
}

function sumDecimals(values: Array<{ toString(): string }>): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(toDecimal(v.toString())), new Decimal(0));
}

function formatInvoiceNumber(order: { id: number; invoiceNumber: string | null }): string {
  return order.invoiceNumber || `INT-${order.id.toString().padStart(5, '0')}`;
}

export class PaymentAllocationService {
  /**
   * Imputa un cobro recién creado (Transaction INCOME) a las facturas pendientes del cliente.
   * Si el cobro supera la deuda en facturas, el excedente queda como saldo a favor disponible
   * para aplicarse automáticamente a futuras facturas.
   */
  async allocateTransactionToOrders(db: DbClient, params: AllocateTransactionParams) {
    const orders = await db.order.findMany({
      where: { personaId: params.personaId, status: OrderStatus.DELIVERED },
      include: {
        paymentAllocations: { select: { amount: true } },
        creditNotes: {
          where: { status: CreditNoteStatus.APPROVED },
          select: { totalAmount: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const allocatableOrders: AllocatableOrderInput[] = orders.map((o) => ({
      id: o.id,
      invoiceNumber: formatInvoiceNumber(o),
      totalAmount: roundToIntegerPeso(o.totalAmount.toString()),
      allocatedAmount: sumDecimals(o.paymentAllocations.map((a) => a.amount)),
      creditNotesAmount: sumDecimals(o.creditNotes.map((cn) => cn.totalAmount)),
    }));

    const plan = planPaymentAllocations({
      paymentAmount: params.amount,
      orders: allocatableOrders,
      preferredOrderId: params.preferredOrderId,
      allocateOverflowToFifo: params.allocateOverflowToFifo,
      manualAllocations: params.manualAllocations,
    });

    if (plan.allocations.length > 0) {
      await db.paymentAllocation.createMany({
        data: plan.allocations.map((item) => ({
          transactionId: params.transactionId,
          orderId: item.orderId,
          amount: item.amount,
        })),
        skipDuplicates: true,
      });
    }

    return plan;
  }

  /**
   * Cuando se emite o entrega una factura nueva, busca cobros previos del cliente
   * con saldo a favor disponible (sin imputar) y los aplica automáticamente en FIFO.
   */
  async applyAvailableCreditToOrder(
    db: DbClient,
    params: { orderId: number; personaId: number; orderTotal?: NumericInput },
  ) {
    const order = await db.order.findUnique({
      where: { id: params.orderId },
      include: {
        paymentAllocations: { select: { amount: true } },
        creditNotes: {
          where: { status: CreditNoteStatus.APPROVED },
          select: { totalAmount: true },
        },
      },
    });
    if (!order || order.status !== OrderStatus.DELIVERED) {
      return { allocations: [], totalApplied: 0, remainingOrderPending: 0, orderStatus: 'PAID' as const };
    }

    const pendingDec = computeOrderPendingAmount({
      totalAmount: roundToIntegerPeso(params.orderTotal ?? order.totalAmount.toString()),
      allocatedAmount: sumDecimals(order.paymentAllocations.map((a) => a.amount)),
      creditNotesAmount: sumDecimals(order.creditNotes.map((cn) => cn.totalAmount)),
    });

    if (pendingDec.lte(0)) {
      return { allocations: [], totalApplied: 0, remainingOrderPending: 0, orderStatus: 'PAID' as const };
    }

    const incomeTxs = await db.transaction.findMany({
      where: { personaId: params.personaId, type: TransactionType.INCOME, voidedAt: null },
      include: { paymentAllocations: { select: { amount: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const creditTransactions: AvailableCreditTransactionInput[] = [];
    for (const tx of incomeTxs) {
      const used = sumDecimals(tx.paymentAllocations.map((a) => a.amount));
      const available = roundToTwoDecimals(toDecimal(tx.amount.toString()).minus(used));
      if (available.gt(0)) {
        creditTransactions.push({ transactionId: tx.id, availableCredit: available });
      }
    }

    if (creditTransactions.length === 0) {
      return {
        allocations: [],
        totalApplied: 0,
        remainingOrderPending: pendingDec.toNumber(),
        orderStatus: 'PENDING' as const,
      };
    }

    const plan = planCreditApplicationToNewOrder({
      orderId: order.id,
      orderTotal: pendingDec,
      creditTransactions,
    });

    if (plan.allocations.length > 0) {
      await db.paymentAllocation.createMany({
        data: plan.allocations.map((a) => ({
          transactionId: a.transactionId,
          orderId: a.orderId,
          amount: a.amount,
        })),
        skipDuplicates: true,
      });
    }

    return plan;
  }

  /**
   * Devuelve el saldo pendiente real de una factura puntual (candado anti doble cobro).
   */
  async getOrderPendingAmount(orderId: number, db: DbClient = prisma): Promise<number> {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        paymentAllocations: { select: { amount: true } },
        creditNotes: {
          where: { status: CreditNoteStatus.APPROVED },
          select: { totalAmount: true },
        },
      },
    });
    if (!order) return 0;

    return computeOrderPendingAmount({
      totalAmount: roundToIntegerPeso(order.totalAmount.toString()),
      allocatedAmount: sumDecimals(order.paymentAllocations.map((a) => a.amount)),
      creditNotesAmount: sumDecimals(order.creditNotes.map((cn) => cn.totalAmount)),
    }).toNumber();
  }

  /**
   * Obtiene las facturas realmente pendientes del cliente usando PaymentAllocation + saldo a favor.
   */
  async getClientPendingInvoicesWithAllocations(
    personaId: number,
    db: DbClient = prisma,
  ): Promise<ClientPendingInvoicesResult> {
    const [orders, incomeTxs] = await Promise.all([
      db.order.findMany({
        where: { personaId, status: OrderStatus.DELIVERED },
        include: {
          paymentAllocations: { select: { amount: true } },
          creditNotes: {
            where: { status: CreditNoteStatus.APPROVED },
            select: { totalAmount: true },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      db.transaction.findMany({
        where: { personaId, type: TransactionType.INCOME, voidedAt: null },
        include: { paymentAllocations: { select: { amount: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const orderMetaById = new Map(orders.map((o) => [o.id, o]));
    const allocatableOrders: AllocatableOrderInput[] = orders.map((o) => ({
      id: o.id,
      invoiceNumber: formatInvoiceNumber(o),
      totalAmount: roundToIntegerPeso(o.totalAmount.toString()),
      allocatedAmount: sumDecimals(o.paymentAllocations.map((a) => a.amount)),
      creditNotesAmount: sumDecimals(o.creditNotes.map((cn) => cn.totalAmount)),
    }));

    const creditTransactions: AvailableCreditTransactionInput[] = incomeTxs
      .map((tx) => {
        const used = sumDecimals(tx.paymentAllocations.map((a) => a.amount));
        const avail = Decimal.max(0, roundToTwoDecimals(toDecimal(tx.amount.toString()).minus(used)));
        return { transactionId: tx.id, availableCredit: avail };
      })
      .filter((t) => toDecimal(t.availableCredit).gt(0));

    const summary = computeClientReceivablesSummary(allocatableOrders, creditTransactions);

    const invoices: PendingInvoiceViewItem[] = summary.pendingInvoices.map((inv) => {
      const meta = orderMetaById.get(inv.id)!;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        billingType: meta.billingType,
        invoiceType: meta.invoiceType,
        totalAmount: inv.totalAmount,
        paidAmount: inv.allocatedAmount,
        creditNotesAmount: inv.creditNotesAmount,
        pendingAmount: inv.pendingAmount,
        status: inv.status,
        createdAt: meta.createdAt,
      };
    });

    return {
      invoices,
      totalPendingOnInvoices: summary.totalPendingOnInvoices,
      totalAvailableCredit: summary.totalAvailableCredit,
      netBalance: summary.netBalance,
    };
  }

  /**
   * Reconstruye las imputaciones históricas de un cliente en orden cronológico (idempotente).
   * 1) Respeta primero el orderId directo de cada cobro (hasta cubrir el pendiente de esa factura).
   * 2) Aplica en FIFO los cobros sin orderId y cualquier excedente (ej. doble cobro o pago de más).
   */
  async reallocateClientHistory(personaId: number) {
    return prisma.$transaction(async (tx) => {
      const [orders, incomeTxs] = await Promise.all([
        tx.order.findMany({
          where: { personaId, status: OrderStatus.DELIVERED },
          include: {
            creditNotes: {
              where: { status: CreditNoteStatus.APPROVED },
              select: { totalAmount: true },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        tx.transaction.findMany({
          where: { personaId, type: TransactionType.INCOME, voidedAt: null },
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
        return { personaId, allocationsCreated: 0, totalAllocated: 0, unallocatedCredit: 0 };
      }

      const orderState = orders.map((o) => ({
        id: o.id,
        invoiceNumber: formatInvoiceNumber(o),
        totalAmount: roundToIntegerPeso(o.totalAmount.toString()),
        allocatedAmount: new Decimal(0),
        creditNotesAmount: sumDecimals(o.creditNotes.map((cn) => cn.totalAmount)),
      }));
      const orderById = new Map(orderState.map((o) => [o.id, o]));

      const createdRows: Array<{ transactionId: number; orderId: number; amount: number }> = [];
      const remainingCreditByTx: Array<{ transactionId: number; remaining: Decimal }> = [];

      // Fase 1: imputación directa para cobros que ya tenían orderId explícito
      for (const incomeTx of incomeTxs) {
        const txAmount = Decimal.max(0, roundToTwoDecimals(incomeTx.amount.toString()));
        if (txAmount.lte(0)) continue;

        let txLeft = txAmount;
        if (incomeTx.orderId && orderById.has(incomeTx.orderId)) {
          const target = orderById.get(incomeTx.orderId)!;
          const pending = computeOrderPendingAmount(target);
          if (pending.gt(0)) {
            const applied = roundToTwoDecimals(Decimal.min(txLeft, pending));
            if (applied.gt(0)) {
              target.allocatedAmount = target.allocatedAmount.plus(applied);
              txLeft = roundToTwoDecimals(txLeft.minus(applied));
              createdRows.push({
                transactionId: incomeTx.id,
                orderId: target.id,
                amount: applied.toNumber(),
              });
            }
          }
        }

        if (txLeft.gt(0)) {
          remainingCreditByTx.push({ transactionId: incomeTx.id, remaining: txLeft });
        }
      }

      // Fase 2: aplicar cobros a cuenta general y excedentes en FIFO cronológico
      let unallocatedCreditDec = new Decimal(0);
      for (const item of remainingCreditByTx) {
        const plan = planPaymentAllocations({
          paymentAmount: item.remaining,
          orders: orderState,
        });

        for (const alloc of plan.allocations) {
          const target = orderById.get(alloc.orderId)!;
          target.allocatedAmount = target.allocatedAmount.plus(toDecimal(alloc.amount));
          createdRows.push({
            transactionId: item.transactionId,
            orderId: alloc.orderId,
            amount: alloc.amount,
          });
        }
        unallocatedCreditDec = unallocatedCreditDec.plus(toDecimal(plan.unallocatedCredit));
      }

      if (createdRows.length > 0) {
        // Consolidar si un mismo (transactionId, orderId) apareciera más de una vez
        const consolidated = new Map<string, { transactionId: number; orderId: number; amount: Decimal }>();
        for (const row of createdRows) {
          const key = `${row.transactionId}:${row.orderId}`;
          const prev = consolidated.get(key);
          if (prev) {
            prev.amount = prev.amount.plus(toDecimal(row.amount));
          } else {
            consolidated.set(key, {
              transactionId: row.transactionId,
              orderId: row.orderId,
              amount: toDecimal(row.amount),
            });
          }
        }

        await tx.paymentAllocation.createMany({
          data: Array.from(consolidated.values()).map((r) => ({
            transactionId: r.transactionId,
            orderId: r.orderId,
            amount: roundToTwoDecimals(r.amount).toNumber(),
          })),
        });
      }

      const totalAllocated = createdRows.reduce(
        (acc, r) => acc.plus(toDecimal(r.amount)),
        new Decimal(0),
      );

      return {
        personaId,
        allocationsCreated: createdRows.length,
        totalAllocated: roundToTwoDecimals(totalAllocated).toNumber(),
        unallocatedCredit: roundToTwoDecimals(unallocatedCreditDec).toNumber(),
      };
    });
  }
}

export const paymentAllocationService = new PaymentAllocationService();
