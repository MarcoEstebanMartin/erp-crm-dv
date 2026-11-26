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
import { resolvePersonaTaxCondition } from './orders/order-tax.helpers';

export { formatAfipCurrency };

export interface IvaExportRow {
  fecha: Date;
  tipo: string;
  numero: string;
  persona: any;
  taxCondition?: string;
  neto: string;
  iva: string;
  percepciones: string;
  percepcionesIva: string;
  total: string;
  sign: 1 | -1;
}

export interface IvaRetencionRow {
  fecha: Date;
  tipo: string;
  taxType: string;
  jurisdiction: string | null;
  numero: string;
  persona: any;
  taxCondition: string;
  amount: string;
  sign: -1;
}

function formatRetencionLabel(taxType: string, jurisdiction?: string | null): string {
  const norm = String(taxType || '').trim().toUpperCase();
  if (norm === 'GANANCIAS') return 'Retencion Ganancias';
  if (norm === 'IVA') return 'Retencion IVA';
  if (norm === 'IIBB') {
    const jur = String(jurisdiction || '').trim().toUpperCase();
    if (jur === 'AR-B' || jur === 'BSAS' || jur === 'BUENOS AIRES') return 'Retencion IIBB Bs As';
    if (jur === 'AR-C' || jur === 'CABA') return 'Retencion IIBB CABA';
    if (jur === 'AR-L' || jur === 'LA PAMPA') return 'Retencion IIBB La Pampa';
    return jurisdiction ? `Retencion IIBB ${jurisdiction}` : 'Retencion IIBB';
  }
  return `Retencion ${taxType || ''}`.trim();
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
        taxCondition: resolvePersonaTaxCondition(order.persona),
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
        taxCondition: resolvePersonaTaxCondition(cn.persona),
        neto: toFixedMoneyString(cn.netAmount),
        iva: toFixedMoneyString(cn.taxAmount),
        percepciones: toFixedMoneyString((cn as any).percepcionAmount ?? 0),
        percepcionesIva: toFixedMoneyString((cn as any).percepcionIvaAmount ?? 0),
        total: toFixedMoneyString(cn.totalAmount),
        sign: -1,
      });
    }

    ventas.sort(
      (a, b) => a.fecha.getTime() - b.fecha.getTime() || a.numero.localeCompare(b.numero),
    );
    return ventas;
  },

  async getRetencionesVentasData(month: number, year: number): Promise<IvaRetencionRow[]> {
    if (typeof (prisma as any).taxWithholding?.findMany !== 'function') {
      return [];
    }
    const { startDateStr, endDateStr } = buildMonthDateStrings(month, year);
    const arRange = parseArgentinaTimestampRange(startDateStr, endDateStr);

    const rows = await prisma.taxWithholding.findMany({
      where: {
        type: 'RETENCION_SUFRIDA',
        date: arRange,
      },
      include: { persona: true },
      orderBy: [{ date: 'asc' }, { number: 'asc' }],
    });

    return (rows || []).map((r): IvaRetencionRow => ({
      fecha: new Date(r.date),
      tipo: formatRetencionLabel(r.taxType, r.jurisdiction),
      taxType: r.taxType,
      jurisdiction: r.jurisdiction ?? null,
      numero: String(r.number || '').trim(),
      persona: r.persona,
      taxCondition: resolvePersonaTaxCondition(r.persona),
      amount: toFixedMoneyString(r.amount),
      sign: -1,
    }));
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
        taxCondition: resolvePersonaTaxCondition(c.persona),
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
    const retenciones = await this.getRetencionesVentasData(month, year);

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
        const percVoucherCode = v.sign === -1 ? '03' : '01';
        percepcionesIvaTxt +=
          percVoucherCode +
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
      retencionesData: retenciones,
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
