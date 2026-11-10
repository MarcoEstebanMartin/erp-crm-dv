import { describe, expect, it } from 'vitest';
import {
  calculateProductStockValuation,
  evaluateLotFefoStatus,
  verifyStockLedgerInvariant,
} from './stock.engine';

describe('StockEngine - Valorización Financiera Exacta y FEFO (002-stock-ledger)', () => {
  it('Valoriza correctamente hormas pesables (0001 Barra Tybo Melincué: 10 hormas x 4.2 kg)', () => {
    const res = calculateProductStockValuation({
      physicalUnits: 10,
      isWeighable: true,
      approxWeightKg: 4.2,
      costPrice: 6680,
      priceList4: 8350,
      minStockAlert: 3,
    });

    expect(res.physicalUnits).toBe(10);
    expect(res.estimatedTotalKg).toBe(42);
    expect(res.stockValueCost).toBe(280560);
    expect(res.stockValueSale).toBe(350700);
    expect(res.latentProfit).toBe(70140);
    expect(res.latentMarginPct).toBe(25);
    expect(res.stockHealth).toBe('OK');
  });

  it('Valoriza correctamente artículos por unidad no pesables (0028 Jugo Baggio)', () => {
    const res = calculateProductStockValuation({
      physicalUnits: 20,
      isWeighable: false,
      approxWeightKg: 0,
      costPrice: 1200,
      priceList4: 1500,
      minStockAlert: 5,
    });

    expect(res.physicalUnits).toBe(20);
    expect(res.estimatedTotalKg).toBe(0);
    expect(res.stockValueCost).toBe(24000);
    expect(res.stockValueSale).toBe(30000);
    expect(res.latentProfit).toBe(6000);
    expect(res.stockHealth).toBe('OK');
  });

  it('Clasifica estados de stock (OUT, LOW, OK) y alertas FEFO de vencimiento', () => {
    const out = calculateProductStockValuation({
      physicalUnits: 0,
      isWeighable: false,
      approxWeightKg: 0,
      costPrice: 1000,
      priceList4: 1300,
      minStockAlert: 5,
    });
    expect(out.stockHealth).toBe('OUT');

    const refDate = new Date('2026-11-07T00:00:00Z');
    expect(evaluateLotFefoStatus('2026-11-01', refDate)).toBe('EXPIRED');
    expect(evaluateLotFefoStatus('2026-11-20', refDate)).toBe('EXPIRING_SOON');
    expect(evaluateLotFefoStatus('2027-03-15', refDate)).toBe('OK');
    expect(evaluateLotFefoStatus('2036-12-31', refDate)).toBe('OK');
  });

  it('Verifica la invariante del Libro Mayor (Stock en Lotes == Suma de Movimientos)', () => {
    const check = verifyStockLedgerInvariant([12, 8], [15, 10, -5]);
    expect(check.isValid).toBe(true);
    expect(check.lotSum).toBe(20);
    expect(check.ledgerSum).toBe(20);
  });
});
