import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// AFIP Format helpers
const padZero = (num: number | string | null | undefined, length: number) => {
  if (!num) return '0'.repeat(length);
  const str = String(num).replace('.', ''); 
  return str.padStart(length, '0');
};

const formatCurrency = (amount: any, length: number = 15) => {
  if (!amount) return '0'.repeat(length);
  const val = Number(amount);
  const fixed = val.toFixed(2).replace('.', '');
  if (val < 0) {
    const absVal = Math.abs(val).toFixed(2).replace('.', '');
    const padded = absVal.padStart(length, '0');
    return '-' + padded.substring(1);
  }
  return fixed.padStart(length, '0');
};

const padString = (str: string | null | undefined, length: number) => {
  if (!str) return ' '.repeat(length);
  let s = str.substring(0, length);
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 *&()\-_.@,]/g, ' ');
  return s.padEnd(length, ' ');
};

const getAfipDocType = (cuit: string | null | undefined) => {
  if (!cuit) return '99'; // Sin identificar
  const c = cuit.replace(/\D/g, '');
  if (c.length === 11) return '80'; // CUIT
  if (c.length >= 7 && c.length <= 8) return '96'; // DNI
  return '99'; // Default
};

const getAfipDocNumber = (cuit: string | null | undefined) => {
  if (!cuit) return '0'.repeat(20);
  const c = cuit.replace(/\D/g, '');
  return c.padStart(20, '0');
};

const getAfipVoucherType = (type: string) => {
  switch (type) {
    case 'FACTURA_A': return '001';
    case 'NOTA_CREDITO_A': return '003';
    case 'NOTA_DEBITO_A': return '002';
    case 'FACTURA_B': return '006';
    case 'NOTA_CREDITO_B': return '008';
    case 'NOTA_DEBITO_B': return '007';
    case 'FACTURA_C': return '011';
    case 'NOTA_CREDITO_C': return '013';
    case 'NOTA_DEBITO_C': return '012';
    default: return '001'; // Default
  }
};

const parseInvoiceNumber = (invoiceNumber: string | null) => {
  if (!invoiceNumber) return { ptoVenta: '00000', cbte: '00000000000000000000' };
  const parts = invoiceNumber.split('-');
  if (parts.length === 2) {
    return {
      ptoVenta: parts[0].padStart(5, '0'),
      cbte: parts[1].padStart(20, '0')
    };
  }
  return { ptoVenta: '00000', cbte: invoiceNumber.padStart(20, '0') };
};

