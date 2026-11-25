import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  computeStockAdjustDelta,
  filterDepositoProducts,
  getDefaultReasonForMode,
  hasExpiringOrExpiredLot,
} from '../stockFilterHelpers';

describe('Paso 3 App Depósito — Stock unificado, vencimientos y ajuste sin signos', () => {
  const refDate = new Date('2026-11-25T12:00:00Z');
  const sampleProducts: any[] = [
    { id: 1, sku: '001', name: 'Queso Tybo', stock: 0, minStock: 10, lots: [] },
    {
      id: 2,
      sku: '002',
      name: 'Jamón Cocido',
      stock: 4,
      minStock: 10,
      lots: [{ id: 10, stock: 4, location: 'D1-R01-C04-A', expirationDate: '2026-12-05T00:00:00Z' }],
    },
    {
      id: 3,
      sku: '003',
      name: 'Fideos',
      stock: 25,
      minStock: 10,
      lots: [{ id: 20, stock: 25, location: 'S/U', expirationDate: '2036-12-31T00:00:00Z' }],
    },
  ];

  it('filtra correctamente Sin stock, Bajo, Por vencer y Sin ubicar', () => {
    expect(filterDepositoProducts(sampleProducts, 'OUT', refDate).map((p) => p.id)).toEqual([1]);
    expect(filterDepositoProducts(sampleProducts, 'LOW', refDate).map((p) => p.id)).toEqual([2]);
    expect(filterDepositoProducts(sampleProducts, 'EXPIRING', refDate).map((p) => p.id)).toEqual([2]);
    expect(filterDepositoProducts(sampleProducts, 'UNASSIGNED', refDate).map((p) => p.id)).toEqual([3]);
    expect(hasExpiringOrExpiredLot(sampleProducts[2], refDate)).toBe(false);
  });

  it('calcula deltas exactos para Ingresar, Retirar y Contar real sin signos manuales', () => {
    expect(computeStockAdjustDelta('ADD', 12, 20)).toBe(12);
    expect(computeStockAdjustDelta('SUBTRACT', 5, 20)).toBe(-5);
    expect(computeStockAdjustDelta('COUNT', 18, 20)).toBe(-2);
    expect(computeStockAdjustDelta('COUNT', 25, 20)).toBe(5);
    expect(computeStockAdjustDelta('COUNT', 20, 20)).toBe(0);
    expect(getDefaultReasonForMode('COUNT')).toContain('inventario');
  });

  it('mantiene DepositoStockListTab y DepositoStockAdjustModal bajo 300 líneas y Mapa WMS adaptado a táctil', () => {
    const listSrc = readFileSync(resolve(process.cwd(), 'src/components/deposito/DepositoStockListTab.tsx'), 'utf8');
    const modalSrc = readFileSync(resolve(process.cwd(), 'src/components/deposito/DepositoStockAdjustModal.tsx'), 'utf8');
    const mapGridSrc = readFileSync(resolve(process.cwd(), 'src/components/deposito/WarehouseMapGrid.tsx'), 'utf8');
    const inspectorSrc = readFileSync(resolve(process.cwd(), 'src/components/deposito/WarehouseSlotInspectorSidebar.tsx'), 'utf8');
    expect(listSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(modalSrc.split(/\r?\n/).length).toBeLessThanOrEqual(300);
    expect(mapGridSrc).toContain('wms-grid-scroll');
    expect(inspectorSrc).toContain('wms-inspector-panel');
  });
});
