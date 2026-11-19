import { describe, expect, it } from 'vitest';
import {
  buildSlotStockSummaryMap,
  buildUnassignedTrayEntries,
  computeLevelMixWarning,
  formatCompactSlotLevels,
  resolveWarehouseForSector,
} from '../wmsMapHelpers';

describe('Paso 3 WMS Usability — semáforo físico, bandeja S/U, sectores y anti-pisado', () => {
  const refDate = new Date('2026-11-19T12:00:00Z');

  it('buildSlotStockSummaryMap usa stock físico aunque disponible esté reservado en 0 y marca semáforo', () => {
    const products: any[] = [
      {
        id: 1,
        sku: '0001',
        name: 'Queso Tybo',
        stock: 0, // todo reservado comercialmente, pero físicamente en cámara
        lots: [
          { id: 10, stock: 12, location: 'D1-R01-C04-A', expirationDate: '2026-11-15T00:00:00Z' }, // vencido
        ],
      },
      {
        id: 2,
        sku: '0002',
        name: 'Dulce de Leche',
        stock: 20,
        lots: [
          { id: 20, stock: 20, location: 'D1-R02-C04-B', expirationDate: '2026-12-05T00:00:00Z' }, // < 30d
        ],
      },
      {
        id: 3,
        sku: '0003',
        name: 'Fideos',
        stock: 30,
        lots: [
          { id: 30, stock: 30, location: 'D2-R09-C01-A', expirationDate: '2036-12-31T00:00:00Z' }, // OK
        ],
      },
    ];

    const summary = buildSlotStockSummaryMap(products, refDate);
    expect(summary['D1-R01-C04'].totalStock).toBe(12);
    expect(summary['D1-R01-C04'].health).toBe('EXPIRED');
    expect(summary['D1-R02-C04'].health).toBe('EXPIRING_SOON');
    expect(summary['D2-R09-C01'].health).toBe('OK');
    expect(summary['D1-R03-C04']).toBeUndefined();
  });

  it('formatCompactSlotLevels acorta A-B-C-D-E-F a A–F y resolveWarehouseForSector salta a D1/D2/D3', () => {
    expect(formatCompactSlotLevels('A-B-C-D-E-F')).toBe('A–F');
    expect(formatCompactSlotLevels('A-B-C')).toBe('A-B-C');
    expect(resolveWarehouseForSector('CAMARA_2')).toBe('D1');
    expect(resolveWarehouseForSector('D2_GENERAL')).toBe('D2');
    expect(resolveWarehouseForSector('D3_GENERAL')).toBe('D3');
  });

  it('buildUnassignedTrayEntries lista S/U ordenando por FEFO y omitiendo lotes ya ubicados o en cero', () => {
    const products: any[] = [
      {
        id: 1,
        sku: '001',
        name: 'Queso B',
        stock: 10,
        lots: [
          { id: 1, lotNumber: 'L-LATE', stock: 5, location: 'S/U', expirationDate: '2027-05-01T00:00:00Z' },
          { id: 2, lotNumber: 'L-UBIC', stock: 5, location: 'D1-R01-C04-A', expirationDate: '2026-11-25T00:00:00Z' },
        ],
      },
      {
        id: 2,
        sku: '002',
        name: 'Queso A',
        stock: 8,
        lots: [
          { id: 3, lotNumber: 'L-SOON', stock: 8, location: 'S/U', expirationDate: '2026-11-25T00:00:00Z' },
          { id: 4, lotNumber: 'L-ZERO', stock: 0, location: 'S/U', expirationDate: '2026-11-21T00:00:00Z' },
        ],
      },
    ];

    const tray = buildUnassignedTrayEntries(products, refDate);
    expect(tray).toHaveLength(2);
    expect(tray[0]).toMatchObject({ lotId: 3, lotNumber: 'L-SOON', units: 8, health: 'EXPIRING_SOON' });
    expect(tray[1]).toMatchObject({ lotId: 1, lotNumber: 'L-LATE', units: 5, health: 'OK' });
  });

  it('computeLevelMixWarning advierte al mezclar otro producto o distinto vencimiento en el mismo piso', () => {
    const existing: any[] = [
      {
        product: { id: 10, name: 'Tybo Barra' },
        lot: { id: 1, lotNumber: 'L-10', stock: 12, expirationDate: '2026-12-10T00:00:00Z' },
      },
    ];

    const otherProduct = computeLevelMixWarning(existing, { productId: 20, lotNumber: 'L-20' });
    expect(otherProduct?.kind).toBe('OTHER_PRODUCT');

    const otherExp = computeLevelMixWarning(existing, {
      productId: 10,
      lotNumber: 'L-11',
      expirationDate: '2027-02-01T00:00:00Z',
    });
    expect(otherExp?.kind).toBe('OTHER_EXPIRATION');

    const sameLot = computeLevelMixWarning(existing, {
      productId: 10,
      lotNumber: 'L-10',
      expirationDate: '2026-12-10T00:00:00Z',
    });
    expect(sameLot).toBeNull();
  });
});
