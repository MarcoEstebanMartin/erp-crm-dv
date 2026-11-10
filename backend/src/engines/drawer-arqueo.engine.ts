import { NumericInput, roundToTwoDecimals, toDecimal } from '../core/money';

export interface DrawerTransactionItem {
  type: 'INCOME' | 'OUTCOME';
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';
  amount: NumericInput;
  bankAccountId?: number | null;
}

export interface VerificationDeltaInput {
  oldAmount: NumericInput;
  verifiedBefore: boolean;
  verifiedAfter: boolean;
  adjustedAmount?: NumericInput | null;
  type: 'INCOME' | 'OUTCOME';
  hasPersona: boolean;
  hasBankAccount: boolean;
}

export interface VerificationDeltaResult {
  finalAmount: number;
  personaDecrementDelta: number;
  bankIncrementDelta: number;
}

export interface RendicionSummaryResult {
  expectedCash: number;
  expectedChecks: number;
  theoreticalClosing: number;
  realCash: number;
  realChecks: number;
  realTotal: number;
  difference: number;
}

/**
 * Calcula el saldo teórico de cierre de una caja física sumando efectivo y cheques físicos en cartera
 * (excluyendo transferencias o cheques ya acreditados directamente en cuenta bancaria).
 */
export function calculateDrawerClosingBalance(
  openingBalance: NumericInput,
  transactions: DrawerTransactionItem[],
): number {
  let balance = roundToTwoDecimals(openingBalance);

  for (const tx of transactions) {
    const isPhysicalValue =
      tx.paymentMethod === 'CASH' ||
      (tx.paymentMethod === 'CHECK' && !tx.bankAccountId);

    if (!isPhysicalValue) continue;

    const amt = roundToTwoDecimals(tx.amount);
    if (tx.type === 'INCOME') {
      balance = balance.plus(amt);
    } else {
      balance = balance.minus(amt);
    }
  }

  return roundToTwoDecimals(balance).toNumber();
}

/**
 * Calcula los deltas exactos sobre Cuenta Corriente (Persona) y Cuenta Bancaria (BankAccount)
 * al verificar, desverificar o ajustar por redondeo una transacción bancaria.
 *
 * Invariante contable:
 * - Persona.outstandingBalance refleja el cobro desde que existe la Transaction (delta = newAmount - oldAmount).
 * - BankAccount.balance en cobros (INCOME) refleja el ingreso SI Y SOLO SI verified === true.
 */
export function calculateVerificationDeltas(
  input: VerificationDeltaInput,
): VerificationDeltaResult {
  const oldAmt = roundToTwoDecimals(input.oldAmount);
  const hasAdjustment =
    input.adjustedAmount !== undefined &&
    input.adjustedAmount !== null &&
    input.verifiedAfter;

  const newAmt = hasAdjustment
    ? roundToTwoDecimals(input.adjustedAmount as NumericInput)
    : oldAmt;

  const amountDiff = newAmt.minus(oldAmt);

  let personaDecrementDelta = toDecimal(0);
  let bankIncrementDelta = toDecimal(0);

  if (input.type === 'INCOME') {
    if (input.hasPersona && !amountDiff.isZero()) {
      personaDecrementDelta = amountDiff;
    }

    if (input.hasBankAccount) {
      const prevBankImpact = input.verifiedBefore ? oldAmt : toDecimal(0);
      const nextBankImpact = input.verifiedAfter ? newAmt : toDecimal(0);
      bankIncrementDelta = nextBankImpact.minus(prevBankImpact);
    }
  }

  return {
    finalAmount: newAmt.toNumber(),
    personaDecrementDelta: roundToTwoDecimals(personaDecrementDelta).toNumber(),
    bankIncrementDelta: roundToTwoDecimals(bankIncrementDelta).toNumber(),
  };
}

/**
 * Calcula el arqueo exacto de una rendición de vendedor o chofer con Decimal.js.
 */
export function calculateRendicionSummary(params: {
  transactions: Array<{ paymentMethod: string; amount: NumericInput }>;
  realCash: NumericInput;
  realChecks: NumericInput;
}): RendicionSummaryResult {
  let expectedCashDec = toDecimal(0);
  let expectedChecksDec = toDecimal(0);

  for (const tx of params.transactions) {
    const amt = roundToTwoDecimals(tx.amount);
    if (tx.paymentMethod === 'CASH') {
      expectedCashDec = expectedCashDec.plus(amt);
    } else if (tx.paymentMethod === 'CHECK') {
      expectedChecksDec = expectedChecksDec.plus(amt);
    }
  }

  const realCashDec = roundToTwoDecimals(params.realCash || 0);
  const realChecksDec = roundToTwoDecimals(params.realChecks || 0);
  const theoreticalClosingDec = expectedCashDec.plus(expectedChecksDec);
  const realTotalDec = realCashDec.plus(realChecksDec);
  const differenceDec = realTotalDec.minus(theoreticalClosingDec);

  return {
    expectedCash: expectedCashDec.toNumber(),
    expectedChecks: expectedChecksDec.toNumber(),
    theoreticalClosing: theoreticalClosingDec.toNumber(),
    realCash: realCashDec.toNumber(),
    realChecks: realChecksDec.toNumber(),
    realTotal: realTotalDec.toNumber(),
    difference: differenceDec.toNumber(),
  };
}

/**
 * Calcula el saldo acumulado teórico de la Caja Grande (Tesorería Central) con Decimal.js.
 */
export function calculateCentralDrawerBalance(params: {
  lastCentralRealBalance: NumericInput;
  closedDrawers: Array<{ realBalance: NumericInput | null; openingBalance: NumericInput | null }>;
  overallExpenses: Array<{ amount: NumericInput | null }>;
}): {
  netDrawersCash: number;
  totalExpensesOverall: number;
  currentCalculatedBalance: number;
} {
  const baseDec = roundToTwoDecimals(params.lastCentralRealBalance || 0);

  const netDrawersDec = params.closedDrawers.reduce((acc, curr) => {
    const real = roundToTwoDecimals(curr.realBalance || 0);
    const opening = roundToTwoDecimals(curr.openingBalance || 0);
    return acc.plus(real.minus(opening));
  }, toDecimal(0));

  const expensesDec = params.overallExpenses.reduce(
    (acc, curr) => acc.plus(roundToTwoDecimals(curr.amount || 0)),
    toDecimal(0),
  );

  const currentCalculatedDec = baseDec.plus(netDrawersDec).minus(expensesDec);

  return {
    netDrawersCash: roundToTwoDecimals(netDrawersDec).toNumber(),
    totalExpensesOverall: roundToTwoDecimals(expensesDec).toNumber(),
    currentCalculatedBalance: roundToTwoDecimals(currentCalculatedDec).toNumber(),
  };
}
