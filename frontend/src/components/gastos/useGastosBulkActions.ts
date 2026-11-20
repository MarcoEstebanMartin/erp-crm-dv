import React, { useState } from 'react';
import { api } from '../../utils/api';
import {
  type ComparisonRow,
  type CopySourceExpenseItem,
  getMonthName,
} from './gastos.types';
import { buildExpenseDateForPeriod } from './gastosComparison.utils';

interface UseGastosBulkActionsParams {
  selectedYear: number;
  selectedMonth: number;
  compareYear: number;
  compareMonth: number;
  initialCopyYear: number;
  initialCopyMonth: number;
  missingRows: ComparisonRow[];
  setErrorMsg: (msg: string | null) => void;
  notifySuccess: (msg: string, ms?: number) => void;
  refreshAll: () => Promise<void>;
}

export function useGastosBulkActions({
  selectedYear,
  selectedMonth,
  compareYear,
  compareMonth,
  initialCopyYear,
  initialCopyMonth,
  missingRows,
  setErrorMsg,
  notifySuccess,
  refreshAll,
}: UseGastosBulkActionsParams) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPaymentMethod, setNewPaymentMethod] = useState('CASH');
  const [newCashSource, setNewCashSource] = useState<'CAJA_GRANDE' | 'CAJA_OFICINA'>('CAJA_GRANDE');
  const [newBankAccountId, setNewBankAccountId] = useState('');
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newBillingType, setNewBillingType] = useState('INTERNAL');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceYear, setCopySourceYear] = useState<number>(initialCopyYear);
  const [copySourceMonth, setCopySourceMonth] = useState<number>(initialCopyMonth);
  const [copyTargetDate, setCopyTargetDate] = useState<string>(
    `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
  );
  const [sourceExpenses, setSourceExpenses] = useState<CopySourceExpenseItem[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [submittingCopy, setSubmittingCopy] = useState(false);
  const [copyingAll, setCopyingAll] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setSelectedFile(e.target.files[0]);
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return setErrorMsg('Seleccione un archivo Excel.');
    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await api.importExpensesExcel(selectedFile);
      notifySuccess(res.message || 'Gastos importados.', 5000);
      setIsImportModalOpen(false);
      setSelectedFile(null);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al importar el archivo.');
    } finally {
      setImporting(false);
    }
  };

  const fetchSourceExpenses = async (year: number, month: number) => {
    setLoadingSource(true);
    try {
      const data = await api.getExpensesList({ year, month });
      setSourceExpenses(
        (data || []).map((exp: any) => ({
          id: exp.id,
          selected: true,
          amount: String(Math.round(Number(exp.amount))),
          description: exp.description,
          categoryId: exp.categoryId,
          categoryName: exp.category?.name || 'General',
          paymentMethod: exp.paymentMethod || 'CASH',
          bankAccountId: exp.bankAccountId || undefined,
          vehicleId: exp.vehicleId || undefined,
        })),
      );
    } catch (e) {
      console.error('Error al cargar gastos del mes de origen:', e);
    } finally {
      setLoadingSource(false);
    }
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
    setSubmittingCopy(true);
    setErrorMsg(null);
    try {
      const payload = selectedItems.map((item) => ({
        amount: Math.round(Number(item.amount)),
        categoryId: item.categoryId,
        description: item.description,
        date: copyTargetDate,
        paymentMethod: 'CASH',
        vehicleId: item.vehicleId,
      }));
      const res = await api.createBulkExpenses({ expenses: payload, targetDate: copyTargetDate });
      notifySuccess(
        res.message || `Se copiaron ${selectedItems.length} gastos a ${getMonthName(selectedMonth)} ${selectedYear}.`,
        4000,
      );
      setIsCopyModalOpen(false);
      await refreshAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al copiar los gastos.');
    } finally {
      setSubmittingCopy(false);
    }
  };

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

  return {
    isCreateModalOpen, setIsCreateModalOpen, submitting,
    newAmount, setNewAmount, newCategoryId, setNewCategoryId, newDescription, setNewDescription,
    newDate, setNewDate, newPaymentMethod, setNewPaymentMethod, newCashSource, setNewCashSource,
    newBankAccountId, setNewBankAccountId, newVehicleId, setNewVehicleId, newBillingType, setNewBillingType,
    handleCreateExpense,
    isImportModalOpen, setIsImportModalOpen,
    isCopyModalOpen, setIsCopyModalOpen,
    copySourceYear, setCopySourceYear,
    copySourceMonth, setCopySourceMonth,
    copyTargetDate, setCopyTargetDate,
    sourceExpenses, setSourceExpenses,
    loadingSource, submittingCopy, copyingAll,
    selectedFile, importing,
    fetchSourceExpenses, openCopyModal, handleFileChange,
    handleImportExcel, handleExecuteCopy, handleCopyAllMissing,
  };
}
