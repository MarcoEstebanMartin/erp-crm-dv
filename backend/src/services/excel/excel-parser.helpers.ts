export interface RowValidationResult {
  rowIndex: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  action: 'CREATE' | 'UPDATE' | 'NONE';
  data: Record<string, any>;
  messages: string[];
}

export interface ValidationReport {
  domain: 'PRODUCTS' | 'PRICES' | 'CLIENTS' | 'STOCK_INICIAL';
  summary: {
    totalRows: number;
    validCount: number;
    warningCount: number;
    errorCount: number;
    actionNewCount: number;
    actionUpdateCount: number;
  };
  rows: RowValidationResult[];
}

/**
 * Parsea un valor numérico/moneda desde Excel.
 * Soporta formatos: 1250, 1250.50, "$ 1.250,50", "1,250.50", etc.
 */
export function parseExcelNumber(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;

  let str = val.toString().trim();
  str = str.replace(/[\$\s]/g, '');

  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Normaliza un SKU a string de 4+ dígitos conservando ceros a la izquierda si es numérico.
 */
export function normalizeSku(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const str = raw.toString().trim();
  if (!str) return '';
  if (/^\d+$/.test(str)) {
    return str.padStart(4, '0');
  }
  return str;
}

/**
 * Sanitiza textos (remueve espacios al inicio/final).
 */
export function sanitizeText(raw: any): string {
  if (raw === undefined || raw === null) return '';
  return raw.toString().trim();
}

const SENTINEL_ISO = '2036-12-31T00:00:00.000Z';

/**
 * Parsea fechas DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD o Date nativo a ISO UTC exacto (medianoche).
 * Vacío / '-' / 'S/V' / 'SIN VENCIMIENTO' devuelven la fecha centinela oficial 2036-12-31.
 */
export function parseExcelDateToUtcIso(raw: any): {
  iso: string | null;
  isSentinel: boolean;
  invalid: boolean;
} {
  if (raw === undefined || raw === null) {
    return { iso: SENTINEL_ISO, isSentinel: true, invalid: false };
  }

  let y = 0;
  let m = 0;
  let d = 0;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      return { iso: null, isSentinel: false, invalid: true };
    }
    y = raw.getUTCFullYear();
    m = raw.getUTCMonth() + 1;
    d = raw.getUTCDate();
  } else {
    const str = String(raw).trim();
    const upper = str.toUpperCase();
    if (!upper || upper === '-' || upper === 'S/V' || upper === 'SIN VENCIMIENTO') {
      return { iso: SENTINEL_ISO, isSentinel: true, invalid: false };
    }

    const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(str);
    const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(str);
    if (dmy) {
      d = Number(dmy[1]);
      m = Number(dmy[2]);
      y = Number(dmy[3]);
    } else if (ymd) {
      y = Number(ymd[1]);
      m = Number(ymd[2]);
      d = Number(ymd[3]);
    } else {
      return { iso: null, isSentinel: false, invalid: true };
    }
  }

  if (y < 2020 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) {
    return { iso: null, isSentinel: false, invalid: true };
  }

  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return { iso: null, isSentinel: false, invalid: true };
  }

  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00.000Z`;
  return { iso, isSentinel: y >= 2036, invalid: false };
}
