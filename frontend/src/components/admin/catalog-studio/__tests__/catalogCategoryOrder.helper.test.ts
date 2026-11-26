import { describe, expect, it } from 'vitest';
import {
  buildEffectiveCategoryOrder,
  isSameCategoryOrder,
  moveCategory,
  moveCategoryToTop,
} from '../catalogCategoryOrder.helper';

describe('catalogCategoryOrder.helper', () => {
  const canonical = ['COMBOS', 'Melincué', 'Cremigal', 'Almacén', 'Espumantes y Sidras', 'Limpieza'];

  it('arma el orden efectivo sin COMBOS y respetando el orden guardado', () => {
    const result = buildEffectiveCategoryOrder(
      ['Espumantes y Sidras', 'Melincué'],
      canonical,
      ['Estuchería y Regalería'],
    );
    expect(result).toEqual([
      'Espumantes y Sidras',
      'Melincué',
      'Cremigal',
      'Almacén',
      'Limpieza',
      'Estuchería y Regalería',
    ]);
  });

  it('elimina duplicados y espacios vacíos', () => {
    const result = buildEffectiveCategoryOrder(
      ['', '  Almacén ', 'Almacén', 'COMBOS'],
      ['COMBOS', 'Almacén', 'Yerbas'],
    );
    expect(result).toEqual(['Almacén', 'Yerbas']);
  });

  it('mueve una categoría a una nueva posición sin mutar el array original', () => {
    const base = ['Melincué', 'Cremigal', 'Almacén', 'Espumantes y Sidras'];
    const moved = moveCategory(base, 3, 1);
    expect(moved).toEqual(['Melincué', 'Espumantes y Sidras', 'Cremigal', 'Almacén']);
    expect(base).toEqual(['Melincué', 'Cremigal', 'Almacén', 'Espumantes y Sidras']);
  });

  it('sube una categoría arriba de todo con moveCategoryToTop', () => {
    const base = ['Melincué', 'Cremigal', 'Almacén', 'Espumantes y Sidras'];
    expect(moveCategoryToTop(base, 3)).toEqual([
      'Espumantes y Sidras',
      'Melincué',
      'Cremigal',
      'Almacén',
    ]);
  });

  it('ignora índices fuera de rango o sin movimiento', () => {
    const base = ['Melincué', 'Cremigal'];
    expect(moveCategory(base, -1, 0)).toEqual(base);
    expect(moveCategory(base, 0, 5)).toEqual(base);
    expect(moveCategory(base, 1, 1)).toEqual(base);
  });

  it('compara dos órdenes con isSameCategoryOrder', () => {
    expect(isSameCategoryOrder(['A', 'B'], ['A', 'B'])).toBe(true);
    expect(isSameCategoryOrder(['A', 'B'], ['B', 'A'])).toBe(false);
    expect(isSameCategoryOrder(['A'], ['A', 'B'])).toBe(false);
  });
});
