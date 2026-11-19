import React, { useState, useEffect, useMemo } from 'react';
import { api, API_BASE_URL } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { type CategoryStatItem, type CopySourceExpenseItem, type Expense, type ExpenseCategory, getMonthName } from './gastos.types';

export function useGastosController() {
  const confirm = useConfirm();
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  const [copySourceYear, setCopySourceYear] = useState<number>(selectedYear);
  const [copySourceMonth, setCopySourceMonth] = useState<number>(selectedMonth === 1 ? 12 : selectedMonth - 1);
  const [copyTargetDate, setCopyTargetDate] = useState<string>(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`);
  const [sourceExpenses, setSourceExpenses] = useState<CopySourceExpenseItem[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [submittingCopy, setSubmittingCopy] = useState(false);

  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
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

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { fetchExpenses(); }, [selectedYear, selectedMonth, filterCategoryId, filterPaymentMethod]);

  const fetchExpenses = async () => {
    try {
      const filters: any = { year: selectedYear, month: selectedMonth };
      if (filterCategoryId) filters.categoryId = Number(filterCategoryId);
      if (filterPaymentMethod) filters.paymentMethod = filterPaymentMethod;
      setExpenses((await api.getExpensesList(filters)) || []);
    } catch { setErrorMsg('Error al obtener el listado de gastos.'); }
  };

  const fetchInitialData = async () => {
    setLoading(true); setErrorMsg(null);
    try {
      setCategories((await api.getExpenseCategories()) || []);
      try { setBankAccounts((await api.getBankAccounts()) || []); } catch (e) { console.error('Error fetching bank accounts', e); }
      try {
        const res = await fetch(`${API_BASE_URL}/fleet/vehicles`, { credentials: 'include' });
        const text = await res.text();
        const json = text && text.trim() ? JSON.parse(text) : {};
        if (json.status === 'success') setVehicles(json.data.vehicles || []);
      } catch (e) { console.error('Error fetching vehicles', e); }
      await fetchExpenses();
    } catch { setErrorMsg('Error al cargar la información inicial.'); } finally { setLoading(false); }
  };

  const resetForm = () => {
    setNewAmount(''); setNewCategoryId(''); setNewDescription('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewPaymentMethod('CASH'); setNewCashSource('CAJA_GRANDE'); setNewBankAccountId(''); setNewVehicleId(''); setNewBillingType('INTERNAL');
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg(null);
    const amount = Number(newAmount);
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
      setIsCreateModalOpen(false); resetForm(); fetchExpenses();
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar el gasto.'); } finally { setSubmitting(false); }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!(await confirm('¿Eliminar este gasto? Si afectó una cuenta bancaria, se revertirá el saldo.', { type: 'danger' }))) return;
    setErrorMsg(null);
    try {
      await api.deleteExpenseNew(id);
      notifySuccess('Gasto eliminado.'); fetchExpenses();
    } catch (err: any) { setErrorMsg(err.message || 'Error al eliminar el gasto.'); }
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
      setIsImportModalOpen(false); setSelectedFile(null); setSelectedYear(2026); setSelectedMonth(5); fetchExpenses();
    } catch (err: any) { setErrorMsg(err.message || 'Error al importar el archivo.'); } finally { setImporting(false); }
  };

  const fetchSourceExpenses = async (year: number, month: number) => {
    setLoadingSource(true);
    try {
      const data = await api.getExpensesList({ year, month });
      setSourceExpenses((data || []).map((exp: any) => ({
        id: exp.id, selected: true, amount: String(exp.amount), description: exp.description,
        categoryId: exp.categoryId, categoryName: exp.category?.name || 'General',
        paymentMethod: exp.paymentMethod || 'CASH', bankAccountId: exp.bankAccountId || undefined, vehicleId: exp.vehicleId || undefined,
      })));
    } catch (e) { console.error('Error al cargar gastos del mes de origen:', e); } finally { setLoadingSource(false); }
  };

  const openCopyModal = () => {
    const srcMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const srcYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    setErrorMsg(null); setCopySourceMonth(srcMonth); setCopySourceYear(srcYear);
    setCopyTargetDate(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`);
    setIsCopyModalOpen(true); fetchSourceExpenses(srcYear, srcMonth);
  };

  const handleExecuteCopy = async () => {
    const selectedItems = sourceExpenses.filter((item) => item.selected && Number(item.amount) > 0);
    if (selectedItems.length === 0) return setErrorMsg('Seleccione al menos un gasto válido.');
    setSubmittingCopy(true); setErrorMsg(null);
    try {
      const payload = selectedItems.map((item) => ({
        amount: Number(item.amount), categoryId: item.categoryId, description: item.description,
        date: copyTargetDate, paymentMethod: item.paymentMethod, bankAccountId: item.bankAccountId, vehicleId: item.vehicleId,
      }));
      const res = await api.createBulkExpenses({ expenses: payload, targetDate: copyTargetDate });
      notifySuccess(res.message || `Se copiaron ${selectedItems.length} gastos a ${getMonthName(selectedMonth)} ${selectedYear}.`, 4000);
      setIsCopyModalOpen(false); fetchExpenses();
    } catch (err: any) { setErrorMsg(err.message || 'Error al copiar los gastos.'); } finally { setSubmittingCopy(false); }
  };

  const totalGasto = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount), 0), [expenses]);
  const sortedCategories: CategoryStatItem[] = useMemo(() => {
    const totals: Record<string, { amount: number; description: string | null }> = {};
    expenses.forEach((e) => {
      const catName = e.category?.name || 'General';
      if (!totals[catName]) totals[catName] = { amount: 0, description: e.category?.description || null };
      totals[catName].amount += Number(e.amount);
    });
    return Object.keys(totals)
      .map((name) => ({ name, amount: totals[name].amount, pct: totalGasto > 0 ? (totals[name].amount / totalGasto) * 100 : 0, description: totals[name].description }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalGasto]);

  return {
    isAdmin, expenses, categories, vehicles, bankAccounts, loading, submitting, errorMsg, setErrorMsg, successMsg, setSuccessMsg,
    selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, filterCategoryId, setFilterCategoryId, filterPaymentMethod, setFilterPaymentMethod,
    isCreateModalOpen, setIsCreateModalOpen, isImportModalOpen, setIsImportModalOpen, isCopyModalOpen, setIsCopyModalOpen,
    copySourceYear, setCopySourceYear, copySourceMonth, setCopySourceMonth, copyTargetDate, setCopyTargetDate,
    sourceExpenses, setSourceExpenses, loadingSource, submittingCopy,
    newAmount, setNewAmount, newCategoryId, setNewCategoryId, newDescription, setNewDescription, newDate, setNewDate,
    newPaymentMethod, setNewPaymentMethod, newCashSource, setNewCashSource, newBankAccountId, setNewBankAccountId, newVehicleId, setNewVehicleId, newBillingType, setNewBillingType,
    selectedFile, importing, totalGasto, sortedCategories,
    fetchSourceExpenses, openCopyModal, handleCreateExpense, handleDeleteExpense, handleFileChange, handleImportExcel, handleExecuteCopy,
  };
}
