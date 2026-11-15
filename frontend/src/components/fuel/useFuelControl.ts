import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';

interface UseFuelControlParams {
  vehiclesProp?: any[];
  onRefreshVehicles?: () => void;
}

const initialFuelForm = (vehicleId = '', odometer = '', bankAccountId = '') => ({
  vehicleId,
  odometer,
  liters: '',
  totalCost: '',
  pricePerLiter: '',
  isFullTank: true,
  notes: '',
  date: new Date().toISOString().substring(0, 10),
  affectFinance: false,
  paymentMethod: 'CASH',
  bankAccountId,
  billingType: 'INTERNAL',
});

export function useFuelControl({ vehiclesProp, onRefreshVehicles }: UseFuelControlParams) {
  const confirm = useConfirm();
  const [internalVehicles, setInternalVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<number | 'ALL'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [form, setForm] = useState(() => initialFuelForm());

  const vehicles = vehiclesProp || internalVehicles;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsData, logsData, vehData] = await Promise.all([
        api.getFuelAnalytics(),
        api.getFuelLogs(),
        !vehiclesProp ? api.getVehicles() : Promise.resolve(null),
      ]);
      setAnalytics(analyticsData);
      setFuelLogs(logsData || []);
      if (vehData) setInternalVehicles(vehData);
    } catch (e: any) {
      setError(e.message || 'Error al obtener información de combustible.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    api.getBankAccounts().then((d) => setBankAccounts(d || [])).catch(() => {});
  }, []);

  const handleOpenModal = (vehicleId?: number) => {
    setModalError(null);
    const vId = vehicleId || (vehicles.length > 0 ? vehicles[0].id : '');
    const selectedVeh = vehicles.find((v) => v.id === Number(vId));
    setForm(initialFuelForm(
      String(vId),
      selectedVeh ? String(selectedVeh.currentOdometer || 0) : '',
      bankAccounts.length > 0 ? String(bankAccounts[0].id) : '',
    ));
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setModalError(null);
    setShowModal(false);
  };

  const handleVehicleChange = (vIdStr: string) => {
    const selectedVeh = vehicles.find((v) => v.id === Number(vIdStr));
    setForm((prev) => ({
      ...prev,
      vehicleId: vIdStr,
      odometer: selectedVeh ? String(selectedVeh.currentOdometer || 0) : prev.odometer,
    }));
  };

  const handleCostOrLitersChange = (field: 'liters' | 'totalCost', value: string) => {
    const nextForm = { ...form, [field]: value };
    const lit = parseFloat(nextForm.liters);
    const cost = parseFloat(nextForm.totalCost);
    if (lit > 0 && cost > 0) nextForm.pricePerLiter = (cost / lit).toFixed(2);
    setForm(nextForm);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.odometer || !form.liters || !form.totalCost) {
      setModalError('Complete los campos requeridos.');
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      await api.createFuelLog({
        vehicleId: Number(form.vehicleId),
        odometer: Number(form.odometer),
        liters: Number(form.liters),
        totalCost: Number(form.totalCost),
        pricePerLiter: form.pricePerLiter ? Number(form.pricePerLiter) : undefined,
        isFullTank: form.isFullTank,
        notes: form.notes,
        date: form.date,
        affectFinance: form.affectFinance,
        paymentMethod: form.paymentMethod,
        bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : undefined,
        billingType: form.billingType,
      });
      setShowModal(false);
      await loadData();
      onRefreshVehicles?.();
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar carga de combustible.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    if (!await confirm('¿Eliminar este registro de carga?', { type: 'danger' })) return;
    setError(null);
    try {
      await api.deleteFuelLog(id);
      await loadData();
      onRefreshVehicles?.();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la carga.');
    }
  };

  const filteredLogs = fuelLogs.filter((log) => (selectedVehicleFilter === 'ALL' ? true : log.vehicleId === selectedVehicleFilter));

  return {
    vehicles, loading, analytics, filteredLogs, selectedVehicleFilter, setSelectedVehicleFilter,
    showModal, submitting, error, setError, modalError, bankAccounts, form, setForm,
    loadData, handleOpenModal, handleCloseModal, handleVehicleChange, handleCostOrLitersChange,
    handleSubmit, handleDeleteLog,
  };
}
