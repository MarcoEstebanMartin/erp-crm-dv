import prisma from '../utils/prisma';
import {
  parseArgentinaTimestampRange,
  parseCalendarDateRange,
} from './billing/billing-date-range.helper';
import {
  buildMonthDateStrings,
  decAbs,
  formatAfipCurrency,
  formatArDateDDMMYYYY,
  formatArDateYYYYMMDD,
  formatUtcDateYYYYMMDD,
  getAfipDocNumber,
  getAfipDocType,
  getAfipVoucherType,
  padString,
  parseInvoiceNumber,
  toFixedMoneyString,
} from './billing/iva-afip-format.helper';

export { formatAfipCurrency };

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
        invoicedAt: arRange,
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
        fecha: new Date(order.invoicedAt ?? order.createdAt),
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
