import { useState, useEffect, type FormEvent } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { ALLOWED_FLEET_PROVIDER_NAMES, isGeneralAdminVehicle, type Expiry, type Maintenance, type Vehicle } from './fleet.types';

const emptyVehicleForm = () => ({
  plate: '', brand: '', model: '', year: new Date().getFullYear(),
  currentOdometer: 0, status: 'ACTIVE' as Vehicle['status'],
  trackFuel: false, fuelType: '' as '' | 'NAFTA' | 'DIESEL', notes: '',
});

const emptyMaintenanceForm = () => ({
  type: 'SERVICE' as Maintenance['type'], description: '', cost: '', odometer: '',
  date: new Date().toISOString().substring(0, 10), supplierId: '',
  affectFinance: false, paymentMethod: 'CASH', bankAccountId: '', billingType: 'INTERNAL',
});

const emptyExpiryForm = () => ({
  type: 'INSURANCE' as Expiry['type'], description: '',
  expirationDate: new Date().toISOString().substring(0, 10),
});

export function useFleetController() {
  const confirm = useConfirm();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [editingExpiryId, setEditingExpiryId] = useState<number | null>(null);

  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [maintenanceForm, setMaintenanceForm] = useState(emptyMaintenanceForm);
  const [expiryForm, setExpiryForm] = useState(emptyExpiryForm);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const data = await api.getVehicles();
      setVehicles(data);
      if (data.length > 0 && !selectedVehicleId) setSelectedVehicleId(data[0].id);
    } catch (e: any) {
      setError(e.message || 'Error al obtener la flota.');
    } finally {
      setLoading(false);
    }
  };

  const loadFormResources = async () => {
    try {
      const bankData = await api.getBankAccounts();
      setBankAccounts(bankData);
      const supplierData = await api.getPersonas('provider');
      const filteredSuppliers = (supplierData || []).filter((s: any) =>
        ALLOWED_FLEET_PROVIDER_NAMES.some((name) => s.name.toLowerCase().trim() === name.toLowerCase().trim()),
      );
      setSuppliers(filteredSuppliers);
    } catch (e) {
      console.error('Error al cargar recursos de flota:', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchVehicles();
      await loadFormResources();
      if (localStorage.getItem('open_fleet_gasto_modal') === 'true') {
        localStorage.removeItem('open_fleet_gasto_modal');
        setModalError(null);
        setShowMaintenanceModal(true);
      }
    };
    init();
  }, []);

  const openCreateVehicle = () => {
    setModalError(null); setEditingVehicle(null); setVehicleForm(emptyVehicleForm()); setShowVehicleModal(true);
  };

  const openEditVehicle = (vehicle: Vehicle) => {
    setModalError(null); setEditingVehicle(vehicle);
    setVehicleForm({
      plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model,
      year: vehicle.year, currentOdometer: vehicle.currentOdometer,
      status: vehicle.status,
      trackFuel: Boolean(vehicle.trackFuel),
      fuelType: vehicle.fuelType || '',
      notes: vehicle.notes || '',
    });
    setShowVehicleModal(true);
  };

  const openMaintenanceModal = () => {
    setModalError(null); setMaintenanceForm(emptyMaintenanceForm()); setShowMaintenanceModal(true);
  };

  const openCreateExpiry = () => {
    const selected = vehicles.find((v) => v.id === selectedVehicleId);
    setModalError(null);
    setEditingExpiryId(null);
    setExpiryForm({
      ...emptyExpiryForm(),
      type: isGeneralAdminVehicle(selected) ? 'OTHER' : 'INSURANCE',
    });
    setShowExpiryModal(true);
  };

  const openEditExpiry = (exp: Expiry) => {
    setModalError(null); setEditingExpiryId(exp.id);
    setExpiryForm({ type: exp.type, description: exp.description, expirationDate: new Date(exp.expirationDate).toISOString().substring(0, 10) });
    setShowExpiryModal(true);
  };

  const handleSaveVehicle = async (e: FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const payload = {
      ...vehicleForm,
      fuelType: vehicleForm.fuelType || null,
    };
    try {
      if (editingVehicle) await api.updateVehicle(editingVehicle.id, payload);
      else await api.createVehicle(payload);
      setShowVehicleModal(false); setEditingVehicle(null); setVehicleForm(emptyVehicleForm()); fetchVehicles();
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar vehículo.');
    }
  };

  const handleDeleteVehicle = async (id: number) => {
    if (!await confirm('¿Eliminar este vehículo de la flota?', { type: 'danger' })) return;
    setError(null);
    try {
      await api.deleteVehicle(id);
      if (selectedVehicleId === id) setSelectedVehicleId(null);
      fetchVehicles();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar vehículo.');
    }
  };

  const handleSaveMaintenance = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;
    const currentVehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (currentVehicle && Number(maintenanceForm.odometer) < currentVehicle.currentOdometer) {
      if (!await confirm(`Kilometraje ingresado (${maintenanceForm.odometer} km) menor al actual (${currentVehicle.currentOdometer} km). ¿Continuar?`, { type: 'warning' })) return;
    }
    setModalError(null);
    try {
      await api.createVehicleMaintenance(selectedVehicleId, {
        ...maintenanceForm,
        cost: Number(maintenanceForm.cost),
        odometer: Number(maintenanceForm.odometer),
        supplierId: maintenanceForm.supplierId ? Number(maintenanceForm.supplierId) : null,
        bankAccountId: maintenanceForm.bankAccountId ? Number(maintenanceForm.bankAccountId) : null,
      });
      setShowMaintenanceModal(false); setMaintenanceForm(emptyMaintenanceForm()); fetchVehicles();
    } catch (err: any) {
      setModalError(err.message || 'Error al registrar actividad.');
    }
  };

  const handleSaveExpiry = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;
    setModalError(null);
    try {
      if (editingExpiryId) await api.updateVehicleExpiry(editingExpiryId, expiryForm);
      else await api.createVehicleExpiry(selectedVehicleId, expiryForm);
      setShowExpiryModal(false); setEditingExpiryId(null); setExpiryForm(emptyExpiryForm()); fetchVehicles();
    } catch (err: any) {
      setModalError(err.message || 'Error al guardar vencimiento.');
    }
  };

  const handleDeleteExpiry = async (id: number) => {
    if (!await confirm('¿Eliminar este vencimiento?')) return;
    setError(null);
    try { await api.deleteVehicleExpiry(id); fetchVehicles(); }
    catch (err: any) { setError(err.message || 'Error al eliminar vencimiento.'); }
  };

  const handleDeleteMaintenance = async (id: number) => {
    if (!await confirm('¿Eliminar este registro de mantenimiento?', { type: 'danger' })) return;
    setError(null);
    try { await api.deleteVehicleMaintenance(id); fetchVehicles(); }
    catch (err: any) { setError(err.message || 'Error al eliminar mantenimiento.'); }
  };

  return {
    vehicles, loading, error, setError, modalError, setModalError,
    selectedVehicleId, setSelectedVehicleId, suppliers, bankAccounts,
    showVehicleModal, setShowVehicleModal, editingVehicle,
    showMaintenanceModal, setShowMaintenanceModal,
    showExpiryModal, setShowExpiryModal, editingExpiryId,
    vehicleForm, setVehicleForm, maintenanceForm, setMaintenanceForm, expiryForm, setExpiryForm,
    openCreateVehicle, openEditVehicle, openMaintenanceModal, openCreateExpiry, openEditExpiry,
    handleSaveVehicle, handleDeleteVehicle, handleSaveMaintenance, handleSaveExpiry,
    handleDeleteExpiry, handleDeleteMaintenance,
  };
}
