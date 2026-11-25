import { afterEach, describe, expect, it, vi } from 'vitest';
import { BillingType, PaymentMethod, Role, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import { receiptService } from '../collections/receipt.service';

describe('receiptService.voidReceipt y getReceipt (soft-void auditable)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseReceipt = {
    id: 979,
    personaId: 45,
    orderId: null,
    type: TransactionType.INCOME,
    billingType: BillingType.INTERNAL,
    amount: '79726.00',
    receiptNumber: 'REC-00979',
    verificationCode: 'DV-TEST-0979',
    paymentMethod: PaymentMethod.CASH,
    verified: false,
    bankAccountId: null,
    cashDrawerId: 10,
    cashDrawer: { id: 10, status: 'OPEN' },
    fieldReceipt: null,
    createdAt: new Date('2026-11-25T13:00:00.000Z'), // 10:00 AR
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    persona: { id: 45, name: 'BECERRA LAURA NOEMI' },
  };

  it('exige motivo obligatorio de al menos 5 caracteres', async () => {
    await expect(
      receiptService.voidReceipt({
        adminId: 2,
        userRole: Role.FACTURACION,
        receiptId: 979,
        reason: 'mal',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('bloquea a FACTURACION si el recibo es de un día anterior (Opción 1)', async () => {
    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(baseReceipt as any);

    await expect(
      receiptService.voidReceipt({
        adminId: 2,
        userRole: Role.FACTURACION,
        receiptId: 979,
        reason: 'Cliente equivocado en cobranza',
        now: new Date('2026-11-26T13:00:00.000Z'), // día siguiente AR
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('bloquea a FACTURACION si la caja asociada ya está cerrada', async () => {
    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
      ...baseReceipt,
      cashDrawer: { id: 10, status: 'CLOSED' },
    } as any);

    await expect(
      receiptService.voidReceipt({
        adminId: 2,
        userRole: Role.FACTURACION,
        receiptId: 979,
        reason: 'Error de importe al cargar',
        now: new Date('2026-11-25T18:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('permite a FACTURACION anular un recibo del mismo día sin verificar y deja rastro en AuditLog', async () => {
    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(baseReceipt as any);

    const mockTx: any = {
      persona: {
        update: vi.fn().mockResolvedValue({ id: 45, outstandingBalance: '79726.00' }),
      },
      accountLedger: {
        create: vi.fn().mockResolvedValue({ id: 501 }),
      },
      paymentAllocation: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      transaction: {
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await receiptService.voidReceipt({
      adminId: 2,
      userRole: Role.FACTURACION,
      receiptId: 979,
      reason: 'Era transferencia, se cargó como efectivo',
      now: new Date('2026-11-25T18:00:00.000Z'),
    });

    expect(result.receiptLabel).toBe('REC-00979');
    expect(result.amountToRestore).toBe(79726);
    expect(mockTx.transaction.delete).not.toHaveBeenCalled();
    expect(mockTx.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 979 },
        data: expect.objectContaining({
          voidedById: 2,
          voidReason: 'Era transferencia, se cargó como efectivo',
        }),
      }),
    );
    expect(mockTx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'VOID_COLLECTION_RECEIPT',
          entityId: 979,
        }),
      }),
    );
  });

  it('getReceipt público devuelve authenticity.status = VOIDED cuando el recibo está anulado', async () => {
    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
      ...baseReceipt,
      voidedAt: new Date('2026-11-25T18:00:00.000Z'),
      voidedById: 2,
      voidReason: 'Error interno de carga',
      voidedBy: { id: 2, username: 'facturacion1' },
      user: { id: 2, username: 'facturacion1' },
    } as any);

    const publicView = await receiptService.getReceipt(979, {
      token: 'DV-TEST-0979',
      isAuthenticatedStaff: false,
    });

    expect(publicView.isVoided).toBe(true);
    expect(publicView.authenticity.verified).toBe(false);
    expect(publicView.authenticity.status).toBe('VOIDED');
    expect(publicView.voidReason).toBeUndefined();
    expect(publicView.voidedBy).toBeUndefined();
  });
});
