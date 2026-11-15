const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateBoundary(
  rawValue: string | undefined,
  suffixForDateOnly: string,
): Date | undefined {
  if (typeof rawValue !== 'string') return undefined;
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;

  const candidate = YYYY_MM_DD_REGEX.test(trimmed)
    ? new Date(`${trimmed}${suffixForDateOnly}`)
    : new Date(trimmed);

  return Number.isNaN(candidate.getTime()) ? undefined : candidate;
}

/**
 * Construye un filtro `{ gte, lte }` en hora oficial de Argentina (`-03:00`)
 * para columnas timestamp reales como `Order.createdAt` y `CreditNote.createdAt`.
 * Evita excluir comprobantes emitidos el mismo `endDate` cuando llega sin hora (`00:00Z`).
 */
export function parseArgentinaTimestampRange(
  startDate?: string,
  endDate?: string,
): { gte?: Date; lte?: Date } | undefined {
  const gte = parseDateBoundary(startDate, 'T00:00:00.000-03:00');
  const lte = parseDateBoundary(endDate, 'T23:59:59.999-03:00');

  if (!gte && !lte) return undefined;
  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  };
}

/**
 * Construye un filtro `{ gte, lte }` UTC de día completo (`00:00:00.000Z` a `23:59:59.999Z`)
 * para fechas de calendario sin hora local (`SupplierInvoice.issueDate`, `TaxWithholding.date`).
 */
export function parseCalendarDateRange(
  startDate?: string,
  endDate?: string,
): { gte?: Date; lte?: Date } | undefined {
  const gte = parseDateBoundary(startDate, 'T00:00:00.000Z');
  const lte = parseDateBoundary(endDate, 'T23:59:59.999Z');

  if (!gte && !lte) return undefined;
  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  };
}
