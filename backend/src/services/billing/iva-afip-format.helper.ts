import { Decimal } from 'decimal.js';
import {
  NumericInput,
  roundToTwoDecimals,
  toDecimal,
} from '../../core/money';

const AR_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function toSafeDecimalInput(value: unknown): NumericInput {
  if (value === null || value === undefined || value === '') return '0';
  if (Decimal.isDecimal(value) || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return String(value);
}

export function decAbs(value: unknown): Decimal {
  return roundToTwoDecimals(toDecimal(toSafeDecimalInput(value))).abs();
}

export function toFixedMoneyString(value: unknown): string {
  return roundToTwoDecimals(toSafeDecimalInput(value)).toFixed(2);
}

function getArDateParts(dateInput: Date): { year: string; month: string; day: string } {
  const parts = AR_DATE_PARTS_FORMATTER.formatToParts(dateInput);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  return {
    year: (map.year || '1970').padStart(4, '0'),
    month: (map.month || '01').padStart(2, '0'),
    day: (map.day || '01').padStart(2, '0'),
  };
}

export function formatArDateYYYYMMDD(dateInput: Date): string {
  const { year, month, day } = getArDateParts(dateInput);
  return `${year}${month}${day}`;
}

export function formatArDateDDMMYYYY(dateInput: Date): string {
  const { year, month, day } = getArDateParts(dateInput);
  return `${day}/${month}/${year}`;
}

export function formatUtcDateYYYYMMDD(dateInput: Date): string {
  const year = String(dateInput.getUTCFullYear()).padStart(4, '0');
  const month = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateInput.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function buildMonthDateStrings(month: number, year: number): {
  startDateStr: string;
  endDateStr: string;
} {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 2100
  ) {
    throw new Error('Período fiscal inválido');
  }
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dd = String(lastDay).padStart(2, '0');
  return {
    startDateStr: `${year}-${mm}-01`,
    endDateStr: `${year}-${mm}-${dd}`,
  };
}

/**
 * Formatea un importe monetario a ancho fijo AFIP (2 decimales implícitos sin punto) usando Decimal.js.
 */
export function formatAfipCurrency(
  amount: NumericInput | null | undefined,
  length: number = 15,
): string {
  if (amount === null || amount === undefined || amount === '') {
    return '0'.repeat(length);
  }
  const dec = roundToTwoDecimals(toSafeDecimalInput(amount));
  const absDigits = dec.abs().toFixed(2).replace('.', '');
  if (dec.isNegative() && !dec.isZero()) {
    return '-' + absDigits.padStart(Math.max(length - 1, 0), '0');
  }
  return absDigits.padStart(length, '0');
}

export function padString(str: string | null | undefined, length: number): string {
  if (!str) return ' '.repeat(length);
  let s = str.substring(0, length);
  s = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 *&()\-_.@,]/g, ' ');
  return s.padEnd(length, ' ');
}

export function getAfipDocType(cuit: string | null | undefined): string {
  if (!cuit) return '99';
  const c = cuit.replace(/\D/g, '');
  if (c.length === 11) return '80';
  if (c.length >= 7 && c.length <= 8) return '96';
  return '99';
}

export function getAfipDocNumber(cuit: string | null | undefined): string {
  if (!cuit) return '0'.repeat(20);
  const c = cuit.replace(/\D/g, '');
  return c.slice(-20).padStart(20, '0');
}

const AFIP_VOUCHER_TYPE_CODES: Record<string, string> = {
  FACTURA_A: '001',
  NOTA_DEBITO_A: '002',
  NOTA_CREDITO_A: '003',
  FACTURA_B: '006',
  NOTA_DEBITO_B: '007',
  NOTA_CREDITO_B: '008',
  FACTURA_C: '011',
  NOTA_DEBITO_C: '012',
  NOTA_CREDITO_C: '013',
};

export function getAfipVoucherType(type: string): string {
  return AFIP_VOUCHER_TYPE_CODES[type] ?? '001';
}

export function parseInvoiceNumber(invoiceNumber: string | null): { ptoVenta: string; cbte: string } {
  if (!invoiceNumber) {
    return { ptoVenta: '00000', cbte: '00000000000000000000' };
  }
  const parts = invoiceNumber.split('-');
  if (parts.length >= 2) {
    const ptoDigits = parts[0].replace(/\D/g, '').slice(-5);
    const cbteDigits = parts.slice(1).join('').replace(/\D/g, '').slice(-20);
    return {
      ptoVenta: ptoDigits.padStart(5, '0'),
      cbte: cbteDigits.padStart(20, '0'),
    };
  }
  const digits = invoiceNumber.replace(/\D/g, '').slice(-20);
  return {
    ptoVenta: '00000',
    cbte: digits.padStart(20, '0'),
  };
}
