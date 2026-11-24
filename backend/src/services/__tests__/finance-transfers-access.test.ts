import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethod, TransactionType } from '@prisma/client';

const { prismaMock, logAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    transaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bankAccount: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  logAuditMock: vi.fn(),
}));

vi.mock('../../utils/prisma', () => ({ default: prismaMock }));
vi.mock('../../utils/audit', () => ({ logAudit: logAuditMock }));

import {
  isBankReconcilableTransaction,
  transactionAdminService,
} from '../finance/transaction-admin.service';

describe('Permisos y aislamiento de transferencias para Facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconoce únicamente ingresos por transferencia bancaria o eCheq como conciliables', () => {
    expect(
      isBankReconcilableTransaction({
        type: TransactionType.INCOME,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        description: 'Cobro transferencia',
      }),
    ).toBe(true);

    expect(
      isBankReconcilableTransaction({
        type: TransactionType.INCOME,
        paymentMethod: PaymentMethod.CHECK,
        description: 'Pago cliente (eCheq)',
      }),
    ).toBe(true);

    expect(
      isBankReconcilableTransaction({
        type: TransactionType.OUTCOME,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        description: 'Pago a proveedor',
      }),
    ).toBe(false);

    expect(
      isBankReconcilableTransaction({
        type: TransactionType.INCOME,
        paymentMethod: PaymentMethod.CASH,
        description: 'Cobro en efectivo',
      }),
    ).toBe(false);
  });

  it('filtra solo transferencias/eCheqs y oculta saldo bancario cuando se solicita modo seguro', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 10,
        type: TransactionType.INCOME,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        amount: 25000,
        bankAccount: { id: 1, name: 'Mercado Pago', balance: 980000 },
      },
    ]);

    const result = await transactionAdminService.getTransactions(
      {},
      { onlyBankReconcilable: true, maskBankBalance: true },
    );

    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: TransactionType.INCOME,
          OR: expect.arrayContaining([
            { paymentMethod: PaymentMethod.BANK_TRANSFER },
          ]),
        }),
      }),
    );
    expect(result[0].bankAccount?.balance).toBe(0);
  });

  it('bloquea con 403 si FACTURACION intenta verificar un gasto o movimiento en efectivo', async () => {
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 44,
      type: TransactionType.OUTCOME,
      paymentMethod: PaymentMethod.CASH,
      description: 'Gasto flete',
      fieldReceipt: null,
    });

    await expect(
      transactionAdminService.verifyTransaction({
        userId: 7,
        actorRole: 'FACTURACION',
        txId: 44,
        verified: true,
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Solo podés conciliar transferencias bancarias o eCheqs.',
    });
  });

  it('permite a FACTURACION verificar una transferencia y enmascara el saldo bancario en la respuesta', async () => {
    const baseTx = {
      id: 55,
      type: TransactionType.INCOME,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      description: 'Transferencia cliente',
      amount: 15000,
      verified: false,
      personaId: null,
      orderId: null,
      billingType: 'INTERNAL',
      bankAccountId: 2,
      fieldReceipt: null,
    };
    prismaMock.transaction.findUnique.mockResolvedValue(baseTx);
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const txClient = {
        transaction: {
          findUnique: vi.fn().mockResolvedValue(baseTx),
          update: vi.fn().mockResolvedValue({
            ...baseTx,
            verified: true,
            verifiedById: 7,
            bankAccount: { id: 2, name: 'Galicia', balance: 1250000 },
          }),
        },
        bankAccount: {
          update: vi.fn().mockResolvedValue({ id: 2, balance: 1265000 }),
        },
      };
      return cb(txClient);
    });

    const updated = await transactionAdminService.verifyTransaction({
      userId: 7,
      actorRole: 'FACTURACION',
      txId: 55,
      verified: true,
      bankAccountId: 2,
    });

    expect(updated.verified).toBe(true);
    expect(updated.bankAccount?.balance).toBe(0);
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        action: 'VERIFY_BANK_TRANSFER',
        entityId: 55,
      }),
    );
  });
});
