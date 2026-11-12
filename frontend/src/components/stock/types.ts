import { computeProductWmsBreakdown } from '../deposito/wmsStockBreakdown';
import { resolveProductRowValuation } from '../../utils/exactStockMath';

export interface StockDashboardProps {
  products: any[];
  onRefresh: () => Promise<void>;
  onJumpToMapLocation?: (locationCode: string) => void;
  userRole?: string;
}

export type StockFilterType = 'all' | 'low' | 'out' | 'expiring' | 'located' | 'unassigned';

export interface AdjustModalState {
  open: boolean;
  product: any | null;
  quantityChange: number;
  reason: string;
  lotNumber: string;
  isNewLot: boolean;
  expirationDate: string;
}

export interface LotManagerModalState {
  open: boolean;
  product: any | null;
}

export interface TransferLotData {
  fromLotId: number | '';
  toLotNumber: string;
  toExpirationDate: string;
  isNewDestLot: boolean;
  quantity: number;
}

export interface StockValuationStats {
  totalUnits: number;
  locatedUnits: number;
  unassignedUnits: number;
  totalCost: number;
  totalRetailVal: number;
  lowStockCount: number;
  outOfStockCount: number;
  goodStockCount: number;
}

export const INITIAL_ADJUST_MODAL: AdjustModalState = {
  open: false,
  product: null,
  quantityChange: 0,
  reason: '',
  lotNumber: '',
  isNewLot: false,
  expirationDate: ''
};

export const INITIAL_TRANSFER_DATA: TransferLotData = {
  fromLotId: '',
  toLotNumber: '',
  toExpirationDate: '',
  isNewDestLot: false,
  quantity: 0
};

export const extractRubroLabel = (p: any): string => {
  if (!p.rubro) return 'Sin Rubro';
  if (typeof p.rubro === 'string') return p.rubro;
  return p.rubro.name || 'Sin Rubro';
};

export const getDisplayedStock = (
  p: any,
  pendingAdjustments: Record<string, number>
): number => {
  if (p.lots && p.lots.length > 0) {
    return p.lots.reduce((sum: number, lot: any) => {
      const pending = pendingAdjustments[`lot-${lot.id}`];
      return sum + (pending !== undefined ? pending : lot.stock);
    }, 0);
  }
  const pending = pendingAdjustments[`prod-${p.id}`];
  return pending !== undefined ? pending : p.stock;
};

export const hasProductPendingAdjustment = (
  p: any,
  pendingAdjustments: Record<string, number>
): boolean => {
  if (pendingAdjustments[`prod-${p.id}`] !== undefined) return true;
  return (p.lots || []).some((lot: any) => pendingAdjustments[`lot-${lot.id}`] !== undefined);
};

export const computeStockStats = (
  filteredProducts: any[],
  pendingAdjustments: Record<string, number>,
  canViewCosts = true
): StockValuationStats => {
  let totalCostBig = 0n;
  let totalRetailBig = 0n;

  const stats = filteredProducts.reduce<StockValuationStats>(
    (acc, p) => {
      const stockQty = getDisplayedStock(p, pendingAdjustments);
      const wms = computeProductWmsBreakdown(p, pendingAdjustments);
      const hasPendingEdit = hasProductPendingAdjustment(p, pendingAdjustments);
      const rowVal = resolveProductRowValuation(p, stockQty, { hasPendingEdit, canViewCosts });
      const minStock = Number(p.minStock) || 0;

      acc.totalUnits += stockQty;
      acc.locatedUnits += wms.locatedUnits;
      acc.unassignedUnits += wms.unassignedUnits;
      totalCostBig += BigInt(rowVal.stockValueCost);
      totalRetailBig += BigInt(rowVal.stockValueSale);

      if (stockQty <= 0) {
        acc.outOfStockCount += 1;
      } else if (minStock > 0 && stockQty < minStock) {
        acc.lowStockCount += 1;
      } else {
        acc.goodStockCount += 1;
      }

      return acc;
    },
    {
      totalUnits: 0,
      locatedUnits: 0,
      unassignedUnits: 0,
      totalCost: 0,
      totalRetailVal: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      goodStockCount: 0
    }
  );

  stats.totalCost = Number(totalCostBig);
  stats.totalRetailVal = Number(totalRetailBig);
  return stats;
};
