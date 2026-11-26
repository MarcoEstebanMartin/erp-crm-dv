export function buildEffectiveCategoryOrder(
  savedOrder: readonly string[],
  canonicalCategories: readonly string[],
  productCategories: readonly string[] = [],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const append = (raw: string) => {
    const clean = String(raw || '').trim();
    if (!clean || clean === 'COMBOS' || seen.has(clean)) return;
    seen.add(clean);
    result.push(clean);
  };

  for (const c of savedOrder) append(c);
  for (const c of canonicalCategories) append(c);
  for (const c of productCategories) append(c);

  return result;
}

export function moveCategory(
  order: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  if (
    fromIndex < 0 ||
    fromIndex >= order.length ||
    toIndex < 0 ||
    toIndex >= order.length ||
    fromIndex === toIndex
  ) {
    return [...order];
  }
  const next = [...order];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function moveCategoryToTop(order: readonly string[], index: number): string[] {
  return moveCategory(order, index, 0);
}

export function isSameCategoryOrder(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
