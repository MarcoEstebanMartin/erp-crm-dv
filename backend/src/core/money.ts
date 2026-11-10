import { Decimal } from 'decimal.js';

/**
 * Configuración global inmutable para aritmética financiera y de balanza.
 * Regla Constitucional (Spec 01): Precisión 20, Redondeo ROUND_HALF_UP.
 */
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export type NumericInput = Decimal | number | string;

export interface AfipBreakdownResult {
  totalAmount: Decimal;
  netAmount: Decimal;
  ivaAmount: Decimal;
  tributesAmount: Decimal;
}

export interface OrderLineCalculationInput {
  unitPriceList: NumericInput;
  unitCost: NumericInput;
  billableQty: NumericInput;
  discountPct?: NumericInput;
}

export interface OrderLineCalculationResult {
  unitCostSnapshot: Decimal;
  listPriceSnapshot: Decimal;
  discountPctSnapshot: Decimal;
  netUnitPrice: Decimal;
  lineSubtotal: Decimal;
  lineCostTotal: Decimal;
  lineProfit: Decimal;
}

/**
 * Convierte cualquier entrada numérica válida en una instancia segura de Decimal.
 */
export function toDecimal(value: NumericInput): Decimal {
  return new Decimal(value);
}

/**
 * Ley 2.1 (Spec 01): Redondea al peso entero más cercano (0 decimales, ROUND_HALF_UP).
 * Garantiza cero centavos fantasma en listas de precios, subtotales y cuentas corrientes.
 */
export function roundToIntegerPeso(value: NumericInput): Decimal {
  return toDecimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

/**
 * Redondea a 2 decimales exactos (uso exclusivo para desglose fiscal interno AFIP/ARCA o costos).
 */
export function roundToTwoDecimals(value: NumericInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Redondea a 3 decimales exactos para pesajes de balanza en kilogramos (ej. 3.845 kg).
 */
export function roundToThreeDecimalsWeight(value: NumericInput): Decimal {
  return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

/**
 * Calcula un Precio de Lista en pesos enteros a partir del Costo de Reposición y el % de Margen:
 * PrecioLista = round_integer(Costo * (1 + Margen% / 100))
 */
export function calculateListPriceFromMargin(
  costPrice: NumericInput,
  marginPct: NumericInput,
): Decimal {
  const cost = toDecimal(costPrice);
  const marginMultiplier = new Decimal(1).plus(toDecimal(marginPct).dividedBy(100));
  return roundToIntegerPeso(cost.times(marginMultiplier));
}

/**
 * Calcula un renglón de venta con congelamiento histórico (Snapshots) y subtotal en pesos enteros.
 */
export function calculateOrderLine(
  input: OrderLineCalculationInput,
): OrderLineCalculationResult {
  const unitCostSnapshot = roundToTwoDecimals(input.unitCost);
  const listPriceSnapshot = roundToIntegerPeso(input.unitPriceList);
  const discountPctSnapshot = roundToTwoDecimals(input.discountPct ?? 0);
  const qty = roundToThreeDecimalsWeight(input.billableQty);

  const discountFactor = new Decimal(1).minus(discountPctSnapshot.dividedBy(100));
  const exactNetUnit = listPriceSnapshot.times(discountFactor);
  const netUnitPrice = roundToTwoDecimals(exactNetUnit);

  const lineSubtotal = roundToIntegerPeso(exactNetUnit.times(qty));
  const lineCostTotal = roundToIntegerPeso(unitCostSnapshot.times(qty));
  const lineProfit = lineSubtotal.minus(lineCostTotal);

  return {
    unitCostSnapshot,
    listPriceSnapshot,
    discountPctSnapshot,
    netUnitPrice,
    lineSubtotal,
    lineCostTotal,
    lineProfit,
  };
}

/**
 * Suma una colección de subtotales enteros garantizando exactitud total en el comprobante.
 */
export function sumIntegerAmounts(amounts: NumericInput[]): Decimal {
  return amounts.reduce<Decimal>(
    (acc, curr) => acc.plus(roundToIntegerPeso(curr)),
    new Decimal(0),
  );
}

/**
 * Desglose técnico hacia adentro para WebService AFIP (ARCA) según Spec 01 (Sección 4).
 * Garantiza invariante: ImpNeto + ImpIVA + ImpTrib === ImpTotal al centavo exacto.
 */
export function calculateAfipBreakdown(
  totalIntegerAmount: NumericInput,
  ivaRatePct: NumericInput = 21,
  tributesAmount: NumericInput = 0,
): AfipBreakdownResult {
  const totalAmount = roundToTwoDecimals(roundToIntegerPeso(totalIntegerAmount));
  const tributes = roundToTwoDecimals(tributesAmount);
  const baseWithIva = totalAmount.minus(tributes);

  const ivaDivisor = new Decimal(1).plus(toDecimal(ivaRatePct).dividedBy(100));
  const netAmount = roundToTwoDecimals(baseWithIva.dividedBy(ivaDivisor));
  const ivaAmount = baseWithIva.minus(netAmount);

  return {
    totalAmount,
    netAmount,
    ivaAmount,
    tributesAmount: tributes,
  };
}
