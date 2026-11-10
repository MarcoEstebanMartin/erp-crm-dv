import { toDecimal, roundToIntegerPeso } from '../core/money';

export type BillingType = 'INTERNAL' | 'OFFICIAL';
export type LedgerBranchFilter = 'ALL' | 'OFFICIAL' | 'INTERNAL';

export interface AccountLedgerEntryRecord {
  id: number;
  customerId: string;
  customerName: string;
  customerCity: string;
  sellerName: string;
  type: 'DEBIT' | 'CREDIT';
  billingType: BillingType;
  reference: string;
  description: string;
  amount: number;
  createdAt: string;
}

export interface RunningLedgerRow extends AccountLedgerEntryRecord {
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerBalanceSummary {
  customerId: string;
  officialBalance: number;
  internalBalance: number;
  totalBalance: number;
}

export interface DebtorByCityItem {
  customerId: string;
  customerName: string;
  city: string;
  sellerName: string;
  officialBalance: number;
  internalBalance: number;
  totalBalance: number;
}

/**
 * Construye el libro mayor cronológico de un cliente (Debe, Haber, Saldo Acumulado)
 * aplicando Decimal.js y permitiendo filtrar por Todos, Sucursal A (OFFICIAL) o Sucursal X (INTERNAL).
 */
export function buildCustomerRunningLedger(
  entries: AccountLedgerEntryRecord[],
  branchFilter: LedgerBranchFilter = 'ALL',
): {
  rows: RunningLedgerRow[];
  officialBalance: number;
  internalBalance: number;
  totalBalance: number;
} {
  let officialDec = toDecimal(0);
  let internalDec = toDecimal(0);

  const sorted = [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);

  for (const e of sorted) {
    const amt = roundToIntegerPeso(e.amount);
    const signed = e.type === 'DEBIT' ? amt : amt.negated();
    if (e.billingType === 'OFFICIAL') {
      officialDec = officialDec.plus(signed);
    } else {
      internalDec = internalDec.plus(signed);
    }
  }

  const filtered = sorted.filter((e) => {
    if (branchFilter === 'ALL') return true;
    return e.billingType === branchFilter;
  });

  let runningDec = toDecimal(0);
  const rows: RunningLedgerRow[] = filtered.map((e) => {
    const amt = roundToIntegerPeso(e.amount);
    const debit = e.type === 'DEBIT' ? amt.toNumber() : 0;
    const credit = e.type === 'CREDIT' ? amt.toNumber() : 0;
    runningDec = runningDec.plus(debit).minus(credit);

    return {
      ...e,
      debit,
      credit,
      runningBalance: runningDec.toNumber(),
    };
  });

  return {
    rows,
    officialBalance: officialDec.toNumber(),
    internalBalance: internalDec.toNumber(),
    totalBalance: officialDec.plus(internalDec).toNumber(),
  };
}

/**
 * Calcula los saldos de todos los clientes y devuelve la planilla de Deudores por Ruta / Localidad.
 */
export function computeDebtorsReport(
  entries: AccountLedgerEntryRecord[],
  options?: {
    sellerFilter?: string;
    branchFilter?: LedgerBranchFilter;
    cities?: string[];
  },
): {
  debtors: DebtorByCityItem[];
  totalOfficial: number;
  totalInternal: number;
  grandTotal: number;
} {
  const byCustomer = new Map<
    string,
    {
      customerName: string;
      city: string;
      sellerName: string;
      officialDec: ReturnType<typeof toDecimal>;
      internalDec: ReturnType<typeof toDecimal>;
    }
  >();

  for (const e of entries) {
    const amt = roundToIntegerPeso(e.amount);
    const signed = e.type === 'DEBIT' ? amt : amt.negated();
    const curr = byCustomer.get(e.customerId) ?? {
      customerName: e.customerName,
      city: e.customerCity || 'GENERAL VILLEGAS',
      sellerName: e.sellerName || 'OFICINA',
      officialDec: toDecimal(0),
      internalDec: toDecimal(0),
    };

    if (e.billingType === 'OFFICIAL') {
      curr.officialDec = curr.officialDec.plus(signed);
    } else {
      curr.internalDec = curr.internalDec.plus(signed);
    }
    byCustomer.set(e.customerId, curr);
  }

  let totalOffDec = toDecimal(0);
  let totalIntDec = toDecimal(0);
  const debtors: DebtorByCityItem[] = [];

  for (const [customerId, data] of byCustomer.entries()) {
    if (
      options?.sellerFilter &&
      options.sellerFilter !== 'ALL' &&
      data.sellerName !== options.sellerFilter
    ) {
      continue;
    }
    if (options?.cities && options.cities.length > 0 && !options.cities.includes(data.city)) {
      continue;
    }

    const officialBalance = data.officialDec.toNumber();
    const internalBalance = data.internalDec.toNumber();
    const totalBalance = data.officialDec.plus(data.internalDec).toNumber();

    const activeBalance =
      options?.branchFilter === 'OFFICIAL'
        ? officialBalance
        : options?.branchFilter === 'INTERNAL'
          ? internalBalance
          : totalBalance;

    if (activeBalance > 0) {
      totalOffDec = totalOffDec.plus(officialBalance);
      totalIntDec = totalIntDec.plus(internalBalance);
      debtors.push({
        customerId,
        customerName: data.customerName,
        city: data.city,
        sellerName: data.sellerName,
        officialBalance,
        internalBalance,
        totalBalance,
      });
    }
  }

  debtors.sort((a, b) => a.city.localeCompare(b.city) || b.totalBalance - a.totalBalance);

  return {
    debtors,
    totalOfficial: totalOffDec.toNumber(),
    totalInternal: totalIntDec.toNumber(),
    grandTotal: totalOffDec.plus(totalIntDec).toNumber(),
  };
}
