import {
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';

export interface StockValuationInput {
  physicalUnits: number;
  isWeighable: boolean;
  approxWeightKg: number;
  costPrice: number;
  priceList4: number;
  minStockAlert: number;
}

export interface StockValuationResult {
  physicalUnits: number;
  estimatedTotalKg: number;
  effectiveMultiplier: number;
  stockValueCost: number;
  stockValueSale: number;
  latentProfit: number;
  latentMarginPct: number;
  stockHealth: 'OK' | 'LOW' | 'OUT';
}

export type LotFefoStatus = 'OK' | 'EXPIRING_SOON' | 'EXPIRED';

export interface WmsLocationScope {
  cleanCode: string;
  baseSlotCode: string;
  level: string | null;
  isStructuredSlot: boolean;
}

export interface WmsLotSnapshot {
  id: number;
  lotNumber: string;
  stock: number;
  location: string | null;
  expirationDate: Date | string;
}

export interface WmsRelocationStep {
  lotId: number;
  lotNumber: string;
  fromLocation: string;
  takeQty: number;
  remainingInSource: number;
  expirationDate: Date;
}

export interface WmsRelocationPlan {
  targetLocation: string;
  requestedQty: number;
  fromUntrackedGap: number;
  steps: WmsRelocationStep[];
}

const STRUCTURED_SLOT_REGEX = /^(D\d+-R\d{2}-C\d{2})(?:-([A-F]))?$/;

/**
 * Calcula la valorización financiera exacta de un artículo en stock.
 * - Si el artículo es pesable (ej. Horma de Queso Barra Tybo de 4.2 kg),
 *   multiplica: Unidades Físicas * Peso Aproximado Kg * Precio por Kg,
 *   redondeando al peso entero más cercano (ROUND_HALF_UP).
 */
export function calculateProductStockValuation(input: StockValuationInput): StockValuationResult {
  const units = Math.max(0, Math.trunc(input.physicalUnits));
  const useWeightMultiplier = input.isWeighable && input.approxWeightKg > 0;
  const multiplierDec = useWeightMultiplier ? toDecimal(input.approxWeightKg) : toDecimal(1);

  const unitsDec = toDecimal(units);
  const effectiveQtyDec = unitsDec.times(multiplierDec);

  const costDec = toDecimal(input.costPrice);
  const saleDec = toDecimal(input.priceList4);

  const stockValueCost = roundToIntegerPeso(effectiveQtyDec.times(costDec)).toNumber();
  const stockValueSale = roundToIntegerPeso(effectiveQtyDec.times(saleDec)).toNumber();
  const latentProfit = stockValueSale - stockValueCost;

  const latentMarginPct =
    stockValueCost > 0
      ? roundToTwoDecimals(toDecimal(latentProfit).dividedBy(stockValueCost).times(100)).toNumber()
      : 0;

  let stockHealth: 'OK' | 'LOW' | 'OUT' = 'OK';
  if (units <= 0) {
    stockHealth = 'OUT';
  } else if (units <= Math.max(2, input.minStockAlert)) {
    stockHealth = 'LOW';
  }

  return {
    physicalUnits: units,
    estimatedTotalKg: useWeightMultiplier ? roundToThreeDecimalsWeight(effectiveQtyDec).toNumber() : 0,
    effectiveMultiplier: multiplierDec.toNumber(),
    stockValueCost,
    stockValueSale,
    latentProfit,
    latentMarginPct,
    stockHealth,
  };
}

/**
 * Evalúa el estado FEFO (First Expired, First Out) de un lote según su fecha de vencimiento.
 */
export function evaluateLotFefoStatus(
  expirationDateStr: string,
  referenceDate: Date = new Date(),
): LotFefoStatus {
  if (!expirationDateStr || expirationDateStr.startsWith('2036')) {
    return 'OK';
  }
  const exp = new Date(`${expirationDateStr}T00:00:00Z`);
  if (Number.isNaN(exp.getTime())) return 'OK';

  const ref = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()),
  );
  if (exp.getTime() <= ref.getTime()) {
    return 'EXPIRED';
  }

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  if (exp.getTime() - ref.getTime() <= thirtyDaysMs) {
    return 'EXPIRING_SOON';
  }
  return 'OK';
}

