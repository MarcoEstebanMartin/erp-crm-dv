import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';
import prisma from '../../utils/prisma';
import * as auditModule from '../../utils/audit';
import { transactionAdminService } from '../finance/transaction-admin.service';

describe('transactionAdminService.verifyTransaction (Auditoría de Conciliación)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('graba verifiedById, verifiedAt y logAudit al conciliar una transferencia', async () => {
    const logSpy = vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
    const txUpdateArgs: any[] = [];

    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
      id: 101,
      userId: 5,
      personaId: 22,
      orderId: null,
      billingType: BillingType.INTERNAL,
      type: TransactionType.INCOME,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amount: '15000.00',
      bankAccountId: 2,
      verified: false,
    } as any);

    const mockTx: any = {
      bankAccount: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        update: vi.fn().mockImplementation((args) => {
          txUpdateArgs.push(args);
          return Promise.resolve({
            id: 101,
            amount: '15000.00',
            bankAccountId: 2,
            verified: args.data.verified,
            verifiedById: args.data.verifiedById,
            verifiedAt: args.data.verifiedAt,
            verifiedBy: { id: 9, username: 'Gemini' },
          });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await transactionAdminService.verifyTransaction({
      userId: 9,
      txId: 101,
      verified: true,
    });

    expect(txUpdateArgs).toHaveLength(1);
    expect(txUpdateArgs[0].data.verified).toBe(true);
    expect(txUpdateArgs[0].data.verifiedById).toBe(9);
    expect(txUpdateArgs[0].data.verifiedAt).toBeInstanceOf(Date);
    expect(txUpdateArgs[0].include.verifiedBy).toEqual({ select: { id: true, username: true } });
    expect(result.verifiedBy).toEqual({ id: 9, username: 'Gemini' });
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 9,
        action: 'VERIFY_BANK_TRANSFER',
        entityType: 'Transaction',
        entityId: 101,
      }),
    );
  });

  it('limpia verifiedById y verifiedAt al desconciliar una transferencia', async () => {
    vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
    const txUpdateArgs: any[] = [];

    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue({
      id: 102,
      userId: 5,
      personaId: 22,
      orderId: null,
      billingType: BillingType.INTERNAL,
      type: TransactionType.INCOME,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      amount: '15000.00',
      bankAccountId: 2,
      verified: true,
    } as any);

    const mockTx: any = {
      bankAccount: {
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        update: vi.fn().mockImplementation((args) => {
          txUpdateArgs.push(args);
          return Promise.resolve({
            id: 102,
            amount: '15000.00',
            bankAccountId: 2,
            verified: false,
            verifiedById: null,
            verifiedAt: null,
            verifiedBy: null,
          });
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    const result = await transactionAdminService.verifyTransaction({
      userId: 9,
      txId: 102,
      verified: false,
    });

    expect(txUpdateArgs[0].data.verified).toBe(false);
    expect(txUpdateArgs[0].data.verifiedById).toBeNull();
    expect(txUpdateArgs[0].data.verifiedAt).toBeNull();
    expect(result.verifiedBy).toBeNull();
  });
});
