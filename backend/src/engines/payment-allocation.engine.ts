import { Decimal } from 'decimal.js';
import { roundToTwoDecimals, toDecimal, type NumericInput } from '../core/money';

export type InvoicePaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID';

export interface AllocatableOrderInput {
  id: number;
  invoiceNumber: string;
  totalAmount: NumericInput;
  allocatedAmount: NumericInput;
  creditNotesAmount: NumericInput;
}

export interface ManualAllocationInput {
  orderId: number;
  amount: NumericInput;
}

export interface PlanPaymentAllocationsInput {
  paymentAmount: NumericInput;
  /** Facturas entregadas del cliente ordenadas cronológicamente (más vieja primero). */
  orders: AllocatableOrderInput[];
  /** Si el usuario eligió priorizar una factura específica. */
  preferredOrderId?: number | null;
  /** Si el usuario eligió priorizar varias facturas específicas (en orden de aplicación). */
  preferredOrderIds?: number[];
  /** Si es true (default), el sobrante tras cubrir las facturas preferidas sigue en FIFO a las demás. */
  allocateOverflowToFifo?: boolean;
  /** Asignación manual explícita por factura (opcional). */
  manualAllocations?: ManualAllocationInput[];
}

export interface PlannedAllocationItem {
  orderId: number;
  invoiceNumber: string;
  amount: number;
  previousPending: number;
  newPending: number;
  newStatus: InvoicePaymentStatus;
}

export interface PlanPaymentAllocationsResult {
  allocations: PlannedAllocationItem[];
  totalAllocated: number;
  unallocatedCredit: number;
}

export interface AvailableCreditTransactionInput {
  transactionId: number;
  availableCredit: NumericInput;
}

export interface PlanCreditApplicationInput {
  orderId: number;
  orderTotal: NumericInput;
  /** Cobros previos con saldo a favor sin imputar, ordenados del más viejo al más nuevo. */
  creditTransactions: AvailableCreditTransactionInput[];
}

export interface PlannedCreditApplicationItem {
  transactionId: number;
  orderId: number;
  amount: number;
}

export interface PlanCreditApplicationResult {
  allocations: PlannedCreditApplicationItem[];
  totalApplied: number;
  remainingOrderPending: number;
  orderStatus: InvoicePaymentStatus;
}

export interface PendingInvoiceDetail {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  allocatedAmount: number;
  creditNotesAmount: number;
  pendingAmount: number;
  status: InvoicePaymentStatus;
}

export interface ClientReceivablesSummary {
  pendingInvoices: PendingInvoiceDetail[];
  totalPendingOnInvoices: number;
  totalAvailableCredit: number;
  netBalance: number;
}

/**
 * Calcula el saldo pendiente real de una factura usando Decimal.js puro:
 * max(0, totalAmount - allocatedAmount - creditNotesAmount).
 */
export function computeOrderPendingAmount(order: {
  totalAmount: NumericInput;
  allocatedAmount: NumericInput;
  creditNotesAmount: NumericInput;
}): Decimal {
  const pending = toDecimal(order.totalAmount)
    .minus(toDecimal(order.allocatedAmount))
    .minus(toDecimal(order.creditNotesAmount));
  return Decimal.max(0, roundToTwoDecimals(pending));
}

/**
 * Determina el estado de pago de una factura a partir de su total neto y su pendiente.
 */
export function computeInvoicePaymentStatus(
  totalAmount: NumericInput,
  pendingAmount: NumericInput,
  creditNotesAmount: NumericInput = 0,
): InvoicePaymentStatus {
  const netTotal = Decimal.max(0, roundToTwoDecimals(toDecimal(totalAmount).minus(toDecimal(creditNotesAmount))));
  const pending = Decimal.max(0, roundToTwoDecimals(pendingAmount));

  if (pending.lte(0) || netTotal.lte(0)) return 'PAID';
  if (pending.lt(netTotal)) return 'PARTIAL';
  return 'PENDING';
}

/**
 * Planifica las imputaciones de un cobro contra las facturas pendientes del cliente.
 * - Soporta modo manual, factura preferida (con o sin derrame FIFO) y FIFO automático puro.
 * - Todo excedente por encima de la deuda en facturas queda como `unallocatedCredit` (saldo a favor).
 */
