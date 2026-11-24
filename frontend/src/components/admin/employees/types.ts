export interface EmployeeAdvanceRecord {
  id: number;
  employeeId: number;
  amount: number | string;
  date: string;
  reason?: string | null;
  status: string;
  paymentMethod: string;
  cashDrawerId?: number | null;
  bankAccountId?: number | null;
  cashDrawer?: { id: number; branch?: string | null; status?: string } | null;
  bankAccount?: { id: number; name: string } | null;
}

export interface EmployeeVacationRecord {
  id: number;
  employeeId: number;
  year: number;
  tramo: number;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
  comments?: string | null;
}

export interface EmployeeRecord {
  id: number;
  firstName: string;
  lastName: string;
  dni: string;
  cuil?: string | null;
  position: string;
  employmentType: 'DEPENDENCIA' | 'MONOTRIBUTISTA' | string;
  vacationDaysPerYear: number;
  hireDate: string;
  isActive: boolean;
  advances: EmployeeAdvanceRecord[];
  vacations: EmployeeVacationRecord[];
  monthlyAdvancesTotal?: number;
}

export interface OpenCashDrawerOption {
  id: number;
  branch?: string | null;
  status?: string;
}

export interface BankAccountOption {
  id: number;
  name: string;
  balance?: number | string;
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export function formatDateAr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatMoneyAr(val: number | string | null | undefined): string {
  const n = Math.round(Number(val) || 0);
  return `$${n.toLocaleString('es-AR')}`;
}
