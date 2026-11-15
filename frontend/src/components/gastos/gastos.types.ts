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

export const AVAILABLE_YEARS = [2026, 2025, 2024] as const;

export const getMonthName = (m: number): string => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return months[m - 1] || '';
};

export const getMethodLabel = (method: string): string => {
  switch (method) {
    case 'CASH': return 'Efectivo';
    case 'BANK_TRANSFER': return 'Transf. Bancaria';
    case 'CHECK': return 'Cheque';
    default: return method;
  }
};
