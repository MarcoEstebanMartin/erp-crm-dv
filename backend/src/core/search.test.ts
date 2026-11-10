import { describe, expect, it } from 'vitest';
import { matchesPhoneticQuery, normalizePhoneticText } from './search';

describe('Motor de Búsqueda Fonética Argentina (search.ts)', () => {
  it('normaliza tildes y mayúsculas correctamente', () => {
    expect(normalizePhoneticText('Jamón Cocido Selección')).toBe('jamon cosido selesion');
    expect(matchesPhoneticQuery('Jamón Cocido Selección', 'jamon selesion')).toBe(true);
  });

  it('iguala b/v, s/z/ce/ci y doble s (caso real: Vieníssima vs Bienisima)', () => {
    const product = 'SALCHICHA VIENÍSSIMA X 6 UN';
    expect(matchesPhoneticQuery(product, 'bienisima')).toBe(true);
    expect(matchesPhoneticQuery(product, 'vienissima')).toBe(true);
    expect(matchesPhoneticQuery(product, 'salchicha 6')).toBe(true);
  });

  it('iguala Venancio y Benancio, Rebozador y Rebosador', () => {
    expect(matchesPhoneticQuery('Distribuidora Don Venancio', 'don benansio')).toBe(true);
    expect(matchesPhoneticQuery('PREMEZCLA REBOZADOR PREFERIDO 5KG', 'premescla rebosador')).toBe(
      true,
    );
  });

  it('permite buscar palabras salteadas o en distinto orden (SKU + Nombre + Rubro)', () => {
    const rowText = 'SKU-1042 QUESO CREMOSO HORMA FIAMBRERIA';
    expect(matchesPhoneticQuery(rowText, 'cremoso 1042')).toBe(true);
    expect(matchesPhoneticQuery(rowText, 'queso paleta')).toBe(false);
  });
});
