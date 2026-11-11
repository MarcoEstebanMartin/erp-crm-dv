/**
 * Formateador central de Pesos Enteros (Política ERP-CRM DV: 0 decimales visuales en saldos,
 * precios, cajas y remitos comerciales, respetando separador de miles `es-AR`).
 * Usa redondeo simétrico HALF_UP (`sign * Math.floor(Math.abs(n) + 0.5)`).
 */
export function roundHalfUpInteger(value: number | string | null | undefined): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num === 0) return 0;
  const sign = num < 0 ? -1 : 1;
  return sign * Math.floor(Math.abs(num) + 0.5);
}

export function formatIntegerNumberAR(value: number | string | null | undefined): string {
  return roundHalfUpInteger(value).toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatIntegerARS(value: number | string | null | undefined): string {
  const rounded = roundHalfUpInteger(value);
  if (rounded < 0) {
    return `-$${Math.abs(rounded).toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }
  return `$${rounded.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
