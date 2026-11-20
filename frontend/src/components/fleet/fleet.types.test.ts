import { describe, it, expect } from 'vitest';
import {
  buildExpiryEntries,
  cleanGroupedExpiryLabel,
  isGeneralAdminVehicle,
  type Expiry,
} from './fleet.types';

const makeExpiry = (overrides: Partial<Expiry> & Pick<Expiry, 'id' | 'type' | 'description' | 'expirationDate'>): Expiry => ({
  alertSent: false,
  ...overrides,
});

describe('fleet.types — Adm. Gral y agrupación de vencimientos', () => {
  it('identifica la unidad virtual DEP-GRAL como Adm. Gral', () => {
    expect(isGeneralAdminVehicle({ plate: 'DEP-GRAL' })).toBe(true);
    expect(isGeneralAdminVehicle({ plate: ' dep-gral ' })).toBe(true);
    expect(isGeneralAdminVehicle({ plate: 'FUL 385' })).toBe(false);
    expect(isGeneralAdminVehicle(undefined)).toBe(false);
  });

  it('agrupa tipos repetidos (ej. CARNET) y deja los OTHER individuales por su nombre', () => {
    const expirations: Expiry[] = [
      makeExpiry({ id: 1, type: 'OTHER', description: 'Vencimiento Matafuegos Depósito', expirationDate: '2026-11-29' }),
      makeExpiry({ id: 2, type: 'OTHER', description: 'Vencimiento Contrato Claro Telefonia', expirationDate: '2027-02-25' }),
      makeExpiry({ id: 3, type: 'CARNET', description: 'Carnet Chofer: ESTEBAN MARTIN', expirationDate: '2027-07-07' }),
      makeExpiry({ id: 4, type: 'OTHER', description: 'Habilitación REBA (Bebidas y Alimentos)', expirationDate: '2027-08-28' }),
      makeExpiry({ id: 5, type: 'CARNET', description: 'Carnet Chofer: NORBERTO RAMOS', expirationDate: '2027-11-02' }),
    ];

    const entries = buildExpiryEntries(expirations);

    expect(entries).toHaveLength(4);
    expect(entries[0]).toMatchObject({ kind: 'item', expiry: { id: 1 } });
    expect(entries[1]).toMatchObject({ kind: 'item', expiry: { id: 2 } });
    expect(entries[2]).toMatchObject({
      kind: 'group',
      type: 'CARNET',
      label: 'Licencias de Chofer',
      nextDate: '2027-07-07',
    });
    if (entries[2].kind === 'group') {
      expect(entries[2].items.map((i) => i.id)).toEqual([3, 5]);
    }
    expect(entries[3]).toMatchObject({ kind: 'item', expiry: { id: 4 } });
  });

  it('limpia el prefijo redundante de Carnet Chofer dentro del grupo', () => {
    expect(cleanGroupedExpiryLabel({ type: 'CARNET', description: 'Carnet Chofer: ESTEBAN MARTIN' })).toBe('ESTEBAN MARTIN');
    expect(cleanGroupedExpiryLabel({ type: 'CARNET', description: 'Licencia Chofer - PABLO MARTIN' })).toBe('PABLO MARTIN');
    expect(cleanGroupedExpiryLabel({ type: 'OTHER', description: 'Habilitación REBA' })).toBe('Habilitación REBA');
  });
});
