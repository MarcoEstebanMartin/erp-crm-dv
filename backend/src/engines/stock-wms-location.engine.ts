export interface WmsLocationScope {
  cleanCode: string;
  baseSlotCode: string;
  level: string | null;
  isStructuredSlot: boolean;
}

const STRUCTURED_SLOT_REGEX = /^(D\d+-R\d{2}-C\d{2})(?:-([A-F]))?$/;
const COMPACT_SLOT_REGEX = /^(D\d+)[·.\-]R(\d{1,2})-C?(\d{1,2})(?:-?([A-F]))?$/;

/**
 * Normaliza un código de ubicación física a formato canónico interno (`D1-R01-C04-C` / `D1-R01-C04`) o 'S/U'.
 * Acepta tanto el formato compacto (`D1·R01-04C`, `D1.R01-04C`, `D1-R01-04C`) como el formato completo.
 */
export function normalizeWmsLocationCode(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return 'S/U';
  const trimmed = raw.trim().toUpperCase().replace(/\s*·\s*/g, '·');
  const cleaned = trimmed.replace(/\s+/g, '-');
  if (!cleaned || cleaned === 'S/U' || cleaned === 'SIN-UBICAR') return 'S/U';

  const compactMatch = COMPACT_SLOT_REGEX.exec(cleaned);
  if (compactMatch) {
    const [, dep, rowStr, colStr, level] = compactMatch;
    const base = `${dep}-R${rowStr.padStart(2, '0')}-C${colStr.padStart(2, '0')}`;
    return level ? `${base}-${level}` : base;
  }

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
 * Extrae el código de lote comercial limpio (normalizador defensivo de datos legados
 * que pudieran conservar sufijos técnicos de posición @SLOT o S/L-SLOT).
 */
export function extractBaseLotNumber(rawLotNumber?: string | null): string {
  if (!rawLotNumber || typeof rawLotNumber !== 'string') return 'S/L';
  const trimmed = rawLotNumber.trim();
  if (!trimmed) return 'S/L';
  const withoutAt = trimmed.split('@')[0].trim();
  if (!withoutAt || /^S\/L(?:-.*)?$/i.test(withoutAt)) {
    return 'S/L';
  }
  return withoutAt;
}
