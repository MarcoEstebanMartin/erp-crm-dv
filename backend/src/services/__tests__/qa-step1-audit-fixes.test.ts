import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PaymentAllocationService } from '../finance/payment-allocation.service';

describe('QA Paso 1 — Blindaje de Imputaciones Factura A (pesos enteros) y RBAC', () => {
  it('Factura A con total fiscal con centavos (138689.39) pagada en peso entero (138689) queda 100% PAID sin centavos fantasma', async () => {
    const service = new PaymentAllocationService();

    const mockDb: any = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 80,
          invoiceNumber: '00001-00000001',
          billingType: 'OFFICIAL',
          invoiceType: 'FACTURA_A',
          status: 'DELIVERED',
          totalAmount: '138689.39',
          createdAt: new Date('2026-11-15T22:47:00Z'),
          paymentAllocations: [{ amount: '138689' }],
          creditNotes: [],
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 80,
            invoiceNumber: '00001-00000001',
            billingType: 'OFFICIAL',
            invoiceType: 'FACTURA_A',
            status: 'DELIVERED',
            totalAmount: '138689.39',
            createdAt: new Date('2026-11-15T22:47:00Z'),
            paymentAllocations: [{ amount: '138689' }],
            creditNotes: [],
          },
        ]),
      },
      transaction: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 2,
            amount: '138689',
            paymentAllocations: [{ amount: '138689' }],
          },
        ]),
      },
      paymentAllocation: {
        createMany: vi.fn(),
      },
    };

    const pendingSingle = await service.getOrderPendingAmount(80, mockDb);
    expect(pendingSingle).toBe(0);

    const receivables = await service.getClientPendingInvoicesWithAllocations(8728, mockDb);
    expect(receivables.invoices).toHaveLength(0);
    expect(receivables.totalPendingOnInvoices).toBe(0);
    expect(receivables.netBalance).toBe(0);
  });

  it('allocateTransactionToOrders imputa contra el total redondeado al peso entero (242027.50 -> 242028)', async () => {
    const service = new PaymentAllocationService();
    const createMany = vi.fn().mockResolvedValue({ count: 1 });

    const mockDb: any = {
      order: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 58,
            invoiceNumber: '00001-00000010',
            totalAmount: '242027.50',
            paymentAllocations: [],
            creditNotes: [],
          },
        ]),
      },
      transaction: { findMany: vi.fn() },
      paymentAllocation: { createMany },
    };

    const plan = await service.allocateTransactionToOrders(mockDb, {
      transactionId: 99,
      personaId: 8802,
      amount: 242028,
    });

    expect(plan.totalAllocated).toBe(242028);
    expect(plan.unallocatedCredit).toBe(0);
    expect(plan.allocations).toHaveLength(1);
    expect(plan.allocations[0].newPending).toBe(0);
    expect(plan.allocations[0].newStatus).toBe('PAID');
    expect(createMany).toHaveBeenCalledTimes(1);
  });

  it('RBAC: crm.routes.ts y persona.routes.ts restringen alertas CRM, ledger y facturas pendientes a roles autorizados', () => {
    const crmRoutes = fs.readFileSync(
      path.resolve(__dirname, '../../routes/crm.routes.ts'),
      'utf8',
    );
    const personaRoutes = fs.readFileSync(
      path.resolve(__dirname, '../../routes/persona.routes.ts'),
      'utf8',
    );

    expect(crmRoutes).toMatch(/requireRole\(\[Role\.ADMIN,\s*Role\.FACTURACION,\s*Role\.VENDEDOR\]\)/);
    expect(personaRoutes).toMatch(
      /router\.get\('\/:id\/ledger',\s*authenticateJWT,\s*requireRoleOrPermission\(\[Role\.ADMIN,\s*Role\.FACTURACION,\s*Role\.VENDEDOR\],\s*'canDeliver'\)/,
    );
    expect(personaRoutes).toMatch(
      /router\.get\('\/:id\/pending-invoices',\s*authenticateJWT,\s*requireRoleOrPermission\(\[Role\.ADMIN,\s*Role\.FACTURACION,\s*Role\.VENDEDOR\],\s*'canDeliver'\)/,
    );
  });
});
