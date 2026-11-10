import { Decimal } from 'decimal.js';
import {
  type NumericInput,
  calculateListPriceFromMargin,
  roundToIntegerPeso,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';
import { normalizePhoneticText } from '../core/search';

export type PriceListCode = 'LISTA_4' | 'ESPECIAL_1' | 'ESPECIAL_2' | 'A' | 'B' | 'C';

export interface SupplierCostCalculationInput {
  rawSupplierPrice: NumericInput;
  discountPct?: NumericInput;
  ivaRatePct?: NumericInput;
}

export interface SupplierCostCalculationResult {
  rawSupplierPrice: Decimal;
  discountPct: Decimal;
  priceAfterDiscount: Decimal;
  ivaRatePct: Decimal;
  netCostPrice: Decimal;
}

export interface ProductPricingInput {
  costPrice: NumericInput;
  marginList4Pct?: NumericInput;
  manualPriceList4?: NumericInput;
  ivaRatePct?: NumericInput;
  special1VariationPct?: NumericInput;
  special2VariationPct?: NumericInput;
  boxPrice?: NumericInput | null;
  subrubro?: string;
  rubro?: string;
  commercialCategory?: string;
}

export interface ProductPricingResult {
  costPrice: Decimal;
  marginList4Pct: Decimal;
  priceNetNoIva: Decimal;
  priceList4: Decimal;
  special1VariationPct: Decimal;
  priceSpecial1: Decimal;
  special2VariationPct: Decimal;
  priceSpecial2: Decimal;
  boxPrice: Decimal | null;
  hasValidCost: boolean;
}

export interface ProductForBulkSimulation {
  sku: string;
  name: string;
  supplierName: string;
  subrubro: string;
  costPrice: NumericInput;
  marginList4Pct: NumericInput;
  priceList4: NumericInput;
  special1VariationPct: NumericInput;
  special2VariationPct: NumericInput;
  ivaRatePct: NumericInput;
  boxPrice?: NumericInput | null;
}

export interface BulkSimulationItemResult {
  sku: string;
  name: string;
  supplierName: string;
  oldCostPrice: Decimal;
  newCostPrice: Decimal;
  oldMarginPct: Decimal;
  newMarginPct: Decimal;
  oldPriceList4: Decimal;
  newPriceList4: Decimal;
  newPriceSpecial1: Decimal;
  newPriceSpecial2: Decimal;
}

/**
 * 1. Mini-Calculadora de Factura de Proveedor:
 * CostoNeto = round_2dec(PrecioBase * (1 - Bonif%/100) * (1 + IVA%/100))
 */
export function calculateNetSupplierCost(
  input: SupplierCostCalculationInput,
): SupplierCostCalculationResult {
  const rawSupplierPrice = roundToTwoDecimals(input.rawSupplierPrice);
  const discountPct = roundToTwoDecimals(input.discountPct ?? 0);
  const ivaRatePct = roundToTwoDecimals(input.ivaRatePct ?? 0);

  if (rawSupplierPrice.isNegative()) {
    throw new Error('El precio bruto del proveedor no puede ser negativo.');
  }
  if (discountPct.lt(0) || discountPct.gte(100)) {
    throw new Error('El porcentaje de bonificación debe estar entre 0% y 99.99%.');
  }

  const discountFactor = new Decimal(1).minus(discountPct.dividedBy(100));
  const priceAfterDiscount = roundToTwoDecimals(rawSupplierPrice.times(discountFactor));
  const ivaFactor = new Decimal(1).plus(ivaRatePct.dividedBy(100));
  const netCostPrice = roundToTwoDecimals(priceAfterDiscount.times(ivaFactor));

  return {
    rawSupplierPrice,
    discountPct,
    priceAfterDiscount,
    ivaRatePct,
    netCostPrice,
  };
}

/**
 * 2. Calcula el Porcentaje de Margen Real Exacto entre el Costo y el Precio Lista 4.
 */
export function calculateRealMarginPct(
  costPrice: NumericInput,
  priceList4: NumericInput,
): Decimal {
  const cost = toDecimal(costPrice);
  const price = roundToIntegerPeso(priceList4);

  if (cost.lte(0) || price.lte(0)) {
    return new Decimal(0);
  }

  return roundToTwoDecimals(price.dividedBy(cost).minus(1).times(100));
}

/**
 * 3. Detecta si un producto pertenece a la línea MELINCUÉ para aplicar por defecto
 * las variaciones oficiales (-3% en Lista Especial 1 y -5% en Lista Especial 2).
 */
export function resolveDefaultMelincueVariations(
  subrubro = '',
  rubro = '',
  commercialCategory = '',
): { special1Pct: Decimal; special2Pct: Decimal } {
  const combined = normalizePhoneticText(`${subrubro} ${rubro} ${commercialCategory}`);
  if (combined.includes('melincue')) {
    return { special1Pct: new Decimal(-3), special2Pct: new Decimal(-5) };
  }
  return { special1Pct: new Decimal(0), special2Pct: new Decimal(0) };
}

/**
 * 4. Motor Central de las 3 Listas Oficiales (Lista 4 / A, Especial 1 / B y Especial 2 / C).
 * Garantiza que todas las listas de venta salgan redondeadas al peso entero (0 centavos).
 */
export function calculateProductPriceLists(input: ProductPricingInput): ProductPricingResult {
  const costPrice = roundToTwoDecimals(input.costPrice);
  if (costPrice.isNegative()) {
    throw new Error('El costo de reposición no puede ser negativo.');
  }

  const ivaRate = toDecimal(input.ivaRatePct ?? 21);
  const hasValidCost = costPrice.gt(0);

  let priceList4: Decimal;
  let marginList4Pct: Decimal;

  if (input.manualPriceList4 !== undefined) {
    priceList4 = roundToIntegerPeso(input.manualPriceList4);
    marginList4Pct = hasValidCost
      ? calculateRealMarginPct(costPrice, priceList4)
      : roundToTwoDecimals(input.marginList4Pct ?? 0);
  } else {
    marginList4Pct = roundToTwoDecimals(input.marginList4Pct ?? 0);
    priceList4 = hasValidCost
      ? calculateListPriceFromMargin(costPrice, marginList4Pct)
      : new Decimal(0);
  }

  const defaults = resolveDefaultMelincueVariations(
    input.subrubro,
    input.rubro,
    input.commercialCategory,
  );
  const special1VariationPct =
    input.special1VariationPct !== undefined
      ? roundToTwoDecimals(input.special1VariationPct)
      : defaults.special1Pct;
  const special2VariationPct =
    input.special2VariationPct !== undefined
      ? roundToTwoDecimals(input.special2VariationPct)
      : defaults.special2Pct;

  const priceSpecial1 = calculateListPriceFromMargin(priceList4, special1VariationPct);
  const priceSpecial2 = calculateListPriceFromMargin(priceList4, special2VariationPct);

  const ivaDivisor = new Decimal(1).plus(ivaRate.dividedBy(100));
  const priceNetNoIva = roundToTwoDecimals(priceList4.dividedBy(ivaDivisor));

  const boxPrice =
    input.boxPrice !== undefined && input.boxPrice !== null && toDecimal(input.boxPrice).gt(0)
      ? roundToIntegerPeso(input.boxPrice)
      : null;

  return {
    costPrice,
    marginList4Pct,
    priceNetNoIva,
    priceList4,
    special1VariationPct,
    priceSpecial1,
    special2VariationPct,
    priceSpecial2,
    boxPrice,
    hasValidCost,
  };
}

/**
 * 5. Regla Híbrida de Precio Aplicable en Pedidos (Lista del Cliente + Volumen por Caja Cerrada).
 */
export function resolveApplicableUnitPrice(
  product: {
    priceList4: NumericInput;
    priceSpecial1: NumericInput;
    priceSpecial2: NumericInput;
    boxPrice?: NumericInput | null;
    unitsPerBox?: number;
  },
  customerPriceList: PriceListCode,
  orderedQty: NumericInput,
): { unitPrice: Decimal; appliedRule: 'LISTA_4' | 'ESPECIAL_1' | 'ESPECIAL_2' | 'BOX_VOLUME' } {
  if (customerPriceList === 'ESPECIAL_2' || customerPriceList === 'C') {
    return { unitPrice: roundToIntegerPeso(product.priceSpecial2), appliedRule: 'ESPECIAL_2' };
  }
  if (customerPriceList === 'ESPECIAL_1' || customerPriceList === 'B') {
    return { unitPrice: roundToIntegerPeso(product.priceSpecial1), appliedRule: 'ESPECIAL_1' };
  }

  const qty = toDecimal(orderedQty);
  const unitsPerBox = product.unitsPerBox ?? 1;
  const hasBoxOffer =
    product.boxPrice !== undefined &&
    product.boxPrice !== null &&
    toDecimal(product.boxPrice).gt(0) &&
    unitsPerBox > 1;

  if (hasBoxOffer && qty.gte(unitsPerBox)) {
    return { unitPrice: roundToIntegerPeso(product.boxPrice!), appliedRule: 'BOX_VOLUME' };
  }

  return { unitPrice: roundToIntegerPeso(product.priceList4), appliedRule: 'LISTA_4' };
}

/**
 * 6. Simulador de Aumento Masivo por Proveedor o Rubro (Vista Previa Antes vs. Después).
 */
export function simulateBulkPriceUpdate(
  products: ProductForBulkSimulation[],
  costIncreasePct: NumericInput,
  newMarginOverridePct?: NumericInput,
): BulkSimulationItemResult[] {
  const increaseMultiplier = new Decimal(1).plus(toDecimal(costIncreasePct).dividedBy(100));

  return products.map((prod) => {
    const oldCostPrice = roundToTwoDecimals(prod.costPrice);
    const oldMarginPct = roundToTwoDecimals(prod.marginList4Pct);
    const oldPriceList4 = roundToIntegerPeso(prod.priceList4);

    const newCostPrice = roundToTwoDecimals(oldCostPrice.times(increaseMultiplier));
    const targetMarginPct =
      newMarginOverridePct !== undefined ? roundToTwoDecimals(newMarginOverridePct) : oldMarginPct;

    const calculated = calculateProductPriceLists({
      costPrice: newCostPrice,
      marginList4Pct: targetMarginPct,
      ivaRatePct: prod.ivaRatePct,
      special1VariationPct: prod.special1VariationPct,
      special2VariationPct: prod.special2VariationPct,
      subrubro: prod.subrubro,
    });

    return {
      sku: prod.sku,
      name: prod.name,
      supplierName: prod.supplierName,
      oldCostPrice,
      newCostPrice,
      oldMarginPct,
      newMarginPct: calculated.marginList4Pct,
      oldPriceList4,
      newPriceList4: calculated.priceList4,
      newPriceSpecial1: calculated.priceSpecial1,
      newPriceSpecial2: calculated.priceSpecial2,
    };
  });
}
