import { Prisma } from '@prisma/client';
import { parseArgentinaTimestampRange } from '../billing/billing-date-range.helper';
import {
  MAIN_CITIES,
  normalizeCity,
  resolveItemHistoricalMetrics,
  type ReportLineItemInput,
} from '../../engines/reports-core.engine';

export { MAIN_CITIES, normalizeCity };

/**
 * Prefijos de comprobantes pertenecientes a la Sucursal 0006 (Inmobiliaria / Alquileres).
 * Pertenecen al mismo CUIT fiscal (entran en Subdiario IVA Ventas y TXT AFIP),
 * pero NO corresponden a la operación comercial de la distribuidora y se excluyen
 * de rentabilidad, rankings, pulso semanal y analítica comercial.
 */
export const NON_OPERATING_POS_PREFIXES = ['00006-', '0006-'] as const;

export function isNonOperatingInvoiceNumber(invoiceNumber: string | null | undefined): boolean {
  if (!invoiceNumber) return false;
  const trimmed = invoiceNumber.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return false;
  const posDigits = trimmed.slice(0, dashIdx).replace(/\D/g, '');
  if (!posDigits) return false;
  return Number.parseInt(posDigits, 10) === 6;
}

/**
 * Filtro Prisma que excluye pedidos no operativos (PV 0006 - Inmobiliaria)
 * preservando comprobantes internos con `invoiceNumber` nulo.
 */
export function buildOperatingOrderWhere(): Prisma.OrderWhereInput {
  return {
    OR: [
      { invoiceNumber: null },
      {
        AND: NON_OPERATING_POS_PREFIXES.map((prefix) => ({
          NOT: { invoiceNumber: { startsWith: prefix } },
        })),
      },
    ],
  };
}

/**
 * Filtro Prisma que excluye Notas de Crédito no operativas (PV 0006 - Inmobiliaria),
 * ya sea por su propio número o por el pedido asociado.
 */
export function buildOperatingCreditNoteWhere(): Prisma.CreditNoteWhereInput {
  return {
    AND: [
      {
        OR: [
          { creditNoteNumber: null },
          {
            AND: NON_OPERATING_POS_PREFIXES.map((prefix) => ({
              NOT: { creditNoteNumber: { startsWith: prefix } },
            })),
          },
        ],
      },
      {
        OR: [{ orderId: null }, { order: buildOperatingOrderWhere() }],
      },
    ],
  };
}

export function resolveOrderItemHistoricalCost(item: ReportLineItemInput): {
  qtyOrWeight: number;
  itemRevenue: number;
  itemCost: number;
  unitCostUsed: number;
} {
  const res = resolveItemHistoricalMetrics(item);
  return {
    qtyOrWeight: res.qtyOrWeight,
    itemRevenue: res.itemRevenue,
    itemCost: res.itemCost,
    unitCostUsed: res.unitCostUsed,
  };
}

const AR_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getArgentinaTodayParts(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  isoDate: string;
} {
  const isoDate = AR_DATE_FORMATTER.format(now);
  const [yStr, mStr, dStr] = isoDate.split('-');
  return {
    year: Number(yStr),
    month: Number(mStr),
    day: Number(dStr),
    isoDate,
  };
}

const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function resolveReportDateRange(params: {
  startDate?: string;
  endDate?: string;
  year?: number;
  month?: number;
  defaultCurrentMonth?: boolean;
}): {
  start?: Date;
  end?: Date;
  range?: { gte?: Date; lte?: Date };
  startDateIso?: string;
  endDateIso?: string;
} {
  const startRaw = typeof params.startDate === 'string' ? params.startDate.trim() : '';
  const endRaw = typeof params.endDate === 'string' ? params.endDate.trim() : '';

  if (startRaw || endRaw) {
    const range = parseArgentinaTimestampRange(startRaw || undefined, endRaw || undefined);
    if (!range) return {};
    const startDateIso = YYYY_MM_DD_REGEX.test(startRaw)
      ? startRaw
      : range.gte
        ? getArgentinaTodayParts(range.gte).isoDate
        : undefined;
    const endDateIso = YYYY_MM_DD_REGEX.test(endRaw)
      ? endRaw
      : range.lte
        ? getArgentinaTodayParts(range.lte).isoDate
        : undefined;
    return {
      start: range.gte,
      end: range.lte,
      range,
      startDateIso,
      endDateIso,
    };
  }

  const y = Number(params.year);
  const m = Number(params.month);
  if (Number.isInteger(y) && y >= 2000 && Number.isInteger(m) && m >= 1 && m <= 12) {
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    const dd = String(lastDay).padStart(2, '0');
    const startDateIso = `${y}-${mm}-01`;
    const endDateIso = `${y}-${mm}-${dd}`;
    const range = parseArgentinaTimestampRange(startDateIso, endDateIso);
    return { start: range?.gte, end: range?.lte, range, startDateIso, endDateIso };
  }

  if (params.defaultCurrentMonth) {
    const today = getArgentinaTodayParts();
    const lastDay = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
    const mm = String(today.month).padStart(2, '0');
    const dd = String(lastDay).padStart(2, '0');
    const startDateIso = `${today.year}-${mm}-01`;
    const endDateIso = `${today.year}-${mm}-${dd}`;
    const range = parseArgentinaTimestampRange(startDateIso, endDateIso);
    return { start: range?.gte, end: range?.lte, range, startDateIso, endDateIso };
  }

  return {};
}

export function getArgentinaWeekMondayIso(dateValue: Date | string): string {
  const dateObj = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  const { year, month, day } = getArgentinaTodayParts(dateObj);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const dow = utcDate.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  utcDate.setUTCDate(utcDate.getUTCDate() + diff);
  return utcDate.toISOString().slice(0, 10);
}
