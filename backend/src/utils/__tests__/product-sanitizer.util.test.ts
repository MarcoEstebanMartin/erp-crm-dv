import { describe, expect, it } from 'vitest';
import {
  canViewProductCosts,
  sanitizeProductForRole,
  stripRestrictedCostFieldsForRole,
} from '../product-sanitizer.util';

describe('product-sanitizer.util (costos y márgenes solo para ADMIN)', () => {
  const sampleProduct = {
    id: 1,
    sku: '0001',
    name: 'Queso Cremoso',
    costPrice: 8451.52,
    profitMargin: 32,
    listPrice: 11156,
    listPriceB: 10821,
    listPriceC: 10598,
    provider: { id: 4, name: 'Lácteos del Sur', cuit: '30-12345678-9' },
    stockValuation: {
      stockValueCost: 500000,
      stockValueRetail: 660000,
      latentProfit: 160000,
      latentMarginPct: 32,
    },
  };

  it('habilita costos y márgenes únicamente para ADMIN', () => {
    expect(canViewProductCosts('ADMIN')).toBe(true);
    expect(canViewProductCosts('FACTURACION')).toBe(false);
    expect(canViewProductCosts('VENDEDOR')).toBe(false);
    expect(canViewProductCosts('DEPOSITO')).toBe(false);
    expect(canViewProductCosts('CHOFER')).toBe(false);
    expect(canViewProductCosts(undefined)).toBe(false);
  });

  it('oculta costPrice, profitMargin y valuación de costo a FACTURACION preservando precios de venta', () => {
    const sanitized = sanitizeProductForRole(sampleProduct, 'FACTURACION');
    expect(sanitized.costPrice).toBe(0);
    expect(sanitized.profitMargin).toBeNull();
    expect(sanitized.listPrice).toBe(11156);
    expect(sanitized.listPriceB).toBe(10821);
    expect(sanitized.listPriceC).toBe(10598);
    expect(sanitized.stockValuation.stockValueCost).toBe(0);
    expect(sanitized.stockValuation.latentProfit).toBe(0);
    expect(sanitized.stockValuation.latentMarginPct).toBe(0);

    const adminView = sanitizeProductForRole(sampleProduct, 'ADMIN');
    expect(adminView.costPrice).toBe(8451.52);
    expect(adminView.profitMargin).toBe(32);
    expect(adminView.stockValuation.stockValueCost).toBe(500000);
  });

  it('elimina costPrice y profitMargin del payload entrante para FACTURACION y los conserva para ADMIN', () => {
    const incoming = {
      name: 'Queso Cremoso',
      costPrice: 0,
      profitMargin: 10,
      listPrice: 12000,
      listPriceB: 11500,
    };

    const stripped = stripRestrictedCostFieldsForRole(incoming, 'FACTURACION');
    expect(stripped).toEqual({
      name: 'Queso Cremoso',
      listPrice: 12000,
      listPriceB: 11500,
    });
    expect('costPrice' in stripped).toBe(false);
    expect('profitMargin' in stripped).toBe(false);

    const adminPayload = stripRestrictedCostFieldsForRole(incoming, 'ADMIN');
    expect(adminPayload).toEqual(incoming);
  });
});
