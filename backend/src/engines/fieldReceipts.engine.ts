import { Decimal } from 'decimal.js';
import { NumericInput, roundToIntegerPeso, toDecimal } from '../core/money';

export type FieldPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK';
export type FieldReceiptStatusValue = 'ISSUED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'VOIDED';
export type PaymentVerificationStatusValue = 'IN_TRANSIT' | 'PENDING_BANK' | 'CLEARED' | 'REJECTED';

export interface ReceiptPaymentInput {
  paymentMethod: FieldPaymentMethod;
  amount: NumericInput;
}

export interface ComputedReceiptPayment {
  paymentMethod: FieldPaymentMethod;
  amount: Decimal;
  initialStatus: PaymentVerificationStatusValue;
}

export interface ReceiptBreakdownResult {
  totalAmount: Decimal;
  cashAmount: Decimal;
  transferAmount: Decimal;
  checkAmount: Decimal;
  initialReceiptStatus: FieldReceiptStatusValue;
  payments: ComputedReceiptPayment[];
}

export interface SettlementReceiptInput {
  status: FieldReceiptStatusValue;
  payments: Array<{
    paymentMethod: FieldPaymentMethod;
    amount: NumericInput;
    status: PaymentVerificationStatusValue;
  }>;
}

export interface CollectorSettlementSummary {
  expectedCash: Decimal;
  expectedChecksCount: number;
  expectedChecksAmount: Decimal;
  pendingTransfersAmount: Decimal;
  clearedTransfersAmount: Decimal;
  totalValidCollected: Decimal;
}

export interface SettlementArqueoResult {
  expectedCash: Decimal;
  declaredCash: Decimal;
  cashDifference: Decimal;
  status: 'APPROVED' | 'DISCREPANCY';
}

const INITIAL_PAYMENT_STATUS: Record<FieldPaymentMethod, PaymentVerificationStatusValue> = {
  CASH: 'IN_TRANSIT',
  CHECK: 'IN_TRANSIT',
  BANK_TRANSFER: 'PENDING_BANK',
};

/**
 * Calcula y valida el desglose de un recibo digital en pesos enteros.
 * Soporta pagos parciales, a cuenta y combinación de múltiples medios de pago.
 */
export function computeReceiptBreakdown(
  payments: ReceiptPaymentInput[],
): ReceiptBreakdownResult {
  if (!payments || payments.length === 0) {
    throw new Error('El recibo debe incluir al menos un medio de pago.');
  }

  let totalAmount = new Decimal(0);
  let cashAmount = new Decimal(0);
  let transferAmount = new Decimal(0);
  let checkAmount = new Decimal(0);
  let hasTransfer = false;

  const computedPayments: ComputedReceiptPayment[] = payments.map((item) => {
    const rounded = roundToIntegerPeso(item.amount);
    if (rounded.lte(0)) {
      throw new Error('Cada importe de pago debe ser mayor a $0.');
    }

    totalAmount = totalAmount.plus(rounded);
    if (item.paymentMethod === 'CASH') {
      cashAmount = cashAmount.plus(rounded);
    } else if (item.paymentMethod === 'BANK_TRANSFER') {
      transferAmount = transferAmount.plus(rounded);
      hasTransfer = true;
    } else if (item.paymentMethod === 'CHECK') {
      checkAmount = checkAmount.plus(rounded);
    }

    return {
      paymentMethod: item.paymentMethod,
      amount: rounded,
      initialStatus: INITIAL_PAYMENT_STATUS[item.paymentMethod],
    };
  });

  return {
    totalAmount,
    cashAmount,
    transferAmount,
    checkAmount,
    initialReceiptStatus: hasTransfer ? 'PENDING_VERIFICATION' : 'ISSUED',
    payments: computedPayments,
  };
}

/**
 * Calcula el saldo resultante del cliente tras aplicar un pago total, parcial o a cuenta.
 */
