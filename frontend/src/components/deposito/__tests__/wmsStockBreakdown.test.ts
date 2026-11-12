import { describe, expect, it } from 'vitest';
import { computeProductWmsBreakdown } from '../wmsStockBreakdown';
import { computeStockStats } from '../../stock/types';

describe('computeProductWmsBreakdown & Stock Parity', () => {
  it('separa exactamente las unidades ubicadas en racks de las unidades Sin Ubicar (S/U)', () => {
    const product = {
      id: 10,
      sku: '0001',
      name: 'Queso Cremoso',
      stock: 100,
      costPrice: 5000,
      listPrice: 7000,
      minStock: 15,
      lots: [
        { id: 1, lotNumber: 'L-01@D1-R01-C04-A', stock: 35, location: 'D1-R01-C04-A' },
        { id: 2, lotNumber: 'L-01@D2-R10-C02-B', stock: 25, location: 'D2-R10-C02-B' },
        { id: 3, lotNumber: 'L-01', stock: 40, location: 'S/U' },
      ],
    };

    const res = computeProductWmsBreakdown(product);
    expect(res.totalUnits).toBe(100);
    expect(res.locatedUnits).toBe(60);
    expect(res.unassignedUnits).toBe(40);
    expect(res.locatedUnits + res.unassignedUnits).toBe(res.totalUnits);
    expect(res.slotEntries).toEqual([
      {
        location: 'D1-R01-C04-A',
        baseSlotCode: 'D1-R01-C04',
        warehouseId: 'D1',
        units: 35,
      },
      {
        location: 'D2-R10-C02-B',
        baseSlotCode: 'D2-R10-C02',
        warehouseId: 'D2',
        units: 25,
      },
    ]);
  });

  it('refleja en tiempo real los ajustes pendientes del Modo Inventario Rápido', () => {
    const product = {
      id: 22,
      sku: '0022',
      name: 'Mozzarella',
      stock: 100,
      costPrice: 4000,
      listPrice: 6000,
      minStock: 10,
      lots: [{ id: 9, lotNumber: 'S/L', stock: 100, location: 'S/U' }],
    };

    const stats = computeStockStats([product], { 'lot-9': 120 });
    expect(stats.totalUnits).toBe(120);
    expect(stats.locatedUnits).toBe(0);
    expect(stats.unassignedUnits).toBe(120);
  });
});
