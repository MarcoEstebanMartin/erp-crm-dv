import { describe, expect, it } from 'vitest';
import {
  calculateAfipBreakdown,
  calculateListPriceFromMargin,
  calculateOrderLine,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  sumIntegerAmounts,
  toDecimal,
} from './money';

describe('Motor Matemático y Contable (Spec 01 Invariantes)', () => {
  it('elimina errores de punto flotante binario nativo (0.1 + 0.2 === 0.3)', () => {
    const sum = toDecimal('0.1').plus(toDecimal('0.2'));
    expect(sum.toString()).toBe('0.3');
  });

  it('aplica la Política de Pesos Enteros en Origen con ROUND_HALF_UP', () => {
    expect(roundToIntegerPeso('101.49').toNumber()).toBe(101);
    expect(roundToIntegerPeso('101.50').toNumber()).toBe(102);
    expect(roundToIntegerPeso(999.95).toNumber()).toBe(1000);
  });

  it('calcula precios de lista enteros a partir del costo de reposición y margen %', () => {
    expect(calculateListPriceFromMargin(1000, 35).toNumber()).toBe(1350);
    expect(calculateListPriceFromMargin('83.33', '21.75').toNumber()).toBe(101);
  });

  it('calcula renglón por unidad y por balanza (kg con 3 decimales) congelando snapshots', () => {
    const unitLine = calculateOrderLine({
      unitPriceList: 101,
      unitCost: 80,
      billableQty: 10,
      discountPct: 0,
    });
    expect(unitLine.lineSubtotal.toNumber()).toBe(1010);
    expect(unitLine.lineCostTotal.toNumber()).toBe(800);
    expect(unitLine.lineProfit.toNumber()).toBe(210);

    const weighableLine = calculateOrderLine({
      unitPriceList: 8500,
      unitCost: 6200,
      billableQty: roundToThreeDecimalsWeight('3.845'),
      discountPct: 5,
    });
    expect(weighableLine.lineSubtotal.toNumber()).toBe(31048);
    expect(weighableLine.lineCostTotal.toNumber()).toBe(23839);
    expect(weighableLine.lineProfit.toNumber()).toBe(7209);
  });

  it('garantiza que la suma de los renglones visibles es 100% igual al Total del Pedido', () => {
    const line1 = calculateOrderLine({ unitPriceList: 101, unitCost: 75, billableQty: 3 });
    const line2 = calculateOrderLine({ unitPriceList: 2450, unitCost: 1900, billableQty: '1.255', discountPct: 10 });
    const total = sumIntegerAmounts([line1.lineSubtotal, line2.lineSubtotal]);

    expect(total.toNumber()).toBe(line1.lineSubtotal.toNumber() + line2.lineSubtotal.toNumber());
    expect(total.decimalPlaces()).toBe(0);
  });

  it('desglosa hacia adentro para AFIP (ARCA) cumpliendo ImpNeto + ImpIVA + ImpTrib === ImpTotal', () => {
    const afip = calculateAfipBreakdown(100000, 21, 0);

    expect(afip.netAmount.toString()).toBe('82644.63');
    expect(afip.ivaAmount.toString()).toBe('17355.37');
    expect(
      afip.netAmount.plus(afip.ivaAmount).plus(afip.tributesAmount).equals(afip.totalAmount),
    ).toBe(true);
  });
});