/**
 * Certifica la invariante de Libro Mayor:
 * La suma de unidades de todos los lotes activos de un SKU debe ser igual a la suma de deltas del StockLedger.
 */
export function verifyStockLedgerInvariant(
  lotQuantities: number[],
  ledgerDeltas: number[],
): { isValid: boolean; lotSum: number; ledgerSum: number } {
  const lotSum = lotQuantities.reduce((acc, q) => acc + Math.trunc(q), 0);
  const ledgerSum = ledgerDeltas.reduce((acc, d) => acc + Math.trunc(d), 0);
  return {
    isValid: lotSum === ledgerSum && lotSum >= 0,
    lotSum,
    ledgerSum,
  };
}

/**
 * Normaliza un código de ubicación física a mayúsculas limpias o 'S/U' ("Sin Ubicar").
 */
export function normalizeWmsLocationCode(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return 'S/U';
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '-');
  if (!cleaned || cleaned === 'S/U' || cleaned === 'SIN-UBICAR') return 'S/U';
  return cleaned;
}

/**
 * Analiza si un código corresponde a un Slot completo (ej. D1-R01-C07) o un Piso puntual (D1-R01-C07-A).
 */
export function parseWmsLocationScope(rawCode: string): WmsLocationScope {
  const cleanCode = normalizeWmsLocationCode(rawCode);
  const match = STRUCTURED_SLOT_REGEX.exec(cleanCode);
  if (match) {
    return {
      cleanCode,
      baseSlotCode: match[1],
      level: match[2] || null,
      isStructuredSlot: true,
    };
  }
  return {
    cleanCode,
    baseSlotCode: cleanCode,
    level: null,
    isStructuredSlot: false,
  };
}

/**
 * Determina de forma exacta (sin substrings ambiguos `contains`) si la ubicación de un lote
 * cae dentro del alcance consultado (ej. D1-R01-C07 abarca D1-R01-C07 y D1-R01-C07-A/B/C, pero jamás D1-R01-C070).
 */
export function doesLotMatchWmsScope(
  lotLocation: string | null | undefined,
  targetScopeCode: string,
): boolean {
  const normLot = normalizeWmsLocationCode(lotLocation);
  const scope = parseWmsLocationScope(targetScopeCode);
  if (scope.cleanCode === 'S/U' || normLot === 'S/U') {
    return normLot === scope.cleanCode;
  }
  if (normLot === scope.cleanCode) return true;
  if (scope.level === null) {
    return normLot.startsWith(`${scope.cleanCode}-`);
  }
  return false;
}

/**
 * Extrae el código de lote comercial limpio removiendo sufijos técnicos de posición (@SLOT o S/L-SLOT).
 */
export function extractBaseLotNumber(rawLotNumber?: string | null): string {
  if (!rawLotNumber || typeof rawLotNumber !== 'string') return 'S/L';
  const trimmed = rawLotNumber.trim();
  if (!trimmed) return 'S/L';
  const withoutAt = trimmed.split('@')[0].trim();
  if (/^S\/L-D\d+-R\d{2}-C\d{2}/i.test(withoutAt)) {
    return 'S/L';
  }
  return withoutAt || 'S/L';
}

/**
 * Resuelve el número de lote único para una ubicación destino evitando choques de clave única
 * cuando un mismo lote físico se reparte en múltiples racks del depósito.
 */
export function resolveTargetLotNumberForLocation(
  requestedLotNumber: string | undefined | null,
  targetLocation: string,
  existingLots: Array<{ id: number; lotNumber: string; location: string | null }>,
): { targetLotNumber: string; existingTargetLotId: number | null } {
  const cleanTargetLoc = normalizeWmsLocationCode(targetLocation);
  const baseLot = extractBaseLotNumber(requestedLotNumber);

  const sameLocAndBase = existingLots.find(
    (l) =>
      normalizeWmsLocationCode(l.location) === cleanTargetLoc &&
      extractBaseLotNumber(l.lotNumber).toUpperCase() === baseLot.toUpperCase(),
  );
  if (sameLocAndBase) {
    return { targetLotNumber: sameLocAndBase.lotNumber, existingTargetLotId: sameLocAndBase.id };
  }

  const baseTakenElsewhere = existingLots.some(
    (l) => l.lotNumber.trim().toUpperCase() === baseLot.toUpperCase(),
  );
  if (!baseTakenElsewhere) {
    return { targetLotNumber: baseLot, existingTargetLotId: null };
  }

  const scopedCandidate = cleanTargetLoc === 'S/U' ? `${baseLot}@SU` : `${baseLot}@${cleanTargetLoc}`;
  const exactScopedMatch = existingLots.find(
    (l) => l.lotNumber.trim().toUpperCase() === scopedCandidate.toUpperCase(),
  );
  if (exactScopedMatch) {
    return { targetLotNumber: exactScopedMatch.lotNumber, existingTargetLotId: exactScopedMatch.id };
  }

  return { targetLotNumber: scopedCandidate, existingTargetLotId: null };
}

