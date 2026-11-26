import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, toDecimal, type NumericInput } from '../core/money';

export const DEFAULT_OVERDUE_SINGLE_INVOICE_DAYS = 10;

export type DebtorFollowUpReason =
  | 'NONE'
  | 'CURRENT'
  | 'MULTIPLE_FULL'
  | 'PARTIAL_AND_MORE'
  | 'PARTIAL_REMAINDER'
  | 'OVERDUE_SINGLE';

export interface DebtorOrderFifoInput {
  id: number;
  billingType: 'OFFICIAL' | 'INTERNAL';
  totalAmount: NumericInput;
  directIncomeSum: NumericInput;
  directCreditNoteSum: NumericInput;
  date?: Date | string | null;
}

export interface DebtorFifoInput {
  outstandingBalance: NumericInput;
  orders: DebtorOrderFifoInput[];
  unallocatedOfficialCredit: NumericInput;
  unallocatedInternalCredit: NumericInput;
  openingOfficialDebt?: NumericInput;
  openingInternalDebt?: NumericInput;
  referenceDate?: Date;
  overdueDaysThreshold?: number;
}

export interface PendingInvoiceFifoDetail {
  orderId: number;
  shortDate: string | null;
  daysOld: number | null;
  remainingAmount: number;
  isPartial: boolean;
}

export interface DebtorBranchFollowUp {
  pendingCount: number;
  fullPendingCount: number;
  hasPartialRemainder: boolean;
  oldestPendingShortDate: string | null;
  oldestPendingDays: number | null;
  needsFollowUp: boolean;
  followUpReason: DebtorFollowUpReason;
  followUpLabel: string | null;
}

export interface DebtorFifoMetrics {
  outstandingBalance: number;
  debtA: number;
  debtX: number;
  pendingInvoicesCount: number;
  hasMultiplePendingInvoices: boolean;
  needsFollowUp: boolean;
  oldestPendingDays: number | null;
  followUpLabel: string | null;
  branchA: DebtorBranchFollowUp;
  branchX: DebtorBranchFollowUp;
}

export interface BranchFifoResult {
  remainingDebt: Decimal;
  pendingInvoicesCount: number;
  pendingInvoices: PendingInvoiceFifoDetail[];
  summary: DebtorBranchFollowUp;
}

