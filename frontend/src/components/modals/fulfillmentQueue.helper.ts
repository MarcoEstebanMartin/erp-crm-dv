/**
 * Devuelve el siguiente índice de la cola o null si ya se procesó el último pedido.
 */
export function getNextQueueIndex(currentIndex: number, totalItems: number): number | null {
  if (totalItems <= 0) return null;
  const next = currentIndex + 1;
  return next < totalItems ? next : null;
}

/**
 * Resuelve qué pedidos entran a la cola de facturación:
 * si hay pedidos marcados manualmente, usa esos en el orden visible;
 * si no hay marcados, toma todos los pedidos visibles en "En Armado".
 */
export function resolvePreparingQueueOrders<T extends { id: number }>(
  preparingOrders: T[],
  selectedPreparingIds: number[],
): T[] {
  if (selectedPreparingIds.length === 0) {
    return [...preparingOrders];
  }
  const selectedSet = new Set(selectedPreparingIds);
  const matched = preparingOrders.filter((o) => selectedSet.has(o.id));
  return matched.length > 0 ? matched : [...preparingOrders];
}
