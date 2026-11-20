import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';

interface UseFuelControlParams {
  vehiclesProp?: any[];
  onRefreshVehicles?: () => void;
}

const todayStr = () => new Date().toISOString().substring(0, 10);

const initialFuelForm = (vehicleId = '', odometer = '') => ({
  vehicleId,
  odometer,
  liters: '',
  ticketNumber: '',
  isFullTank: true,
  notes: '',
  date: todayStr(),
});

const initialSettleForm = (bankAccountId = '') => ({
  dieselPricePerLiter: '',
  dieselTotalCost: '',
  naftaPricePerLiter: '',
  naftaTotalCost: '',
  settledDate: todayStr(),
  affectFinance: false,
  paymentMethod: 'TRANSFER',
  bankAccountId,
  billingType: 'INTERNAL',
  notes: '',
});

export function useFuelControl({ vehiclesProp, onRefreshVehicles }: UseFuelControlParams) {
  const confirm = useConfirm();
  const [internalVehicles, setInternalVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<number | 'ALL'>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'PENDING' | 'SETTLED'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [form, setForm] = useState(() => initialFuelForm());
  const [selectedSettleIds, setSelectedSettleIds] = useState<number[]>([]);
  const [settleForm, setSettleForm] = useState(() => initialSettleForm());

  const allVehicles = vehiclesProp || internalVehicles;
  const vehicles = useMemo(
    () => allVehicles.filter((v) => v.trackFuel === true),
    [allVehicles],
  );

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

  const pendingLogs = useMemo(
    () => fuelLogs.filter((l) => l.status === 'PENDING'),
    [fuelLogs],
  );

  const handleOpenModal = (vehicleId?: number) => {
    setModalError(null);
    const vId = vehicleId || (vehicles.length > 0 ? vehicles[0].id : '');
    const selectedVeh = vehicles.find((v) => v.id === Number(vId));
    setForm(initialFuelForm(String(vId), selectedVeh ? String(selectedVeh.currentOdometer || 0) : ''));
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.odometer || !form.liters) {
      setModalError('Completá vehículo, odómetro y litros.');
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      await api.createFuelLog({
        vehicleId: Number(form.vehicleId),
        odometer: Number(form.odometer),
        liters: Number(form.liters),
        ticketNumber: form.ticketNumber.trim() || null,
        isFullTank: form.isFullTank,
        notes: form.notes.trim() || null,
        date: form.date,
      });
      setShowModal(false);
      await loadData();
      onRefreshVehicles?.();
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar el ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSettleModal = () => {
    setModalError(null);
    setSelectedSettleIds(pendingLogs.map((l) => l.id));
    setSettleForm(initialSettleForm(bankAccounts.length > 0 ? String(bankAccounts[0].id) : ''));
    setShowSettleModal(true);
  };

  const handleCloseSettleModal = () => {
    setModalError(null);
    setShowSettleModal(false);
  };

  const toggleSettleLog = (id: number) => {
    setSelectedSettleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSettleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedSettleIds.length === 0) {
      setModalError('Seleccioná al menos un ticket.');
      return;
    }
    setSubmitting(true);
    setModalError(null);
    try {
      await api.settleFuelLogs({
        logIds: selectedSettleIds,
        dieselPricePerLiter: settleForm.dieselPricePerLiter ? Number(settleForm.dieselPricePerLiter) : undefined,
        dieselTotalCost: settleForm.dieselTotalCost ? Number(settleForm.dieselTotalCost) : undefined,
        naftaPricePerLiter: settleForm.naftaPricePerLiter ? Number(settleForm.naftaPricePerLiter) : undefined,
        naftaTotalCost: settleForm.naftaTotalCost ? Number(settleForm.naftaTotalCost) : undefined,
        settledDate: settleForm.settledDate,
        affectFinance: settleForm.affectFinance,
        paymentMethod: settleForm.paymentMethod,
        bankAccountId: settleForm.bankAccountId ? Number(settleForm.bankAccountId) : undefined,
        billingType: settleForm.billingType,
        notes: settleForm.notes.trim() || null,
      });
      setShowSettleModal(false);
      await loadData();
    } catch (err: any) {
      setModalError(err.message || 'Error al liquidar tickets.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    if (!await confirm('¿Eliminar este ticket de combustible?', { type: 'danger' })) return;
    setError(null);
    try {
      await api.deleteFuelLog(id);
      await loadData();
      onRefreshVehicles?.();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el ticket.');
    }
  };

  const filteredLogs = useMemo(
    () =>
      fuelLogs.filter((log) => {
        if (selectedVehicleFilter !== 'ALL' && log.vehicleId !== selectedVehicleFilter) return false;
        if (selectedStatusFilter !== 'ALL' && log.status !== selectedStatusFilter) return false;
        return true;
      }),
    [fuelLogs, selectedVehicleFilter, selectedStatusFilter],
  );

  return {
    vehicles, loading, analytics, filteredLogs, pendingLogs,
    selectedVehicleFilter, setSelectedVehicleFilter,
    selectedStatusFilter, setSelectedStatusFilter,
    showModal, showSettleModal, submitting, error, setError, modalError, bankAccounts,
    form, setForm, settleForm, setSettleForm, selectedSettleIds, setSelectedSettleIds,
    loadData, handleOpenModal, handleCloseModal, handleVehicleChange, handleSubmit,
    handleOpenSettleModal, handleCloseSettleModal, toggleSettleLog, handleSettleSubmit,
    handleDeleteLog,
  };
}