/**
 * Planifica una reubicación segura en el Mapa WMS garantizando Δ Stock Total = 0 (cero invención/pérdida).
 */
export function planWmsSafeRelocation(params: {
  targetLocation: string;
  quantity: number;
  lots: WmsLotSnapshot[];
  untrackedCommercialGap?: number;
  sourceLotId?: number | null;
  preferredLotNumber?: string | null;
}): WmsRelocationPlan {
  const cleanTarget = normalizeWmsLocationCode(params.targetLocation);
  if (cleanTarget === 'S/U') {
    throw new Error('Para liberar mercadería a Sin Ubicar (S/U) utilice la acción de liberar posición.');
  }
  const qty = Math.trunc(Number(params.quantity));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('La cantidad a ubicar debe ser un número entero mayor a cero.');
  }

  const gap = Math.max(0, Math.trunc(params.untrackedCommercialGap || 0));
  const eligibleLots = params.lots
    .filter((l) => l.stock > 0 && normalizeWmsLocationCode(l.location) !== cleanTarget)
    .map((l) => ({
      ...l,
      cleanLocation: normalizeWmsLocationCode(l.location),
      expDateObj: l.expirationDate instanceof Date ? l.expirationDate : new Date(l.expirationDate),
    }));

  const preferredBase = params.preferredLotNumber
    ? extractBaseLotNumber(params.preferredLotNumber).toUpperCase()
    : null;

  eligibleLots.sort((a, b) => {
    if (params.sourceLotId) {
      if (a.id === params.sourceLotId) return -1;
      if (b.id === params.sourceLotId) return 1;
    }
    if (preferredBase) {
      const aMatch =
        a.lotNumber.toUpperCase() === params.preferredLotNumber!.trim().toUpperCase() ||
        extractBaseLotNumber(a.lotNumber).toUpperCase() === preferredBase;
      const bMatch =
        b.lotNumber.toUpperCase() === params.preferredLotNumber!.trim().toUpperCase() ||
        extractBaseLotNumber(b.lotNumber).toUpperCase() === preferredBase;
      if (aMatch !== bMatch) return aMatch ? -1 : 1;
    }
    const aUnassigned = a.cleanLocation === 'S/U';
    const bUnassigned = b.cleanLocation === 'S/U';
    if (aUnassigned !== bUnassigned) return aUnassigned ? -1 : 1;
    return a.expDateObj.getTime() - b.expDateObj.getTime();
  });

  const availableInLots = eligibleLots.reduce((acc, l) => acc + l.stock, 0);
  const totalAvailable = availableInLots + gap;

  if (qty > totalAvailable) {
    throw new Error(
      `No hay suficientes unidades físicas disponibles para ubicar en ${cleanTarget} (Disponible para reubicar: ${totalAvailable} u., Solicitado: ${qty} u.). Ingresá primero la compra o el ajuste en 'Control de Stock'.`,
    );
  }

  let remaining = qty;
  const steps: WmsRelocationStep[] = [];

  for (const lot of eligibleLots) {
    if (remaining <= 0) break;
    const takeQty = Math.min(lot.stock, remaining);
    if (takeQty <= 0) continue;
    steps.push({
      lotId: lot.id,
      lotNumber: lot.lotNumber,
      fromLocation: lot.cleanLocation,
      takeQty,
      remainingInSource: lot.stock - takeQty,
      expirationDate: lot.expDateObj,
    });
    remaining -= takeQty;
  }

  return {
    targetLocation: cleanTarget,
    requestedQty: qty,
    fromUntrackedGap: remaining,
    steps,
  };
}