export function planPaymentAllocations(
  input: PlanPaymentAllocationsInput,
): PlanPaymentAllocationsResult {
  let remaining = Decimal.max(0, roundToTwoDecimals(input.paymentAmount));
  if (remaining.lte(0)) {
    return { allocations: [], totalAllocated: 0, unallocatedCredit: 0 };
  }

  const pendingByOrderId = new Map<number, { order: AllocatableOrderInput; pending: Decimal }>();
  const orderedPending: Array<{ order: AllocatableOrderInput; pending: Decimal }> = [];

  for (const order of input.orders) {
    const pending = computeOrderPendingAmount(order);
    if (pending.gt(0)) {
      const entry = { order, pending };
      pendingByOrderId.set(order.id, entry);
      orderedPending.push(entry);
    }
  }

  const allocations: PlannedAllocationItem[] = [];
  let totalAllocatedDec = new Decimal(0);

  const applyToEntry = (entry: { order: AllocatableOrderInput; pending: Decimal }, requestedMax?: Decimal) => {
    if (remaining.lte(0) || entry.pending.lte(0)) return;

    let cap = Decimal.min(remaining, entry.pending);
    if (requestedMax !== undefined) {
      cap = Decimal.min(cap, Decimal.max(0, roundToTwoDecimals(requestedMax)));
    }
    const applied = roundToTwoDecimals(cap);
    if (applied.lte(0)) return;

    const previousPending = entry.pending;
    const newPending = roundToTwoDecimals(previousPending.minus(applied));
    entry.pending = newPending;
    remaining = roundToTwoDecimals(remaining.minus(applied));
    totalAllocatedDec = totalAllocatedDec.plus(applied);

    allocations.push({
      orderId: entry.order.id,
      invoiceNumber: entry.order.invoiceNumber,
      amount: applied.toNumber(),
      previousPending: previousPending.toNumber(),
      newPending: newPending.toNumber(),
      newStatus: computeInvoicePaymentStatus(
        entry.order.totalAmount,
        newPending,
        entry.order.creditNotesAmount,
      ),
    });
  };

  if (input.manualAllocations && input.manualAllocations.length > 0) {
    for (const manual of input.manualAllocations) {
      const entry = pendingByOrderId.get(manual.orderId);
      if (!entry) continue;
      applyToEntry(entry, toDecimal(manual.amount));
    }
  } else {
    const allocateOverflow = input.allocateOverflowToFifo !== false;

    const preferredIds: number[] = [];
    if (Array.isArray(input.preferredOrderIds) && input.preferredOrderIds.length > 0) {
      for (const id of input.preferredOrderIds) {
        if (!preferredIds.includes(id)) preferredIds.push(id);
      }
    } else if (input.preferredOrderId) {
      preferredIds.push(input.preferredOrderId);
    }

    if (preferredIds.length > 0) {
      for (const prefId of preferredIds) {
        if (remaining.lte(0)) break;
        const preferred = pendingByOrderId.get(prefId);
        if (preferred) {
          applyToEntry(preferred);
        }
      }
      if (!allocateOverflow) {
        return {
          allocations,
          totalAllocated: roundToTwoDecimals(totalAllocatedDec).toNumber(),
          unallocatedCredit: roundToTwoDecimals(remaining).toNumber(),
        };
      }
    }

    for (const entry of orderedPending) {
      if (remaining.lte(0)) break;
      if (entry.pending.lte(0)) continue;
      applyToEntry(entry);
    }
  }

  return {
    allocations,
    totalAllocated: roundToTwoDecimals(totalAllocatedDec).toNumber(),
    unallocatedCredit: roundToTwoDecimals(remaining).toNumber(),
  };
}

/**
 * Cuando nace/se entrega una factura nueva, consume automáticamente el saldo a favor
 * disponible de cobros anteriores en orden FIFO.
 */
export function planCreditApplicationToNewOrder(
  input: PlanCreditApplicationInput,
): PlanCreditApplicationResult {
  const orderTotalDec = Decimal.max(0, roundToTwoDecimals(input.orderTotal));
  let remainingOrder = orderTotalDec;
  let totalAppliedDec = new Decimal(0);
  const allocations: PlannedCreditApplicationItem[] = [];

  for (const creditTx of input.creditTransactions) {
    if (remainingOrder.lte(0)) break;
    const avail = Decimal.max(0, roundToTwoDecimals(creditTx.availableCredit));
    if (avail.lte(0)) continue;

    const applied = roundToTwoDecimals(Decimal.min(remainingOrder, avail));
    if (applied.lte(0)) continue;

    remainingOrder = roundToTwoDecimals(remainingOrder.minus(applied));
    totalAppliedDec = totalAppliedDec.plus(applied);
    allocations.push({
      transactionId: creditTx.transactionId,
      orderId: input.orderId,
      amount: applied.toNumber(),
    });
  }

  return {
    allocations,
    totalApplied: roundToTwoDecimals(totalAppliedDec).toNumber(),
    remainingOrderPending: remainingOrder.toNumber(),
    orderStatus: computeInvoicePaymentStatus(orderTotalDec, remainingOrder),
  };
}

/**
 * Consolida el estado de cuenta por comprobantes de un cliente y verifica la invariante:
 * netBalance = totalPendingOnInvoices - totalAvailableCredit.
 */
export function computeClientReceivablesSummary(
  orders: AllocatableOrderInput[],
  creditTransactions: AvailableCreditTransactionInput[],
): ClientReceivablesSummary {
  const pendingInvoices: PendingInvoiceDetail[] = [];
  let totalPendingDec = new Decimal(0);

  for (const order of orders) {
    const pendingDec = computeOrderPendingAmount(order);
    if (pendingDec.gt(0)) {
      totalPendingDec = totalPendingDec.plus(pendingDec);
      pendingInvoices.push({
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        totalAmount: roundToTwoDecimals(order.totalAmount).toNumber(),
        allocatedAmount: roundToTwoDecimals(order.allocatedAmount).toNumber(),
        creditNotesAmount: roundToTwoDecimals(order.creditNotesAmount).toNumber(),
        pendingAmount: pendingDec.toNumber(),
        status: computeInvoicePaymentStatus(order.totalAmount, pendingDec, order.creditNotesAmount),
      });
    }
  }

  let totalCreditDec = new Decimal(0);
  for (const tx of creditTransactions) {
    const avail = Decimal.max(0, roundToTwoDecimals(tx.availableCredit));
    totalCreditDec = totalCreditDec.plus(avail);
  }

  const netBalanceDec = roundToTwoDecimals(totalPendingDec.minus(totalCreditDec));

  return {
    pendingInvoices,
    totalPendingOnInvoices: roundToTwoDecimals(totalPendingDec).toNumber(),
    totalAvailableCredit: roundToTwoDecimals(totalCreditDec).toNumber(),
    netBalance: netBalanceDec.toNumber(),
  };
}
