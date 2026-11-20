import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api, API_BASE_URL } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import {
  type ComparisonRow,
  type CopySourceExpenseItem,
  type Expense,
  type ExpenseCategory,
  type ExpensePeriod,
  getMonthName,
  shiftMonth,
} from './gastos.types';
import {
  buildCategoryStats,
  buildComparisonRows,
  buildExpenseDateForPeriod,
  pickDefaultComparePeriod,
} from './gastosComparison.utils';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [compareExpenses, setCompareExpenses] = useState<Expense[]>([]);
  const [periods, setPeriods] = useState<ExpensePeriod[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copyingAll, setCopyingAll] = useState(false);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [savedRowKey, setSavedRowKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  const [copySourceYear, setCopySourceYear] = useState<number>(initialPrev.year);
  const [copySourceMonth, setCopySourceMonth] = useState<number>(initialPrev.month);
  const [copyTargetDate, setCopyTargetDate] = useState<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
  const [sourceExpenses, setSourceExpenses] = useState<CopySourceExpenseItem[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [submittingCopy, setSubmittingCopy] = useState(false);

  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(now.toISOString().split('T')[0]);
  const [newPaymentMethod, setNewPaymentMethod] = useState('CASH');
  const [newCashSource, setNewCashSource] = useState<'CAJA_GRANDE' | 'CAJA_OFICINA'>('CAJA_GRANDE');
  const [newBankAccountId, setNewBankAccountId] = useState('');
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newBillingType, setNewBillingType] = useState('INTERNAL');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

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
      try {
        const [curList, cmpList] = await Promise.all([
          api.getExpensesList({ year: curY, month: curM }),
          api.getExpensesList({ year: cmpY, month: cmpM }),
        ]);
        setExpenses(curList || []);
        setCompareExpenses(cmpList || []);
      } catch {
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
    if (loading) return;
    fetchExpensesForBoth(selectedYear, selectedMonth, compareYear, compareMonth);
  }, [selectedYear, selectedMonth, compareYear, compareMonth, loading, fetchExpensesForBoth]);

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

  const resetForm = () => {
    setNewAmount(''); setNewCategoryId(''); setNewDescription('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewPaymentMethod('CASH'); setNewCashSource('CAJA_GRANDE');
    setNewBankAccountId(''); setNewVehicleId(''); setNewBillingType('INTERNAL');
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg(null);
    const amount = Math.round(Number(newAmount));
    if (isNaN(amount) || amount <= 0) return setErrorMsg('Ingrese un monto válido mayor a 0.');
    if (!newCategoryId) return setErrorMsg('Seleccione una categoría.');
    if (!newDescription.trim()) return setErrorMsg('La descripción es obligatoria.');

    setSubmitting(true);
    try {
      await api.createExpenseNew({
        amount, categoryId: Number(newCategoryId), description: newDescription.trim(),
        date: newDate ? new Date(newDate).toISOString() : undefined, paymentMethod: newPaymentMethod,
        cashSource: newPaymentMethod === 'CASH' ? newCashSource : undefined,
        bankAccountId: newPaymentMethod === 'BANK_TRANSFER' ? Number(newBankAccountId) : undefined,
        vehicleId: newVehicleId ? Number(newVehicleId) : undefined, billingType: newBillingType,
      });
      notifySuccess('Gasto registrado.');
      setIsCreateModalOpen(false); resetForm(); await refreshAll();
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar el gasto.'); } finally { setSubmitting(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setSelectedFile(e.target.files[0]);
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return setErrorMsg('Seleccione un archivo Excel.');
    setImporting(true); setErrorMsg(null);
    try {
      const res = await api.importExpensesExcel(selectedFile);
      notifySuccess(res.message || 'Gastos importados.', 5000);
      setIsImportModalOpen(false); setSelectedFile(null);
      await refreshAll();
    } catch (err: any) { setErrorMsg(err.message || 'Error al importar el archivo.'); } finally { setImporting(false); }
  };

  const fetchSourceExpenses = async (year: number, month: number) => {
    setLoadingSource(true);
    try {
      const data = await api.getExpensesList({ year, month });
      setSourceExpenses((data || []).map((exp: any) => ({
        id: exp.id, selected: true, amount: String(Math.round(Number(exp.amount))), description: exp.description,
        categoryId: exp.categoryId, categoryName: exp.category?.name || 'General',
        paymentMethod: exp.paymentMethod || 'CASH', bankAccountId: exp.bankAccountId || undefined, vehicleId: exp.vehicleId || undefined,
      })));
    } catch (e) { console.error('Error al cargar gastos del mes de origen:', e); } finally { setLoadingSource(false); }
  };

  const openCopyModal = () => {
    setErrorMsg(null);
    setCopySourceMonth(compareMonth);
    setCopySourceYear(compareYear);
    setCopyTargetDate(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`);
    setIsCopyModalOpen(true);
    fetchSourceExpenses(compareYear, compareMonth);
  };

  const handleExecuteCopy = async () => {
    const selectedItems = sourceExpenses.filter((item) => item.selected && Number(item.amount) > 0);
    if (selectedItems.length === 0) return setErrorMsg('Seleccione al menos un gasto válido.');
    setSubmittingCopy(true); setErrorMsg(null);
    try {
      const payload = selectedItems.map((item) => ({
        amount: Math.round(Number(item.amount)), categoryId: item.categoryId, description: item.description,
        date: copyTargetDate, paymentMethod: 'CASH', vehicleId: item.vehicleId,
      }));
      const res = await api.createBulkExpenses({ expenses: payload, targetDate: copyTargetDate });
      notifySuccess(res.message || `Se copiaron ${selectedItems.length} gastos a ${getMonthName(selectedMonth)} ${selectedYear}.`, 4000);
      setIsCopyModalOpen(false);
      await refreshAll();
    } catch (err: any) { setErrorMsg(err.message || 'Error al copiar los gastos.'); } finally { setSubmittingCopy(false); }
  };

  const comparisonRows = useMemo(
    () => buildComparisonRows({ expenses, compareExpenses, filterCategoryId, searchQuery }),
    [expenses, compareExpenses, filterCategoryId, searchQuery],
  );

  const missingRows = useMemo(
    () => comparisonRows.filter((r) => !r.currentExpense && r.compareAmount && r.compareAmount > 0),
    [comparisonRows],
  );

  const handleCopyAllMissing = async () => {
    if (missingRows.length === 0) return;
    setCopyingAll(true);
    setErrorMsg(null);
    try {
      const targetDate = buildExpenseDateForPeriod(selectedYear, selectedMonth);
      const payload = missingRows.map((row) => ({
        amount: Math.round(row.compareAmount || 0),
        categoryId: row.categoryId,
        description: row.description,
        date: targetDate,
        paymentMethod: 'CASH',
      }));
      await api.createBulkExpenses({ expenses: payload, targetDate });
      notifySuccess(`Se copiaron ${payload.length} gastos desde ${getMonthName(compareMonth)} a Caja Grande.`);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al copiar los gastos pendientes.');
    } finally {
      setCopyingAll(false);
    }
  };

  const totalGasto = useMemo(() => expenses.reduce((sum, e) => sum + Math.round(Number(e.amount)), 0), [expenses]);
  const totalCompare = useMemo(() => compareExpenses.reduce((sum, e) => sum + Math.round(Number(e.amount)), 0), [compareExpenses]);
  const totalDiff = totalGasto - totalCompare;
  const totalDiffPct = totalCompare > 0 ? (totalDiff / totalCompare) * 100 : null;

  const sortedCategories = useMemo(
    () => buildCategoryStats(expenses, totalGasto),
    [expenses, totalGasto],
  );

  return {
    isAdmin, activeTab, setActiveTab, searchQuery, setSearchQuery, filterCategoryId, setFilterCategoryId,
    selectedYear, selectedMonth, compareYear, compareMonth, periods, navigateMonth, setComparePeriod,
    expenses, compareExpenses, comparisonRows, missingRows, categories, vehicles, bankAccounts,
    loading, submitting, copyingAll, savingRowKey, savedRowKey, errorMsg, setErrorMsg, successMsg, setSuccessMsg,
    isCreateModalOpen, setIsCreateModalOpen, isImportModalOpen, setIsImportModalOpen, isCopyModalOpen, setIsCopyModalOpen,
    copySourceYear, setCopySourceYear, copySourceMonth, setCopySourceMonth, copyTargetDate, setCopyTargetDate,
    sourceExpenses, setSourceExpenses, loadingSource, submittingCopy,
    newAmount, setNewAmount, newCategoryId, setNewCategoryId, newDescription, setNewDescription, newDate, setNewDate,
    newPaymentMethod, setNewPaymentMethod, newCashSource, setNewCashSource, newBankAccountId, setNewBankAccountId, newVehicleId, setNewVehicleId, newBillingType, setNewBillingType,
    selectedFile, importing, totalGasto, totalCompare, totalDiff, totalDiffPct, sortedCategories,
    fetchSourceExpenses, openCopyModal, handleCreateExpense, handleDeleteExpense, handleFileChange, handleImportExcel, handleExecuteCopy,
    handleInlineSaveAmount, handleQuickCopyRow, handleCopyAllMissing, handleQuickAddRow,
  };
}
