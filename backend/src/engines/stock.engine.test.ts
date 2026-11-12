import { describe, expect, it } from 'vitest';
import {
  calculateProductStockValuation,
  doesLotMatchWmsScope,
  evaluateLotFefoStatus,
  extractBaseLotNumber,
  planWmsSafeRelocation,
  resolveAdjustmentLot,
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

    const low = calculateProductStockValuation({
      physicalUnits: 4,
      isWeighable: false,
      approxWeightKg: 0,
      costPrice: 1000,
      priceList4: 1300,
      minStockAlert: 5,
    });
    expect(low.stockHealth).toBe('LOW');

    const exactThreshold = calculateProductStockValuation({
      physicalUnits: 5,
      isWeighable: false,
      approxWeightKg: 0,
      costPrice: 1000,
      priceList4: 1300,
      minStockAlert: 5,
    });
    expect(exactThreshold.stockHealth).toBe('OK');

    const disabledAlert = calculateProductStockValuation({
      physicalUnits: 1,
      isWeighable: false,
      approxWeightKg: 0,
      costPrice: 1000,
      priceList4: 1300,
      minStockAlert: 0,
    });
    expect(disabledAlert.stockHealth).toBe('OK');

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

  it('Partir un lote en múltiples racks conserva SIEMPRE el código limpio (clave única productId+lotNumber+location)', () => {
    // Normalizador defensivo de datos legados
    expect(extractBaseLotNumber('L-2026@D1-R01-C04-A')).toBe('L-2026');
    expect(extractBaseLotNumber('S/L-D1-R01-C04-A')).toBe('S/L');
    expect(extractBaseLotNumber('S/L@D1-R01-C04-C')).toBe('S/L');
    expect(extractBaseLotNumber('')).toBe('S/L');

    // Lote de fábrica ya presente en otro rack: el nuevo rack recibe el MISMO código, sin '@'
    const res = resolveTargetLotNumberForLocation('L-2026', 'D1-R01-C08-B', [
      { id: 10, lotNumber: 'L-2026', location: 'D1-R01-C04-A' },
    ]);
    expect(res.targetLotNumber).toBe('L-2026');
    expect(res.existingTargetLotId).toBeNull();

    // Genérico 'S/L' que ya existe en S/U: ubicar parte en un rack genera otro 'S/L' (no 'S/L@...')
    const generic = resolveTargetLotNumberForLocation('S/L', 'D1-R01-C04-C', [
      { id: 868, lotNumber: 'S/L', location: 'S/U' },
    ]);
    expect(generic.targetLotNumber).toBe('S/L');
    expect(generic.targetLotNumber).not.toContain('@');

    // Si ya existe el mismo lote en el rack destino, se reutiliza (fusión)
    const merge = resolveTargetLotNumberForLocation('S/L', 'S/U', [
      { id: 868, lotNumber: 'S/L', location: 'S/U' },
      { id: 1115, lotNumber: 'S/L', location: 'D1-R01-C04-C' },
    ]);
    expect(merge).toEqual({ targetLotNumber: 'S/L', existingTargetLotId: 868 });
  });

  it('resolveAdjustmentLot elige el lote físico correcto sin fabricar sufijos', () => {
    const lots = [
      { id: 868, lotNumber: 'S/L', stock: 80, location: 'S/U', expirationDate: '2036-12-31' },
      { id: 1115, lotNumber: 'S/L', stock: 20, location: 'D1-R01-C04-C', expirationDate: '2036-12-31' },
      { id: 900, lotNumber: 'L-2409', stock: 5, location: 'D1-R01-C08-A', expirationDate: '2027-03-15' },
    ];

    // Ajuste genérico sin rack → lote 'S/L' de S/U
    expect(resolveAdjustmentLot({ lots, change: 10 }).lotId).toBe(868);
    // Ajuste genérico en un rack → lote 'S/L' de ese rack
    expect(resolveAdjustmentLot({ lots, location: 'D1-R01-C04-C', change: 3 }).lotId).toBe(1115);
    // Suma en un rack nuevo → crea 'S/L' limpio
    expect(resolveAdjustmentLot({ lots, location: 'D1-R01-C09-B', change: 4 })).toEqual({
      lotId: null,
      createLotNumber: 'S/L',
      createExpiration: null,
    });
    // Suma de un lote de fábrica en S/U → crea gemelo heredando el vencimiento real
    const twin = resolveAdjustmentLot({ lots, lotNumber: 'L-2409', change: 6 });
    expect(twin.lotId).toBeNull();
    expect(twin.createLotNumber).toBe('L-2409');
    expect(twin.createExpiration?.toISOString().slice(0, 10)).toBe('2027-03-15');
    // Resta de un lote de fábrica sin rack → lo busca donde esté
    expect(resolveAdjustmentLot({ lots, lotNumber: 'L-2409', change: -2 }).lotId).toBe(900);
    // Lote preseleccionado que suma en otro rack → crea su gemelo con el mismo código
    const pre = resolveAdjustmentLot({ lots, preselectedLot: lots[2], location: 'D1-R01-C04-C', change: 1 });
    expect(pre.lotId).toBeNull();
    expect(pre.createLotNumber).toBe('L-2409');
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
