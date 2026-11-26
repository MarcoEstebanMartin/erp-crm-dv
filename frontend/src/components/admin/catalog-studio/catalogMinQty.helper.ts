const SUPPRESSED_MIN_QTY_TOKENS = new Set([
  '0',
  '1',
  'SIN MÍNIMO',
  'SIN MINIMO',
  'NO',
  'NONE',
  'FALSE',
  'SIN MÍN.',
  'SIN MIN.',
  'SIN CARTEL',
]);

/**
 * Resuelve el texto corto de cantidad mínima visible en la tarjeta del Estudio de Catálogo,
 * alineado con la regla de `parseMinQtyBadge` del generador PDF:
 * - Si `catalogMinQtyLabel` tiene un token de supresión ("SIN MINIMO", "0", etc.), oculta la etiqueta.
 * - Si `catalogMinQtyLabel` tiene texto manual, muestra ese texto.
 * - Si está vacío y `minOrderQuantity > 1`, muestra el mínimo del ERP (ej. "3 u.").
 */
export function resolveEffectiveMinQtyLabel(
  catalogMinQtyLabel?: string | null,
  minOrderQuantity?: number | null,
): string | null {
  const custom = String(catalogMinQtyLabel || '').trim();
  if (custom) {
    if (SUPPRESSED_MIN_QTY_TOKENS.has(custom.toUpperCase())) {
      return null;
    }
    return custom;
  }

  const erpMin = Math.floor(Number(minOrderQuantity || 0));
  if (Number.isFinite(erpMin) && erpMin > 1) {
    return `${erpMin} u.`;
  }

  return null;
}