export function computeBalanceAfterReceipt(
  currentBalance: NumericInput,
  receiptTotal: NumericInput,
): Decimal {
  const balance = roundToIntegerPeso(currentBalance);
  const payment = roundToIntegerPeso(receiptTotal);
  if (payment.lte(0)) {
    throw new Error('El monto del recibo debe ser mayor a $0.');
  }
  return balance.minus(payment);
}

/**
 * Resume lo que un cobrador debe rendir en depósito a partir de sus recibos sincronizados.
 * Excluye recibos anulados y pagos rechazados.
 */
export function computeCollectorSettlementSummary(
  receipts: SettlementReceiptInput[],
): CollectorSettlementSummary {
  let expectedCash = new Decimal(0);
  let expectedChecksCount = 0;
  let expectedChecksAmount = new Decimal(0);
  let pendingTransfersAmount = new Decimal(0);
  let clearedTransfersAmount = new Decimal(0);
  let totalValidCollected = new Decimal(0);

  for (const receipt of receipts) {
    if (receipt.status === 'VOIDED') continue;

    for (const payment of receipt.payments) {
      if (payment.status === 'REJECTED') continue;

      const amount = roundToIntegerPeso(payment.amount);
      totalValidCollected = totalValidCollected.plus(amount);

      if (payment.paymentMethod === 'CASH' && payment.status === 'IN_TRANSIT') {
        expectedCash = expectedCash.plus(amount);
      } else if (payment.paymentMethod === 'CHECK' && payment.status === 'IN_TRANSIT') {
        expectedChecksCount += 1;
        expectedChecksAmount = expectedChecksAmount.plus(amount);
      } else if (payment.paymentMethod === 'BANK_TRANSFER') {
        if (payment.status === 'PENDING_BANK') {
          pendingTransfersAmount = pendingTransfersAmount.plus(amount);
        } else if (payment.status === 'CLEARED') {
          clearedTransfersAmount = clearedTransfersAmount.plus(amount);
        }
      }
    }
  }

  return {
    expectedCash,
    expectedChecksCount,
    expectedChecksAmount,
    pendingTransfersAmount,
    clearedTransfersAmount,
    totalValidCollected,
  };
}

/**
 * Evalúa el arqueo de efectivo al cierre de la rendición del repartidor/vendedor.
 * Diferencia negativa = faltante de caja; positiva = sobrante; cero = rendición exacta.
 */
export function evaluateSettlementArqueo(
  expectedCash: NumericInput,
  declaredCash: NumericInput,
): SettlementArqueoResult {
  const expected = roundToIntegerPeso(expectedCash);
  const declared = roundToIntegerPeso(declaredCash);
  if (declared.lt(0)) {
    throw new Error('El efectivo declarado no puede ser negativo.');
  }

  const cashDifference = declared.minus(expected);
  return {
    expectedCash: expected,
    declaredCash: declared,
    cashDifference,
    status: cashDifference.isZero() ? 'APPROVED' : 'DISCREPANCY',
  };
}

/**
 * Calcula el monto exacto a revertir en cuenta corriente ante rechazo de pago o anulación total.
 */
export function computeReversalAmount(amount: NumericInput): Decimal {
  const rounded = toDecimal(amount).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  if (rounded.lte(0)) {
    throw new Error('El monto a revertir debe ser mayor a $0.');
  }
  return rounded;
}

export interface MirrorTransactionSyncInput {
  receiptStatus: FieldReceiptStatusValue;
  payments: Array<{
    paymentMethod: FieldPaymentMethod;
    amount: NumericInput;
    status: PaymentVerificationStatusValue;
    bankAccountId?: number | null;
  }>;
}

export type MirrorTransactionSyncAction =
  | { action: 'DELETE' }
  | {
      action: 'MARK_VERIFIED';
      amount: number;
      bankAccountId: number | null;
      receiptStatus: 'VERIFIED';
    }
  | {
      action: 'KEEP_PENDING';
      amount: number;
      bankAccountId: number | null;
    };

