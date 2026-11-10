import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  toDecimal,
} from '../../core/money';

export const MAIN_CITIES = [
  'GENERAL VILLEGAS',
  'EMILIO V. BUNGE',
  'BANDERALO',
  'INTENDENTE ALVEAR',
  'PIEDRITAS',
  'CEBALLOS',
  'RUFINO',
  'BUCHARDO',
  'CHARLONE',
  'LARROUDE',
  'SAUCE',
  'SANSINENA',
  'TRES ALGARROBOS',
  'AMEGHINO',
  'BLAQUIER',
  'AMERICA',
  'FORTIN',
  'CARLOS TEJEDOR',
];

export function normalizeCity(city: string | null | undefined): string {
  if (!city) return 'Sin Localidad';
  const upper = city.toUpperCase().trim();

  for (const mainCity of MAIN_CITIES) {
    if (upper.includes(mainCity)) {
      return mainCity;
    }
  }

  if (upper.includes('BUNGE')) return 'EMILIO V. BUNGE';
  if (upper.includes('ALVEAR')) return 'INTENDENTE ALVEAR';
  if (upper.includes('VILLEGAS')) return 'GENERAL VILLEGAS';
  if (upper.includes('LARROUDE')) return 'LARROUDE';
  if (upper.includes('TEJEDOR')) return 'CARLOS TEJEDOR';

  if (upper.startsWith('(') || /\d/.test(upper)) {
    return 'Sin Localidad';
  }

  return upper;
}

/**
 * Calcula la cantidad facturable real de un renglón (kilos si es pesable y fue pesado, o unidades)
 * y el Costo de Mercadería Vendida (CMV) histórico exacto usando unitCostSnapshot (Spec 01 / Ley 2.2).
 */
export function resolveOrderItemHistoricalCost(item: {
  quantity: number;
  weight?: any;
  unitPrice?: any;
  subtotal?: any;
  unitCostSnapshot?: any;
  product?: { isPesable?: boolean; costPrice?: any } | null;
}): { qtyOrWeight: number; itemRevenue: number; itemCost: number; unitCostUsed: number } {
  const isWeighable = Boolean(item.product?.isPesable);
  const qtyDec =
    isWeighable && item.weight && Number(item.weight) > 0
      ? roundToThreeDecimalsWeight(item.weight)
      : toDecimal(item.quantity);

  const snapshotCost = Number(item.unitCostSnapshot || 0);
  const currentCost = Number(item.product?.costPrice || 0);
  const unitCostUsed = snapshotCost > 0 ? snapshotCost : currentCost;

  const itemRevenueDec =
    item.subtotal !== undefined && item.subtotal !== null
      ? roundToIntegerPeso(item.subtotal)
      : roundToIntegerPeso(toDecimal(item.unitPrice || 0).times(qtyDec));

  const itemCost = roundToIntegerPeso(toDecimal(unitCostUsed).times(qtyDec)).toNumber();
  return {
    qtyOrWeight: qtyDec.toNumber(),
    itemRevenue: itemRevenueDec.toNumber(),
    itemCost,
    unitCostUsed,
  };
}
