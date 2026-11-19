import { Decimal } from 'decimal.js';
import { type NumericInput, roundToIntegerPeso } from '../core/money';

export type RouteSettlementPaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'CHECK'
  | 'CREDITO'
  | 'FIELD_RECEIPT';

export interface RouteOrderSettlementInput {
  id: number;
  personaId: number;
  clientName: string;
  totalAmount: NumericInput;
}

export interface RouteFieldReceiptPaymentInput {
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK';
  amount: NumericInput;
  status?: string | null;
}

export interface RouteFieldReceiptInput {
  id: number;
  receiptNumber?: string | null;
  provisionalCode: string;
  personaId: number;
  status: string;
  totalAmount: NumericInput;
  payments: RouteFieldReceiptPaymentInput[];
}

export interface RouteSettlementSubmissionInput {
  orderId: number;
  paymentMethod?: string | null;
}

export interface ClientRouteReceiptSummary {
  personaId: number;
  receiptCount: number;
  receiptNumbers: string[];
  totalCollected: Decimal;
  cashAmount: Decimal;
  transferAmount: Decimal;
  checkAmount: Decimal;
}

export interface RouteSettlementConflict {
  code: 'DOUBLE_COLLECTION_CONFLICT';
  orderId: number;
  personaId: number;
  clientName: string;
  receiptNumbers: string[];
  alreadyCollectedAmount: number;
  message: string;
}

export type OrderSettlementActionType =
  | 'CREATE_OFFICE_TRANSACTION'
  | 'KEEP_FIELD_RECEIPT'
  | 'LEAVE_ON_CREDIT';

export interface EvaluatedOrderSettlementAction {
  orderId: number;
  personaId: number;
  action: OrderSettlementActionType;
  paymentMethod: RouteSettlementPaymentMethod;
  orderTotal: Decimal;
  fieldReceiptSummary: ClientRouteReceiptSummary | null;
}

export interface RouteSettlementEvaluationResult {
  actionsByOrderId: Record<number, EvaluatedOrderSettlementAction>;
  conflicts: RouteSettlementConflict[];
  totals: {
    ordersTotal: Decimal;
    fieldCash: Decimal;
    fieldTransfer: Decimal;
    fieldCheck: Decimal;
    fieldTotal: Decimal;
    officeCash: Decimal;
    officeTransfer: Decimal;
    officeCheck: Decimal;
    officeTotal: Decimal;
    creditAccountTotal: Decimal;
  };
}

export interface RouteSettlementPrefillRow {
  orderId: number;
  personaId: number;
  suggestedPaymentMethod: 'FIELD_RECEIPT' | 'CREDITO';
  hasFieldReceipts: boolean;
  receiptNumbers: string[];
  fieldCollectedAmount: number;
  fieldCashAmount: number;
  fieldTransferAmount: number;
  fieldCheckAmount: number;
}

const MANUAL_COLLECTION_METHODS = new Set<string>(['CASH', 'BANK_TRANSFER', 'CHECK']);

function normalizePaymentMethod(raw?: string | null): RouteSettlementPaymentMethod {
  const upper = String(raw || 'CREDITO').trim().toUpperCase();
  if (
    upper === 'CASH' ||
    upper === 'BANK_TRANSFER' ||
    upper === 'CHECK' ||
    upper === 'CREDITO' ||
    upper === 'FIELD_RECEIPT'
  ) {
    return upper;
  }
  return 'CREDITO';
}

/**
 * Consolida todos los recibos de calle activos (no anulados) de un viaje agrupados por cliente.
 * Toda la aritmética usa Decimal.js redondeado al peso entero en origen.
 */
export function summarizeRouteFieldReceiptsByClient(
  receipts: RouteFieldReceiptInput[],
): Record<number, ClientRouteReceiptSummary> {
  const map: Record<number, ClientRouteReceiptSummary> = {};

  for (const receipt of receipts) {
    if (String(receipt.status || '').toUpperCase() === 'VOIDED') continue;

    const current = map[receipt.personaId] ?? {
      personaId: receipt.personaId,
      receiptCount: 0,
      receiptNumbers: [],
      totalCollected: new Decimal(0),
      cashAmount: new Decimal(0),
      transferAmount: new Decimal(0),
      checkAmount: new Decimal(0),
    };

    const label = (receipt.receiptNumber || receipt.provisionalCode || `#${receipt.id}`).trim();
    current.receiptCount += 1;
    current.receiptNumbers.push(label);

    let receiptPaymentsSum = new Decimal(0);
    for (const payment of receipt.payments || []) {
      const paymentStatus = String(payment.status || '').toUpperCase();
      if (paymentStatus === 'REJECTED') continue;

      const amt = roundToIntegerPeso(payment.amount);
      receiptPaymentsSum = receiptPaymentsSum.plus(amt);

      if (payment.paymentMethod === 'CASH') {
        current.cashAmount = current.cashAmount.plus(amt);
      } else if (payment.paymentMethod === 'BANK_TRANSFER') {
        current.transferAmount = current.transferAmount.plus(amt);
      } else if (payment.paymentMethod === 'CHECK') {
        current.checkAmount = current.checkAmount.plus(amt);
      }
    }

    const effectiveTotal = receiptPaymentsSum.gt(0)
      ? receiptPaymentsSum
      : roundToIntegerPeso(receipt.totalAmount);
    current.totalCollected = current.totalCollected.plus(effectiveTotal);

    map[receipt.personaId] = current;
  }

  return map;
}

