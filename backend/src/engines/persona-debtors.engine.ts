import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, toDecimal, type NumericInput } from '../core/money';

export interface DebtorOrderFifoInput {
  id: number;
  billingType: 'OFFICIAL' | 'INTERNAL';
  totalAmount: NumericInput;
  directIncomeSum: NumericInput;
  directCreditNoteSum: NumericInput;
}

export interface DebtorFifoInput {
  outstandingBalance: NumericInput;
  orders: DebtorOrderFifoInput[];
  unallocatedOfficialCredit: NumericInput;
  unallocatedInternalCredit: NumericInput;
}

export interface DebtorFifoMetrics {
  outstandingBalance: number;
  debtA: number;
  debtX: number;
  pendingInvoicesCount: number;
  hasMultiplePendingInvoices: boolean;
}

export interface BranchFifoResult {
  remainingDebt: Decimal;
  pendingInvoicesCount: number;
}

/**
 * Ejecuta imputación cronológica FIFO sobre los comprobantes de una sucursal (A o X)
 * usando Decimal.js puro (precisión bancaria, cero Float).
 */
export function calculateBranchFifo(
  orders: DebtorOrderFifoInput[],
  unallocatedCredit: NumericInput,
): BranchFifoResult {
  let pool = Decimal.max(0, toDecimal(unallocatedCredit));
  let pendingInvoicesCount = 0;
  let remainingDebt = new Decimal(0);

  for (const order of orders) {
    let debt = Decimal.max(
      0,
      toDecimal(order.totalAmount)
        .minus(toDecimal(order.directIncomeSum))
        .minus(toDecimal(order.directCreditNoteSum)),
    );

    if (pool.gt(0)) {
      if (debt.lte(pool)) {
        pool = pool.minus(debt);
        debt = new Decimal(0);
      } else {
        debt = debt.minus(pool);
        pool = new Decimal(0);
      }
    }

    if (debt.gt('0.5')) {
      pendingInvoicesCount += 1;
      remainingDebt = remainingDebt.plus(debt);
    }
  }

  return { remainingDebt, pendingInvoicesCount };
}

/**
 * Calcula métricas consolidadas FIFO por cliente garantizando la invariante
 * en pesos enteros: debtA + debtX === roundToIntegerPeso(outstandingBalance).
 */
export function computeDebtorFifoMetrics(input: DebtorFifoInput): DebtorFifoMetrics {
  const dbOutstandingDec = roundToIntegerPeso(input.outstandingBalance);

  if (dbOutstandingDec.lte(0)) {
    return {
      outstandingBalance: 0,
      debtA: 0,
      debtX: 0,
      pendingInvoicesCount: 0,
      hasMultiplePendingInvoices: false,
    };
  }

  const officialOrders = input.orders.filter((o) => o.billingType === 'OFFICIAL');
  const internalOrders = input.orders.filter((o) => o.billingType === 'INTERNAL');

  const officialResult = calculateBranchFifo(officialOrders, input.unallocatedOfficialCredit);
  const internalResult = calculateBranchFifo(internalOrders, input.unallocatedInternalCredit);

  const totalCalculated = officialResult.remainingDebt.plus(internalResult.remainingDebt);
  let debtA = 0;
  let debtX = 0;

  if (totalCalculated.gt(0)) {
    const debtADec = roundToIntegerPeso(
      officialResult.remainingDebt.mul(dbOutstandingDec).div(totalCalculated),
    );
    const debtXDec = Decimal.max(0, dbOutstandingDec.minus(debtADec));
    debtA = Math.max(0, debtADec.toNumber());
    debtX = Math.max(0, debtXDec.toNumber());
  } else {
    debtA = 0;
    debtX = dbOutstandingDec.toNumber();
  }

  const pendingInvoicesCount =
    officialResult.pendingInvoicesCount + internalResult.pendingInvoicesCount;

  return {
    outstandingBalance: dbOutstandingDec.toNumber(),
    debtA,
    debtX,
    pendingInvoicesCount,
    hasMultiplePendingInvoices: pendingInvoicesCount > 1,
  };
}
