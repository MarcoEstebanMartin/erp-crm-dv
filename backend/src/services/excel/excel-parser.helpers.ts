export interface RowValidationResult {
  rowIndex: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  action: 'CREATE' | 'UPDATE' | 'NONE';
  data: Record<string, any>;
  messages: string[];
}

export interface ValidationReport {
  domain: 'PRODUCTS' | 'PRICES' | 'CLIENTS';
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
