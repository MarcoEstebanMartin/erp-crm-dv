import { describe, expect, it } from 'vitest';
import {
  calculateNetSupplierCost,
  calculateProductPriceLists,
  calculateRealMarginPct,
  resolveApplicableUnitPrice,
  simulateBulkPriceUpdate,
} from './pricing.engine';

describe('PricingEngine — Motor de Precios y Listas Oficiales Don Venancio', () => {
  it('Caso Real 1 (SKU 0001 Melincué Barra Tybo): corrige el margen falso del Excel (25% real) y calcula Especial 1 (-3%) y Especial 2 (-5%) en pesos enteros', () => {
    const realMargin = calculateRealMarginPct(9131.2, 11414);
    expect(realMargin.toFixed(2)).toBe('25.00');

    const lists = calculateProductPriceLists({
      costPrice: 9131.2,
      manualPriceList4: 11414,
      ivaRatePct: 21,
      subrubro: 'MELINCUE',
    });

    expect(lists.marginList4Pct.toFixed(2)).toBe('25.00');
    expect(lists.priceList4.toFixed(0)).toBe('11414');
    expect(lists.special1VariationPct.toFixed(2)).toBe('-3.00');
    expect(lists.priceSpecial1.toFixed(0)).toBe('11072');
    expect(lists.special2VariationPct.toFixed(2)).toBe('-5.00');
    expect(lists.priceSpecial2.toFixed(0)).toBe('10843');
    expect(lists.priceNetNoIva.toFixed(2)).toBe('9433.06');
  });

  it('Caso Real 2 (SKU 0100 Fiambre de Cerdo): elimina centavos residuales ($6.169,98 -> $6.170 entero)', () => {
    const lists = calculateProductPriceLists({
      costPrice: 4935.98,
      manualPriceList4: 6169.98,
      subrubro: 'FIAMBRES',
    });

    expect(lists.priceList4.toFixed(0)).toBe('6170');
    expect(lists.marginList4Pct.toFixed(2)).toBe('25.00');
    expect(lists.priceSpecial1.toFixed(0)).toBe('6170');
    expect(lists.priceSpecial2.toFixed(0)).toBe('6170');
  });

  it('Mini-Calculadora de Proveedor: calcula Costo Neto exacto con descuento e IVA', () => {
    const result = calculateNetSupplierCost({
      rawSupplierPrice: 10000,
      discountPct: 10,
      ivaRatePct: 21,
    });

    expect(result.priceAfterDiscount.toFixed(2)).toBe('9000.00');
    expect(result.netCostPrice.toFixed(2)).toBe('10890.00');
  });

  it('Regla Híbrida de Lista B / Volumen por Caja: baja automático al llevar >= unitsPerBox', () => {
    const product = {
      priceList4: 499,
      priceSpecial1: 499,
      priceSpecial2: 499,
      boxPrice: 460,
      unitsPerBox: 18,
    };

    const retail = resolveApplicableUnitPrice(product, 'LISTA_4', 6);
    expect(retail.unitPrice.toFixed(0)).toBe('499');
    expect(retail.appliedRule).toBe('LISTA_4');

    const wholesaleBox = resolveApplicableUnitPrice(product, 'LISTA_4', 18);
    expect(wholesaleBox.unitPrice.toFixed(0)).toBe('460');
    expect(wholesaleBox.appliedRule).toBe('BOX_VOLUME');
  });

  it('Simulador de Aumento Masivo por Proveedor (ej. REMOTTI +10%): genera vista previa Antes vs. Después en pesos enteros', () => {
    const remottiProducts = [
      {
        sku: '0001',
        name: 'MELINCUÉ BARRA TYBO X KG',
        supplierName: 'REMOTTI',
        subrubro: 'MELINCUE',
        costPrice: 9131.2,
        marginList4Pct: 25,
        priceList4: 11414,
        special1VariationPct: -3,
        special2VariationPct: -5,
        ivaRatePct: 21,
      },
    ];

    const preview = simulateBulkPriceUpdate(remottiProducts, 10);
    expect(preview).toHaveLength(1);
    const item = preview[0]!;

    expect(item.newCostPrice.toFixed(2)).toBe('10044.32');
    expect(item.newPriceList4.toFixed(0)).toBe('12555');
    expect(item.newPriceSpecial1.toFixed(0)).toBe('12178');
    expect(item.newPriceSpecial2.toFixed(0)).toBe('11927');
  });
});
