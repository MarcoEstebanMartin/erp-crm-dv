import { describe, it, expect } from 'vitest';
import {
  buildCustomerRunningLedger,
  computeDebtorsReport,
  type AccountLedgerEntryRecord,
} from './treasury.engine';
import { buildTreasuryOverviewData } from './treasury.overview';

describe('LedgerEngine (004-cuentas-corrientes-tesoreria)', () => {
  const sampleEntries: AccountLedgerEntryRecord[] = [
    {
      id: 1,
      customerId: 'cli-1',
      customerName: 'SUPERMERCADO EL SOL',
      customerCity: 'GENERAL VILLEGAS',
      sellerName: 'DIEGO LEJARZA',
      type: 'DEBIT',
      billingType: 'OFFICIAL',
      reference: 'A-0004-00001001',
      description: 'Factura Oficial A',
      amount: 150000,
      createdAt: '2026-11-01T10:00:00.000Z',
    },
    {
      id: 2,
      customerId: 'cli-1',
      customerName: 'SUPERMERCADO EL SOL',
      customerCity: 'GENERAL VILLEGAS',
      sellerName: 'DIEGO LEJARZA',
      type: 'DEBIT',
      billingType: 'INTERNAL',
      reference: 'X-0001-00001002',
      description: 'Presupuesto X',
      amount: 80000,
      createdAt: '2026-11-02T10:00:00.000Z',
    },
    {
      id: 3,
      customerId: 'cli-1',
      customerName: 'SUPERMERCADO EL SOL',
      customerCity: 'GENERAL VILLEGAS',
      sellerName: 'DIEGO LEJARZA',
      type: 'CREDIT',
      billingType: 'OFFICIAL',
      reference: 'REC-000101',
      description: 'Recibo Transferencia Banco Provincia',
      amount: 50000,
      createdAt: '2026-11-03T10:00:00.000Z',
    },
  ];

  it('verifica invariante de partida doble: Saldo Total == Suma(Debe) - Suma(Haber) == Sucursal A + Sucursal X', () => {
    const all = buildCustomerRunningLedger(sampleEntries, 'ALL');
    expect(all.officialBalance).toBe(100000);
    expect(all.internalBalance).toBe(80000);
    expect(all.totalBalance).toBe(180000);
    expect(all.rows[all.rows.length - 1]!.runningBalance).toBe(180000);

    const onlyOfficial = buildCustomerRunningLedger(sampleEntries, 'OFFICIAL');
    expect(onlyOfficial.rows).toHaveLength(2);
    expect(onlyOfficial.rows[1]!.runningBalance).toBe(100000);
  });

  it('agrupa deudores por localidad con desglose exacto por sucursal', () => {
    const report = computeDebtorsReport(sampleEntries);
    expect(report.debtors).toHaveLength(1);
    expect(report.totalOfficial).toBe(100000);
    expect(report.totalInternal).toBe(80000);
    expect(report.grandTotal).toBe(180000);
  });

  it('calcula Finanzas General por período con invariante: Recaudación Neta == Efectivo + Cheques + Transferencias - Gastos', () => {
    const overview = buildTreasuryOverviewData({
      banks: [{ id: 1, name: 'Mercado Pago', accountNumber: '0000031', balance: 390000 }],
      drawers: [
        {
          id: 1,
          name: 'Caja Mostrador Villegas',
          responsible: 'Admin',
          drawerType: 'OPERATIVE',
          status: 'OPEN',
          openingBalance: 100000,
          expectedBalance: 310000,
          realBalance: 310000,
          openedAt: '2026-11-07T08:00:00.000Z',
          closedAt: null,
        },
      ],
      transactions: [
        {
          id: 1,
          type: 'INCOME',
          category: 'RECEIPT',
          paymentMethod: 'CASH',
          billingType: 'INTERNAL',
          amount: 245000,
          description: 'Cobro Efectivo',
          customerId: 'cli-1',
          customerName: 'SUPERMERCADO EL SOL',
          bankAccountId: null,
          cashDrawerId: 1,
          checkNumber: null,
          checkIssuer: null,
          createdAt: '2026-11-07T10:00:00.000Z',
        },
        {
          id: 2,
          type: 'INCOME',
          category: 'RECEIPT',
          paymentMethod: 'BANK_TRANSFER',
          billingType: 'OFFICIAL',
          amount: 390000,
          description: 'Cobro Transferencia',
          customerId: 'cli-1',
          customerName: 'SUPERMERCADO EL SOL',
          bankAccountId: 1,
          cashDrawerId: null,
          checkNumber: null,
          checkIssuer: null,
          createdAt: '2026-11-07T11:00:00.000Z',
        },
        {
          id: 3,
          type: 'OUTCOME',
          category: 'EXPENSE_FLEET',
          paymentMethod: 'CASH',
          billingType: 'INTERNAL',
          amount: 35000,
          description: 'Carga Gasoil Reparto',
          customerId: null,
          customerName: null,
          bankAccountId: null,
          cashDrawerId: 1,
          checkNumber: null,
          checkIssuer: null,
          createdAt: '2026-11-07T12:00:00.000Z',
        },
      ],
      fromDate: '2026-11-01',
      toDate: '2026-11-07',
    });

    expect(overview.kpis.cashIncome).toBe(245000);
    expect(overview.kpis.transferIncome).toBe(390000);
    expect(overview.kpis.checkIncome).toBe(0);
    expect(overview.kpis.totalExpenses).toBe(35000);
    expect(overview.kpis.netBalance).toBe(600000);
    expect(overview.kpis.cajaCentralBalance).toBe(310000);
    expect(overview.breakdowns.net).toHaveLength(3);
  });
});
