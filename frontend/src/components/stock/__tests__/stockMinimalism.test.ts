import { describe, expect, it } from 'vitest';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isGenericUntrackedLot,
  isSentinelExpiration
} from '../lotLabel';
import { computeStockStats } from '../types';

describe('Stock Minimalism — Etiquetas limpias de Lote/WMS y Verdad Operativa de Stock Mínimo', () => {
  it('extractCleanLotNumber limpia sufijos técnicos @SLOT y S/L-SLOT sin alterar lotes reales', () => {
    expect(extractCleanLotNumber('S/L@D1-R01-C04-C')).toBe('S/L');
    expect(extractCleanLotNumber('L-2409@D1-R01-C04-C')).toBe('L-2409');
    expect(extractCleanLotNumber('S/L-D1-R01-C04-A')).toBe('S/L');
    expect(extractCleanLotNumber('S/L-D1-R01-C04-A@D1-R01-C04-B')).toBe('S/L');
    expect(extractCleanLotNumber('L-2026-09')).toBe('L-2026-09');
    expect(extractCleanLotNumber('')).toBe('S/L');
    expect(extractCleanLotNumber(null)).toBe('S/L');
    expect(extractCleanLotNumber(undefined)).toBe('S/L');
  });

  it('isSentinelExpiration detecta fechas centinela (>= 2035), nulas o inválidas', () => {
    expect(isSentinelExpiration('2036-12-31')).toBe(true);
    expect(isSentinelExpiration('2036-12-31T00:00:00.000Z')).toBe(true);
    expect(isSentinelExpiration(new Date('2035-01-01T00:00:00Z'))).toBe(true);
    expect(isSentinelExpiration(null)).toBe(true);
    expect(isSentinelExpiration('')).toBe(true);
    expect(isSentinelExpiration('fecha-invalida')).toBe(true);

    expect(isSentinelExpiration('2027-03-15')).toBe(false);
    expect(isSentinelExpiration(new Date('2026-12-20T00:00:00Z'))).toBe(false);
  });

  it('isGenericUntrackedLot distingue stock genérico S/L sin vencimiento frente a lotes reales', () => {
    expect(
      isGenericUntrackedLot({
        lotNumber: 'S/L@D1-R01-C04-C',
        expirationDate: '2036-12-31T00:00:00.000Z'
      })
    ).toBe(true);
    expect(
      isGenericUntrackedLot({
        lotNumber: 'S/L',
        expirationDate: '2036-12-31'
      })
    ).toBe(true);

    expect(
      isGenericUntrackedLot({
        lotNumber: 'L-2409@D1-R01-C04-C',
        expirationDate: '2036-12-31T00:00:00.000Z'
      })
    ).toBe(false);
    expect(
      isGenericUntrackedLot({
        lotNumber: 'S/L',
        expirationDate: '2026-12-15T00:00:00.000Z'
      })
    ).toBe(false);
  });

  it('formatCleanExpirationDate oculta el centinela 2036 y formatea dd/mm/yyyy en fechas reales', () => {
    expect(formatCleanExpirationDate('2036-12-31T00:00:00.000Z')).toBe('Sin vencimiento');
    expect(formatCleanExpirationDate(null)).toBe('Sin vencimiento');
    expect(formatCleanExpirationDate('2027-03-05T00:00:00.000Z')).toBe('05/03/2027');
  });

  it('computeStockStats usa comparación estricta (< minStock) e ignora minStock = 0', () => {
    const exactAtMin = {
      id: 1,
      sku: '0001',
      stock: 100,
      minStock: 100,
      costPrice: 1000,
      listPrice: 1300,
      lots: [
        { id: 10, lotNumber: 'S/L', stock: 80, location: 'S/U' },
        { id: 11, lotNumber: 'S/L@D1-R01-C04-C', stock: 20, location: 'D1-R01-C04-C' }
      ]
    };
    const statsExact = computeStockStats([exactAtMin], {});
    expect(statsExact.lowStockCount).toBe(0);
    expect(statsExact.goodStockCount).toBe(1);

    const belowMin = { ...exactAtMin, id: 2, stock: 99, lots: [{ id: 12, lotNumber: 'S/L', stock: 99, location: 'S/U' }] };
    const statsBelow = computeStockStats([belowMin], {});
    expect(statsBelow.lowStockCount).toBe(1);
    expect(statsBelow.goodStockCount).toBe(0);

    const noMinConfigured = { ...exactAtMin, id: 3, stock: 5, minStock: 0, lots: [{ id: 13, lotNumber: 'S/L', stock: 5, location: 'S/U' }] };
    const statsNoMin = computeStockStats([noMinConfigured], {});
    expect(statsNoMin.lowStockCount).toBe(0);
    expect(statsNoMin.goodStockCount).toBe(1);
  });
});
