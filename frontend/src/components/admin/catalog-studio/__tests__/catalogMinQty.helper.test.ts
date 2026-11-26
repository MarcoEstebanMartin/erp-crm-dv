import { describe, expect, it } from 'vitest';
import { resolveEffectiveMinQtyLabel } from '../catalogMinQty.helper';

describe('resolveEffectiveMinQtyLabel', () => {
  it('usa minOrderQuantity del ERP cuando no hay etiqueta manual', () => {
    expect(resolveEffectiveMinQtyLabel(null, 3)).toBe('3 u.');
    expect(resolveEffectiveMinQtyLabel('', 6)).toBe('6 u.');
  });

  it('devuelve null cuando no hay etiqueta manual y minOrderQuantity es 1 o menor', () => {
    expect(resolveEffectiveMinQtyLabel(null, 1)).toBeNull();
    expect(resolveEffectiveMinQtyLabel(undefined, 0)).toBeNull();
  });

  it('prioriza la etiqueta manual de catálogo cuando está cargada', () => {
    expect(resolveEffectiveMinQtyLabel('3 CAJA', 6)).toBe('3 CAJA');
    expect(resolveEffectiveMinQtyLabel(' 1 BULTO ', 1)).toBe('1 BULTO');
  });

  it('oculta la etiqueta cuando se configuró un token de supresión aunque el ERP tenga mínimo', () => {
    expect(resolveEffectiveMinQtyLabel('SIN MINIMO', 3)).toBeNull();
    expect(resolveEffectiveMinQtyLabel('sin mínimo', 6)).toBeNull();
    expect(resolveEffectiveMinQtyLabel('0', 3)).toBeNull();
  });
});
