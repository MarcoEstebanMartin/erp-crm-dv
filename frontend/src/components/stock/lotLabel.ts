/**
 * Utilidades puras de presentación minimalista para lotes y vencimientos en Stock/WMS.
 * Oculta sufijos técnicos internos (@SLOT, S/L-SLOT) y fechas centinela (2036-12-31).
 */

export function extractCleanLotNumber(lotNumber?: string | null): string {
  if (!lotNumber || typeof lotNumber !== 'string') return 'S/L';
  const trimmed = lotNumber.trim();
  if (!trimmed) return 'S/L';

  const withoutAt = trimmed.split('@')[0].trim();
  if (!withoutAt) return 'S/L';

  if (/^S\/L(?:-.+)?$/i.test(withoutAt)) {
    return 'S/L';
  }

  return withoutAt;
}

export function isSentinelExpiration(dateInput?: string | Date | null): boolean {
  if (!dateInput) return true;
  if (typeof dateInput === 'string' && !dateInput.trim()) return true;

  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return true;

  return parsed.getUTCFullYear() >= 2035;
}

export function isGenericUntrackedLot(
  lot?: { lotNumber?: string | null; expirationDate?: string | Date | null } | null
): boolean {
  if (!lot) return true;
  return (
    extractCleanLotNumber(lot.lotNumber).toUpperCase() === 'S/L' &&
    isSentinelExpiration(lot.expirationDate)
  );
}

export function formatCleanExpirationDate(dateInput?: string | Date | null): string {
  if (isSentinelExpiration(dateInput)) {
    return 'Sin vencimiento';
  }
  const parsed = dateInput instanceof Date ? dateInput : new Date(dateInput as string);
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const year = parsed.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