export const ivaExportService = {
  async getVentasData(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const orders = await prisma.order.findMany({
      where: {
        billingType: 'OFFICIAL',
        status: { not: 'CANCELLED' },
        createdAt: { gte: startDate, lte: endDate }
      },
      include: { persona: true }
    });

    const creditNotes = await prisma.creditNote.findMany({
      where: {
        billingType: 'OFFICIAL',
        createdAt: { gte: startDate, lte: endDate }
      },
      include: { persona: true }
    });

    const ventas = [];

    for (const order of orders) {
      if (order.invoiceType === 'PRESUPUESTO' || !order.invoiceNumber) continue;
      ventas.push({
        fecha: order.createdAt,
        tipo: order.invoiceType,
        numero: order.invoiceNumber,
        persona: order.persona,
        neto: Number(order.netAmount),
        iva: Number(order.taxAmount),
        percepciones: Number(order.percepcionAmount),
        total: Number(order.totalAmount),
        sign: 1
      });
    }

    for (const cn of creditNotes) {
      if (!cn.creditNoteNumber) continue;
      ventas.push({
        fecha: cn.createdAt,
        tipo: cn.creditNoteType,
        numero: cn.creditNoteNumber,
        persona: cn.persona,
        neto: Number(cn.netAmount),
        iva: Number(cn.taxAmount),
        percepciones: 0,
        total: Number(cn.totalAmount),
        sign: -1
      });
    }

    ventas.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.numero.localeCompare(b.numero));
    return ventas;
  },

  async getComprasData(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const compras = await prisma.supplierInvoice.findMany({
      where: {
        issueDate: { gte: startDate, lte: endDate }
      },
      include: { persona: true }
    });

    return compras.map(c => ({
        fecha: c.issueDate,
        tipo: c.invoiceType,
        numero: c.invoiceNumber,
        persona: c.persona,
        neto: Number(c.netAmount),
        iva: Number(c.taxAmount),
        percepciones: Number(c.percepcionAmount),
        total: Number(c.totalAmount),
        sign: c.invoiceType.includes('CREDITO') ? -1 : 1
    })).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  },

  async generateAFIPTxt(month: number, year: number) {
    const ventas = await this.getVentasData(month, year);
    const compras = await this.getComprasData(month, year);

    let ventasTxt = '';
    let ventasAlicuotasTxt = '';
    let percepcionesIvaTxt = '';

    for (const v of ventas) {
      const d = v.fecha;
      const dateStr = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
      const cbteType = getAfipVoucherType(v.tipo);
      const parsedInv = parseInvoiceNumber(v.numero);
      
      const isFacturaA = cbteType === '001' || cbteType === '002' || cbteType === '003';
      const isFacturaC = cbteType === '011' || cbteType === '012' || cbteType === '013';
      
      const absNeto = Math.abs(v.neto);
      const absIva = Math.abs(v.iva);
      const absPerc = Math.abs(v.percepciones);
      const absTotal = Math.abs(v.total);

      // Comprobantes (256 bytes)
      ventasTxt += 
        dateStr + // 8
        cbteType + // 3
        parsedInv.ptoVenta + // 5
        parsedInv.cbte + // 20
        parsedInv.cbte + // 20
        getAfipDocType(v.persona?.cuit) + // 2
        getAfipDocNumber(v.persona?.cuit) + // 20
        padString(v.persona?.name, 30) + // 30
        formatCurrency(absTotal) + // 15
        formatCurrency(0) + // 15 No Gravado
        formatCurrency(0) + // 15 Perc No Categorizados
        formatCurrency(0) + // 15 Exentas
        formatCurrency(0) + // 15 Perc Nacionales
        formatCurrency(absPerc) + // 15 Perc IIBB
        formatCurrency(0) + // 15 Perc Municipales
        formatCurrency(0) + // 15 Imp Internos
        'PES' + // 3 Moneda
        '0001000000' + // 10 Tipo Cambio
        (isFacturaC ? '0' : '1') + // 1 Cantidad Alicuotas
        ' ' + // 1 Cod Operacion
        formatCurrency(0) + // 15 Otros tributos
        '00000000' + // 8 Vencimiento
        '\n';

      // Alicuotas (62 bytes)
      if (!isFacturaC && absIva > 0) {
          ventasAlicuotasTxt += 
          cbteType + // 3
          parsedInv.ptoVenta + // 5
          parsedInv.cbte + // 20
          formatCurrency(absNeto) + // 15 Neto
          '0005' + // 4 Alicuota (0005 = 21%, 0004 = 10.5%)
          formatCurrency(absIva) + // 15 IVA
          '\n';
      }

      // Percepciones ARBA/SICORE approx (145 bytes)
      if (absPerc > 0) {
        percepcionesIvaTxt +=
          '01' + // 2 Tipo
          `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}` + // 10
          parsedInv.ptoVenta.padStart(15, '0') + // 15? Format might vary
          parsedInv.cbte.substring(16) + // 4 (part of cbte?)
          padString('', 7) + 
          formatCurrency(absTotal, 15) + 
          formatCurrency(absNeto, 15) +
          '\n'; // Placeholder structure, real one requires exact specs
      }
    }

    let comprasTxt = '';
    let comprasAlicuotasTxt = '';

    for (const c of compras) {
        const d = c.fecha;
        const dateStr = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
        const cbteType = getAfipVoucherType(c.tipo);
        const parsedInv = parseInvoiceNumber(c.numero);
        
        const isFacturaC = cbteType === '011' || cbteType === '012' || cbteType === '013';
        
        const absNeto = Math.abs(c.neto);
        const absIva = Math.abs(c.iva);
        const absPerc = Math.abs(c.percepciones);
        const absTotal = Math.abs(c.total);

        // Compras Comprobantes (312 bytes estándar AFIP)
        comprasTxt += 
          dateStr + // 8
          cbteType + // 3
          parsedInv.ptoVenta + // 5
          parsedInv.cbte + // 20
          padString('', 16) + // 16 despacho importacion
          getAfipDocType(c.persona?.cuit) + // 2
          getAfipDocNumber(c.persona?.cuit) + // 20
          padString(c.persona?.name, 30) + // 30
          formatCurrency(absTotal) + // 15
          formatCurrency(0) + // 15 no gravado
          formatCurrency(0) + // 15 exentas
          formatCurrency(0) + // 15 pago a cuenta IVA
          formatCurrency(0) + // 15 pago a cuenta otros
          formatCurrency(absPerc) + // 15 perc IIBB
          formatCurrency(0) + // 15 perc municipales
          formatCurrency(0) + // 15 impuestos internos
          'PES' + // 3
          '0001000000' + // 10
          (isFacturaC ? '0' : '1') + // 1
          ' ' + // 1
          formatCurrency(absIva) + // 15 credito fiscal computable
          formatCurrency(0) + // 15 otros tributos
          '00000000000' + // 11 cuit emisor/corredor
          padString('', 30) + // 30 denom emisor
          formatCurrency(0) + // 15 IVA comision
          '\n';

        // Compras Alicuotas (84 bytes estándar AFIP)
        if (!isFacturaC && absIva > 0) {
            comprasAlicuotasTxt += 
              cbteType + // 3
              parsedInv.ptoVenta + // 5
              parsedInv.cbte + // 20
              getAfipDocType(c.persona?.cuit) + // 2
              getAfipDocNumber(c.persona?.cuit) + // 20
              formatCurrency(absNeto) + // 15
              '0005' + // 4 alicuota (21%)
              formatCurrency(absIva) + // 15
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
        'PercepcionesIva.txt': percepcionesIvaTxt
      }
    };
  }
};

function padEndString(str: string, len: number) {
    return str.padEnd(len, ' ').substring(0, len);
}
