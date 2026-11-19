import { Decimal } from 'decimal.js';
import { type NumericInput, roundToIntegerPeso } from '../core/money';

export const DUPLICATE_COLLECTION_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

export type CollectionGuardBlockCode =
  | 'DUPLICATE_RECEIPT_WINDOW'
  | 'ORDER_ALREADY_PAID'
  | 'ORDER_OVERPAYMENT'
  | 'ZERO_DEBT_BLOCKED'
  | 'OVERPAYMENT_BLOCKED';

export interface RecentCollectionMatch {
  id: number;
  receiptNumber?: string | null;
  amount: NumericInput;
  createdAt: Date;
}

export interface TargetOrderBalanceInput {
  orderId: number;
  invoiceLabel: string;
  orderTotal: NumericInput;
  alreadyPaidOnOrder: NumericInput;
}

export interface CollectionGuardInput {
  clientName: string;
  paymentAmount: NumericInput;
  clientOutstandingBalance: NumericInput;
  /** Suma de pedidos PREPARED aún no facturados del cliente en el mismo viaje (si aplica). */
  unbilledRouteOrdersAmount?: NumericInput;
  /** True solo cuando el operador marcó explícitamente "Dejar saldo a favor / Anticipo". */
  allowCreditOnAccount?: boolean;
  /** Cobro idéntico reciente encontrado en la ventana de duplicados (5 min). */
  recentDuplicate?: RecentCollectionMatch | null;
  /** Datos del comprobante imputado, si el recibo se aplica a un orderId específico. */
  targetOrder?: TargetOrderBalanceInput | null;
  now?: Date;
}

export interface CollectionGuardResult {
  allowed: boolean;
  code?: CollectionGuardBlockCode;
  message?: string;
  effectiveDebt: Decimal;
  normalizedAmount: Decimal;
}

function formatPesosAr(val: Decimal): string {
  return `$${val.toNumber().toLocaleString('es-AR')}`;
}

function formatElapsedTime(createdAt: Date, now: Date): string {
  const diffSec = Math.max(1, Math.round((now.getTime() - createdAt.getTime()) / 1000));
  if (diffSec < 60) return `${diffSec} seg`;
  const mins = Math.floor(diffSec / 60);
  return mins === 1 ? '1 min' : `${mins} min`;
}

/**
 * Guardia matemático central anti-doble cobro y anti-sobrepago.
 * Opera 100% en pesos enteros con Decimal.js (ROUND_HALF_UP).
 */
export function evaluateCollectionGuard(input: CollectionGuardInput): CollectionGuardResult {
  const now = input.now ?? new Date();
  const normalizedAmount = roundToIntegerPeso(input.paymentAmount);
  const rawBalance = roundToIntegerPeso(input.clientOutstandingBalance);
  const unbilledRoute = roundToIntegerPeso(input.unbilledRouteOrdersAmount ?? 0);

  const positiveBalance = rawBalance.gt(0) ? rawBalance : new Decimal(0);
  const positiveUnbilled = unbilledRoute.gt(0) ? unbilledRoute : new Decimal(0);
  const effectiveDebt = positiveBalance.plus(positiveUnbilled);

  // 1. Alarma de recibo duplicado en ventana reciente (aplica SIEMPRE, incluso con anticipo)
  if (input.recentDuplicate) {
    const dupAmt = roundToIntegerPeso(input.recentDuplicate.amount);
    const elapsedMs = now.getTime() - input.recentDuplicate.createdAt.getTime();
    if (dupAmt.eq(normalizedAmount) && elapsedMs >= 0 && elapsedMs <= DUPLICATE_COLLECTION_WINDOW_MS) {
      const ref = input.recentDuplicate.receiptNumber
        ? ` (${input.recentDuplicate.receiptNumber})`
        : '';
      const ago = formatElapsedTime(input.recentDuplicate.createdAt, now);
      return {
        allowed: false,
        code: 'DUPLICATE_RECEIPT_WINDOW',
        message: `Alarma de recibo duplicado: ya se registró un cobro de ${formatPesosAr(normalizedAmount)} para ${input.clientName} hace ${ago}${ref}. Verificá el historial antes de volver a cargar.`,
        effectiveDebt,
        normalizedAmount,
      };
    }
  }

  // 2. Validación de comprobante imputado (orderId): no pagar dos veces la misma factura
  if (input.targetOrder) {
    const orderTotal = roundToIntegerPeso(input.targetOrder.orderTotal);
    const alreadyPaid = roundToIntegerPeso(input.targetOrder.alreadyPaidOnOrder);
    const remainingOnOrder = orderTotal.minus(alreadyPaid);

    if (remainingOnOrder.lte(0)) {
      return {
        allowed: false,
        code: 'ORDER_ALREADY_PAID',
        message: `Alarma de doble cobro: el comprobante ${input.targetOrder.invoiceLabel} de ${input.clientName} ya se encuentra saldado (${formatPesosAr(orderTotal)}).`,
        effectiveDebt,
        normalizedAmount,
      };
    }

    if (!input.allowCreditOnAccount && normalizedAmount.gt(remainingOnOrder)) {
      return {
        allowed: false,
        code: 'ORDER_OVERPAYMENT',
        message: `Alarma de sobrepago: intentás cobrar ${formatPesosAr(normalizedAmount)} sobre ${input.targetOrder.invoiceLabel}, pero el saldo pendiente del comprobante es ${formatPesosAr(remainingOnOrder)}.`,
        effectiveDebt,
        normalizedAmount,
      };
    }
  }

  // 3. Validación de deuda real del cliente (salvo anticipo explícito autorizado)
  if (!input.allowCreditOnAccount) {
    if (effectiveDebt.lte(0)) {
      return {
        allowed: false,
        code: 'ZERO_DEBT_BLOCKED',
        message: `Estás cargando ${formatPesosAr(normalizedAmount)} de más (sin deuda). Tildá "Dejar plata a favor" para continuar.`,
        effectiveDebt,
        normalizedAmount,
      };
    }

    if (normalizedAmount.gt(effectiveDebt)) {
      const excess = normalizedAmount.minus(effectiveDebt);
      return {
        allowed: false,
        code: 'OVERPAYMENT_BLOCKED',
        message: `Estás cargando ${formatPesosAr(excess)} de más (deuda: ${formatPesosAr(effectiveDebt)}). Tildá "Dejar plata a favor" para continuar.`,
        effectiveDebt,
        normalizedAmount,
      };
    }
  }

  return {
    allowed: true,
    effectiveDebt,
    normalizedAmount,
  };
}
