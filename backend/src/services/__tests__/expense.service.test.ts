import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentMethod, TransactionType } from '@prisma/client';

const { mockTx, mockPrisma, mockLogAudit } = vi.hoisted(() => {
  const tx = {
    bankAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    cashDrawer: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      update: vi.fn(),
    },
    expense: {
      create: vi.fn(),
      update: vi.fn(),
    },
    expenseCategory: {
      findMany: vi.fn(),
    },
    vehicleMaintenance: {
      create: vi.fn(),
    },
    vehicle: {
      update: vi.fn(),
    },
  };

  return {
    mockTx: tx,
    mockPrisma: {
      expense: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      vehicle: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    },
    mockLogAudit: vi.fn(),
  };
});

vi.mock('../../utils/prisma', () => ({
  default: mockPrisma,
}));

vi.mock('../../utils/audit', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

import { expenseService } from '../expenses/expense.service';
import { createBulkExpensesRecords } from '../expenses/expense-bulk.service';
import { vehicleMaintenanceService } from '../fleet/vehicle-maintenance.service';

describe('expenseService & expense-bulk.service — Caja Grande y edición atómica', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updateExpense actualiza monto en peso entero y sincroniza la transacción de Caja Grande', async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({
      id: 10,
      amount: '1200000.00',
      description: 'Luz',
      categoryId: 2,
      date: new Date('2026-11-01T12:00:00Z'),
      transactionId: 501,
      transaction: {
        id: 501,
        amount: '1200000.00',
        cashDrawerId: null,
        bankAccountId: null,
      },
      category: { id: 2, name: 'Servicios' },
    });

    mockTx.transaction.update.mockResolvedValue({ id: 501, amount: 1500000 });
    mockTx.expense.update.mockResolvedValue({
      id: 10,
      amount: 1500000,
      description: 'Luz depósito',
      categoryId: 2,
    });

    const res = await expenseService.updateExpense({
      userId: 1,
      expenseId: 10,
      amount: 1499999.6, // redondea a 1500000 (ROUND_HALF_UP)
      description: 'Luz depósito',
    });

    expect(res.amount).toBe(1500000);
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
    expect(mockTx.transaction.update).toHaveBeenCalledWith({
      where: { id: 501 },
      data: {
        amount: 1500000,
        description: 'Gasto: Luz depósito',
      },
    });
    expect(mockTx.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          amount: 1500000,
          description: 'Luz depósito',
        }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_EXPENSE',
        entityId: 10,
      }),
    );
  });

  it('updateExpense ajusta el saldo bancario por el delta exacto al subir o bajar el gasto', async () => {
    // Caso 1: sube de 500.000 a 650.000 -> decrementa 150.000 del banco
    mockPrisma.expense.findUnique.mockResolvedValue({
      id: 11,
      amount: '500000.00',
      description: 'Seguro',
      categoryId: 6,
      date: new Date('2026-11-01T12:00:00Z'),
      transactionId: 502,
      transaction: {
        id: 502,
        amount: '500000.00',
        cashDrawerId: null,
        bankAccountId: 7,
      },
      category: { id: 6, name: 'Seguros' },
    });
    mockTx.expense.update.mockResolvedValue({ id: 11, amount: 650000 });

    await expenseService.updateExpense({ userId: 1, expenseId: 11, amount: 650000 });
    expect(mockTx.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { balance: { decrement: 150000 } },
    });

    vi.clearAllMocks();

    // Caso 2: baja de 650.000 a 400.000 -> incrementa (devuelve) 250.000 al banco
    mockPrisma.expense.findUnique.mockResolvedValue({
      id: 11,
      amount: '650000.00',
      description: 'Seguro',
      categoryId: 6,
      date: new Date('2026-11-01T12:00:00Z'),
      transactionId: 502,
      transaction: {
        id: 502,
        amount: '650000.00',
        cashDrawerId: null,
        bankAccountId: 7,
      },
      category: { id: 6, name: 'Seguros' },
    });
    mockTx.expense.update.mockResolvedValue({ id: 11, amount: 400000 });

    await expenseService.updateExpense({ userId: 1, expenseId: 11, amount: 400000 });
    expect(mockTx.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { balance: { increment: 250000 } },
    });
  });

  it('updateExpense sobre gasto histórico sin transacción no crea egresos duplicados', async () => {
    mockPrisma.expense.findUnique.mockResolvedValue({
      id: 12,
      amount: '100000.00',
      description: 'Claro',
      categoryId: 2,
      date: new Date('2026-05-08T12:00:00Z'),
      transactionId: null,
      transaction: null,
      category: { id: 2, name: 'Servicios' },
    });
    mockTx.expense.update.mockResolvedValue({ id: 12, amount: 120000 });

    await expenseService.updateExpense({ userId: 1, expenseId: 12, amount: 120000 });

    expect(mockTx.transaction.update).not.toHaveBeenCalled();
    expect(mockTx.transaction.create).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
    expect(mockTx.expense.update).toHaveBeenCalledTimes(1);
  });

  it('updateExpense rechaza gasto inexistente o monto <= 0', async () => {
    mockPrisma.expense.findUnique.mockResolvedValue(null);
    await expect(
      expenseService.updateExpense({ userId: 1, expenseId: 999, amount: 5000 }),
    ).rejects.toThrow('Gasto no encontrado.');

    mockPrisma.expense.findUnique.mockResolvedValue({
      id: 12,
      amount: '100000.00',
      description: 'Claro',
      categoryId: 2,
      date: new Date('2026-05-08T12:00:00Z'),
      transactionId: null,
      transaction: null,
    });
    await expect(
      expenseService.updateExpense({ userId: 1, expenseId: 12, amount: 0 }),
    ).rejects.toThrow('El monto debe ser un número mayor a cero.');
  });

  it('createBulkExpensesRecords descuenta de Caja Grande (cashDrawerId: null) al copiar gastos en efectivo', async () => {
    mockTx.transaction.create.mockResolvedValue({ id: 801 });
    mockTx.expense.create.mockResolvedValue({
      id: 901,
      amount: 25100000,
      description: 'Sueldos',
      transactionId: 801,
    });

    const created = await createBulkExpensesRecords({
      userId: 1,
      targetDate: '2026-11-01',
      expenses: [
        {
          amount: 25100000.4,
          categoryId: 1,
          description: 'Sueldos',
          paymentMethod: PaymentMethod.CASH,
        },
      ],
    });

    expect(created).toHaveLength(1);
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1,
        type: TransactionType.OUTCOME,
        paymentMethod: PaymentMethod.CASH,
        amount: 25100000,
        cashDrawerId: null,
        verified: true,
        description: 'Gasto: Sueldos',
      }),
    });
    expect(mockTx.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 25100000,
          transactionId: 801,
          cashDrawerId: undefined,
        }),
      }),
    );
  });

  it('getExpensePeriods agrupa por mes/año en pesos enteros ordenados del más reciente al más antiguo', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { date: new Date(2026, 4, 8), amount: '1200000.00' },
      { date: new Date(2026, 4, 8), amount: '800000.00' },
      { date: new Date(2026, 10, 1), amount: '1500000.00' },
    ]);

    const periods = await expenseService.getExpensePeriods();
    expect(periods).toEqual([
      { year: 2026, month: 11, count: 1, total: 1500000 },
      { year: 2026, month: 5, count: 2, total: 2000000 },
    ]);
  });

  it('vehicleMaintenanceService.createMaintenance sincroniza automáticamente en Expense sin duplicar Transaction', async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({
      id: 4,
      plate: 'AE123CD',
      currentOdometer: 50000,
    });
    mockTx.transaction.create.mockResolvedValue({ id: 777 });
    mockTx.vehicleMaintenance.create.mockResolvedValue({ id: 88, cost: 185000 });
    mockTx.expenseCategory.findMany.mockResolvedValue([
      { id: 5, name: 'Combustible' },
      { id: 7, name: 'Mantenimiento' },
    ]);
    mockTx.expense.create.mockResolvedValue({ id: 999 });

    await vehicleMaintenanceService.createMaintenance({
      userId: 1,
      vehicleId: 4,
      type: 'FUEL',
      description: 'Carga YPF',
      cost: 185000,
      odometer: 50420,
      affectFinance: true,
      paymentMethod: PaymentMethod.CASH,
    });

    expect(mockTx.transaction.create).toHaveBeenCalledTimes(1);
    expect(mockTx.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 185000,
        description: 'AE123CD - Carga YPF',
        categoryId: 5,
        vehicleId: 4,
        transactionId: 777,
      }),
    });
  });

  it('vehicleMaintenanceService.createMaintenance respeta CAJA_OFICINA y categoryId personalizada', async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({
      id: 4,
      plate: 'AE123CD',
      currentOdometer: 50000,
    });
    mockTx.cashDrawer.findFirst.mockResolvedValue({ id: 42, status: 'OPEN', drawerType: 'DEPOSITO' });
    mockTx.transaction.create.mockResolvedValue({ id: 778 });
    mockTx.vehicleMaintenance.create.mockResolvedValue({ id: 89, cost: 95000 });
    mockTx.expense.create.mockResolvedValue({ id: 1000 });

    await vehicleMaintenanceService.createMaintenance({
      userId: 1,
      vehicleId: 4,
      type: 'OTHER',
      description: 'Seguro mensual',
      cost: 95000,
      odometer: 50000,
      affectFinance: true,
      paymentMethod: PaymentMethod.CASH,
      cashSource: 'CAJA_OFICINA',
      categoryId: 6,
    });

    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 95000,
        cashDrawerId: 42,
        paymentMethod: PaymentMethod.CASH,
      }),
    });
    expect(mockTx.expense.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 95000,
        categoryId: 6,
        cashDrawerId: 42,
        vehicleId: 4,
        transactionId: 778,
      }),
    });
  });

  it('vehicleMaintenanceService.createMaintenance lanza error si se elige CAJA_OFICINA y no hay caja abierta', async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({
      id: 4,
      plate: 'AE123CD',
      currentOdometer: 50000,
    });
    mockTx.cashDrawer.findFirst.mockResolvedValue(null);

    await expect(
      vehicleMaintenanceService.createMaintenance({
        userId: 1,
        vehicleId: 4,
        type: 'REPAIR',
        description: 'Cambio de cubierta',
        cost: 120000,
        odometer: 50100,
        affectFinance: true,
        paymentMethod: PaymentMethod.CASH,
        cashSource: 'CAJA_OFICINA',
      }),
    ).rejects.toThrow('No hay una Caja Oficina abierta.');
  });
});
