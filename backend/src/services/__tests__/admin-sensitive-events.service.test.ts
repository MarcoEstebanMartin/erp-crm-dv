import { afterEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../utils/prisma';
import { adminSensitiveEventsService } from '../admin/admin-sensitive-events.service';

describe('adminSensitiveEventsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('agrega anulaciones de oficina, calle y diferencias de caja excluyendo arqueos exactos', async () => {
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([
      {
        id: 979,
        receiptNumber: 'REC-00979',
        amount: '79726.00',
        voidedAt: new Date('2026-11-25T13:00:00.000Z'),
        voidReason: 'Importe erróneo',
        persona: { name: 'BECERRA LAURA NOEMI' },
        voidedBy: { username: 'facturacion1' },
      },
    ] as any);

    vi.spyOn(prisma.fieldReceipt, 'findMany').mockResolvedValue([
      {
        id: 12,
        receiptNumber: 'REC-C-00012',
        provisionalCode: 'PROV-12',
        totalAmount: '15000.00',
        voidedAt: new Date('2026-11-25T14:00:00.000Z'),
        voidReason: 'Cliente equivocado',
        persona: { name: 'KIOSCO SUR' },
        voidedBy: { username: 'admin' },
      },
    ] as any);

    vi.spyOn(prisma.cashDrawer, 'findMany').mockResolvedValue([
      {
        id: 5,
        branch: 'CONSOLIDADA',
        drawerType: 'DEPOSITO',
        closingBalance: '100000.00',
        realBalance: '100000.00',
        closedAt: new Date('2026-11-25T12:00:00.000Z'),
        notes: null,
        user: { username: 'cajero1' },
      },
      {
        id: 6,
        branch: 'CONSOLIDADA',
        drawerType: 'DEPOSITO',
        closingBalance: '85000.00',
        realBalance: '80000.00',
        closedAt: new Date('2026-11-25T15:00:00.000Z'),
        notes: 'Faltó billete de $5.000',
        user: { username: 'cajero2' },
      },
    ] as any);

    const res = await adminSensitiveEventsService.getSensitiveEvents(7);

    expect(res.summary).toEqual({
      totalCount: 3,
      voidedReceiptsCount: 2,
      voidedReceiptsAmount: 94726,
      cashDiscrepanciesCount: 1,
      cashDiscrepanciesNet: -5000,
    });
    expect(res.events.map((e) => e.id)).toEqual([
      'cash-diff-6',
      'void-field-12',
      'void-office-979',
    ]);
  });
});
