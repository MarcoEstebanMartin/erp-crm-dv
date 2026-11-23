import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api, API_BASE_URL } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import {
  type ComparisonRow,
  type Expense,
  type ExpenseCategory,
  type ExpensePeriod,
  shiftMonth,
} from './gastos.types';
import {
  buildCategoryStats,
  buildComparisonRows,
  buildExpenseDateForPeriod,
  pickDefaultComparePeriod,
} from './gastosComparison.utils';
import { useGastosBulkActions } from './useGastosBulkActions';

export function useGastosController() {
  const confirm = useConfirm();
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const initialPrev = shiftMonth(now.getFullYear(), now.getMonth() + 1, -1);
  const [compareYear, setCompareYear] = useState<number>(initialPrev.year);
  const [compareMonth, setCompareMonth] = useState<number>(initialPrev.month);
  const [compareManuallySet, setCompareManuallySet] = useState(false);

  const [activeTab, setActiveTab] = useState<'planilla' | 'categorias'>('planilla');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'GENERAL' | 'RODADO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [compareExpenses, setCompareExpenses] = useState<Expense[]>([]);
  const [periods, setPeriods] = useState<ExpensePeriod[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [savedRowKey, setSavedRowKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);
  const initializedRef = useRef(false);

  const notifySuccess = (msg: string, ms = 3000) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), ms);
  };

  const markRowSaved = (rowKey: string) => {
    setSavedRowKey(rowKey);
    setTimeout(() => setSavedRowKey((prev) => (prev === rowKey ? null : prev)), 1500);
  };

  const fetchPeriods = useCallback(async (): Promise<ExpensePeriod[]> => {
    try {
      const list = (await api.getExpensePeriods()) || [];
      setPeriods(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  const fetchExpensesForBoth = useCallback(
    async (curY: number, curM: number, cmpY: number, cmpM: number) => {
      const seq = ++fetchSeqRef.current;
      try {
        const [curList, cmpList] = await Promise.all([
          api.getExpensesList({ year: curY, month: curM }),
          api.getExpensesList({ year: cmpY, month: cmpM }),
        ]);
        if (seq !== fetchSeqRef.current) return;
        setExpenses(curList || []);
        setCompareExpenses(cmpList || []);
      } catch {
        if (seq !== fetchSeqRef.current) return;
        setErrorMsg('Error al obtener los gastos del período.');
      }
    },
    [],
  );

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const [cats, fetchedPeriods] = await Promise.all([
          api.getExpenseCategories().catch(() => []),
          fetchPeriods(),
        ]);
        setCategories(cats || []);
        api.getBankAccounts().then((b) => setBankAccounts(b || [])).catch(() => {});
        fetch(`${API_BASE_URL}/fleet/vehicles`, { credentials: 'include' })
          .then((r) => r.text())
          .then((t) => {
            const json = t?.trim() ? JSON.parse(t) : {};
            if (json.status === 'success') setVehicles(json.data.vehicles || []);
          })
          .catch(() => {});

        const picked = pickDefaultComparePeriod(selectedYear, selectedMonth, fetchedPeriods);
        setCompareYear(picked.year);
        setCompareMonth(picked.month);
        await fetchExpensesForBoth(selectedYear, selectedMonth, picked.year, picked.month);
        initializedRef.current = true;
      } catch {
        setErrorMsg('Error al cargar la información inicial.');
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;
    fetchExpensesForBoth(selectedYear, selectedMonth, compareYear, compareMonth);
  }, [selectedYear, selectedMonth, compareYear, compareMonth, fetchExpensesForBoth]);

  const navigateMonth = (delta: number) => {
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
    if (!compareManuallySet) {
      const picked = pickDefaultComparePeriod(next.year, next.month, periods);
      setCompareYear(picked.year);
      setCompareMonth(picked.month);
    }
  };

  const setComparePeriod = (year: number, month: number) => {
    setCompareManuallySet(true);
    setCompareYear(year);
    setCompareMonth(month);
  };

  const refreshAll = async () => {
    await Promise.all([
      fetchExpensesForBoth(selectedYear, selectedMonth, compareYear, compareMonth),
      fetchPeriods(),
    ]);
  };

  const handleInlineSaveAmount = async (row: ComparisonRow, newAmt: number) => {
    const rounded = Math.round(newAmt);
    if (isNaN(rounded) || rounded <= 0) return;
    if (row.currentExpense && Math.round(Number(row.currentExpense.amount)) === rounded) return;

    setSavingRowKey(row.rowKey);
    setErrorMsg(null);
    try {
      if (row.currentExpense) {
        const updated = await api.updateExpenseNew(row.currentExpense.id, { amount: rounded });
        setExpenses((prev) =>
          prev.map((e) => (e.id === row.currentExpense!.id ? { ...e, ...updated, amount: String(updated.amount ?? rounded) } : e)),
        );
      } else {
        await api.createExpenseNew({
          amount: rounded,
          categoryId: row.categoryId,
          description: row.description,
          date: buildExpenseDateForPeriod(selectedYear, selectedMonth),
          paymentMethod: 'CASH',
          cashSource: 'CAJA_GRANDE',
          billingType: 'INTERNAL',
        });
        await refreshAll();
      }
      markRowSaved(row.rowKey);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo guardar el monto.');
    } finally {
      setSavingRowKey(null);
    }
  };

  const handleQuickCopyRow = async (row: ComparisonRow) => {
    if (!row.compareAmount || row.compareAmount <= 0 || row.currentExpense) return;
    await handleInlineSaveAmount(row, row.compareAmount);
  };

  const handleQuickAddRow = async (params: { description: string; categoryId: number; amount: number }) => {
    const cleanDesc = params.description.trim();
    const rounded = Math.round(params.amount);
    if (!cleanDesc) return setErrorMsg('Ingresá un concepto.');
    if (isNaN(rounded) || rounded <= 0) return setErrorMsg('Ingresá un monto mayor a 0.');
    const resolvedCatId = params.categoryId || categories[0]?.id;
    if (!resolvedCatId) return setErrorMsg('No hay categorías disponibles.');

    setSavingRowKey('__quick_add__');
    setErrorMsg(null);
    try {
      await api.createExpenseNew({
        amount: rounded,
        categoryId: resolvedCatId,
        description: cleanDesc,
        date: buildExpenseDateForPeriod(selectedYear, selectedMonth),
        paymentMethod: 'CASH',
        cashSource: 'CAJA_GRANDE',
        billingType: 'INTERNAL',
      });
      await refreshAll();
      notifySuccess(`Gasto "${cleanDesc}" registrado en Caja Grande.`);
      return true;
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar el gasto.');
      return false;
    } finally {
      setSavingRowKey(null);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!(await confirm('¿Eliminar este gasto? Se revertirá el movimiento en Caja Grande o Banco.', { type: 'danger' }))) return;
    setErrorMsg(null);
    try {
      await api.deleteExpenseNew(id);
      notifySuccess('Gasto eliminado.');
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar el gasto.');
    }
  };

  const matchesScope = useCallback(
    (e: Expense) => {
      const isVehicle = Boolean(e.vehicleId || e.vehicle);
      if (scopeFilter === 'RODADO') return isVehicle;
      if (scopeFilter === 'GENERAL') return !isVehicle;
      return true;
    },
    [scopeFilter],
  );

  const filteredExpenses = useMemo(() => expenses.filter(matchesScope), [expenses, matchesScope]);
  const filteredCompareExpenses = useMemo(() => compareExpenses.filter(matchesScope), [compareExpenses, matchesScope]);

  const comparisonRows = useMemo(
    () =>
      buildComparisonRows({
        expenses: filteredExpenses,
        compareExpenses: filteredCompareExpenses,
        filterCategoryId,
        searchQuery,
      }),
    [filteredExpenses, filteredCompareExpenses, filterCategoryId, searchQuery],
  );

  const missingRows = useMemo(
    () => comparisonRows.filter((r) => !r.currentExpense && r.compareAmount && r.compareAmount > 0),
    [comparisonRows],
  );

  const bulk = useGastosBulkActions({
    selectedYear,
    selectedMonth,
    compareYear,
    compareMonth,
    initialCopyYear: initialPrev.year,
    initialCopyMonth: initialPrev.month,
    missingRows,
    setErrorMsg,
    notifySuccess,
    refreshAll,
  });

  const totalGasto = useMemo(() => filteredExpenses.reduce((sum, e) => sum + Math.round(Number(e.amount)), 0), [filteredExpenses]);
  const totalCompare = useMemo(() => filteredCompareExpenses.reduce((sum, e) => sum + Math.round(Number(e.amount)), 0), [filteredCompareExpenses]);
  const totalDiff = totalGasto - totalCompare;
  const totalDiffPct = totalCompare > 0 ? (totalDiff / totalCompare) * 100 : null;

  const sortedCategories = useMemo(
    () => buildCategoryStats(filteredExpenses, totalGasto),
    [filteredExpenses, totalGasto],
  );

  return {
    isAdmin, activeTab, setActiveTab, scopeFilter, setScopeFilter, searchQuery, setSearchQuery, filterCategoryId, setFilterCategoryId,
    selectedYear, selectedMonth, compareYear, compareMonth, periods, navigateMonth, setComparePeriod,
    expenses: filteredExpenses, compareExpenses: filteredCompareExpenses, comparisonRows, missingRows, categories, vehicles, bankAccounts,
    loading, savingRowKey, savedRowKey, errorMsg, setErrorMsg, successMsg, setSuccessMsg,
    totalGasto, totalCompare, totalDiff, totalDiffPct, sortedCategories,
    handleDeleteExpense, handleInlineSaveAmount, handleQuickCopyRow, handleQuickAddRow,
    ...bulk,
  };
}
