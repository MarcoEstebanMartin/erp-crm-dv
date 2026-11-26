import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingType, InvoiceType } from '@prisma/client';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    perceptionType: { findUnique: vi.fn() },
    order: { findMany: vi.fn() },
    creditNote: { findMany: vi.fn() },
    supplierInvoice: { findMany: vi.fn() },
    taxWithholding: { findMany: vi.fn() },
  },
}));

import prisma from '../../utils/prisma';
import {
  computeInvoiceTaxBreakdown,
  resolvePersonaTaxCondition,
} from '../orders/order-tax.helpers';
import { calculateCreditNotePerceptions } from '../../engines/credit-purchase.engine';
import { ivaExportService } from '../ivaExport.service';

describe('Paso 1 — Reglas fiscales RG 5329, Condición IVA, NC A con percepciones y Retenciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.perceptionType.findUnique as any).mockResolvedValue({ code: 'IVA_5329', aliquot: '3.00' });
    (prisma.order.findMany as any).mockResolvedValue([]);
    (prisma.creditNote.findMany as any).mockResolvedValue([]);
    (prisma.supplierInvoice.findMany as any).mockResolvedValue([]);
    (prisma.taxWithholding.findMany as any).mockResolvedValue([]);
  });

  it('RG 5329 NO aplica cuando el Total supera $100.000 pero el Neto Gravado es <= $100.000 (ej. $120.552 -> Neto $99.629,75)', async () => {
    const res = await computeInvoiceTaxBreakdown(120552, BillingType.OFFICIAL, {
      cuit: '20-37178456-0',
      taxCondition: 'RESPONSABLE_INSCRIPTO',
      iibbAliquot: '0.00',
    });

    expect(res.finalInvoiceType).toBe(InvoiceType.FACTURA_A);
    expect(res.net).toBe(99629.75);
    expect(res.tax).toBe(20922.25);
    expect(res.percepIVA).toBe(0);
    expect(res.finalTotal).toBe(120552);
  });

  it('RG 5329 SÍ aplica 3% sobre Neto cuando es Factura A a Responsable Inscripto con Neto > $100.000 (ej. $130.438 -> Neto $107.800)', async () => {
    const res = await computeInvoiceTaxBreakdown(130438, BillingType.OFFICIAL, {
      cuit: '20-37178456-0',
      taxCondition: 'RESPONSABLE_INSCRIPTO',
      iibbAliquot: '0.00',
    });

    expect(res.finalInvoiceType).toBe(InvoiceType.FACTURA_A);
    expect(res.net).toBe(107800);
    expect(res.tax).toBe(22638);
    expect(res.percepIVA).toBe(3234);
    expect(res.finalTotal).toBe(133672);
  });

  it('RG 5329 NO aplica a Monotributistas aunque reciban Factura A con Neto > $100.000', async () => {
    const res = await computeInvoiceTaxBreakdown(411024, BillingType.OFFICIAL, {
      cuit: '20-24283656-2',
      taxCondition: 'MONOTRIBUTO',
      iibbAliquot: '0.00',
    });

    expect(res.finalInvoiceType).toBe(InvoiceType.FACTURA_A);
    expect(res.taxCondition).toBe('MONOTRIBUTO');
    expect(res.percepIVA).toBe(0);
    expect(res.finalTotal).toBe(411024);
  });

  it('Clientes EXENTO con CUIT 11 dígitos reciben Factura B (docType 80) y $0 de Percepción IVA', async () => {
    const res = await computeInvoiceTaxBreakdown(242736, BillingType.OFFICIAL, {
      cuit: '30-62067362-1',
      taxCondition: 'EXENTO',
      iibbAliquot: '0.00',
    });

    expect(res.finalInvoiceType).toBe(InvoiceType.FACTURA_B);
    expect(res.docType).toBe(80);
    expect(res.percepIVA).toBe(0);
    expect(res.finalTotal).toBe(242736);
  });

  it('resolvePersonaTaxCondition mantiene compatibilidad con clientes legacy sin taxCondition', () => {
    expect(resolvePersonaTaxCondition({ cuit: '30-70832779-0' })).toBe('RESPONSABLE_INSCRIPTO');
    expect(resolvePersonaTaxCondition({ cuit: '35123456' })).toBe('CONSUMIDOR_FINAL');
    expect(resolvePersonaTaxCondition({ cuit: null })).toBe('CONSUMIDOR_FINAL');
  });

  it('calculateCreditNotePerceptions devuelve 100% exacto de percepciones en anulación total y proporcional en parcial', () => {
    const full = calculateCreditNotePerceptions({
      isFacturaA: true,
      creditNoteNetAmount: 497606.26,
      creditNoteTaxAmount: 104497.32,
      linkedOrderNetAmount: 497606.26,
      linkedOrderPercepcionAmount: 0,
      linkedOrderPercepcionIvaAmount: 14928.19,
    });
    expect(full.percepcionIvaAmount).toBe(14928.19);
    expect(full.totalAmount).toBe(617031.77);

    const partial = calculateCreditNotePerceptions({
      isFacturaA: true,
      creditNoteNetAmount: 248803.13,
      creditNoteTaxAmount: 52248.66,
      linkedOrderNetAmount: 497606.26,
      linkedOrderPercepcionAmount: 0,
      linkedOrderPercepcionIvaAmount: 14928.19,
    });
    expect(partial.percepcionIvaAmount).toBe(7464.1);
    expect(partial.totalAmount).toBe(308515.89);
  });

  it('ivaExportService exporta percepciones de NC A (código 03 en PercepcionesIva.txt) y retenciones sufridas separadas sin contaminar TXT ARCA', async () => {
    (prisma.creditNote.findMany as any).mockResolvedValue([
      {
        id: 21,
        createdAt: new Date('2026-10-07T15:00:00.000Z'),
        creditNoteType: 'NOTA_CREDITO_A',
        creditNoteNumber: '00005-00000407',
        netAmount: '497606.26',
        taxAmount: '104497.32',
        percepcionAmount: '0.00',
        percepcionIvaAmount: '14928.19',
        totalAmount: '617031.77',
        persona: { name: 'CAMERINI VILLARRUEL', cuit: '24-36577658-6', taxCondition: 'RESPONSABLE_INSCRIPTO' },
      },
    ]);

    (prisma.taxWithholding.findMany as any).mockResolvedValue([
      {
        id: 5,
        type: 'RETENCION_SUFRIDA',
        taxType: 'GANANCIAS',
        jurisdiction: null,
        number: '00005-00000558',
        date: new Date('2026-10-01T15:00:00.000Z'),
        amount: '6968.49',
        persona: { name: 'FANBERLIAN SA', cuit: '30-70737682-8', taxCondition: 'RESPONSABLE_INSCRIPTO' },
      },
      {
        id: 6,
        type: 'RETENCION_SUFRIDA',
        taxType: 'IIBB',
        jurisdiction: 'AR-B',
        number: '00005-00017380',
        date: new Date('2026-10-07T15:00:00.000Z'),
        amount: '954.26',
        persona: { name: 'MUNICIPALIDAD B. LARROUDE', cuit: '30-99911388-1', taxCondition: 'EXENTO' },
      },
    ]);

    const result = await ivaExportService.generateAFIPTxt(10, 2026);

    // 1. La NC A conserva su percepción IVA y condición fiscal
    expect(result.ventasData).toHaveLength(1);
    expect(result.ventasData[0].percepcionesIva).toBe('14928.19');
    expect(result.ventasData[0].taxCondition).toBe('RESPONSABLE_INSCRIPTO');

    // 2. PercepcionesIva.txt usa código 03 para NC
    const percLines = result.txt['PercepcionesIva.txt'].trim().split('\n');
    expect(percLines).toHaveLength(1);
    expect(percLines[0].startsWith('0307/10/2026')).toBe(true);

    // 3. RegInformacionVentas.txt tiene SOLO el comprobante fiscal (NO las retenciones)
    const ventasTxtLines = result.txt['RegInformacionVentas.txt'].trim().split('\n');
    expect(ventasTxtLines).toHaveLength(1);

    // 4. retencionesData trae las retenciones sufridas con etiquetas contables de Iduo
    expect(result.retencionesData).toHaveLength(2);
    expect(result.retencionesData[0].tipo).toBe('Retencion Ganancias');
    expect(result.retencionesData[0].amount).toBe('6968.49');
    expect(result.retencionesData[0].sign).toBe(-1);
    expect(result.retencionesData[1].tipo).toBe('Retencion IIBB Bs As');
    expect(result.retencionesData[1].amount).toBe('954.26');
  });
});
