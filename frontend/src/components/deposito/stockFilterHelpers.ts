import type { Product } from '../../types';
import { computeProductWmsBreakdown } from './wmsStockBreakdown';
import { isSentinelExpiration } from '../stock/lotLabel';

export type DepositoStockFilter = 'ALL' | 'OUT' | 'LOW' | 'EXPIRING' | 'UNASSIGNED';
export type StockAdjustMode = 'ADD' | 'SUBTRACT' | 'COUNT';

export function getLotDaysUntilExpiration(
  expirationDate?: string | Date | null,
  refDate: Date = new Date(),
): number | null {
  if (!expirationDate || isSentinelExpiration(expirationDate)) return null;
  const exp = expirationDate instanceof Date ? expirationDate : new Date(expirationDate);
  if (Number.isNaN(exp.getTime())) return null;
  const expDay = Date.UTC(exp.getUTCFullYear(), exp.getUTCMonth(), exp.getUTCDate());
  const todayDay = Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate());
  return Math.ceil((expDay - todayDay) / (1000 * 3600 * 24));
}

export function hasExpiringOrExpiredLot(
  product: Product,
  refDate: Date = new Date(),
  thresholdDays = 30,
): boolean {
  const lots = Array.isArray(product.lots) ? product.lots : [];
  return lots.some((lot: any) => {
    if (Number(lot.stock || 0) <= 0) return false;
    const days = getLotDaysUntilExpiration(lot.expirationDate, refDate);
    return days !== null && days <= thresholdDays;
  });
}

export function filterDepositoProducts(
  products: Product[],
  filter: DepositoStockFilter,
  refDate: Date = new Date(),
): Product[] {
  if (filter === 'ALL') return products;
  return products.filter((p) => {
    const stock = Number(p.stock || 0);
    const minStock = Number(p.minStock || 0);
    if (filter === 'OUT') return stock <= 0;
    if (filter === 'LOW') return stock > 0 && minStock > 0 && stock < minStock;
    if (filter === 'EXPIRING') return hasExpiringOrExpiredLot(p, refDate);
    if (filter === 'UNASSIGNED') return computeProductWmsBreakdown(p).unassignedUnits > 0;
    return true;
  });
}

export function computeStockAdjustDelta(
  mode: StockAdjustMode,
  inputAmount: number,
  currentStock: number,
): number {
  const safeCurrent = Number.isFinite(currentStock) ? Math.trunc(currentStock) : 0;
  const safeInput = Number.isFinite(inputAmount) ? Math.max(0, Math.trunc(inputAmount)) : 0;
  if (mode === 'ADD') return safeInput;
  if (mode === 'SUBTRACT') return -safeInput;
  return safeInput - safeCurrent;
}

export function getDefaultReasonForMode(mode: StockAdjustMode): string {
  if (mode === 'ADD') return 'Ingreso de mercadería por compras';
  if (mode === 'SUBTRACT') return 'Rotura / Vencimiento de lote';
  return 'Ajuste por inventario físico mensual';
}
