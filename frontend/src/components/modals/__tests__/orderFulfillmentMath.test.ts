import { describe, it, expect } from 'vitest';
import {
  buildInitialFulfillmentWeights,
  calculateFulfillmentLineSubtotalInt,
  calculateFulfillmentOrderTotalInt,
  computeSuggestedItemWeightKg,
  detectFulfillmentWeightAnomalies,
  isOrderItemWeighable,
  needsArmadoConfirmationBeforeInvoice,
} from '../orderFulfillmentMath';
import {
  calculateDirectBillingTotals,
  computeClientUnitPrice,
} from '../../billing/sales/salesBilling.helpers';

describe('Paso 1 Frontend — Rigor BigInt en Balanza, Armado y Facturación Directa', () => {
  it('NO infiere pesabilidad ni inventa 4 kg por nombre en productos unitarios ("Queso Barra Tybo" con isPesable=false)', () => {
    const unitCheeseItem = {
      id: 1,
      quantity: 2,
      unitPrice: 12000,
      product: {
        id: 50,
        name: 'Queso Barra Tybo x Horma Chica',
        isPesable: false,
        approximateWeight: null,
      },
    };

    expect(isOrderItemWeighable(unitCheeseItem)).toBe(false);
    expect(computeSuggestedItemWeightKg(unitCheeseItem)).toBe(0);
    expect(buildInitialFulfillmentWeights([unitCheeseItem])).toEqual({});
    expect(calculateFulfillmentLineSubtotalInt(unitCheeseItem, {})).toBe(24000);
    expect(detectFulfillmentWeightAnomalies([unitCheeseItem], { 1: 2 })).toEqual([]);
  });

  it('Redondea pesables a peso entero ROUND_HALF_UP, respeta SUM(renglones) === Total y excluye bonificados ($0)', () => {
    const items = [
      {
        id: 10,
        quantity: 1,
        unitPrice: 8333,
        product: { id: 100, name: 'Queso Cremoso x Kg', isPesable: true, approximateWeight: 1.2 },
      },
      {
        id: 11,
        quantity: 1,
        unitPrice: 15,
        product: { id: 101, name: 'Fiambre x Kg', isPesable: true, approximateWeight: 1.5 },
      },
      {
        id: 12,
        quantity: 2,
        unitPrice: 0,
        discountPctSnapshot: 100,
        isPromoBonus: true,
        product: { id: 102, name: 'Bonificación N+M', isPesable: false },
      },
    ];

    const weights = { 10: 1.235, 11: 1.5 };
    const line1 = calculateFulfillmentLineSubtotalInt(items[0], weights);
    const line2 = calculateFulfillmentLineSubtotalInt(items[1], weights);
    const line3 = calculateFulfillmentLineSubtotalInt(items[2], weights);
    const total = calculateFulfillmentOrderTotalInt(items, weights);

    expect(line1).toBe(10291);
    expect(line2).toBe(23); // 15 * 1.5 = 22.5 => ROUND_HALF_UP => 23
    expect(line3).toBe(0);
    expect(total).toBe(line1 + line2 + line3);
  });

  it('Detecta anomalías de peso y sugiere corrección de coma decimal con BigInt (42 kg -> 4.2 kg)', () => {
    const item = {
      id: 20,
      quantity: 1,
      unitPrice: 9000,
      product: { id: 200, name: 'Horma Tybo', isPesable: true, approximateWeight: 4 },
    };

    const anomalies = detectFulfillmentWeightAnomalies([item], { 20: 42 });
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].suggestedAvgWeight).toBe(4);
    expect(anomalies[0].possibleDecimalFix).toBe(4.2);
  });

  it('calculateDirectBillingTotals iguala al centavo el motor backend (Factura A $100.000 + 3% IIBB y umbral >$100.000 RG 5329)', () => {
    const clientA = { id: 1, cuit: '30-71234567-8', iibbAliquot: 3 };

    const at100k = calculateDirectBillingTotals([], 'OFFICIAL', clientA, 3, 100000);
    expect(at100k).toEqual({
      net: 82644.63,
      tax: 17355.37,
      percepcion: 2479.34,
      percepcionIva: 0,
      total: 102479.34,
    });
    expect(
      Number((at100k.net + at100k.tax + at100k.percepcion + at100k.percepcionIva).toFixed(2)),
    ).toBe(at100k.total);

    const above100k = calculateDirectBillingTotals([], 'OFFICIAL', clientA, 3, 150000);
    expect(above100k.percepcionIva).toBeGreaterThan(0);
    expect(
      Number((above100k.net + above100k.tax + above100k.percepcion + above100k.percepcionIva).toFixed(2)),
    ).toBe(above100k.total);
  });

  it('computeClientUnitPrice aplica DiscountRule por especificidad con BigInt y respeta descuento en Lista B', () => {
    const prod = { id: 30, rubroId: 5, listPrice: 2000, listPriceB: 1800, listPriceC: 1700 };
    const clientB = { id: 77, priceList: 'B', discount: 4 };

    // Sin reglas DB, Lista B respeta el descuento del cliente (1800 * 0.96 = 1728)
    expect(computeClientUnitPrice(prod, clientB, [], 'OFFICIAL')).toBe(1728);

    // Con regla más específica (persona + producto + billingType), gana la regla específica (1800 * 0.90 = 1620)
    const rules = [
      { id: 1, priceList: 'B', rubroId: 5, discount: 5 },
      { id: 2, personaId: 77, productId: 30, billingType: 'OFFICIAL', discount: 10 },
    ];
    expect(computeClientUnitPrice(prod, clientB, rules, 'OFFICIAL')).toBe(1620);
    // En canal INTERNAL la regla OFFICIAL no aplica y cae a la regla de rubro+lista B (5% => 1800 * 0.95 = 1710)
    expect(computeClientUnitPrice(prod, clientB, rules, 'INTERNAL')).toBe(1710);
  });

  it('needsArmadoConfirmationBeforeInvoice omite confirmOrderArmado solo cuando PREPARED ya tiene los mismos pesos guardados', () => {
    const pesableItemSaved = {
      id: 1,
      quantity: 1,
      weight: 4.25,
      product: { id: 10, isPesable: true, approximateWeight: 4 },
    };
    const pesableItemUnsaved = {
      id: 2,
      quantity: 1,
      weight: null,
      product: { id: 11, isPesable: true, approximateWeight: 3 },
    };
    const unitItem = {
      id: 3,
      quantity: 2,
      weight: null,
      product: { id: 12, isPesable: false },
    };

    // PENDING o PREPARING siempre requieren confirmar armado
    expect(
      needsArmadoConfirmationBeforeInvoice({ status: 'PENDING', items: [unitItem] }, {}),
    ).toBe(true);
    expect(
      needsArmadoConfirmationBeforeInvoice({ status: 'PREPARING', items: [pesableItemSaved] }, { 1: 4.25 }),
    ).toBe(true);

    // PREPARED sin pesables o con pesos exactos ya guardados -> saltea confirmOrderArmado
    expect(
      needsArmadoConfirmationBeforeInvoice({ status: 'PREPARED', items: [unitItem] }, {}),
    ).toBe(false);
    expect(
      needsArmadoConfirmationBeforeInvoice({ status: 'PREPARED', items: [pesableItemSaved, unitItem] }, { 1: 4.25 }),
    ).toBe(false);

    // PREPARED pero peso modificado en pantalla o sin peso guardado en DB -> requiere confirmOrderArmado
    expect(
      needsArmadoConfirmationBeforeInvoice({ status: 'PREPARED', items: [pesableItemSaved] }, { 1: 4.5 }),
    ).toBe(true);
    expect(
      needsArmadoConfirmationBeforeInvoice({ status: 'PREPARED', items: [pesableItemUnsaved] }, { 2: 3 }),
    ).toBe(true);
  });
});
