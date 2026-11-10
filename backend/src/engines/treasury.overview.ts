import { roundToIntegerPeso, toDecimal } from '../core/money';
import type { BillingType } from './treasury.engine';

export interface BankAccountRecord {
  id: number;
  name: string;
  accountNumber: string;
  balance: number;
}

export interface CashDrawerRecord {
  id: number;
  name: string;
  responsible: string;
  drawerType: 'OPERATIVE' | 'CENTRAL';
  status: 'OPEN' | 'CLOSED';
  openingBalance: number;
  expectedBalance: number;
  realBalance: number;
  openedAt: string;
  closedAt: string | null;
}

export interface TreasuryTransactionRecord {
  id: number;
  type: 'INCOME' | 'OUTCOME';
  category: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';
  billingType: BillingType;
  amount: number;
  description: string;
  customerId: string | null;
  customerName: string | null;
  bankAccountId: number | null;
  cashDrawerId: number | null;
  checkNumber: string | null;
  checkIssuer: string | null;
  createdAt: string;
}

export interface CajaGrandeMovementItem {
  id: string;
  createdAt: string;
  type: 'INGRESO' | 'EGRESO';
  responsible: string;
  paymentMethodLabel: string;
  amount: number;
  drawerId: number | null;
  receiptCount: number;
}

export interface KpiBreakdownMovementItem {
  id: string;
  createdAt: string;
  type: 'INGRESO' | 'EGRESO';
  origin: string;
  description: string;
  paymentMethodLabel: string;
  amount: number;
}

export function buildTreasuryOverviewData(params: {
  banks: BankAccountRecord[];
  drawers: CashDrawerRecord[];
  transactions: TreasuryTransactionRecord[];
  fromDate?: string;
  toDate?: string;
}) {
  const { banks, drawers, transactions, fromDate, toDate } = params;

  const startMs = fromDate ? new Date(`${fromDate}T00:00:00.000`).getTime() : 0;
  const endMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : Number.MAX_SAFE_INTEGER;

  const inRange = (iso: string): boolean => {
    const t = new Date(iso).getTime();
    return t >= startMs && t <= endMs;
  };

  const periodTxs = transactions.filter((t) => inRange(t.createdAt));

  let cashIncomeDec = toDecimal(0);
  let checkIncomeDec = toDecimal(0);
  let transferIncomeDec = toDecimal(0);
  let totalExpensesDec = toDecimal(0);

  const cashItems: KpiBreakdownMovementItem[] = [];
  const checkItems: KpiBreakdownMovementItem[] = [];
  const transferItems: KpiBreakdownMovementItem[] = [];
  const expenseItems: KpiBreakdownMovementItem[] = [];

  for (const t of periodTxs) {
    const amt = roundToIntegerPeso(t.amount);
    if (t.type === 'INCOME') {
      if (t.paymentMethod === 'CASH') {
        cashIncomeDec = cashIncomeDec.plus(amt);
        cashItems.push({
          id: `tx-${t.id}`,
          createdAt: t.createdAt,
          type: 'INGRESO',
          origin: t.customerName || 'Caja Operativa',
          description: t.description,
          paymentMethodLabel: 'EFECTIVO',
          amount: amt.toNumber(),
        });
      } else if (t.paymentMethod === 'CHECK') {
        checkIncomeDec = checkIncomeDec.plus(amt);
        checkItems.push({
          id: `tx-${t.id}`,
          createdAt: t.createdAt,
          type: 'INGRESO',
          origin: t.customerName || t.checkIssuer || 'Cartera de Cheques',
          description: t.description,
          paymentMethodLabel: `CHEQUE ${t.checkNumber ?? ''}`.trim(),
          amount: amt.toNumber(),
        });
      } else if (t.paymentMethod === 'BANK_TRANSFER') {
        transferIncomeDec = transferIncomeDec.plus(amt);
        const bank = banks.find((b) => b.id === t.bankAccountId);
        transferItems.push({
          id: `tx-${t.id}`,
          createdAt: t.createdAt,
          type: 'INGRESO',
          origin: bank ? bank.name : 'Transferencia Bancaria',
          description: t.description,
          paymentMethodLabel: 'TRANSFERENCIA',
          amount: amt.toNumber(),
        });
      }
    } else {
      totalExpensesDec = totalExpensesDec.plus(amt);
      expenseItems.push({
        id: `tx-${t.id}`,
        createdAt: t.createdAt,
        type: 'EGRESO',
        origin:
          t.category === 'EXPENSE_FLEET'
            ? 'Flota / Combustible'
            : 'Gastos Generales (Tesorería)',
        description: t.description,
        paymentMethodLabel: t.paymentMethod === 'CASH' ? 'EFECTIVO' : 'TRANSFERENCIA',
        amount: amt.toNumber(),
      });
    }
  }

  const netBalanceDec = cashIncomeDec
    .plus(checkIncomeDec)
    .plus(transferIncomeDec)
    .minus(totalExpensesDec);
  const netItems: KpiBreakdownMovementItem[] = [
    ...cashItems,
    ...checkItems,
    ...transferItems,
    ...expenseItems,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const cajaGrandeMovements: CajaGrandeMovementItem[] = periodTxs
    .filter((t) => t.paymentMethod === 'CASH' || t.paymentMethod === 'CHECK')
    .map((t) => ({
      id: `cg-tx-${t.id}`,
      createdAt: t.createdAt,
      type: t.type === 'INCOME' ? ('INGRESO' as const) : ('EGRESO' as const),
      responsible:
        t.type === 'INCOME'
          ? t.customerName
            ? `Cobro: ${t.customerName}`
            : 'Caja Mostrador / Reparto'
          : `Gasto: ${t.description}`,
      paymentMethodLabel: t.paymentMethod === 'CASH' ? 'Efectivo' : 'Cheque',
      amount: roundToIntegerPeso(t.amount).toNumber(),
      drawerId: t.cashDrawerId,
      receiptCount: t.type === 'INCOME' ? 1 : 0,
    }));

  const cajaCentralBalance = roundToIntegerPeso(
    drawers.reduce((acc, d) => acc.plus(d.realBalance), toDecimal(0)),
  ).toNumber();

  return {
    kpis: {
      cajaCentralBalance,
      cashIncome: cashIncomeDec.toNumber(),
      transferIncome: transferIncomeDec.toNumber(),
      checkIncome: checkIncomeDec.toNumber(),
      totalExpenses: totalExpensesDec.toNumber(),
      netBalance: netBalanceDec.toNumber(),
    },
    breakdowns: {
      cash: cashItems,
      checks: checkItems,
      transfers: transferItems,
      expenses: expenseItems,
      net: netItems,
    },
    cajaGrandeMovements,
    banks: banks.map((b) => ({
      ...b,
      balance: roundToIntegerPeso(b.balance).toNumber(),
    })),
    drawers,
    transactions: periodTxs.slice(0, 100),
  };
}
