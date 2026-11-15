import { Decimal } from 'decimal.js';
import prisma from '../utils/prisma';
import {
  NumericInput,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';
import {
  parseArgentinaTimestampRange,
  parseCalendarDateRange,
} from './billing/billing-date-range.helper';

const AR_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function toSafeDecimalInput(value: unknown): NumericInput {
  if (value === null || value === undefined || value === '') return '0';
  if (Decimal.isDecimal(value) || typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return String(value);
}

function decAbs(value: unknown): Decimal {
  return roundToTwoDecimals(toDecimal(toSafeDecimalInput(value))).abs();
}

function toFixedMoneyString(value: unknown): string {
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

function formatArDateYYYYMMDD(dateInput: Date): string {
  const { year, month, day } = getArDateParts(dateInput);
  return `${year}${month}${day}`;
}

function formatArDateDDMMYYYY(dateInput: Date): string {
  const { year, month, day } = getArDateParts(dateInput);
  return `${day}/${month}/${year}`;
}

function formatUtcDateYYYYMMDD(dateInput: Date): string {
  const year = String(dateInput.getUTCFullYear()).padStart(4, '0');
  const month = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateInput.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function buildMonthDateStrings(month: number, year: number): {
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

const padString = (str: string | null | undefined, length: number) => {
  if (!str) return ' '.repeat(length);
  let s = str.substring(0, length);
  s = s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 *&()\-_.@,]/g, ' ');
  return s.padEnd(length, ' ');
};

const getAfipDocType = (cuit: string | null | undefined) => {
  if (!cuit) return '99';
  const c = cuit.replace(/\D/g, '');
  if (c.length === 11) return '80';
  if (c.length >= 7 && c.length <= 8) return '96';
  return '99';
};

const getAfipDocNumber = (cuit: string | null | undefined) => {
  if (!cuit) return '0'.repeat(20);
  const c = cuit.replace(/\D/g, '');
  return c.slice(-20).padStart(20, '0');
};

const getAfipVoucherType = (type: string) => {
  switch (type) {
    case 'FACTURA_A':
      return '001';
    case 'NOTA_CREDITO_A':
      return '003';
    case 'NOTA_DEBITO_A':
      return '002';
    case 'FACTURA_B':
      return '006';
    case 'NOTA_CREDITO_B':
      return '008';
    case 'NOTA_DEBITO_B':
      return '007';
    case 'FACTURA_C':
      return '011';
    case 'NOTA_CREDITO_C':
      return '013';
    case 'NOTA_DEBITO_C':
      return '012';
    default:
      return '001';
  }
};

const parseInvoiceNumber = (invoiceNumber: string | null) => {
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
};

export interface IvaExportRow {
  fecha: Date;
  tipo: string;
  numero: string;
  persona: any;
  neto: string;
  iva: string;
  percepciones: string;
  percepcionesIva: string;
  total: string;
  sign: 1 | -1;
}

export const ivaExportService = {
  async getVentasData(month: number, year: number): Promise<IvaExportRow[]> {
    const { startDateStr, endDateStr } = buildMonthDateStrings(month, year);
    const arRange = parseArgentinaTimestampRange(startDateStr, endDateStr);

    const orders = await prisma.order.findMany({
      where: {
        billingType: 'OFFICIAL',
        status: { not: 'CANCELLED' },
        cae: { not: null },
        createdAt: arRange,
      },
      include: { persona: true },
    });

    const creditNotes = await prisma.creditNote.findMany({
      where: {
        billingType: 'OFFICIAL',
        status: 'APPROVED',
        createdAt: arRange,
      },
      include: { persona: true },
    });

    const ventas: IvaExportRow[] = [];

    for (const order of orders) {
      const invNum = String(order.invoiceNumber || '').trim();
      if (
        order.invoiceType === 'PRESUPUESTO' ||
        !invNum ||
        !order.cae ||
        invNum.toUpperCase().startsWith('PRE-')
      ) {
        continue;
      }
      ventas.push({
        fecha: new Date(order.createdAt),
        tipo: order.invoiceType,
        numero: invNum,
        persona: order.persona,
        neto: toFixedMoneyString(order.netAmount),
        iva: toFixedMoneyString(order.taxAmount),
        percepciones: toFixedMoneyString(order.percepcionAmount),
        percepcionesIva: toFixedMoneyString(order.percepcionIvaAmount),
        total: toFixedMoneyString(order.totalAmount),
        sign: 1,
      });
    }

    for (const cn of creditNotes) {
      const cnNum = String(cn.creditNoteNumber || '').trim();
      const upperCn = cnNum.toUpperCase();
      if (!cnNum || upperCn.startsWith('NCI-') || upperCn.startsWith('PRE-')) {
        continue;
      }
      ventas.push({
        fecha: new Date(cn.createdAt),
        tipo: cn.creditNoteType,
        numero: cnNum,
        persona: cn.persona,
        neto: toFixedMoneyString(cn.netAmount),
        iva: toFixedMoneyString(cn.taxAmount),
        percepciones: '0.00',
        percepcionesIva: '0.00',
        total: toFixedMoneyString(cn.totalAmount),
        sign: -1,
      });
    }

    ventas.sort(
      (a, b) => a.fecha.getTime() - b.fecha.getTime() || a.numero.localeCompare(b.numero),
    );
    return ventas;
  },

  async getComprasData(month: number, year: number): Promise<IvaExportRow[]> {
    const { startDateStr, endDateStr } = buildMonthDateStrings(month, year);
    const calRange = parseCalendarDateRange(startDateStr, endDateStr);

    const compras = await prisma.supplierInvoice.findMany({
      where: {
        billingType: 'OFFICIAL',
        issueDate: calRange,
      },
      include: { persona: true },
    });

    return compras
      .map((c): IvaExportRow => ({
        fecha: new Date(c.issueDate),
        tipo: c.invoiceType,
        numero: c.invoiceNumber,
        persona: c.persona,
        neto: toFixedMoneyString(c.netAmount),
        iva: toFixedMoneyString(c.taxAmount),
        percepciones: toFixedMoneyString(c.percepcionAmount),
        percepcionesIva: toFixedMoneyString(c.percepcionIvaAmount),
        total: toFixedMoneyString(c.totalAmount),
        sign: c.invoiceType.includes('CREDITO') ? -1 : 1,
      }))
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  },

  async generateAFIPTxt(month: number, year: number) {
    const ventas = await this.getVentasData(month, year);
    const compras = await this.getComprasData(month, year);

    let ventasTxt = '';
    let ventasAlicuotasTxt = '';
    let percepcionesIvaTxt = '';

    for (const v of ventas) {
      const dateStr = formatArDateYYYYMMDD(v.fecha);
      const cbteType = getAfipVoucherType(v.tipo);
      const parsedInv = parseInvoiceNumber(v.numero);
      const isFacturaC = cbteType === '011' || cbteType === '012' || cbteType === '013';

      const absNeto = decAbs(v.neto);
      const absIva = decAbs(v.iva);
      const absPerc = decAbs(v.percepciones);
      const absPercIva = decAbs(v.percepcionesIva);
      const absTotal = decAbs(v.total);

      ventasTxt +=
        dateStr +
        cbteType +
        parsedInv.ptoVenta +
        parsedInv.cbte +
        parsedInv.cbte +
        getAfipDocType(v.persona?.cuit) +
        getAfipDocNumber(v.persona?.cuit) +
        padString(v.persona?.name, 30) +
        formatAfipCurrency(absTotal) +
        formatAfipCurrency(0) +
        formatAfipCurrency(0) +
        formatAfipCurrency(0) +
        formatAfipCurrency(absPercIva) +
        formatAfipCurrency(absPerc) +
        formatAfipCurrency(0) +
        formatAfipCurrency(0) +
        'PES' +
        '0001000000' +
        (isFacturaC ? '0' : '1') +
        ' ' +
        formatAfipCurrency(0) +
        '00000000' +
        '\n';

      if (!isFacturaC && absIva.greaterThan(0)) {
        ventasAlicuotasTxt +=
          cbteType +
          parsedInv.ptoVenta +
          parsedInv.cbte +
          formatAfipCurrency(absNeto) +
          '0005' +
          formatAfipCurrency(absIva) +
          '\n';
      }

      if (absPercIva.greaterThan(0)) {
        percepcionesIvaTxt +=
          '01' +
          formatArDateDDMMYYYY(v.fecha) +
          parsedInv.ptoVenta.padStart(15, '0') +
          parsedInv.cbte.substring(16) +
          padString('', 7) +
          formatAfipCurrency(absTotal, 15) +
          formatAfipCurrency(absPercIva, 15) +
          '\n';
      }
    }

    let comprasTxt = '';
    let comprasAlicuotasTxt = '';

    for (const c of compras) {
      const dateStr = formatUtcDateYYYYMMDD(c.fecha);
      const cbteType = getAfipVoucherType(c.tipo);
      const parsedInv = parseInvoiceNumber(c.numero);
      const isFacturaC = cbteType === '011' || cbteType === '012' || cbteType === '013';

      const absNeto = decAbs(c.neto);
      const absIva = decAbs(c.iva);
      const absPerc = decAbs(c.percepciones);
      const absPercIva = decAbs(c.percepcionesIva);
      const absTotal = decAbs(c.total);

      comprasTxt +=
        dateStr +
        cbteType +
        parsedInv.ptoVenta +
        parsedInv.cbte +
        padString('', 16) +
        getAfipDocType(c.persona?.cuit) +
        getAfipDocNumber(c.persona?.cuit) +
        padString(c.persona?.name, 30) +
        formatAfipCurrency(absTotal) +
        formatAfipCurrency(0) +
        formatAfipCurrency(0) +
        formatAfipCurrency(absPercIva) +
        formatAfipCurrency(0) +
        formatAfipCurrency(absPerc) +
        formatAfipCurrency(0) +
        formatAfipCurrency(0) +
        'PES' +
        '0001000000' +
        (isFacturaC ? '0' : '1') +
        ' ' +
        formatAfipCurrency(absIva) +
        formatAfipCurrency(0) +
        '00000000000' +
        padString('', 30) +
        formatAfipCurrency(0) +
        '\n';

      if (!isFacturaC && absIva.greaterThan(0)) {
        comprasAlicuotasTxt +=
          cbteType +
          parsedInv.ptoVenta +
          parsedInv.cbte +
          getAfipDocType(c.persona?.cuit) +
          getAfipDocNumber(c.persona?.cuit) +
          formatAfipCurrency(absNeto) +
          '0005' +
          formatAfipCurrency(absIva) +
          '\n';
      }
    }

    return {
      ventasData: ventas,
      comprasData: compras,
      txt: {
        'RegInformacionVentas.txt': ventasTxt,
        'RegInformacionVentas-.txt': ventasAlicuotasTxt,
        'RegInformacionCompras.txt': comprasTxt,
        'RegInformacionCompras-.txt': comprasAlicuotasTxt,
        'PercepcionesIva.txt': percepcionesIvaTxt,
      },
    };
  },
};
