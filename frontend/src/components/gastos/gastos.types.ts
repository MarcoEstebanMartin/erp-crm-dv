export interface ExpenseCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface Expense {
  id: number;
  amount: string;
  date: string;
  description: string;
  categoryId: number;
  category: ExpenseCategory;
  paymentMethod: string;
  cashDrawerId: number | null;
  bankAccountId: number | null;
  vehicleId: number | null;
  vehicle?: { id: number; plate: string; brand: string; model: string } | null;
  user: { id: number; username: string };
  transaction?: any;
}

export interface ExpensePeriod {
  year: number;
  month: number;
  count: number;
  total: number;
}

export interface ComparisonRow {
  rowKey: string;
  description: string;
  categoryId: number;
  categoryName: string;
  compareAmount: number | null;
  currentAmount: number | null;
  currentExpense: Expense | null;
  comparePaymentMethod: string;
}

export interface CopySourceExpenseItem {
  id: number;
  selected: boolean;
  amount: string;
  description: string;
  categoryId: number;
  categoryName: string;
  paymentMethod: string;
  bankAccountId?: number;
  vehicleId?: number;
}

export interface CategoryStatItem {
  name: string;
  amount: number;
  pct: number;
  description: string | null;
}

export const AVAILABLE_YEARS = [2027, 2026, 2025, 2024] as const;

export const getMonthName = (m: number): string => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return months[m - 1] || '';
};

export const getShortMonthName = (m: number): string => {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[m - 1] || '';
};

export const getMethodLabel = (method: string): string => {
  switch (method) {
    case 'CASH': return 'Caja Grande';
    case 'BANK_TRANSFER': return 'Transferencia';
    case 'CHECK': return 'Cheque';
    default: return method;
  }
};

export const formatPeso = (value: number): string => {
  const rounded = Math.round(value);
  return `$${rounded.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
};

export const formatDiffPeso = (diff: number): string => {
  const rounded = Math.round(diff);
  if (rounded === 0) return '—';
  const sign = rounded > 0 ? '+' : '-';
  return `${sign}$${Math.abs(rounded).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
};

export const shiftMonth = (year: number, month: number, delta: number): { year: number; month: number } => {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};
