import { extractBaseSlotFromLocation } from './warehouseLayoutMerger';

export interface ProductSlotEntry {
  location: string;
  baseSlotCode: string;
  warehouseId: 'D1' | 'D2' | 'D3' | 'ALL';
  units: number;
}

export interface ProductWmsBreakdown {
  totalUnits: number;
  locatedUnits: number;
  unassignedUnits: number;
  slotEntries: ProductSlotEntry[];
}

function resolveWarehouseFromSlot(code: string): 'D1' | 'D2' | 'D3' | 'ALL' {
  const upper = code.toUpperCase();
  if (upper.startsWith('D1-')) return 'D1';
  if (upper.startsWith('D2-')) return 'D2';
  if (upper.startsWith('D3-')) return 'D3';
  return 'ALL';
}

export function isRealWmsSlotLocation(location?: string | null): boolean {
  if (!location) return false;
  const clean = location.trim().toUpperCase();
  return clean !== '' && clean !== 'S/U';
}

export function computeProductWmsBreakdown(
  product: any,
  pendingAdjustments: Record<string, number> = {},
): ProductWmsBreakdown {
  const lots = Array.isArray(product?.lots) ? product.lots : [];

  if (lots.length === 0) {
    const rawStock =
      pendingAdjustments[`prod-${product?.id}`] !== undefined
        ? pendingAdjustments[`prod-${product?.id}`]
        : Number(product?.stock) || 0;
    const totalUnits = Math.max(0, rawStock);

    if (totalUnits > 0 && isRealWmsSlotLocation(product?.defaultLocation)) {
      const loc = String(product.defaultLocation).trim().toUpperCase();
      const baseSlotCode = extractBaseSlotFromLocation(loc) || loc;
      return {
        totalUnits,
        locatedUnits: totalUnits,
        unassignedUnits: 0,
        slotEntries: [
          {
            location: loc,
            baseSlotCode,
            warehouseId: resolveWarehouseFromSlot(baseSlotCode),
            units: totalUnits,
          },
        ],
      };
    }

    return {
      totalUnits,
      locatedUnits: 0,
      unassignedUnits: totalUnits,
      slotEntries: [],
    };
  }

  let totalFromLots = 0;
  let locatedUnits = 0;
  const byLocation = new Map<string, ProductSlotEntry>();

  for (const lot of lots) {
    const rawLotStock =
      pendingAdjustments[`lot-${lot.id}`] !== undefined
        ? pendingAdjustments[`lot-${lot.id}`]
        : Number(lot.stock) || 0;
    const st = Math.max(0, rawLotStock);
    if (st <= 0) continue;

    totalFromLots += st;
    if (isRealWmsSlotLocation(lot.location)) {
      const loc = String(lot.location).trim().toUpperCase();
      const baseSlotCode = extractBaseSlotFromLocation(loc) || loc;
      locatedUnits += st;
      const prev = byLocation.get(loc);
      if (prev) {
        prev.units += st;
      } else {
        byLocation.set(loc, {
          location: loc,
          baseSlotCode,
          warehouseId: resolveWarehouseFromSlot(baseSlotCode),
          units: st,
        });
      }
    }
  }

  const unassignedUnits = Math.max(0, totalFromLots - locatedUnits);
  const slotEntries = Array.from(byLocation.values()).sort((a, b) =>
    a.location.localeCompare(b.location),
  );

  return {
    totalUnits: totalFromLots,
    locatedUnits,
    unassignedUnits,
    slotEntries,
  };
}