/**
 * Determina cómo debe sincronizarse la Transaction espejo a partir del estado
 * actual del recibo digital y sus medios de pago.
 */
export function evaluateMirrorTransactionSync(
  input: MirrorTransactionSyncInput,
): MirrorTransactionSyncAction {
  if (input.receiptStatus === 'VOIDED') {
    return { action: 'DELETE' };
  }

  let hasPending = false;
  let clearedAmount = new Decimal(0);
  let activeAmount = new Decimal(0);
  let clearedBankAccountId: number | null = null;

  for (const p of input.payments) {
    if (p.status === 'IN_TRANSIT' || p.status === 'PENDING_BANK') {
      hasPending = true;
    }

    const amt = roundToIntegerPeso(p.amount);

    if (p.status !== 'REJECTED') {
      activeAmount = activeAmount.plus(amt);
    }

    if (p.status === 'CLEARED') {
      clearedAmount = clearedAmount.plus(amt);
      if (
        clearedBankAccountId === null &&
        p.paymentMethod === 'BANK_TRANSFER' &&
        p.bankAccountId != null
      ) {
        clearedBankAccountId = p.bankAccountId;
      }
    }
  }

  if (!hasPending && activeAmount.lte(0)) {
    return { action: 'DELETE' };
  }

  if (!hasPending && clearedAmount.gt(0)) {
    return {
      action: 'MARK_VERIFIED',
      amount: clearedAmount.toNumber(),
      bankAccountId: clearedBankAccountId,
      receiptStatus: 'VERIFIED',
    };
  }

  return {
    action: 'KEEP_PENDING',
    amount: activeAmount.toNumber(),
    bankAccountId: clearedBankAccountId,
  };
}

export interface SplitReceiptPaymentsResult {
  immediatePayments: ComputedReceiptPayment[];
  deferredTransferPayments: ComputedReceiptPayment[];
  immediateAmount: Decimal;
  deferredTransferAmount: Decimal;
  hasImmediate: boolean;
}

/**
 * Separa pagos inmediatos en calle (efectivo / cheques) de transferencias bancarias,
 * que no emiten recibo ni acreditan saldo hasta ser verificadas en banco.
 */
export function splitImmediateAndDeferredPayments(
  payments: ComputedReceiptPayment[],
): SplitReceiptPaymentsResult {
  const immediatePayments: ComputedReceiptPayment[] = [];
  const deferredTransferPayments: ComputedReceiptPayment[] = [];
  let immediateAmount = new Decimal(0);
  let deferredTransferAmount = new Decimal(0);

  for (const p of payments) {
    const amt = roundToIntegerPeso(p.amount);
    if (p.paymentMethod === 'BANK_TRANSFER') {
      deferredTransferPayments.push(p);
      deferredTransferAmount = deferredTransferAmount.plus(amt);
    } else {
      immediatePayments.push(p);
      immediateAmount = immediateAmount.plus(amt);
    }
  }

  return {
    immediatePayments,
    deferredTransferPayments,
    immediateAmount,
    deferredTransferAmount,
    hasImmediate: immediateAmount.gt(0),
  };
}

/**
 * Suma únicamente los pagos efectivamente acreditados en Cuenta Corriente:
 * efectivo/cheques no rechazados + transferencias ya acreditadas (CLEARED).
 */
export function computeCreditedReceiptAmount(
  payments: Array<{
    paymentMethod: FieldPaymentMethod;
    amount: NumericInput;
    status: PaymentVerificationStatusValue;
  }>,
): Decimal {
  let total = new Decimal(0);
  for (const p of payments) {
    if (p.paymentMethod === 'BANK_TRANSFER') {
      if (p.status === 'CLEARED') {
        total = total.plus(roundToIntegerPeso(p.amount));
      }
    } else if (p.status !== 'REJECTED') {
      total = total.plus(roundToIntegerPeso(p.amount));
    }
  }
  return total;
}
