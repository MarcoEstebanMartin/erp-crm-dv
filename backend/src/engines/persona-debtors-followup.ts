export type DebtorFollowUpReason =
  | 'NONE'
  | 'CURRENT'
  | 'MULTIPLE_FULL'
  | 'PARTIAL_AND_MORE'
  | 'PARTIAL_REMAINDER'
  | 'OVERDUE_SINGLE';

export interface PendingInvoiceFifoDetail {
  orderId: number;
  shortDate: string | null;
  daysOld: number | null;
  remainingAmount: number;
  isPartial: boolean;
  isSkippedPrevious?: boolean;
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

/** Crea un resumen de seguimiento vacío para sucursales sin viajes pendientes. */
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

export const SMALL_REMAINDER_THRESHOLD = 10000;

function formatIntegerPeso(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return rounded < 0 ? `-$${formatted}` : `$${formatted}`;
}

/** Construye la etiqueta de lectura rápida (por viaje, resto o saldo anterior) de una sucursal. */
export function buildBranchFollowUpSummary(
  pendingTrips: PendingInvoiceFifoDetail[],
  overdueDaysThreshold: number,
  hasUnmatchedOpening: boolean = false,
): DebtorBranchFollowUp {
  const tripCount = pendingTrips.length;
  if (tripCount === 0 && !hasUnmatchedOpening) {
    return createEmptyBranchFollowUp();
  }

  const fullPendingCount = pendingTrips.filter((inv) => !inv.isPartial).length;

  if (hasUnmatchedOpening) {
    if (tripCount === 0) {
      return {
        pendingCount: 1,
        fullPendingCount: 0,
        hasPartialRemainder: true,
        oldestPendingShortDate: null,
        oldestPendingDays: null,
        needsFollowUp: true,
        followUpReason: 'PARTIAL_REMAINDER',
        followUpLabel: 'Saldo ant.',
      };
    }

    return {
      pendingCount: tripCount + 1,
      fullPendingCount,
      hasPartialRemainder: true,
      oldestPendingShortDate: null,
      oldestPendingDays: pendingTrips[0].daysOld,
      needsFollowUp: true,
      followUpReason: 'PARTIAL_AND_MORE',
      followUpLabel: `${tripCount} + saldo ant.`,
    };
  }

  const oldest = pendingTrips[0];
  const hasPartialRemainder = pendingTrips.some((inv) => inv.isPartial);
  const oldestPendingShortDate = oldest.shortDate;
  const oldestPendingDays = oldest.daysOld;

  if (tripCount === 1) {
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

    if (
      oldest.isSkippedPrevious ||
      (oldestPendingDays !== null && oldestPendingDays > overdueDaysThreshold)
    ) {
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

  if (oldest.isPartial) {
    const newerCount = tripCount - 1;
    const latestTrip = pendingTrips[1];
    const isSingleCurrentInvoicePlusSmallRemainder =
      tripCount === 2 &&
      oldest.remainingAmount < SMALL_REMAINDER_THRESHOLD &&
      !latestTrip.isSkippedPrevious &&
      (latestTrip.daysOld === null || latestTrip.daysOld <= overdueDaysThreshold);

    if (isSingleCurrentInvoicePlusSmallRemainder) {
      const amountLabel = formatIntegerPeso(oldest.remainingAmount);
      return {
        pendingCount: tripCount,
        fullPendingCount,
        hasPartialRemainder: true,
        oldestPendingShortDate,
        oldestPendingDays,
        needsFollowUp: true,
        followUpReason: 'PARTIAL_REMAINDER',
        followUpLabel: oldestPendingShortDate
          ? `Resto ${oldestPendingShortDate}: ${amountLabel}`
          : `Resto: ${amountLabel}`,
      };
    }

    const restoPart = oldestPendingShortDate ? `resto ${oldestPendingShortDate}` : 'resto';
    return {
      pendingCount: tripCount,
      fullPendingCount,
      hasPartialRemainder: true,
      oldestPendingShortDate,
      oldestPendingDays,
      needsFollowUp: true,
      followUpReason: 'PARTIAL_AND_MORE',
      followUpLabel: `${newerCount} + ${restoPart}`,
    };
  }

  return {
    pendingCount: tripCount,
    fullPendingCount,
    hasPartialRemainder,
    oldestPendingShortDate,
    oldestPendingDays,
    needsFollowUp: true,
    followUpReason: 'MULTIPLE_FULL',
    followUpLabel: `${tripCount} viajes`,
  };
}
