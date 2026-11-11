export interface ParsedFiscalIdentifier {
  isValid: boolean;
  kind: 'CUIT' | 'DNI' | 'INVALID';
  cleanDigits: string;
  normalizedCuit?: string;
  candidateCuits: string[];
  expectedCheckDigit?: number;
  errorMessage?: string;
}

const VALID_CUIT_PREFIXES = new Set(['20', '23', '24', '27', '30', '33', '34']);
const CUIT_MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

/**
 * Calcula el dígito verificador Módulo 11 oficial de ARCA para los primeros 10 dígitos de un CUIT/CUIL.
 * Retorna -1 si la combinación de prefijo + DNI requiere cambio de prefijo a 23/33 (resto 1).
 */
export function computeModulo11Digit(tenDigits: string): number {
  if (!/^\d{10}$/.test(tenDigits)) return -1;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(tenDigits[i]) * CUIT_MULTIPLIERS[i];
  }
  const mod = sum % 11;
  if (mod === 0) return 0;
  if (mod === 1) return -1;
  return 11 - mod;
}

/**
 * Construye un CUIL válido dado un DNI (7 u 8 dígitos) y un prefijo base ('20' varón / '27' mujer).
 * Maneja automáticamente el caso especial de resto 1 (prefijo '23' con dígito 9 o 4).
 */
export function buildCuilFromDniAndGender(dniDigits: string, basePrefix: '20' | '27'): string {
  const paddedDni = dniDigits.replace(/\D/g, '').padStart(8, '0');
  const directCheck = computeModulo11Digit(`${basePrefix}${paddedDni}`);
  if (directCheck !== -1) {
    return `${basePrefix}${paddedDni}${directCheck}`;
  }
  const fallbackDigit = basePrefix === '20' ? 9 : 4;
  return `23${paddedDni}${fallbackDigit}`;
}

/**
 * Genera todos los CUILs matemáticamente válidos posibles para un DNI de 7 u 8 dígitos
 * (tanto masculino como femenino y prefijo 24 si aplica), sin duplicados.
 */
export function buildCandidateCuitsFromDni(dniDigits: string): string[] {
  const paddedDni = dniDigits.replace(/\D/g, '').padStart(8, '0');
  const candidates = new Set<string>();

  candidates.add(buildCuilFromDniAndGender(paddedDni, '20'));
  candidates.add(buildCuilFromDniAndGender(paddedDni, '27'));

  const alt24 = computeModulo11Digit(`24${paddedDni}`);
  if (alt24 !== -1) {
    candidates.add(`24${paddedDni}${alt24}`);
  }

  return Array.from(candidates);
}

/**
 * Valida y clasifica un identificador fiscal argentino (DNI de 7–8 dígitos o CUIT/CUIL de 11 dígitos).
 */
export function parseFiscalIdentifier(rawInput: string): ParsedFiscalIdentifier {
  const cleanDigits = (rawInput || '').replace(/\D/g, '');

  if (cleanDigits.length >= 7 && cleanDigits.length <= 8) {
    if (/^0+$/.test(cleanDigits)) {
      return {
        isValid: false,
        kind: 'INVALID',
        cleanDigits,
        candidateCuits: [],
        errorMessage: 'El DNI ingresado no es válido.',
      };
    }
    return {
      isValid: true,
      kind: 'DNI',
      cleanDigits: cleanDigits.padStart(8, '0'),
      candidateCuits: buildCandidateCuitsFromDni(cleanDigits),
    };
  }

  if (cleanDigits.length === 11) {
    const prefix = cleanDigits.slice(0, 2);
    if (!VALID_CUIT_PREFIXES.has(prefix)) {
      return {
        isValid: false,
        kind: 'INVALID',
        cleanDigits,
        candidateCuits: [],
        errorMessage: `El prefijo "${prefix}" no corresponde a un CUIT/CUIL válido en ARCA.`,
      };
    }

    const firstTen = cleanDigits.slice(0, 10);
    const providedDigit = Number(cleanDigits[10]);

    // Caso especial prefijo 23 / 33 cuando el prefijo original 20/27/30 tuvo resto 1
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += Number(firstTen[i]) * CUIT_MULTIPLIERS[i];
    }
    const mod = sum % 11;
    const expectedDigit = mod === 0 ? 0 : mod === 1 ? (prefix === '23' ? providedDigit : -1) : 11 - mod;
    const isSpecial23Valid =
      prefix === '23' &&
      ((mod === 0 && providedDigit === 0) ||
        (11 - mod === providedDigit) ||
        providedDigit === 9 ||
        providedDigit === 4);

    if (expectedDigit !== providedDigit && !isSpecial23Valid) {
      const hint =
        expectedDigit >= 0
          ? ` (el dígito verificador correcto sería ${expectedDigit})`
          : '';
      return {
        isValid: false,
        kind: 'INVALID',
        cleanDigits,
        candidateCuits: [],
        expectedCheckDigit: expectedDigit >= 0 ? expectedDigit : undefined,
        errorMessage: `El CUIT ${cleanDigits} tiene un dígito verificador inválido${hint}. Revisá los números ingresados.`,
      };
    }

    return {
      isValid: true,
      kind: 'CUIT',
      cleanDigits,
      normalizedCuit: cleanDigits,
      candidateCuits: [cleanDigits],
    };
  }

  return {
    isValid: false,
    kind: 'INVALID',
    cleanDigits,
    candidateCuits: [],
    errorMessage: 'Ingresá un DNI válido (7 u 8 dígitos) o un CUIT completo (11 dígitos).',
  };
}

export function normalizePadronText(raw?: string | null): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim();
}