const AR_OFFSET_MS = -3 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toArCalendarDayNumber(date: Date): { dayNumber: number; shortDate: string } {
  const shifted = new Date(date.getTime() + AR_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
  return { dayNumber, shortDate: `${day}/${month}` };
}

function parseOrderDate(raw: Date | string | null | undefined): Date | null {
  if (!raw) return null;
  const parsed = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function createEmptyBranchFollowUp(): DebtorBranchFollowUp {
  return {
    pendingCount: 0,
    fullPendingCount: 0,
    hasPartialRemainder: false,
    oldestPendingShortDate: null,
    oldestPendingDays: null,
    needsFollowUp: false,
    followUpReason: 'NONE',
    followUpLabel: null,
  };
}

function buildBranchFollowUpSummary(
  pendingInvoices: PendingInvoiceFifoDetail[],
  overdueDaysThreshold: number,
): DebtorBranchFollowUp {
  const count = pendingInvoices.length;
  if (count === 0) {
    return createEmptyBranchFollowUp();
  }

  const oldest = pendingInvoices[0];
  const fullPendingCount = pendingInvoices.filter((inv) => !inv.isPartial).length;
  const hasPartialRemainder = pendingInvoices.some((inv) => inv.isPartial);
  const oldestPendingShortDate = oldest.shortDate;
  const oldestPendingDays = oldest.daysOld;

  if (count === 1) {
    if (oldest.isPartial) {
      return {
        pendingCount: 1,
        fullPendingCount: 0,
        hasPartialRemainder: true,
        oldestPendingShortDate,
        oldestPendingDays,
        needsFollowUp: true,
        followUpReason: 'PARTIAL_REMAINDER',
        followUpLabel: oldestPendingShortDate ? `Resto ${oldestPendingShortDate}` : 'Resto',
      };
    }

    if (oldestPendingDays !== null && oldestPendingDays > overdueDaysThreshold) {
      return {
        pendingCount: 1,
        fullPendingCount: 1,
        hasPartialRemainder: false,
        oldestPendingShortDate,
        oldestPendingDays,
        needsFollowUp: true,
        followUpReason: 'OVERDUE_SINGLE',
        followUpLabel: oldestPendingShortDate ?? `+${overdueDaysThreshold}d`,
      };
    }

    return {
      pendingCount: 1,
      fullPendingCount: 1,
      hasPartialRemainder: false,
      oldestPendingShortDate,
      oldestPendingDays,
      needsFollowUp: false,
      followUpReason: 'CURRENT',
      followUpLabel: null,
    };
  }

  // count >= 2
  if (oldest.isPartial) {
    const newerCount = count - 1;
    const restoPart = oldestPendingShortDate ? `Resto ${oldestPendingShortDate}` : 'Resto';
    const tailPart = newerCount === 1 ? 'y última' : `y últimas ${newerCount}`;
    return {
      pendingCount: count,
      fullPendingCount,
      hasPartialRemainder: true,
      oldestPendingShortDate,
      oldestPendingDays,
      needsFollowUp: true,
      followUpReason: 'PARTIAL_AND_MORE',
      followUpLabel: `${restoPart} ${tailPart}`,
    };
  }

  return {
    pendingCount: count,
    fullPendingCount,
    hasPartialRemainder,
    oldestPendingShortDate,
    oldestPendingDays,
    needsFollowUp: true,
    followUpReason: 'MULTIPLE_FULL',
    followUpLabel: `Últimas ${count}`,
  };
}

/**
 * Ejecuta imputación cronológica FIFO sobre los comprobantes de una sucursal (A o X)
 * usando Decimal.js puro (precisión bancaria, cero Float) y clasifica restos/boletas/atrasos.
 */
export function calculateBranchFifo(
  orders: DebtorOrderFifoInput[],
  unallocatedCredit: NumericInput,
  referenceDate: Date = new Date(),
  overdueDaysThreshold: number = DEFAULT_OVERDUE_SINGLE_INVOICE_DAYS,
): BranchFifoResult {
  let pool = Decimal.max(0, toDecimal(unallocatedCredit));
  let pendingInvoicesCount = 0;
  let remainingDebt = new Decimal(0);
  const pendingInvoices: PendingInvoiceFifoDetail[] = [];
  const refDay = toArCalendarDayNumber(referenceDate).dayNumber;

  for (const order of orders) {
    const totalDec = Decimal.max(0, toDecimal(order.totalAmount));
    let debt = Decimal.max(
      0,
      totalDec
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

      const paidAgainstOrder = totalDec.minus(debt);
      const isPartial = paidAgainstOrder.gt('0.5');
      const parsedDate = parseOrderDate(order.date);
      let shortDate: string | null = null;
      let daysOld: number | null = null;

      if (parsedDate) {
        const orderDay = toArCalendarDayNumber(parsedDate);
        shortDate = orderDay.shortDate;
        daysOld = Math.max(0, refDay - orderDay.dayNumber);
      }

      pendingInvoices.push({
        orderId: order.id,
        shortDate,
        daysOld,
        remainingAmount: roundToIntegerPeso(debt).toNumber(),
        isPartial,
      });
    }
  }

  return {
    remainingDebt,
    pendingInvoicesCount,
    pendingInvoices,
    summary: buildBranchFollowUpSummary(pendingInvoices, overdueDaysThreshold),
  };
}

/**
 * Calcula métricas consolidadas FIFO por cliente garantizando la invariante
 * en pesos enteros: debtA + debtX === roundToIntegerPeso(outstandingBalance).
 */
export function computeDebtorFifoMetrics(input: DebtorFifoInput): DebtorFifoMetrics {
  const dbOutstandingDec = roundToIntegerPeso(input.outstandingBalance);
  const referenceDate = input.referenceDate ?? new Date();
  const overdueDaysThreshold =
    input.overdueDaysThreshold ?? DEFAULT_OVERDUE_SINGLE_INVOICE_DAYS;

  if (dbOutstandingDec.lte(0)) {
    return {
      outstandingBalance: 0,
      debtA: 0,
      debtX: 0,
      pendingInvoicesCount: 0,
      hasMultiplePendingInvoices: false,
      needsFollowUp: false,
      oldestPendingDays: null,
      followUpLabel: null,
      branchA: createEmptyBranchFollowUp(),
      branchX: createEmptyBranchFollowUp(),
    };
  }

  const officialOrders = input.orders.filter((o) => o.billingType === 'OFFICIAL');
  const internalOrders = input.orders.filter((o) => o.billingType === 'INTERNAL');

  const openingOfficialDec = Decimal.max(0, toDecimal(input.openingOfficialDebt ?? 0));
  const openingInternalDec = Decimal.max(0, toDecimal(input.openingInternalDebt ?? 0));
  const unallocOfficialDec = Decimal.max(0, toDecimal(input.unallocatedOfficialCredit));
  const unallocInternalDec = Decimal.max(0, toDecimal(input.unallocatedInternalCredit));

  const usedOnOpeningOfficial = Decimal.min(openingOfficialDec, unallocOfficialDec);
  const remainingOpeningOfficial = openingOfficialDec.minus(usedOnOpeningOfficial);
  const creditForOfficialOrders = Decimal.max(0, unallocOfficialDec.minus(usedOnOpeningOfficial));

  const usedOnOpeningInternal = Decimal.min(openingInternalDec, unallocInternalDec);
  const remainingOpeningInternal = openingInternalDec.minus(usedOnOpeningInternal);
  const creditForInternalOrders = Decimal.max(0, unallocInternalDec.minus(usedOnOpeningInternal));

  const officialResult = calculateBranchFifo(
    officialOrders,
    creditForOfficialOrders,
    referenceDate,
    overdueDaysThreshold,
  );
  const internalResult = calculateBranchFifo(
    internalOrders,
    creditForInternalOrders,
    referenceDate,
    overdueDaysThreshold,
  );

  const officialTotalRemaining = remainingOpeningOfficial.plus(officialResult.remainingDebt);
  const internalTotalRemaining = remainingOpeningInternal.plus(internalResult.remainingDebt);
  const totalCalculated = officialTotalRemaining.plus(internalTotalRemaining);
  let debtA = 0;
  let debtX = 0;

  if (totalCalculated.gt(0)) {
    const debtADec = roundToIntegerPeso(
      officialTotalRemaining.mul(dbOutstandingDec).div(totalCalculated),
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

  const branchA = officialResult.summary;
  const branchX = internalResult.summary;
  const needsFollowUp = branchA.needsFollowUp || branchX.needsFollowUp;

  const dayCandidates = [branchA.oldestPendingDays, branchX.oldestPendingDays].filter(
    (d): d is number => d !== null,
  );
  const oldestPendingDays = dayCandidates.length > 0 ? Math.max(...dayCandidates) : null;

  let followUpLabel: string | null = null;
  if (branchA.needsFollowUp && branchX.needsFollowUp) {
    followUpLabel = `A: ${branchA.followUpLabel} · X: ${branchX.followUpLabel}`;
  } else if (branchA.needsFollowUp) {
    followUpLabel = branchA.followUpLabel;
  } else if (branchX.needsFollowUp) {
    followUpLabel = branchX.followUpLabel;
  }

  return {
    outstandingBalance: dbOutstandingDec.toNumber(),
    debtA,
    debtX,
    pendingInvoicesCount,
    hasMultiplePendingInvoices: pendingInvoicesCount > 1,
    needsFollowUp,
    oldestPendingDays,
    followUpLabel,
    branchA,
    branchX,
  };
}
