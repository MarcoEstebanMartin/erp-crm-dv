import {
  cleanVarietiesText,
  computeMarginPercent,
  normalizeCatalogBadge,
  type CatalogProductInput,
} from './catalog-studio.engine';

const VARIANT_SKU_RE = /^([^-]+)-(\d+)$/;

export interface CatalogVariantRecord extends CatalogProductInput {
  previousListPrice?: number | null;
  marginPct?: number | null;
}

/**
 * Si el SKU sigue la convención de variante `<BASE>-<N>` (ej. `0456-1`),
 * devuelve `<BASE>` (`0456`). En caso contrario devuelve `null`.
 */
export function parseVariantSkuBase(sku?: string | null): string | null {
  const trimmed = String(sku || '').trim();
  const match = VARIANT_SKU_RE.exec(trimmed);
  return match ? match[1] : null;
}

function normalizeToken(token: string): string {
  return token
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^[.,;:()\-/]+|[.,;:()\-/]+$/g, '');
}

function tokenizeName(name: string): string[] {
  return String(name || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tokensRoughlyEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4) {
    if (`${a}S` === b || `${b}S` === a) return true;
    if (`${a}ES` === b || `${b}ES` === a) return true;
  }
  return false;
}

/**
 * Deduce la lista de sabores/variedades a partir de los nombres de los hijos activos.
 * Cuando hay 2 o más hijos, elimina los tokens comunes a todos los hermanos (marca,
 * descripción base y gramaje) para dejar únicamente la diferencia de cada sabor.
 * Cuando hay 1 solo hijo, resta los tokens compartidos con el nombre del padre.
 */
export function extractFamilyVarieties(
  childNames: string[],
  parentName?: string | null,
): string | null {
  const cleanedNames = childNames.map((n) => String(n || '').trim()).filter(Boolean);
  if (cleanedNames.length === 0) return null;

  const tokenized = cleanedNames.map((n) => ({
    raw: tokenizeName(n),
    norm: tokenizeName(n).map(normalizeToken),
  }));

  const extracted: string[] = [];

  if (tokenized.length >= 2) {
    const commonNorm = new Set<string>();
    const firstNorm = tokenized[0].norm;
    for (const tok of firstNorm) {
      if (!tok) continue;
      const inAll = tokenized.every((item) => item.norm.some((t) => tokensRoughlyEqual(t, tok)));
      if (inAll) commonNorm.add(tok);
    }

    for (const item of tokenized) {
      const uniqueParts = item.raw.filter((_, idx) => {
        const nt = item.norm[idx];
        if (!nt) return false;
        return !Array.from(commonNorm).some((c) => tokensRoughlyEqual(c, nt));
      });
      const label = uniqueParts.join(' ').trim();
      if (label) extracted.push(label);
    }
  } else if (parentName) {
    const parentNorm = tokenizeName(parentName).map(normalizeToken).filter(Boolean);
    const item = tokenized[0];
    const uniqueParts = item.raw.filter((_, idx) => {
      const nt = item.norm[idx];
      if (!nt) return false;
      return !parentNorm.some((p) => tokensRoughlyEqual(p, nt));
    });
    const label = uniqueParts.join(' ').trim();
    if (label) extracted.push(label);
  }

  const uniqueOrdered: string[] = [];
  const seen = new Set<string>();
  for (const label of extracted) {
    const key = normalizeToken(label);
    if (key && !seen.has(key)) {
      seen.add(key);
      uniqueOrdered.push(label);
    }
  }

  if (uniqueOrdered.length === 0) return null;
  const formatted = cleanVarietiesText(uniqueOrdered.join(' - '));
  return formatted || null;
}

/**
 * Agrupa familias `<SKU>` (padre genérico de catálogo) + `<SKU>-1, <SKU>-2...` (hijos activos de ERP)
 * en una sola tarjeta de catálogo:
 * - Mantiene el nombre, la foto grupal y la configuración visual del padre.
 * - Toma el precio, costo y precio anterior del primer hijo activo.
 * - Suma el stock de todos los hijos activos.
 * - Arma automáticamente las variedades si el padre no tiene variedades manuales.
 * - Hereda el badge del padre (o el de los hijos si el padre no tiene).
 * - Si un padre no tiene hijos activos, no se incluye en el catálogo.
 */
export function collapseCatalogVariantFamilies<T extends CatalogVariantRecord>(
  activeProducts: T[],
  parentProducts: T[],
): T[] {
  const activeChildrenByBase = new Map<string, T[]>();
  for (const item of activeProducts) {
    const base = parseVariantSkuBase(item.sku);
    if (!base) continue;
    const list = activeChildrenByBase.get(base) || [];
    list.push(item);
    activeChildrenByBase.set(base, list);
  }

  const parentBySku = new Map<string, T>();
  for (const p of parentProducts) {
    parentBySku.set(p.sku.trim(), p);
  }
  for (const p of activeProducts) {
    if (!parseVariantSkuBase(p.sku)) {
      parentBySku.set(p.sku.trim(), p);
    }
  }

  const collapsedBases = new Set<string>();
  const familyCards: T[] = [];

  for (const [base, children] of activeChildrenByBase.entries()) {
    const parent = parentBySku.get(base);
    if (!parent || children.length === 0) continue;

    collapsedBases.add(base);
    const sortedChildren = [...children].sort((a, b) =>
      a.sku.localeCompare(b.sku, 'es', { numeric: true }),
    );
    const primary = sortedChildren[0];
    const totalStock = sortedChildren.reduce((sum, c) => sum + Number(c.stock || 0), 0);

    const childBadge = sortedChildren.map((c) => normalizeCatalogBadge(c.badge)).find(Boolean) ?? null;
    const resolvedBadge = normalizeCatalogBadge(parent.badge) ?? childBadge;

    const autoVarieties = extractFamilyVarieties(
      sortedChildren.map((c) => c.name),
      parent.name,
    );
    const resolvedVarieties = parent.varieties ? parent.varieties : autoVarieties;

    const resolvedOldPrice = parent.oldPrice ?? primary.oldPrice ?? primary.previousListPrice;

    familyCards.push({
      ...parent,
      price: primary.price,
      costPrice: primary.costPrice,
      previousListPrice: primary.previousListPrice,
      oldPrice: resolvedOldPrice,
      marginPct: computeMarginPercent(primary.price, primary.costPrice),
      stock: totalStock,
      badge: resolvedBadge,
      varieties: resolvedVarieties,
      isActive: true,
    });
  }

  const result: T[] = [];
  for (const item of activeProducts) {
    const base = parseVariantSkuBase(item.sku);
    if (base && collapsedBases.has(base)) continue;
    if (!base && collapsedBases.has(item.sku.trim())) continue;
    result.push(item);
  }

  result.push(...familyCards);
  result.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return result;
}
