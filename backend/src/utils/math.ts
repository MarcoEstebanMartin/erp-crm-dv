/**
 * Redondea un valor numérico a 2 decimales con precisión de moneda,
 * previniendo errores de imprecisión en coma flotante de JavaScript (ej. 1.005 -> 1.01).
 */
export function roundCurrency(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Redondea un valor numérico a N decimales de precisión intermedia (por defecto 4 decimales).
 */
export function roundPrecision(val: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}
