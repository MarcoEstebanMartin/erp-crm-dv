import { describe, it, expect } from '@jest/globals';
import { roundCurrency, roundPrecision } from '../math';

describe('Math Utility Unit Tests (Redondeo Financiero)', () => {
  it('Debe redondear valores con imprecisión de coma flotante de JS correctamente (ej: 1.005 -> 1.01)', () => {
    expect(roundCurrency(1.005)).toBe(1.01);
    expect(roundCurrency(10.555)).toBe(10.56);
    expect(roundCurrency(10.554)).toBe(10.55);
  });

  it('Debe mantener la suma exacta de subtotales sin desfasaje de centavos', () => {
    const item1 = roundCurrency(100.33);
    const item2 = roundCurrency(200.67);
    const total = roundCurrency(item1 + item2);
    expect(total).toBe(301.00);
  });

  it('Debe calcular redondeo a N decimales de precisión intermedia', () => {
    expect(roundPrecision(10.12345, 4)).toBe(10.1235);
    expect(roundPrecision(10.12344, 4)).toBe(10.1234);
  });
});
