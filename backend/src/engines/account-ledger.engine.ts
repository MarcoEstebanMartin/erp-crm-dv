import { roundToTwoDecimals, toDecimal } from '../core/money';

export type LedgerEntrySign = 'DEBIT' | 'CREDIT';

export interface PureLedgerEntryInput {
  entryType: LedgerEntrySign;
  amount: string | number;
}

export interface NextLedgerBalanceResult {
  normalizedAmount: number;
  nextBalance: number;
}

export interface RunningBalanceItem<T extends PureLedgerEntryInput> {
  entry: T;
  normalizedAmount: number;
  runningBalance: number;
}

export interface ReconciliationAdjustmentPlan {
  needed: boolean;
  entryType: LedgerEntrySign;
  amount: number;
  difference: number;
}

/**
 * Motor Matemático Puro del Libro Mayor (AccountLedger) con Decimal.js.
 *
 * Convención contable universal en ERP-CRM DV (Clientes y Proveedores):
 *   saldo = SUM(DEBIT) - SUM(CREDIT)
 *   - Cliente nos debe: saldo > 0 (DEBIT incrementa deuda, CREDIT la cancela).
 *   - Le debemos a Proveedor: saldo < 0 (CREDIT de factura proveedor disminuye saldo a negativo;
 *     DEBIT de pago a proveedor o anulación lo acerca a 0).
 */
export function computeNextLedgerBalance(
  currentBalance: string | number,
  entryType: LedgerEntrySign,
  amount: string | number,
): NextLedgerBalanceResult {
  const amtDec = roundToTwoDecimals(amount);
  if (amtDec.lte(0)) {
    throw new Error(`El monto del asiento de Libro Mayor debe ser mayor a 0 (recibido: ${amount}).`);
  }

  const currentDec = roundToTwoDecimals(currentBalance || 0);
  const nextDec =
    entryType === 'DEBIT' ? currentDec.plus(amtDec) : currentDec.minus(amtDec);

  return {
    normalizedAmount: amtDec.toNumber(),
    nextBalance: roundToTwoDecimals(nextDec).toNumber(),
  };
}

/**
 * Calcula los saldos acumulados línea por línea y el saldo final exacto de una secuencia ordenada de asientos.
 */
export function computeRunningBalances<T extends PureLedgerEntryInput>(
  entries: T[],
  initialBalance: string | number = 0,
): { items: RunningBalanceItem<T>[]; finalBalance: number } {
  let runningDec = roundToTwoDecimals(initialBalance);
  const items: RunningBalanceItem<T>[] = [];

  for (const entry of entries) {
    const amtDec = roundToTwoDecimals(entry.amount);
    if (amtDec.lte(0)) continue;

    runningDec =
      entry.entryType === 'DEBIT' ? runningDec.plus(amtDec) : runningDec.minus(amtDec);

    items.push({
      entry,
      normalizedAmount: amtDec.toNumber(),
      runningBalance: roundToTwoDecimals(runningDec).toNumber(),
    });
  }

  return {
    items,
    finalBalance: roundToTwoDecimals(runningDec).toNumber(),
  };
}

/**
 * Determina el asiento exacto de ajuste o saldo inicial necesario para alinear
 * el saldo calculado del Libro Mayor con un saldo objetivo (targetBalance).
 *
 * Si targetBalance > ledgerBalance => falta DEBIT por (target - ledger).
 * Si targetBalance < ledgerBalance => falta CREDIT por (ledger - target).
 */
export function computeReconciliationAdjustment(
  ledgerBalance: string | number,
  targetBalance: string | number,
): ReconciliationAdjustmentPlan {
  const ledgerDec = roundToTwoDecimals(ledgerBalance || 0);
  const targetDec = roundToTwoDecimals(targetBalance || 0);
  const diffDec = roundToTwoDecimals(targetDec.minus(ledgerDec));
  const absDiff = diffDec.abs();

  if (absDiff.lt(toDecimal('0.01'))) {
    return {
      needed: false,
      entryType: 'DEBIT',
      amount: 0,
      difference: 0,
    };
  }

  return {
    needed: true,
    entryType: diffDec.gt(0) ? 'DEBIT' : 'CREDIT',
    amount: absDiff.toNumber(),
    difference: diffDec.toNumber(),
  };
}
