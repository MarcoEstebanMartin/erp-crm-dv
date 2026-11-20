import {
  type CategoryStatItem,
  type ComparisonRow,
  type Expense,
  type ExpensePeriod,
  shiftMonth,
} from './gastos.types';

export function pickDefaultComparePeriod(
  targetYear: number,
  targetMonth: number,
  periods: ExpensePeriod[],
): { year: number; month: number } {
  const prev = shiftMonth(targetYear, targetMonth, -1);
  const targetKey = targetYear * 100 + targetMonth;
  if (periods.some((p) => p.year === prev.year && p.month === prev.month)) {
    return prev;
  }

  const latestBefore = periods.find((p) => p.year * 100 + p.month < targetKey);
  if (latestBefore) return { year: latestBefore.year, month: latestBefore.month };

  const anyOther = periods.find((p) => p.year * 100 + p.month !== targetKey);
  if (anyOther) return { year: anyOther.year, month: anyOther.month };

  return prev;
}

export function buildExpenseDateForPeriod(year: number, month: number): string {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    return new Date(year, month - 1, now.getDate(), 12, 0, 0).toISOString();
  }
  return new Date(year, month - 1, 1, 12, 0, 0).toISOString();
}

export function buildComparisonRows(params: {
  expenses: Expense[];
  compareExpenses: Expense[];
  filterCategoryId: string;
  searchQuery: string;
}): ComparisonRow[] {
  const compareMap = new Map<
    string,
    { amount: number; description: string; categoryId: number; categoryName: string; paymentMethod: string }
  >();

  for (const exp of params.compareExpenses) {
    const key = exp.description.trim().toLowerCase();
    const amt = Math.round(Number(exp.amount));
    const existing = compareMap.get(key);
    if (existing) {
      existing.amount += amt;
    } else {
      compareMap.set(key, {
        amount: amt,
        description: exp.description.trim(),
        categoryId: exp.categoryId,
        categoryName: exp.category?.name || 'General',
        paymentMethod: exp.paymentMethod || 'CASH',
      });
    }
  }

  const rows: ComparisonRow[] = [];
  const matchedKeys = new Set<string>();

  for (const exp of params.expenses) {
    const key = exp.description.trim().toLowerCase();
    const cmp = !matchedKeys.has(key) ? compareMap.get(key) : undefined;
    if (cmp) matchedKeys.add(key);

    rows.push({
      rowKey: `exp-${exp.id}`,
      description: exp.description.trim(),
      categoryId: exp.categoryId,
      categoryName: exp.category?.name || 'General',
      compareAmount: cmp ? cmp.amount : null,
      currentAmount: Math.round(Number(exp.amount)),
      currentExpense: exp,
      comparePaymentMethod: exp.paymentMethod || 'CASH',
    });
  }

  for (const [key, cmp] of compareMap.entries()) {
    if (matchedKeys.has(key)) continue;
    rows.push({
      rowKey: `cmp-${key}`,
      description: cmp.description,
      categoryId: cmp.categoryId,
      categoryName: cmp.categoryName,
      compareAmount: cmp.amount,
      currentAmount: null,
      currentExpense: null,
      comparePaymentMethod: cmp.paymentMethod,
    });
  }

  const q = params.searchQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (params.filterCategoryId && row.categoryId !== Number(params.filterCategoryId)) return false;
    if (q && !row.description.toLowerCase().includes(q) && !row.categoryName.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

export function buildCategoryStats(expenses: Expense[], totalGasto: number): CategoryStatItem[] {
  const totals: Record<string, { amount: number; description: string | null }> = {};
  for (const e of expenses) {
    const catName = e.category?.name || 'General';
    if (!totals[catName]) {
      totals[catName] = { amount: 0, description: e.category?.description || null };
    }
    totals[catName].amount += Math.round(Number(e.amount));
  }
  return Object.keys(totals)
    .map((name) => ({
      name,
      amount: totals[name].amount,
      pct: totalGasto > 0 ? (totals[name].amount / totalGasto) * 100 : 0,
      description: totals[name].description,
    }))
    .sort((a, b) => b.amount - a.amount);
}
