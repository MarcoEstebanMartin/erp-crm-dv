import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTx, mockPrisma } = vi.hoisted(() => {
  const tx = {
    cashDrawer: { findUnique: vi.fn() },
    expenseCategory: { findUnique: vi.fn(), create: vi.fn() },
    transaction: { create: vi.fn() },
    bankAccount: { update: vi.fn() },
    expense: { create: vi.fn() },
    salaryAdvance: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    payroll: { create: vi.fn() },
    offerCampaignItem: { upsert: vi.fn() },
  };

  const prisma = {
    employee: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    salaryAdvance: { findMany: vi.fn() },
    payroll: { findUnique: vi.fn(), findMany: vi.fn() },
    order: { aggregate: vi.fn() },
    offerCampaign: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    offerCampaignItem: { upsert: vi.fn(), delete: vi.fn() },
    product: { findMany: vi.fn() },
    productLot: { findMany: vi.fn() },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };

  return { mockTx: tx, mockPrisma: prisma };
});

vi.mock('../../utils/prisma', () => ({ default: mockPrisma }));
vi.mock('../../utils/audit', () => ({ logAudit: vi.fn() }));

import { employeeService, SAFE_EMPLOYEE_USER_SELECT } from '../hr/employee.service';
import { salaryAdvanceService } from '../hr/salary-advance.service';
import { payrollService, computePayrollBreakdown } from '../hr/payroll.service';
import { offerItemService } from '../offers/offer-item.service';
import { offerRecommendationsService } from '../offers/offer-recommendations.service';
import { offerAnalyticsService } from '../offers/offer-analytics.service';

