import { describe, expect, it } from 'vitest';
import {
  WMS_LOCATION_GROUPS,
  getLocationWeight,
  getProductLocation,
  resolveWmsSlotMeta,
  sortItemsByOptimalRoute,
} from '../depositoHelpers';

describe('Deposito route unification & FEFO-aware location resolution', () => {
  it('ordena D1 (Rack Entrada -> Estantería -> Cámara 3 -> Cámara 2 -> Cámara 1) antes de D2, D3 y S/U', () => {
    const unordered = [
      { id: 1, product: { id: 1, defaultLocation: 'S/U', lots: [] } },
      { id: 2, product: { id: 2, lots: [{ id: 1, stock: 5, location: 'D3-R23-C01-A' }] } },
      { id: 3, product: { id: 3, lots: [{ id: 2, stock: 5, location: 'D2-R09-C01-A' }] } },
      { id: 4, product: { id: 4, lots: [{ id: 3, stock: 5, location: 'D1-R07-C06-A' }] } }, // CAMARA_1
      { id: 5, product: { id: 5, lots: [{ id: 4, stock: 5, location: 'D1-R01-C11-A' }] } }, // CAMARA_2
      { id: 6, product: { id: 6, lots: [{ id: 5, stock: 5, location: 'D1-R05-C11-A' }] } }, // CAMARA_3
      { id: 7, product: { id: 7, lots: [{ id: 6, stock: 5, location: 'D1-R01-C04-A' }] } }, // ESTANTERIA
      { id: 8, product: { id: 8, lots: [{ id: 7, stock: 5, location: 'D1-R06-C01-A' }] } }, // RACK_ENTRADA
      { id: 9, product: { id: 9, lots: [{ id: 8, stock: 5, location: 'D1-R03-C04-A' }] } }, // ESTANTERIA fila 3
    ];

    const sorted = sortItemsByOptimalRoute(unordered);
    expect(sorted.map((x) => x.id)).toEqual([8, 7, 9, 6, 5, 4, 3, 2, 1]);
  });

  it('mantiene compatibilidad de recorrido y metadatos con códigos legacy y grupos WMS', () => {
    expect(getLocationWeight('D1-CAM2-R01-A')).toBeLessThan(getLocationWeight('D2-PISO-FID-01'));
    expect(getLocationWeight('D2-PISO-FID-01')).toBeLessThan(getLocationWeight('D3-PISO-UAT-01'));
    expect(resolveWmsSlotMeta('D1-R07-C06-F').chamber).toBe('CAMARA_1');
    expect(resolveWmsSlotMeta('D1-R01-C11-A').chamber).toBe('CAMARA_2');
    expect(WMS_LOCATION_GROUPS.some((g) => g.options.some((o) => o.value === 'D1-R07-C06-F'))).toBe(true);
    expect(WMS_LOCATION_GROUPS.some((g) => g.options.some((o) => o.value === 'D1-R05-C17-A'))).toBe(false);
  });

  it('getProductLocation prioriza el lote vigente más próximo a vencer y recurre a defaultLocation o S/U', () => {
    const product = {
      id: 20,
      defaultLocation: 'D1-R01-C04-B',
      lots: [
        { id: 1, stock: 10, location: 'D1-R01-C04-A', expirationDate: '2020-01-01T00:00:00Z' }, // vencido
        { id: 2, stock: 10, location: 'D1-R01-C11-A', expirationDate: '2030-06-01T00:00:00Z' },
        { id: 3, stock: 10, location: 'D1-R07-C06-B', expirationDate: '2029-05-01T00:00:00Z' },
      ],
    };
    expect(getProductLocation(product)).toBe('D1-R07-C06-B');
    expect(getProductLocation({ id: 21, defaultLocation: 'D2-R09-C01-A', lots: [] })).toBe('D2-R09-C01-A');
    expect(getProductLocation({ id: 22, lots: [] })).toBe('S/U');
  });
});
