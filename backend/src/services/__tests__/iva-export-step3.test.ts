import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    order: { findMany: vi.fn() },
    creditNote: { findMany: vi.fn() },
    supplierInvoice: { findMany: vi.fn() },
  },
}));

import prisma from '../../utils/prisma';
import { formatAfipCurrency, ivaExportService } from '../ivaExport.service';

describe('Paso 3A — Libro IVA Digital AFIP: Decimal.js, horario AR (-03:00) y filtrado estricto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.order.findMany as any).mockResolvedValue([]);
    (prisma.creditNote.findMany as any).mockResolvedValue([]);
    (prisma.supplierInvoice.findMany as any).mockResolvedValue([]);
  });

  it('consulta rangos exactos AR (-03:00) para ventas/NC y calendario UTC para compras, exigiendo cae no nulo y NC APPROVED', async () => {
    await ivaExportService.generateAFIPTxt(11, 2026);

    const orderArgs = (prisma.order.findMany as any).mock.calls[0][0];
    expect(orderArgs.where.billingType).toBe('OFFICIAL');
    expect(orderArgs.where.cae).toEqual({ not: null });
    expect(orderArgs.where.createdAt.gte.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(orderArgs.where.createdAt.lte.toISOString()).toBe('2026-12-01T02:59:59.999Z');

    const cnArgs = (prisma.creditNote.findMany as any).mock.calls[0][0];
    expect(cnArgs.where.billingType).toBe('OFFICIAL');
    expect(cnArgs.where.status).toBe('APPROVED');
    expect(cnArgs.where.createdAt.lte.toISOString()).toBe('2026-12-01T02:59:59.999Z');

    const invArgs = (prisma.supplierInvoice.findMany as any).mock.calls[0][0];
    expect(invArgs.where.billingType).toBe('OFFICIAL');
    expect(invArgs.where.issueDate.gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(invArgs.where.issueDate.lte.toISOString()).toBe('2026-11-30T23:59:59.999Z');
  });

  it('exporta factura emitida 30/11 22:30 AR como 20261130, excluye Pre-Facturas PRE- sin CAE y excluye NC NCI-', async () => {
    (prisma.order.findMany as any).mockResolvedValue([
      {
        id: 1,
        createdAt: new Date('2026-12-01T01:30:00.000Z'), // 2026-11-30 22:30 AR
        invoiceType: 'FACTURA_A',
        invoiceNumber: '0001-00000125',
        cae: '74123456789012',
        netAmount: '1000.00',
        taxAmount: '210.00',
        percepcionAmount: '0.00',
        percepcionIvaAmount: '30.00',
        totalAmount: '1240.00',
        persona: { name: 'YESICA GARAY', cuit: '27-33444555-6' },
      },
      {
        id: 2,
        createdAt: new Date('2026-11-15T14:00:00.000Z'),
        invoiceType: 'FACTURA_B',
        invoiceNumber: 'PRE-B-00015',
        cae: null,
        netAmount: '500.00',
        taxAmount: '105.00',
        percepcionAmount: '0.00',
        percepcionIvaAmount: '0.00',
        totalAmount: '605.00',
        persona: { name: 'BORRADOR PRE', cuit: null },
      },
    ]);

    (prisma.creditNote.findMany as any).mockResolvedValue([
      {
        id: 10,
        createdAt: new Date('2026-11-20T15:00:00.000Z'),
        creditNoteType: 'NOTA_CREDITO_A',
        creditNoteNumber: 'NCI-00010',
        netAmount: '100.00',
        taxAmount: '21.00',
        totalAmount: '121.00',
        persona: { name: 'CLIENTE INTERNO', cuit: '20-11222333-4' },
      },
      {
        id: 11,
        createdAt: new Date('2026-11-25T15:00:00.000Z'),
        creditNoteType: 'NOTA_CREDITO_A',
        creditNoteNumber: '0001-00000008',
        netAmount: '200.00',
        taxAmount: '42.00',
        totalAmount: '242.00',
        persona: { name: 'SUPERMERCADO NORTE', cuit: '30-70999888-1' },
      },
    ]);

    (prisma.supplierInvoice.findMany as any).mockResolvedValue([
      {
        id: 50,
        issueDate: new Date('2026-11-01T00:00:00.000Z'),
        invoiceType: 'FACTURA_A',
        invoiceNumber: '0004-00008811',
        netAmount: '2000.00',
        taxAmount: '420.00',
        percepcionAmount: '50.00',
        percepcionIvaAmount: '60.00',
        totalAmount: '2530.00',
        persona: { name: 'LACTEOS SUR SA', cuit: '30-55555555-9' },
      },
    ]);

    const result = await ivaExportService.generateAFIPTxt(11, 2026);

    expect(result.ventasData).toHaveLength(2);
    expect(result.ventasData[0].numero).toBe('0001-00000008');
    expect(result.ventasData[1].numero).toBe('0001-00000125');

    const ventasLines = result.txt['RegInformacionVentas.txt'].trim().split('\n');
    expect(ventasLines).toHaveLength(2);
    expect(ventasLines[0]).toMatch(/^202611250030000100000000000000000008/);
    expect(ventasLines[1]).toMatch(/^202611300010000100000000000000000125/);

    const percepLines = result.txt['PercepcionesIva.txt'].trim().split('\n');
    expect(percepLines).toHaveLength(1);
    expect(percepLines[0].startsWith('0130/11/2026')).toBe(true);

    const comprasLines = result.txt['RegInformacionCompras.txt'].trim().split('\n');
    expect(comprasLines).toHaveLength(1);
    expect(comprasLines[0]).toMatch(/^202611010010000400000000000000008811/);
  });

  it('formatAfipCurrency usa ROUND_HALF_UP de Decimal.js y respeta exactamente 15 caracteres', () => {
    expect(formatAfipCurrency('10.005')).toBe('000000000001001');
    expect(formatAfipCurrency('1234.5')).toBe('000000000123450');
    expect(formatAfipCurrency('-50.25')).toBe('-00000000005025');
    expect(formatAfipCurrency('0')).toBe('000000000000000');
    expect(formatAfipCurrency('-0.001')).toBe('000000000000000');
  });
});
