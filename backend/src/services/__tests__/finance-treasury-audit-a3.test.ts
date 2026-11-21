import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BillingType,
  PaymentMethod,
  Role,
  TransactionType,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import * as afipService from '../afip.service';
import * as auditModule from '../../utils/audit';
import { rendicionService } from '../collections/rendicion.service';
import { DirectInvoiceService } from '../directInvoice.service';
import { settleOrderFinancials } from '../orders/order-tax.helpers';
import { transactionAdminService } from '../finance/transaction-admin.service';
import { payrollService } from '../hr/payroll.service';

describe('Paso A3 — Blindaje Rendiciones, Caja Grande, Bancos, Mostrador y RRHH', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(auditModule, 'logAudit').mockResolvedValue(undefined as any);
  });

  it('verifyRendicion evita doble contabilización en Caja Grande cuando deriva efectivo a destinationDrawerId y acredita cheques a banco', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 7,
      username: 'Gemini Ventas',
    } as any);
    vi.spyOn(prisma.transaction, 'findMany').mockResolvedValue([
      {
        id: 1,
        movementId: 101,
        receiptNumber: 'REC-00101',
        paymentMethod: PaymentMethod.CASH,
        amount: '50000.00',
        createdAt: new Date(),
        bankAccountId: null,
        persona: { id: 1, name: 'Cliente A', phone: null },
      },
      {
        id: 2,
        movementId: 102,
        receiptNumber: 'REC-00102',
        paymentMethod: PaymentMethod.CHECK,
        amount: '30000.00',
        createdAt: new Date(),
        bankAccountId: 1,
        persona: { id: 2, name: 'Cliente B', phone: null },
      },
    ] as any);

    const drawerCreateSpy = vi.fn().mockResolvedValue({ id: 99 });
    const bankUpdateSpy = vi.fn().mockResolvedValue({});
    const mockTx: any = {
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
        update: bankUpdateSpy,
      },
      cashDrawer: { create: drawerCreateSpy },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: 500 }),
        update: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await rendicionService.verifyRendicion({
      adminId: 1,
      sellerId: 7,
      realCash: 50000,
      realChecks: 30000,
      destinationDrawerId: 10,
      hostOrigin: 'http://localhost:3000',
    });

    // Efectivo fue a caja destino #10 y cheque se acreditó al banco #1 => realBalance en drawer de rendición = 0
    expect(drawerCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          realBalance: 0,
        }),
      }),
    );
    expect(bankUpdateSpy).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { balance: { increment: 30000 } },
    });
  });

  it('DirectInvoiceService rechaza cobro CASH sin Caja abierta ANTES de llamar a AFIP', async () => {
    vi.spyOn(prisma.persona, 'findUnique').mockResolvedValue({
      id: 5,
      name: 'Cliente Mostrador',
      cuit: null,
      priceList: 'A',
      discount: 0,
      outstandingBalance: 0,
      maxUnpaidInvoices: 0,
      iibbAliquot: 0,
    } as any);
    vi.spyOn(prisma.product, 'findMany').mockResolvedValue([
      {
        id: 10,
        name: 'Queso',
        isPesable: false,
        listPrice: 10000,
        priceA: 10000,
        costPrice: 5000,
        stock: 50,
      },
    ] as any);
    vi.spyOn(prisma.discountRule, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.weeklyPromo, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.cashDrawer, 'findFirst').mockResolvedValue(null);

    const afipSpy = vi.spyOn(afipService, 'emitirFacturaAFIP');

    await expect(
      DirectInvoiceService.createDirectInvoice({
        adminId: 1,
        userRole: Role.ADMIN,
        personaId: 5,
        billingType: BillingType.OFFICIAL,
        paymentMethod: PaymentMethod.CASH,
        items: [{ productId: 10, quantity: 1 }],
      }),
    ).rejects.toThrow(/Caja Oficina abierta/i);

    expect(afipSpy).not.toHaveBeenCalled();
  });

  it('settleOrderFinancials acredita BankAccount.balance en cobro inmediato con cheque físico (verified=true)', async () => {
    const bankUpdateSpy = vi.fn().mockResolvedValue({});
    const mockTx: any = {
      persona: { update: vi.fn().mockResolvedValue({ id: 5, outstandingBalance: '0.00' }) },
      accountLedger: { create: vi.fn().mockResolvedValue({ id: 1 }) },
      transaction: { create: vi.fn().mockResolvedValue({ id: 77 }) },
      bankAccount: { update: bankUpdateSpy },
    };

    await settleOrderFinancials(mockTx, {
      orderId: 30,
      personaId: 5,
      adminId: 1,
      billingType: BillingType.INTERNAL,
      paymentMethod: PaymentMethod.CHECK,
      amount: 25000,
      invoiceTotal: 25000,
      invoiceNumber: 'INT-00030',
      description: 'Cobro cheque físico Banco Provincia',
      bankAccountId: 3,
    });

    expect(bankUpdateSpy).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { balance: { increment: 25000 } },
    });
  });

  it('verifyTransaction adquiere lock FOR UPDATE y lee la transacción fresca dentro de $transaction', async () => {
    const sampleTx = {
      id: 90,
      type: TransactionType.INCOME,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      billingType: BillingType.OFFICIAL,
      amount: '15000.00',
      verified: false,
      bankAccountId: 2,
      personaId: 4,
      orderId: null,
      fieldReceipt: null,
    };
    vi.spyOn(prisma.transaction, 'findUnique').mockResolvedValue(sampleTx as any);
    const queryRawSpy = vi.fn().mockResolvedValue([]);
    const mockTx: any = {
      $queryRaw: queryRawSpy,
      transaction: {
        findUnique: vi.fn().mockResolvedValue(sampleTx),
        update: vi.fn().mockResolvedValue({ id: 90, verified: true, amount: 15000 }),
      },
      bankAccount: { update: vi.fn().mockResolvedValue({}) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(mockTx));

    await transactionAdminService.verifyTransaction({
      userId: 1,
      txId: 90,
      verified: true,
    });

    expect(queryRawSpy).toHaveBeenCalledTimes(1);
    expect(mockTx.transaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 90 } }),
    );
  });

  it('payrollService rechaza cajas cerradas y preserva el saldo remanente en deducciones parciales de adelantos', async () => {
    vi.spyOn(prisma.employee, 'findUnique').mockResolvedValue({
      id: 4,
      firstName: 'Juan',
      lastName: 'Pérez',
      baseSalary: 500000,
      commissionRate: 0,
      userId: null,
    } as any);
    vi.spyOn(prisma.payroll, 'findUnique').mockResolvedValue(null);

    const closedTx: any = {
      cashDrawer: { findUnique: vi.fn().mockResolvedValue({ id: 11, status: 'CLOSED' }) },
    };
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb(closedTx));

    await expect(
      payrollService.createPayroll({
        employeeId: 4,
        periodMonth: 11,
        periodYear: 2026,
        baseSalary: 500000,
        cashDrawerId: 11,
        actorUserId: 1,
      }),
    ).rejects.toThrow(/cerrada/i);

    const advUpdateSpy = vi.fn().mockResolvedValue({});
    const advCreateSpy = vi.fn().mockResolvedValue({});
    const partialTx: any = {
      payroll: { create: vi.fn().mockResolvedValue({ id: 80 }) },
      salaryAdvance: {
        findMany: vi.fn().mockResolvedValue([
          { id: 15, amount: '100000.00', date: new Date('2026-11-05') },
        ]),
        update: advUpdateSpy,
        create: advCreateSpy,
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (cb: any) => cb(partialTx));

    await payrollService.createPayroll({
      employeeId: 4,
      periodMonth: 11,
      periodYear: 2026,
      baseSalary: 500000,
      advancesDeduction: 40000,
      actorUserId: 1,
    });

    expect(advUpdateSpy).toHaveBeenCalledWith({
      where: { id: 15 },
      data: { amount: 40000, status: 'DEDUCTED', payrollId: 80 },
    });
    expect(advCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employeeId: 4,
          amount: 60000,
          status: 'PENDING',
        }),
      }),
    );
  });
});
