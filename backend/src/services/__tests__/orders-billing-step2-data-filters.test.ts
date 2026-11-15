import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingType, Role } from '@prisma/client';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    order: { findMany: vi.fn(), count: vi.fn() },
    supplierInvoice: { findMany: vi.fn() },
    creditNote: { findMany: vi.fn() },
    taxWithholding: { findMany: vi.fn() },
  },
}));

vi.mock('../../utils/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

import prisma from '../../utils/prisma';
import {
  parseArgentinaTimestampRange,
  parseCalendarDateRange,
} from '../billing/billing-date-range.helper';
import { OrderQueriesService } from '../orders/order-queries.service';
import { supplierInvoiceService } from '../billing/supplier-invoice.service';
import { creditNoteService } from '../credit-notes/credit-note.service';
import { taxWithholdingService } from '../billing/tax-withholding.service';

describe('Paso 2 — Datos de Persona, Filtros Horarios Argentina (-03:00) y Facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.order.findMany as any).mockResolvedValue([]);
    (prisma.order.count as any).mockResolvedValue(0);
    (prisma.supplierInvoice.findMany as any).mockResolvedValue([]);
    (prisma.creditNote.findMany as any).mockResolvedValue([]);
    (prisma.taxWithholding.findMany as any).mockResolvedValue([]);
  });

  it('parseArgentinaTimestampRange cubre de 00:00:00.000-03:00 a 23:59:59.999-03:00 y soporta bordes parciales', () => {
    const sameDay = parseArgentinaTimestampRange('2026-11-14', '2026-11-14');
    expect(sameDay?.gte?.toISOString()).toBe('2026-11-14T03:00:00.000Z');
    expect(sameDay?.lte?.toISOString()).toBe('2026-11-15T02:59:59.999Z');

    const onlyStart = parseArgentinaTimestampRange('2026-11-14', undefined);
    expect(onlyStart?.gte?.toISOString()).toBe('2026-11-14T03:00:00.000Z');
    expect(onlyStart?.lte).toBeUndefined();

    const onlyEnd = parseArgentinaTimestampRange(undefined, '2026-11-14');
    expect(onlyEnd?.gte).toBeUndefined();
    expect(onlyEnd?.lte?.toISOString()).toBe('2026-11-15T02:59:59.999Z');

    expect(parseArgentinaTimestampRange('', '')).toBeUndefined();
  });

  it('parseCalendarDateRange cubre de 00:00:00.000Z a 23:59:59.999Z sin invadir el día siguiente', () => {
    const range = parseCalendarDateRange('2026-11-14', '2026-11-14');
    expect(range?.gte?.toISOString()).toBe('2026-11-14T00:00:00.000Z');
    expect(range?.lte?.toISOString()).toBe('2026-11-14T23:59:59.999Z');
  });

  it('OrderQueriesService.getOrders selecciona outstandingBalance, priceList, discount e iibbAliquot en persona', async () => {
    await OrderQueriesService.getOrders({ userId: 1, userRole: Role.ADMIN });

    expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
    const callArg = (prisma.order.findMany as any).mock.calls[0][0];
    const select = callArg.include.persona.select;
    expect(select.outstandingBalance).toBe(true);
    expect(select.priceList).toBe(true);
    expect(select.discount).toBe(true);
    expect(select.iibbAliquot).toBe(true);
    expect(select.province).toBe(true);
    expect(select.phone).toBe(true);
    expect((select as any).taxCondition).toBeUndefined();
  });

  it('supplierInvoiceService.getSalesInvoices aplica rango -03:00, billingType y búsqueda por #id o texto', async () => {
    await supplierInvoiceService.getSalesInvoices({
      startDate: '2026-11-14',
      endDate: '2026-11-14',
      billingType: BillingType.OFFICIAL,
      query: '#95',
    });

    const where = (prisma.order.findMany as any).mock.calls[0][0].where;
    expect(where.status).toBe('DELIVERED');
    expect(where.billingType).toBe(BillingType.OFFICIAL);
    expect(where.createdAt.gte.toISOString()).toBe('2026-11-14T03:00:00.000Z');
    expect(where.createdAt.lte.toISOString()).toBe('2026-11-15T02:59:59.999Z');
    expect(where.OR).toEqual(expect.arrayContaining([{ id: 95 }]));
  });

  it('creditNoteService.getCreditNotes y taxWithholdingService.getTaxWithholdings aplican rango de fechas, billingType y query', async () => {
    await creditNoteService.getCreditNotes({
      startDate: '2026-11-10',
      endDate: '2026-11-14',
      billingType: BillingType.INTERNAL,
      status: 'APPROVED',
      query: 'Yesica',
    });
    const cnWhere = (prisma.creditNote.findMany as any).mock.calls[0][0].where;
    expect(cnWhere.billingType).toBe(BillingType.INTERNAL);
    expect(cnWhere.status).toBe('APPROVED');
    expect(cnWhere.createdAt.lte.toISOString()).toBe('2026-11-15T02:59:59.999Z');

    await taxWithholdingService.getTaxWithholdings({
      startDate: '2026-11-14',
      endDate: '2026-11-14',
      query: 'RET-100',
    });
    const twWhere = (prisma.taxWithholding.findMany as any).mock.calls[0][0].where;
    expect(twWhere.date.gte.toISOString()).toBe('2026-11-14T00:00:00.000Z');
    expect(twWhere.date.lte.toISOString()).toBe('2026-11-14T23:59:59.999Z');
    expect(twWhere.OR).toHaveLength(3);
  });
});
