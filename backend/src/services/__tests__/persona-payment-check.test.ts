import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethod } from '@prisma/client';

const { prismaMock, recordLedgerMovementMock, assertCollectionAllowedMock, logAuditMock } = vi.hoisted(() => ({
  prismaMock: {
    persona: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  recordLedgerMovementMock: vi.fn(),
  assertCollectionAllowedMock: vi.fn(),
  logAuditMock: vi.fn(),
}));

vi.mock('../../utils/prisma', () => ({ default: prismaMock }));
vi.mock('../ledger/account-ledger.service', () => ({
  recordLedgerMovement: recordLedgerMovementMock,
}));
vi.mock('../collections/collection-guard.service', () => ({
  assertCollectionAllowed: assertCollectionAllowedMock,
}));
vi.mock('../../utils/audit', () => ({
  logAudit: logAuditMock,
}));

import { personaPaymentSubService } from '../personas/persona-payment.service';

describe('personaPaymentSubService — cobros con cheque físico y eCheq', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.persona.findUnique.mockResolvedValue({
      id: 10,
      name: 'MASSA JUAN CARLOS',
      isClient: true,
      isProvider: false,
      sellerId: 2,
    });
    assertCollectionAllowedMock.mockResolvedValue(undefined);
    recordLedgerMovementMock.mockResolvedValue({
      updatedPersona: { id: 10, outstandingBalance: 0 },
    });
    logAuditMock.mockResolvedValue(undefined);
  });

  it('registra eCheq con detalle estructurado, verified=false y sin acreditar banco hasta conciliar', async () => {
    const txMock = {
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 3 }),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: 801, amount: 50000 }),
      },
      persona: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 10, outstandingBalance: 0 }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb(txMock));

    await personaPaymentSubService.recordPersonaPayment(
      10,
      {
        amount: 50000,
        paymentMethod: PaymentMethod.CHECK,
        checkNumber: '98765432',
        checkBank: 'Banco Nación',
        checkDueDate: '2026-12-15',
        isEcheq: true,
      },
      1,
      'ADMIN',
    );

    expect(txMock.bankAccount.update).not.toHaveBeenCalled();
    expect(txMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.CHECK,
          verified: false,
          description:
            'Cobro en cuenta corriente de MASSA JUAN CARLOS - Cheque N° 98765432 (Echeq) · Banco: Banco Nación · Vto: 2026-12-15',
        }),
      }),
    );
  });

  it('registra cheque físico con detalle estructurado y verified=true', async () => {
    const txMock = {
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 3 }),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: 802, amount: 25000 }),
      },
      persona: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 10, outstandingBalance: 0 }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb(txMock));

    await personaPaymentSubService.recordPersonaPayment(
      10,
      {
        amount: 25000,
        paymentMethod: PaymentMethod.CHECK,
        checkNumber: '11223344',
        checkBank: 'Banco Provincia',
        isEcheq: false,
        description: 'Entrega en oficina',
      },
      1,
      'ADMIN',
    );

    expect(txMock.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { balance: { increment: 25000 } },
    });
    expect(txMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMethod: PaymentMethod.CHECK,
          verified: true,
          description: 'Entrega en oficina - Cheque N° 11223344 · Banco: Banco Provincia',
        }),
      }),
    );
  });
});
