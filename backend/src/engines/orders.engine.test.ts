import { describe, it, expect } from 'vitest';
import {
  computeOrderItem,
  detectWeightAnomalies,
  computeOrderTotals,
} from './orders.engine';

describe('OrderEngine (003-pedidos-pesaje-facturacion)', () => {
  it('calcula subtotal estimado para hormas pesables antes de pasar por balanza', () => {
    const item = computeOrderItem({
      id: 1,
      productId: 'prod-0001',
      sku: '0001',
      productName: 'MELINCUE BARRA TYBO x KG',
      rubro: 'REMOTTI',
      isWeighable: true,
      approxWeightKg: 4,
      quantity: 2,
      actualWeightKg: null,
      unitCost: 8734.26,
      unitPriceList: 11414,
      ivaRatePct: 21,
    });

    expect(item.pickingZone).toBe('FRIO');
    expect(item.billableQuantityOrKg).toBe(8);
    expect(item.subtotal).toBe(91312);
    expect(item.unitCostSnapshot).toBe(8734.26);
    expect(item.listPriceSnapshot).toBe(11414);
  });

  it('recalcula el subtotal exacto en pesos enteros cuando se ingresa el peso real de balanza', () => {
    const item = computeOrderItem({
      id: 1,
      productId: 'prod-0001',
      sku: '0001',
      productName: 'MELINCUE BARRA TYBO x KG',
      rubro: 'REMOTTI',
      isWeighable: true,
      approxWeightKg: 4,
      quantity: 2,
      actualWeightKg: 8.2,
      unitCost: 8734.26,
      unitPriceList: 11414,
      ivaRatePct: 21,
    });

    expect(item.actualWeightKg).toBe(8.2);
    expect(item.billableQuantityOrKg).toBe(8.2);
    expect(item.subtotal).toBe(93595);
  });

  it('detecta anomalías de pesaje y sugiere corrección de coma faltante (82 kg -> 8.2 kg y 4250 -> 4.25 kg)', () => {
    const anomalies = detectWeightAnomalies([
      {
        id: 10,
        productId: 'prod-0001',
        sku: '0001',
        productName: 'MELINCUE BARRA TYBO x KG',
        rubro: 'REMOTTI',
        isWeighable: true,
        approxWeightKg: 4,
        quantity: 2,
        actualWeightKg: 82,
        unitCost: 8734.26,
        unitPriceList: 11414,
        ivaRatePct: 21,
      },
      {
        id: 11,
        productId: 'prod-0001',
        sku: '0001',
        productName: 'MELINCUE BARRA TYBO x KG',
        rubro: 'REMOTTI',
        isWeighable: true,
        approxWeightKg: 4,
        quantity: 1,
        actualWeightKg: 4250,
        unitCost: 8734.26,
        unitPriceList: 11414,
        ivaRatePct: 21,
      },
    ]);

    expect(anomalies).toHaveLength(2);
    expect(anomalies[0]!.possibleDecimalFixKg).toBe(8.2);
    expect(anomalies[1]!.possibleDecimalFixKg).toBe(4.25);
  });

  it('garantiza cuadratura exacta AFIP: Neto + IVA + IIBB == Total Entero', () => {
    const item = computeOrderItem({
      id: 1,
      productId: 'prod-0100',
      sku: '0100',
      productName: 'ACEITE NATURA 1.5L',
      rubro: 'A.G.D Y NIZA',
      isWeighable: false,
      approxWeightKg: null,
      quantity: 10,
      actualWeightKg: null,
      unitCost: 8000,
      unitPriceList: 10000,
      ivaRatePct: 21,
    });

    const totals = computeOrderTotals([item], 0);
    expect(totals.totalAmount).toBe(100000);
    expect(totals.netoGravado).toBe(82644.63);
    expect(totals.ivaAmount).toBe(17355.37);
    expect(Number((totals.netoGravado + totals.ivaAmount).toFixed(2))).toBe(totals.totalAmount);
  });
});
