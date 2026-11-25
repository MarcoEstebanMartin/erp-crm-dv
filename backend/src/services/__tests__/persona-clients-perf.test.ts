import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingType, CreditNoteStatus, OrderStatus, Role, TransactionType } from '@prisma/client';

vi.mock('../../utils/prisma', () => ({
  __esModule: true,
  default: {
    persona: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
    },
    transaction: {
      groupBy: vi.fn(),
    },
    creditNote: {
      groupBy: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from '../../utils/prisma';
import { personaDebtorsSubService } from '../personas/persona-debtors.service';
import { personaService } from '../persona.service';

describe('Paso 1 Performance Clientes — Consultas SQL Paralelas y Filtro Comisionistas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDebtMetricsByPersonaIds ejecuta 0 consultas SQL cuando ningún cliente tiene saldo deudor > 0', async () => {
    const fakeDb = {
      order: { findMany: vi.fn() },
      transaction: { groupBy: vi.fn() },
      creditNote: { groupBy: vi.fn() },
    };

    const result = await personaDebtorsSubService.getDebtMetricsByPersonaIds(
      [
        { id: 1, outstandingBalance: 0 },
        { id: 2, outstandingBalance: -500 },
        { id: 3, outstandingBalance: null },
      ],
      fakeDb,
    );

    expect(result.size).toBe(0);
    expect(fakeDb.order.findMany).not.toHaveBeenCalled();
    expect(fakeDb.transaction.groupBy).not.toHaveBeenCalled();
    expect(fakeDb.creditNote.groupBy).not.toHaveBeenCalled();
  });

  it('getDebtMetricsByPersonaIds agrega por orderId y filtra NC APPROVED en paralelo', async () => {
    (prisma.order.findMany as any).mockResolvedValue([
      {
        id: 101,
        personaId: 7,
        billingType: BillingType.OFFICIAL,
        totalAmount: '12000.00',
      },
      {
        id: 102,
        personaId: 7,
        billingType: BillingType.INTERNAL,
        totalAmount: '8000.00',
      },
    ]);
    (prisma.transaction.groupBy as any)
      // 1ra llamada: unallocatedTx (orderId: null)
      .mockResolvedValueOnce([
        { personaId: 7, billingType: BillingType.INTERNAL, _sum: { amount: '2000.00' } },
      ])
      // 2da llamada: directTx (orderId: { in: orderIds })
      .mockResolvedValueOnce([{ orderId: 101, _sum: { amount: '12000.00' } }]);
    (prisma.creditNote.groupBy as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const metricsMap = await personaDebtorsSubService.getDebtMetricsByPersonaIds([
      { id: 7, outstandingBalance: '6000.00' },
      { id: 8, outstandingBalance: '0.00' },
    ]);

    expect(metricsMap.get(7)).toEqual({
      outstandingBalance: 6000,
      debtA: 0,
      debtX: 6000,
      pendingInvoicesCount: 1,
      hasMultiplePendingInvoices: false,
    });
    expect(metricsMap.has(8)).toBe(false);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { personaId: { in: [7] }, status: OrderStatus.DELIVERED },
      }),
    );
    expect(prisma.transaction.groupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        by: ['orderId'],
        where: { orderId: { in: [101, 102] }, type: TransactionType.INCOME, voidedAt: null },
      }),
    );
    expect(prisma.creditNote.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: CreditNoteStatus.APPROVED }),
      }),
    );
  });

  it('personaService.getPersonas filtra isCommissionAgent con role="commission_agent" y evita getDebtorsReport en clientes', async () => {
    (prisma.persona.findMany as any).mockResolvedValue([
      { id: 20, name: 'Comisionista Sur', isCommissionAgent: true, outstandingBalance: 0 },
    ]);

    const commissionList = await personaService.getPersonas(1, Role.ADMIN, undefined, 'commission_agent');
    expect(commissionList).toHaveLength(1);
    expect(prisma.persona.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isCommissionAgent: true },
      }),
    );

    vi.clearAllMocks();
    (prisma.persona.findMany as any).mockResolvedValue([
      { id: 30, name: 'Autoservicio Centro', isClient: true, outstandingBalance: 0 },
    ]);

    const clients = await personaService.getPersonas(1, Role.ADMIN, undefined, 'client');
    expect(clients).toEqual([
      expect.objectContaining({ id: 30, pendingInvoicesCount: 0 }),
    ]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