/**
 * Evalúa la liquidación de un viaje antes de impactar caja/ledger.
 * Bloquea cualquier intento de cobro manual en oficina sobre clientes que ya poseen
 * recibos de calle activos en este mismo viaje (anti-doble cobro).
 */
export function evaluateRouteSettlementActions(
  orders: RouteOrderSettlementInput[],
  fieldReceipts: RouteFieldReceiptInput[],
  submissions: RouteSettlementSubmissionInput[],
): RouteSettlementEvaluationResult {
  const receiptsByClient = summarizeRouteFieldReceiptsByClient(fieldReceipts);
  const submissionsByOrderId = new Map<number, RouteSettlementSubmissionInput>();
  for (const item of submissions) {
    submissionsByOrderId.set(Number(item.orderId), item);
  }

  const actionsByOrderId: Record<number, EvaluatedOrderSettlementAction> = {};
  const conflicts: RouteSettlementConflict[] = [];

  let ordersTotal = new Decimal(0);
  let officeCash = new Decimal(0);
  let officeTransfer = new Decimal(0);
  let officeCheck = new Decimal(0);
  let creditAccountTotal = new Decimal(0);

  for (const order of orders) {
    const orderTotal = roundToIntegerPeso(order.totalAmount);
    ordersTotal = ordersTotal.plus(orderTotal);

    const submission = submissionsByOrderId.get(order.id);
    if (!submission) continue;

    const clientSummary = receiptsByClient[order.personaId] ?? null;
    const hasActiveFieldReceipt = Boolean(clientSummary && clientSummary.totalCollected.gt(0));
    const method = normalizePaymentMethod(submission.paymentMethod);

    if (hasActiveFieldReceipt && MANUAL_COLLECTION_METHODS.has(method)) {
      const collectedNum = clientSummary!.totalCollected.toNumber();
      const codes = clientSummary!.receiptNumbers.join(', ');
      conflicts.push({
        code: 'DOUBLE_COLLECTION_CONFLICT',
        orderId: order.id,
        personaId: order.personaId,
        clientName: order.clientName,
        receiptNumbers: clientSummary!.receiptNumbers,
        alreadyCollectedAmount: collectedNum,
        message: `Doble cobro bloqueado para ${order.clientName}: ya tiene recibo en calle (${codes}) por $${collectedNum.toLocaleString('es-AR')} en este viaje.`,
      });
      continue;
    }

    let action: OrderSettlementActionType;
    if (method === 'FIELD_RECEIPT' || (hasActiveFieldReceipt && method === 'CREDITO')) {
      action = 'KEEP_FIELD_RECEIPT';
    } else if (MANUAL_COLLECTION_METHODS.has(method)) {
      action = 'CREATE_OFFICE_TRANSACTION';
      if (method === 'CASH') officeCash = officeCash.plus(orderTotal);
      else if (method === 'BANK_TRANSFER') officeTransfer = officeTransfer.plus(orderTotal);
      else if (method === 'CHECK') officeCheck = officeCheck.plus(orderTotal);
    } else {
      action = 'LEAVE_ON_CREDIT';
      creditAccountTotal = creditAccountTotal.plus(orderTotal);
    }

    actionsByOrderId[order.id] = {
      orderId: order.id,
      personaId: order.personaId,
      action,
      paymentMethod: method,
      orderTotal,
      fieldReceiptSummary: clientSummary,
    };
  }

  let fieldCash = new Decimal(0);
  let fieldTransfer = new Decimal(0);
  let fieldCheck = new Decimal(0);
  let fieldTotal = new Decimal(0);
  for (const summary of Object.values(receiptsByClient)) {
    fieldCash = fieldCash.plus(summary.cashAmount);
    fieldTransfer = fieldTransfer.plus(summary.transferAmount);
    fieldCheck = fieldCheck.plus(summary.checkAmount);
    fieldTotal = fieldTotal.plus(summary.totalCollected);
  }

  const officeTotal = officeCash.plus(officeTransfer).plus(officeCheck);

  return {
    actionsByOrderId,
    conflicts,
    totals: {
      ordersTotal,
      fieldCash,
      fieldTransfer,
      fieldCheck,
      fieldTotal,
      officeCash,
      officeTransfer,
      officeCheck,
      officeTotal,
      creditAccountTotal,
    },
  };
}

/**
 * Construye el prellenado determinístico de cada pedido del viaje para la pantalla de Liquidación.
 */
export function buildRouteSettlementPrefill(
  orders: RouteOrderSettlementInput[],
  fieldReceipts: RouteFieldReceiptInput[],
): RouteSettlementPrefillRow[] {
  const receiptsByClient = summarizeRouteFieldReceiptsByClient(fieldReceipts);

  return orders.map((order) => {
    const summary = receiptsByClient[order.personaId];
    const hasFieldReceipts = Boolean(summary && summary.totalCollected.gt(0));
    return {
      orderId: order.id,
      personaId: order.personaId,
      suggestedPaymentMethod: hasFieldReceipts ? 'FIELD_RECEIPT' : 'CREDITO',
      hasFieldReceipts,
      receiptNumbers: summary?.receiptNumbers ?? [],
      fieldCollectedAmount: summary ? summary.totalCollected.toNumber() : 0,
      fieldCashAmount: summary ? summary.cashAmount.toNumber() : 0,
      fieldTransferAmount: summary ? summary.transferAmount.toNumber() : 0,
      fieldCheckAmount: summary ? summary.checkAmount.toNumber() : 0,
    };
  });
}
