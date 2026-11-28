import { Decimal } from 'decimal.js';
import { roundToIntegerPeso, toDecimal, type NumericInput } from '../core/money';
import {
  buildBranchFollowUpSummary,
  createEmptyBranchFollowUp,
  type DebtorBranchFollowUp,
  type DebtorFollowUpReason,
  type PendingInvoiceFifoDetail,
} from './persona-debtors-followup';

export {
  createEmptyBranchFollowUp,
  type DebtorBranchFollowUp,
  type DebtorFollowUpReason,
  type PendingInvoiceFifoDetail,
};

export const DEFAULT_OVERDUE_SINGLE_INVOICE_DAYS = 10;

export interface DebtorOrderFifoInput {
  id: number;
  billingType: 'OFFICIAL' | 'INTERNAL';
  totalAmount: NumericInput;
  directIncomeSum: NumericInput;
  directCreditNoteSum: NumericInput;
  date?: Date | string | null;
  isHistorical?: boolean;
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

interface GroupedTripFifo {
  representativeOrderId: number;
  firstIndex: number;
  dayNumber: number | null;
  shortDate: string | null;
  totalAmount: Decimal;
  initialDebt: Decimal;
  hasHistorical: boolean;
}

/**
 * Agrupa boletas de una misma sucursal por día calendario argentino (1 día = 1 viaje).
 * Las órdenes sin fecha conservan clave única por id para preservar compatibilidad FIFO.
 */
function groupOrdersIntoTrips(orders: DebtorOrderFifoInput[]): GroupedTripFifo[] {
  const tripMap = new Map<string, GroupedTripFifo>();

  orders.forEach((order, index) => {
    const parsedDate = parseOrderDate(order.date);
    const dayInfo = parsedDate ? toArCalendarDayNumber(parsedDate) : null;
    const key = dayInfo ? `day:${dayInfo.dayNumber}` : `id:${order.id}`;

    const totalDec = Decimal.max(0, toDecimal(order.totalAmount));
    const orderInitialDebt = Decimal.max(
      0,
      totalDec
        .minus(toDecimal(order.directIncomeSum))
        .minus(toDecimal(order.directCreditNoteSum)),
    );

    const existing = tripMap.get(key);
    if (existing) {
      existing.totalAmount = existing.totalAmount.plus(totalDec);
      existing.initialDebt = existing.initialDebt.plus(orderInitialDebt);
      existing.hasHistorical = existing.hasHistorical || Boolean(order.isHistorical);
    } else {
      tripMap.set(key, {
        representativeOrderId: order.id,
        firstIndex: index,
        dayNumber: dayInfo ? dayInfo.dayNumber : null,
        shortDate: dayInfo ? dayInfo.shortDate : null,
        totalAmount: totalDec,
        initialDebt: orderInitialDebt,
        hasHistorical: Boolean(order.isHistorical),
      });
    }
  });

  return Array.from(tripMap.values()).sort((a, b) => {
    if (a.dayNumber !== null && b.dayNumber !== null && a.dayNumber !== b.dayNumber) {
      return a.dayNumber - b.dayNumber;
    }
    return a.firstIndex - b.firstIndex;
  });
}

/**
 * Ejecuta imputación cronológica FIFO agrupada por viaje (mismo día = 1 viaje)
 * sobre los comprobantes de una sucursal (A o X) usando Decimal.js puro.
 */
export function calculateBranchFifo(
  orders: DebtorOrderFifoInput[],
  unallocatedCredit: NumericInput,
  referenceDate: Date = new Date(),
  overdueDaysThreshold: number = DEFAULT_OVERDUE_SINGLE_INVOICE_DAYS,
  remainingOpeningDebt: NumericInput = 0,
): BranchFifoResult {
  let pool = Decimal.max(0, toDecimal(unallocatedCredit));
  let remainingDebt = new Decimal(0);
  const pendingTrips: PendingInvoiceFifoDetail[] = [];
  const refDay = toArCalendarDayNumber(referenceDate).dayNumber;
  const trips = groupOrdersIntoTrips(orders);

  for (const trip of trips) {
    let debt = trip.initialDebt;

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
      remainingDebt = remainingDebt.plus(debt);

      const paidAgainstTrip = trip.totalAmount.minus(debt);
      const partialThreshold = trip.hasHistorical ? '5' : '0.5';
      const isPartial = paidAgainstTrip.gt(partialThreshold);
      const daysOld = trip.dayNumber !== null ? Math.max(0, refDay - trip.dayNumber) : null;

      pendingTrips.push({
        orderId: trip.representativeOrderId,
        shortDate: trip.shortDate,
        daysOld,
        remainingAmount: roundToIntegerPeso(debt).toNumber(),
        isPartial,
      });
    }
  }

  const hasUnmatchedOpening = Decimal.max(0, toDecimal(remainingOpeningDebt)).gt('0.5');
  const pendingInvoicesCount = pendingTrips.length + (hasUnmatchedOpening ? 1 : 0);

  return {
    remainingDebt,
    pendingInvoicesCount,
    pendingInvoices: pendingTrips,
    summary: buildBranchFollowUpSummary(pendingTrips, overdueDaysThreshold, hasUnmatchedOpening),
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

  const resolveBranchPool = (
    branchOrders: DebtorOrderFifoInput[],
    openingDebt: Decimal,
    unallocCredit: Decimal,
  ) => {
    const historicalTotal = branchOrders
      .filter((o) => o.isHistorical)
      .reduce((acc, o) => {
        const net = Decimal.max(
          0,
          toDecimal(o.totalAmount)
            .minus(toDecimal(o.directIncomeSum))
            .minus(toDecimal(o.directCreditNoteSum)),
        );
        return acc.plus(net);
      }, new Decimal(0));

    // Las boletas históricas importadas de Iduo no impactan AccountLedger: su deuda viva
    // ya está reflejada en openingDebt. La diferencia ya fue saldada antes del corte.
    const impliedHistoricalPaid = Decimal.max(0, historicalTotal.minus(openingDebt));
    const unmatchedOpeningDebt = Decimal.max(0, openingDebt.minus(historicalTotal));
    const usedOnOpening = Decimal.min(unmatchedOpeningDebt, unallocCredit);
    const remainingOpening = unmatchedOpeningDebt.minus(usedOnOpening);
    const creditForOrders = impliedHistoricalPaid.plus(
      Decimal.max(0, unallocCredit.minus(usedOnOpening)),
    );
    return { remainingOpening, creditForOrders };
  };

  const {
    remainingOpening: remainingOpeningOfficial,
    creditForOrders: creditForOfficialOrders,
  } = resolveBranchPool(officialOrders, openingOfficialDec, unallocOfficialDec);

  const {
    remainingOpening: remainingOpeningInternal,
    creditForOrders: creditForInternalOrders,
  } = resolveBranchPool(internalOrders, openingInternalDec, unallocInternalDec);

  const officialResult = calculateBranchFifo(
    officialOrders,
    creditForOfficialOrders,
    referenceDate,
    overdueDaysThreshold,
    remainingOpeningOfficial,
  );
  const internalResult = calculateBranchFifo(
    internalOrders,
    creditForInternalOrders,
    referenceDate,
    overdueDaysThreshold,
    remainingOpeningInternal,
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
