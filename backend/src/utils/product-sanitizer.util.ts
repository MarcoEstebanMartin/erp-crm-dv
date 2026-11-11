import { Role } from '@prisma/client';

const COST_PRIVILEGED_ROLES: readonly string[] = [Role.ADMIN, Role.FACTURACION];

export function canViewProductCosts(role?: string | null): boolean {
  if (!role) return false;
  return COST_PRIVILEGED_ROLES.includes(role);
}

/**
 * Oculta costos de compra, márgenes confidenciales y valuación financiera de stock
 * para roles operativos (VENDEDOR, DEPOSITO, CHOFER), preservando la forma del objeto
 * para mantener compatibilidad total con las pantallas operativas.
 */
export function sanitizeProductForRole<T extends Record<string, any>>(
  product: T,
  role?: string | null,
): T {
  if (!product || canViewProductCosts(role)) {
    return product;
  }

  return {
    ...product,
    costPrice: 0,
    profitMargin: null,
    provider: product.provider
      ? { id: product.provider.id, name: product.provider.name }
      : null,
    ...(product.stockValuation
      ? {
          stockValuation: {
            ...product.stockValuation,
            unitCost: 0,
            totalValueCost: 0,
            estimatedProfit: 0,
          },
        }
      : {}),
  };
}

export function sanitizeProductListForRole<T extends Record<string, any>>(
  products: T[],
  role?: string | null,
): T[] {
  if (canViewProductCosts(role)) return products;
  return products.map((p) => sanitizeProductForRole(p, role));
}