describe('HR & Offers Services (Decimal.js, Atomic Tx & Sanitized User Selects)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes Employee user select and never exposes passwordHash', async () => {
    expect(SAFE_EMPLOYEE_USER_SELECT).toEqual({
      id: true,
      username: true,
      role: true,
      isActive: true,
    });
    expect('passwordHash' in SAFE_EMPLOYEE_USER_SELECT).toBe(false);

    mockPrisma.employee.findUnique.mockResolvedValue({ id: 7, firstName: 'Ana' });
    await employeeService.getEmployeeById(7);

    expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        include: expect.objectContaining({
          user: { select: SAFE_EMPLOYEE_USER_SELECT },
        }),
      }),
    );
  });

  it('rounds baseSalary with Decimal.js and rejects duplicate DNI on createEmployee', async () => {
    mockPrisma.employee.findUnique.mockResolvedValueOnce({ id: 1, dni: '30111222' });
    await expect(
      employeeService.createEmployee({
        firstName: 'Juan',
        lastName: 'Perez',
        dni: '30111222',
        position: 'Vendedor',
        hireDate: '2026-01-10',
        baseSalary: '850000.556',
      }),
    ).rejects.toThrow('Ya existe un empleado registrado con ese DNI');

    mockPrisma.employee.findUnique.mockResolvedValueOnce(null);
    mockPrisma.employee.create.mockImplementation(async ({ data }: any) => ({ id: 2, ...data }));

    const created = await employeeService.createEmployee({
      firstName: 'Juan',
      lastName: 'Perez',
      dni: '30999888',
      position: 'Vendedor',
      hireDate: '2026-01-10',
      baseSalary: '850000.556',
    });

    expect(created.baseSalary).toBe(850000.56);
  });

  it('executes createAdvance atomically inside prisma.$transaction and decrements bank balance', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 5, firstName: 'Luis', lastName: 'Gomez' });
    mockTx.expenseCategory.findUnique.mockResolvedValue({ id: 10, name: 'Sueldos' });
    mockTx.transaction.create.mockResolvedValue({ id: 99 });
    mockTx.salaryAdvance.create.mockImplementation(async ({ data }: any) => ({ id: 44, ...data }));

    const result = await salaryAdvanceService.createAdvance({
      employeeId: 5,
      amount: '25000.455',
      bankAccountId: 3,
      paymentMethod: 'BANK_TRANSFER',
      actorUserId: 1,
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { balance: { decrement: 25000.46 } },
    });
    expect(mockTx.expense.create).toHaveBeenCalledTimes(1);
    expect(result.amount).toBe(25000.46);
    expect(result.transactionId).toBe(99);
  });

  it('calculates seller 1.5% commission in integer pesos and sanitizes user select in calculatePayroll', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({
      id: 8,
      userId: 12,
      position: 'Vendedor Preventa',
      baseSalary: 600000,
    });
    mockPrisma.salaryAdvance.findMany.mockResolvedValue([
      { id: 1, amount: '50000.10' },
      { id: 2, amount: '24999.90' },
    ]);
    mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalAmount: 1033300 } });

    const calc = await payrollService.calculatePayroll({
      employeeId: '8',
      periodMonth: '10',
      periodYear: '2026',
    });

    expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
      where: { id: 8 },
      include: { user: { select: SAFE_EMPLOYEE_USER_SELECT } },
    });
    expect(calc.suggestedCommissions).toBe(15500);
    expect(calc.totalAdvances).toBe(75000);
    expect(calc.grossSalary).toBe(615500);
    expect(calc.netSalary).toBe(540500);
  });

  it('pays payroll and deducts pending advances FIFO atomically inside prisma.$transaction', async () => {
    const breakdown = computePayrollBreakdown({
      baseSalary: '700000.10',
      commissions: '50000.20',
      advancesDeduction: 40000,
    });
    expect(breakdown.grossSalary.toNumber()).toBe(750000.3);
    expect(breakdown.netSalary.toNumber()).toBe(710000.3);

    mockPrisma.employee.findUnique.mockResolvedValue({ id: 9, firstName: 'Mia', lastName: 'Paz' });
    mockPrisma.payroll.findUnique.mockResolvedValue(null);
    mockTx.expenseCategory.findUnique.mockResolvedValue({ id: 10, name: 'Sueldos' });
    mockTx.transaction.create.mockResolvedValue({ id: 201 });
    mockTx.payroll.create.mockImplementation(async ({ data }: any) => ({ id: 301, ...data }));
    mockTx.salaryAdvance.findMany.mockResolvedValue([
      { id: 11, amount: 25000 },
      { id: 12, amount: 15000 },
      { id: 13, amount: 30000 },
    ]);

    const payroll = await payrollService.createPayroll({
      employeeId: 9,
      periodMonth: 11,
      periodYear: 2026,
      baseSalary: 700000,
      advancesDeduction: 40000,
      bankAccountId: 2,
    });

    expect(payroll.status).toBe('PAID');
    expect(payroll.netSalary).toBe(660000);
    expect(mockTx.bankAccount.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { balance: { decrement: 660000 } },
    });
    expect(mockTx.salaryAdvance.update).toHaveBeenCalledTimes(2);
  });

  it('rounds offer prices to integer pesos and computes exact Decimal comparison & expiring discounts', async () => {
    mockTx.offerCampaignItem.upsert.mockImplementation(async ({ create }: any) => create);
    const items = await offerItemService.addBulkCampaignItems(4, [
      { productId: 101, offerPrice: '1599.5', previousPrice: '1899.4' },
    ]);
    expect(items[0].offerPrice).toBe(1600);
    expect(items[0].previousPrice).toBe(1899);

    const soon = new Date();
    soon.setDate(soon.getDate() + 10);
    mockPrisma.offerCampaign.findMany.mockResolvedValueOnce([{ id: 1, title: 'Semana 1' }]);
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 50, sku: 'M1', name: 'QUESO SARDO MELINCUE', stock: 10, minStock: 2, listPrice: 1005, unitsPerBox: 1, lots: [{ expirationDate: soon }] },
    ]);
    const recs = await offerRecommendationsService.getWeeklyOfferRecommendations({ week: 'auto' });
    expect(recs.detectedWeekNumber).toBe(2);
    expect(recs.recommendationsByGroup.MELINCUE[0].suggestedPrice).toBe(905);

    mockPrisma.offerCampaign.findMany.mockResolvedValueOnce([{ id: 2, title: 'Nueva' }, { id: 1, title: 'Base' }]);
    mockPrisma.offerCampaign.findUnique
      .mockResolvedValueOnce({ id: 1, title: 'Base', items: [{ productId: 50, offerPrice: 1000, product: { name: 'MELINCUE SARDO', sku: 'M1', stock: 5 } }] })
      .mockResolvedValueOnce({ id: 2, title: 'Nueva', items: [{ productId: 50, offerPrice: 1155, product: { name: 'MELINCUE SARDO', sku: 'M1', stock: 5 } }] });

    const cmp = await offerAnalyticsService.getCampaignComparison({});
    expect(cmp.comparisonByGroup.MELINCUE[0].priceDiff).toBe(155);
    expect(cmp.comparisonByGroup.MELINCUE[0].priceDiffPercent).toBe(15.5);
    expect(cmp.comparisonByGroup.MELINCUE[0].status).toBe('INCREASE');
  });
});
