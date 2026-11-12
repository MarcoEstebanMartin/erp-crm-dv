import { describe, expect, it } from 'vitest';
import {
  calculateProductStockValuation,
  doesLotMatchWmsScope,
  evaluateLotFefoStatus,
  extractBaseLotNumber,
  planWmsSafeRelocation,
  resolveTargetLotNumberForLocation,
  verifyStockLedgerInvariant,
} from './stock.engine';

describe('StockEngine - Valorización Financiera Exacta, FEFO y WMS Seguro', () => {
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

  it('Valida alcance exacto de Slots WMS sin falsos positivos por substring (anti-contains)', () => {
    expect(doesLotMatchWmsScope('D1-R01-C04-A', 'D1-R01-C04')).toBe(true);
    expect(doesLotMatchWmsScope('D1-R01-C04', 'D1-R01-C04')).toBe(true);
    expect(doesLotMatchWmsScope('D1-R01-C04-B', 'D1-R01-C04-A')).toBe(false);
    expect(doesLotMatchWmsScope('D1-R01-C040', 'D1-R01-C04')).toBe(false);
    expect(doesLotMatchWmsScope('XD1-R01-C04', 'D1-R01-C04')).toBe(false);
  });

  it('Resuelve sufijos limpios al dividir un mismo lote en múltiples slots sin encadenar @', () => {
    expect(extractBaseLotNumber('L-2026@D1-R01-C04-A')).toBe('L-2026');
    expect(extractBaseLotNumber('S/L-D1-R01-C04-A')).toBe('S/L');

    const res = resolveTargetLotNumberForLocation('L-2026@D1-R01-C04-A', 'D1-R01-C08-B', [
      { id: 10, lotNumber: 'L-2026', location: 'D1-R01-C04-A' },
    ]);
    expect(res.targetLotNumber).toBe('L-2026@D1-R01-C08-B');
    expect(res.existingTargetLotId).toBeNull();
  });

  it('Planifica reubicación segura priorizando S/U por FEFO y bloquea excesos sobre el stock físico', () => {
    const plan = planWmsSafeRelocation({
      targetLocation: 'D1-R01-C07-A',
      quantity: 25,
      lots: [
        {
          id: 1,
          lotNumber: 'L-UBICADO',
          stock: 30,
          location: 'D1-R01-C01-A',
          expirationDate: '2026-11-20',
        },
        {
          id: 2,
          lotNumber: 'L-SU-PROX',
          stock: 15,
          location: 'S/U',
          expirationDate: '2026-12-01',
        },
        {
          id: 3,
          lotNumber: 'L-SU-LEJANO',
          stock: 20,
          location: 'S/U',
          expirationDate: '2027-04-01',
        },
      ],
    });

    expect(plan.fromUntrackedGap).toBe(0);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0]).toMatchObject({ lotId: 2, takeQty: 15, remainingInSource: 0 });
    expect(plan.steps[1]).toMatchObject({ lotId: 3, takeQty: 10, remainingInSource: 10 });

    expect(() =>
      planWmsSafeRelocation({
        targetLocation: 'D1-R01-C07-A',
        quantity: 80,
        lots: [{ id: 2, lotNumber: 'L-SU', stock: 15, location: 'S/U', expirationDate: '2026-12-01' }],
      }),
    ).toThrow(/No hay suficientes unidades físicas/);
  });
});
