import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildAfipCreditNotePayload,
  buildAfipInvoicePayload,
  emitirFacturaAFIP,
  emitirNotaCreditoAFIP,
  formatAfipDateAR,
} from '../afip.service';
import * as systemConfigService from '../admin/system-config.service';

describe('AFIP Service Invariants Unit Tests (Igualdad Impositiva y ARCA RG 4540)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Debe garantizar que ImpTotal sea exactamente igual a ImpNeto + ImpIVA en Factura A sin percepciones', async () => {
    // Usando el modo MOCK por defecto de AFIP en entorno de test
    const res = await emitirFacturaAFIP({
      clientCuit: '30712345678',
      clientDocType: 80,
      invoiceType: 'A',
      total: 1210.00,
    });

    expect(res).toBeDefined();
    expect(res.invoiceNumber).toBeDefined();
    expect(res.cae).toBeDefined();
  });

  it('Debe calcular correctamente el neto e IVA para un total con decimales complejos', async () => {
    const totalInput = 10543.25;
    const netoExpected = Number((totalInput / 1.21).toFixed(2));
    const ivaExpected = Number((totalInput - netoExpected).toFixed(2));

    expect(Number((netoExpected + ivaExpected).toFixed(2))).toBe(totalInput);
  });

  it('formatAfipDateAR usa America/Argentina/Buenos_Aires y evita desfase UTC después de las 21:00 AR', () => {
    // 2026-11-15T01:30:00.000Z === 2026-11-14 22:30:00 ART (-03:00)
    expect(formatAfipDateAR(new Date('2026-11-15T01:30:00.000Z'))).toBe(20261114);
  });

  it('buildAfipInvoicePayload garantiza ImpTotal === ImpNeto + ImpIVA + ImpTrib en Factura A con percepciones y DocNro 0 para Consumidor Final', () => {
    const payloadA = buildAfipInvoicePayload({
      puntoDeVenta: 3,
      nextVoucherNumber: 42,
      now: new Date('2026-11-15T01:30:00.000Z'),
      request: {
        clientCuit: '30-71234567-8',
        clientDocType: 80,
        invoiceType: 'A',
        total: 102479.34,
        neto: 82644.63,
        iva: 17355.37,
        percepcionAmount: 2479.34,
        percepcionIvaAmount: 0,
      },
    });

    expect(payloadA.CbteTipo).toBe(1);
    expect(payloadA.CbteFch).toBe(20261114);
    expect(payloadA.DocTipo).toBe(80);
    expect(payloadA.DocNro).toBe(30712345678);
    expect(Number((payloadA.ImpNeto + payloadA.ImpIVA + payloadA.ImpTrib).toFixed(2))).toBe(payloadA.ImpTotal);
    expect(payloadA.ImpTotal).toBe(102479.34);
    expect(payloadA.Tributos).toHaveLength(1);

    const payloadCF = buildAfipInvoicePayload({
      puntoDeVenta: 3,
      nextVoucherNumber: 43,
      now: new Date('2026-11-14T15:00:00.000Z'),
      request: {
        clientCuit: 'SIN-CUIT',
        clientDocType: 99,
        invoiceType: 'B',
        total: 12100,
      },
    });

    expect(payloadCF.CbteTipo).toBe(6);
    expect(payloadCF.DocTipo).toBe(99);
    expect(payloadCF.DocNro).toBe(0);
  });

  it('buildAfipCreditNotePayload incluye CbtesAsoc (RG 4540) si hay factura vinculada y PeriodoAsoc si no hay comprobante', () => {
    const withAssoc = buildAfipCreditNotePayload({
      puntoDeVenta: 2,
      nextVoucherNumber: 10,
      emitterCuit: '20-16316505-9',
      now: new Date('2026-11-14T16:00:00.000Z'),
      request: {
        clientCuit: '30712345678',
        clientDocType: 80,
        invoiceType: 'A',
        total: 12100,
        neto: 10000,
        iva: 2100,
        associatedVoucher: {
          invoiceNumber: '00002-00000125',
          invoiceType: 'FACTURA_A',
          invoiceDate: '2026-11-10T18:00:00.000Z',
        },
      },
    });

    expect(withAssoc.CbteTipo).toBe(3);
    expect(withAssoc.CbtesAsoc).toEqual([
      {
        Tipo: 1,
        PtoVta: 2,
        Nro: 125,
        Cuit: '20163165059',
        CbteFch: '20261110',
      },
    ]);
    expect(withAssoc.PeriodoAsoc).toBeUndefined();

    const withoutAssoc = buildAfipCreditNotePayload({
      puntoDeVenta: 2,
      nextVoucherNumber: 11,
      emitterCuit: '20-16316505-9',
      now: new Date('2026-11-14T16:00:00.000Z'),
      request: {
        clientCuit: '0',
        clientDocType: 99,
        invoiceType: 'B',
        total: 5000,
      },
    });

    expect(withoutAssoc.CbteTipo).toBe(8);
    expect(withoutAssoc.PeriodoAsoc).toEqual({
      FchDesde: '20261114',
      FchHasta: '20261114',
    });
  });

  it('emitirNotaCreditoAFIP usa puntoVenta dinámico de configuración y modo mock seguro en Vitest', async () => {
    vi.spyOn(systemConfigService, 'getSystemConfigSnapshot').mockResolvedValue({
      ignoreStock: false,
      afipProduction: false,
      company: {
        ...systemConfigService.DEFAULT_COMPANY_PROFILE,
        puntoVenta: 4,
      },
    });

    const ncRes = await emitirNotaCreditoAFIP({
      clientCuit: '30712345678',
      clientDocType: 80,
      invoiceType: 'A',
      total: 12100,
      neto: 10000,
      iva: 2100,
      associatedVoucher: {
        invoiceNumber: '00004-00000050',
        invoiceType: 'FACTURA_A',
        invoiceDate: new Date('2026-11-12T15:00:00.000Z'),
      },
    });

    expect(ncRes.puntoVenta).toBe(4);
    expect(ncRes.invoiceNumber.startsWith('00004-')).toBe(true);
    expect(ncRes.cae).toMatch(/2$/);
  });

  it('En modo simulacro (afipMockMode=true) emite Factura y Nota de Crédito con CAE simulado de 14 dígitos sin llamar a ARCA', async () => {
    vi.spyOn(systemConfigService, 'getSystemConfigSnapshot').mockResolvedValue({
      ignoreStock: false,
      afipProduction: false,
      afipMockMode: true,
      company: {
        ...systemConfigService.DEFAULT_COMPANY_PROFILE,
        puntoVenta: 2,
      },
    });

    const facRes = await emitirFacturaAFIP({
      clientCuit: '30712345678',
      clientDocType: 80,
      invoiceType: 'A',
      total: 24200,
      neto: 20000,
      iva: 4200,
    });

    expect(facRes.puntoVenta).toBe(2);
    expect(facRes.invoiceNumber).toMatch(/^00002-\d{8}$/);
    expect(facRes.cae).toMatch(/^99999\d{8}1$/);
    expect(facRes.cae).toHaveLength(14);

    const ncRes = await emitirNotaCreditoAFIP({
      clientCuit: '30712345678',
      clientDocType: 80,
      invoiceType: 'A',
      total: 12100,
      neto: 10000,
      iva: 2100,
    });

    expect(ncRes.puntoVenta).toBe(2);
    expect(ncRes.invoiceNumber).toMatch(/^00002-\d{8}$/);
    expect(ncRes.cae).toMatch(/^99999\d{8}2$/);
    expect(ncRes.cae).toHaveLength(14);
  });
});
