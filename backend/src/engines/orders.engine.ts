import {
  toDecimal,
  roundToTwoDecimals,
  roundToThreeDecimalsWeight,
  calculateOrderLine,
  calculateAfipBreakdown,
  sumIntegerAmounts,
} from '../core/money';

export type PickingZone = 'FRIO' | 'CAJAS' | 'TABLA';

export interface OrderItemEngineInput {
  id: number;
  productId: string;
  sku: string;
  productName: string;
  rubro: string | null;
  isWeighable: boolean;
  approxWeightKg: number | null;
  quantity: number;
  actualWeightKg: number | null;
  unitCost: number;
  unitPriceList: number;
  discountPct?: number;
  ivaRatePct: number;
}

export interface ComputedOrderItem {
  id: number;
  productId: string;
  sku: string;
  productName: string;
  rubro: string | null;
  pickingZone: PickingZone;
  isWeighable: boolean;
  approxWeightKg: number | null;
  quantity: number;
  actualWeightKg: number | null;
  billableQuantityOrKg: number;
  unitCostSnapshot: number;
  listPriceSnapshot: number;
  discountPctSnapshot: number;
  ivaRatePct: number;
  subtotal: number;
}

export interface WeightAnomaly {
  itemId: number;
  sku: string;
  productName: string;
  quantity: number;
  currentWeightKg: number;
  expectedWeightKg: number;
  possibleDecimalFixKg: number | null;
}

/**
 * Clasifica automáticamente la zona de depósito (FRIO, TABLA, CAJAS) según rubro o característica pesable.
 */
export function resolvePickingZone(rubro: string | null, isWeighable: boolean): PickingZone {
  const r = (rubro || '').toUpperCase();
  if (
    isWeighable ||
    r.includes('REMOTTI') ||
    r.includes('SODECAR') ||
    r.includes('LÁCTEOS') ||
    r.includes('LACTEOS') ||
    r.includes('QUESO') ||
    r.includes('FIAMBRE')
  ) {
    return 'FRIO';
  }
  if (r.includes('BEBIDA') || r.includes('REGALER')) {
    return 'TABLA';
  }
  return 'CAJAS';
}

/**
 * Calcula un renglón de pedido con Decimal.js:
 * - Si NO es pesable: billableQty = quantity.
 * - Si ES pesable: si tiene actualWeightKg > 0 usa actualWeightKg; si aún no se pesó usa quantity * approxWeightKg.
 */
export function computeOrderItem(input: OrderItemEngineInput): ComputedOrderItem {
  const approxKg = input.approxWeightKg && input.approxWeightKg > 0 ? input.approxWeightKg : 4;
  let billableDec = toDecimal(input.quantity);

  if (input.isWeighable) {
    if (input.actualWeightKg !== null && input.actualWeightKg > 0) {
      billableDec = roundToThreeDecimalsWeight(input.actualWeightKg);
    } else {
      billableDec = roundToThreeDecimalsWeight(toDecimal(input.quantity).times(approxKg));
    }
  }

  const lineResult = calculateOrderLine({
    unitCost: input.unitCost,
    unitPriceList: input.unitPriceList,
    billableQty: billableDec,
    discountPct: input.discountPct ?? 0,
  });

  return {
    id: input.id,
    productId: input.productId,
    sku: input.sku,
    productName: input.productName,
    rubro: input.rubro,
    pickingZone: resolvePickingZone(input.rubro, input.isWeighable),
    isWeighable: input.isWeighable,
    approxWeightKg: input.isWeighable ? approxKg : null,
    quantity: input.quantity,
    actualWeightKg:
      input.actualWeightKg !== null && input.actualWeightKg > 0
        ? roundToThreeDecimalsWeight(input.actualWeightKg).toNumber()
        : null,
    billableQuantityOrKg: billableDec.toNumber(),
    unitCostSnapshot: lineResult.unitCostSnapshot.toNumber(),
    listPriceSnapshot: lineResult.listPriceSnapshot.toNumber(),
    discountPctSnapshot: lineResult.discountPctSnapshot.toNumber(),
    ivaRatePct: input.ivaRatePct,
    subtotal: lineResult.lineSubtotal.toNumber(),
  };
}

/**
 * Detector automático de anomalías de pesaje y sugerencia de "coma faltante" (ej. 42 kg -> 4.2 kg o 4250 -> 4.25 kg).
 */
export function detectWeightAnomalies(items: OrderItemEngineInput[]): WeightAnomaly[] {
  const anomalies: WeightAnomaly[] = [];

  for (const item of items) {
    if (!item.isWeighable || item.actualWeightKg === null || item.actualWeightKg <= 0) {
      continue;
    }

    const approxUnit = item.approxWeightKg && item.approxWeightKg > 0 ? item.approxWeightKg : 4;
    const expectedDec = roundToThreeDecimalsWeight(toDecimal(item.quantity).times(approxUnit));
    const currentDec = roundToThreeDecimalsWeight(item.actualWeightKg);
    const expected = expectedDec.toNumber();
    const current = currentDec.toNumber();

    if (expected <= 0) continue;

    const isTooHeavy = currentDec.greaterThan(expectedDec.times(2));
    const isTooLight = expected >= 2 && currentDec.lessThan(expectedDec.times('0.3'));

    if (isTooHeavy || isTooLight) {
      let possibleFix: number | null = null;
      const div10 = currentDec.dividedBy(10).toDecimalPlaces(3);
      const div100 = currentDec.dividedBy(100).toDecimalPlaces(3);
      const div1000 = currentDec.dividedBy(1000).toDecimalPlaces(3);

      if (
        div10.greaterThanOrEqualTo(expectedDec.times('0.5')) &&
        div10.lessThanOrEqualTo(expectedDec.times('1.6'))
      ) {
        possibleFix = div10.toNumber();
      } else if (
        div100.greaterThanOrEqualTo(expectedDec.times('0.5')) &&
        div100.lessThanOrEqualTo(expectedDec.times('1.6'))
      ) {
        possibleFix = div100.toNumber();
      } else if (
        div1000.greaterThanOrEqualTo(expectedDec.times('0.5')) &&
        div1000.lessThanOrEqualTo(expectedDec.times('1.6'))
      ) {
        possibleFix = div1000.toNumber();
      }

      anomalies.push({
        itemId: item.id,
        sku: item.sku,
        productName: item.productName,
        quantity: item.quantity,
        currentWeightKg: current,
        expectedWeightKg: expected,
        possibleDecimalFixKg: possibleFix,
      });
    }
  }

  return anomalies;
}

/**
 * Calcula los totales del comprobante (en pesos enteros) y su desglose técnico AFIP (Neto + IVA + IIBB == Total).
 */
export function computeOrderTotals(
  items: ComputedOrderItem[],
  iibbPerceptionPct: number = 0,
): {
  netoGravado: number;
  ivaAmount: number;
  iibbPerceptionAmount: number;
  totalAmount: number;
} {
  const totalInteger = sumIntegerAmounts(items.map((i) => i.subtotal));
  const iibbPctDec = toDecimal(iibbPerceptionPct || 0);
  const tributesDec = iibbPctDec.greaterThan(0)
    ? roundToTwoDecimals(totalInteger.times(iibbPctDec).dividedBy(100))
    : toDecimal(0);

  const afip = calculateAfipBreakdown(totalInteger, 21, tributesDec);

  return {
    netoGravado: afip.netAmount.toNumber(),
    ivaAmount: afip.ivaAmount.toNumber(),
    iibbPerceptionAmount: afip.tributesAmount.toNumber(),
    totalAmount: afip.totalAmount.toNumber(),
  };
}
