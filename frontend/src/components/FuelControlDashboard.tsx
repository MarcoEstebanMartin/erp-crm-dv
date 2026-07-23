import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useConfirm } from '../context/ConfirmContext';
import { 
  Fuel, Plus, Trash2, TrendingUp, AlertCircle, RefreshCw, 
  CheckCircle2, DollarSign, Gauge, Activity, Calendar, Car
} from 'lucide-react';

interface FuelControlDashboardProps {
  vehicles?: any[];
  onRefreshVehicles?: () => void;
}

export default function FuelControlDashboard({ vehicles: vehiclesProp, onRefreshVehicles }: FuelControlDashboardProps) {
  const confirm = useConfirm();
  const [internalVehicles, setInternalVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);
  const [fuelLogs, setFuelLogs] = useState<any[]>([]);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<number | 'ALL'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vehicles = vehiclesProp || internalVehicles;

  // Cuentas bancarias para integración financiera
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  // Formulario de Carga
  const [form, setForm] = useState({
    vehicleId: '',
    odometer: '',
    liters: '',
    totalCost: '',
    pricePerLiter: '',
    isFullTank: true,
    notes: '',
    date: new Date().toISOString().substring(0, 10),
    affectFinance: false,
    paymentMethod: 'CASH',
    bankAccountId: '',
    billingType: 'INTERNAL'
  });

  useEffect(() => {
    loadData();
    loadResources();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [analyticsData, logsData, vehData] = await Promise.all([
        api.getFuelAnalytics(),
        api.getFuelLogs(),
        !vehiclesProp ? api.getVehicles() : Promise.resolve(null)
      ]);
      setAnalytics(analyticsData);
      setFuelLogs(logsData || []);
      if (vehData) {
        setInternalVehicles(vehData);
      }
    } catch (e: any) {
      console.error('Error al cargar datos de combustible:', e);
      setError(e.message || 'Error al obtener la información de combustible.');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const bankData = await api.getBankAccounts();
      setBankAccounts(bankData || []);
    } catch (e) {
      console.error('Error al cargar cuentas bancarias:', e);
    }
  };

  const handleOpenModal = (vehicleId?: number) => {
    const vId = vehicleId || (vehicles.length > 0 ? vehicles[0].id : '');
    const selectedVeh = vehicles.find(v => v.id === Number(vId));
    
    setForm({
      vehicleId: String(vId),
      odometer: selectedVeh ? String(selectedVeh.currentOdometer || 0) : '',
      liters: '',
      totalCost: '',
      pricePerLiter: '',
      isFullTank: true,
      notes: '',
      date: new Date().toISOString().substring(0, 10),
      affectFinance: false,
      paymentMethod: 'CASH',
      bankAccountId: bankAccounts.length > 0 ? String(bankAccounts[0].id) : '',
      billingType: 'INTERNAL'
    });
    setShowModal(true);
  };

  const handleVehicleChange = (vIdStr: string) => {
    const selectedVeh = vehicles.find(v => v.id === Number(vIdStr));
    setForm(prev => ({
      ...prev,
      vehicleId: vIdStr,
      odometer: selectedVeh ? String(selectedVeh.currentOdometer || 0) : prev.odometer
    }));
  };

  const handleCostOrLitersChange = (field: 'liters' | 'totalCost', value: string) => {
    const nextForm = { ...form, [field]: value };
    const lit = parseFloat(nextForm.liters);
    const cost = parseFloat(nextForm.totalCost);

    if (lit > 0 && cost > 0) {
      nextForm.pricePerLiter = (cost / lit).toFixed(2);
    }
    setForm(nextForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.odometer || !form.liters || !form.totalCost) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    setSubmitting(true);
    setError(null);
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
        billingType: form.billingType
      });

      setShowModal(false);
      await loadData();
      if (onRefreshVehicles) onRefreshVehicles();
    } catch (e: any) {
      setError(e.message || 'Error al guardar la carga de combustible.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    const ok = await confirm({
      title: 'Eliminar Carga de Combustible',
      message: '¿Estás seguro de que deseas eliminar este registro de carga? Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar'
    });

    if (!ok) return;

    try {
      await api.deleteFuelLog(id);
      await loadData();
      if (onRefreshVehicles) onRefreshVehicles();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar la carga.');
    }
  };

  const filteredLogs = fuelLogs.filter(log => {
    if (selectedVehicleFilter === 'ALL') return true;
    return log.vehicleId === selectedVehicleFilter;
  });

  const summary = analytics?.summary || {
    totalFleetSpent: 0,
    totalFleetLiters: 0,
    totalFleetKmTraveled: 0,
    averageFleetLitersPer100Km: 0,
    activeVehiclesCount: 0
  };

  const vehicleStats = analytics?.vehicleStats || [];
  const highestConsumingVehicle = vehicleStats.length > 0 && vehicleStats[0].litersPer100Km > 0 ? vehicleStats[0] : null;

  return (
    <div className="space-y-6">
      {/* Header & Acciones Rápidas */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Fuel className="w-5 h-5 text-gray-700" />
            Control de Combustible y Eficiencia
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Monitoreo continuo de consumo promedio (L/100 km) y costos por vehículo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 text-xs font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            Cargar Combustible
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Minimalistas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Gasto Total</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">
            ${summary.totalFleetSpent.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">Acumulado en cargas</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Litros Consumidos</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Fuel className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">
            {summary.totalFleetLiters.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-semibold text-gray-500">L</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Total de litros despachados</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Promedio Flota</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Gauge className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">
            {summary.averageFleetLitersPer100Km > 0 ? summary.averageFleetLitersPer100Km.toFixed(1) : '--'} <span className="text-sm font-semibold text-gray-500">L/100 km</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Rendimiento medio global</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Mayor Consumo</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          {highestConsumingVehicle ? (
            <div>
              <p className="text-base font-bold text-gray-900 mt-2 truncate">
                {highestConsumingVehicle.brand} {highestConsumingVehicle.model}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-bold text-xs rounded">
                  {highestConsumingVehicle.litersPer100Km} L/100 km
                </span>
                <span className="text-xs text-gray-400 font-mono">({highestConsumingVehicle.plate})</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-3">Sin datos comparativos suficientes (requiere min. 2 cargas)</p>
          )}
        </div>
      </div>

      {/* Ranking de Vehículos por Consumo Promedio */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Ranking de Eficiencia y Consumo (L / 100 km)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Comparativa del consumo promedio por unidad.
            </p>
          </div>
        </div>

        {vehicleStats.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No se registran datos de vehículos activos.
          </div>
        ) : (
          <div className="space-y-4">
            {vehicleStats.map((stat: any) => {
              const maxLitersPer100 = Math.max(...vehicleStats.map((s: any) => s.litersPer100Km || 0), 1);
              const percentage = stat.litersPer100Km > 0 ? (stat.litersPer100Km / maxLitersPer100) * 100 : 0;
              
              // Estado de consumo
              let badgeText = 'Normal';
              let badgeClass = 'bg-gray-100 text-gray-700 border-gray-200';
              let barClass = 'bg-gray-700';

              if (stat.litersPer100Km > 0) {
                if (summary.averageFleetLitersPer100Km > 0 && stat.litersPer100Km > summary.averageFleetLitersPer100Km * 1.25) {
                  badgeText = 'Alto Consumo';
                  badgeClass = 'bg-red-50 text-red-700 border-red-200 font-semibold';
                  barClass = 'bg-red-600';
                } else if (summary.averageFleetLitersPer100Km > 0 && stat.litersPer100Km < summary.averageFleetLitersPer100Km * 0.85) {
                  badgeText = 'Eficiente';
                  badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold';
                  barClass = 'bg-emerald-500';
                }
              }

              return (
                <div key={stat.vehicleId} className="p-3 bg-gray-50/70 border border-gray-100 rounded-lg hover:border-gray-300 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-xs font-bold text-gray-900">
                        {stat.brand} {stat.model}
                      </span>
                      <span className="text-[11px] font-mono text-gray-500 px-1.5 py-0.5 bg-white border border-gray-200 rounded">
                        {stat.plate}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-gray-500">Gasto: </span>
                        <span className="font-semibold text-gray-900">${stat.vehicleSpent.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-500">Cargas: </span>
                        <span className="font-semibold text-gray-900">{stat.logsCount}</span>
                      </div>
                      <div className="text-right min-w-[100px]">
                        <span className="font-extrabold text-gray-900 text-sm">
                          {stat.litersPer100Km > 0 ? `${stat.litersPer100Km} L/100km` : 'Mediendo...'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro barra de nivel */}
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                      style={{ width: `${Math.max(percentage, 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabla de Cargas Recientes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Historial de Cargas Registradas</h3>
            <p className="text-xs text-gray-500">Listado detallado de recargas por fecha y odómetro</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Filtrar por Vehículo:</label>
            <select
              value={selectedVehicleFilter}
              onChange={(e) => setSelectedVehicleFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="ALL">Todos los vehículos ({vehicles.length})</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-400">
            No se han registrado cargas de combustible para el criterio seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Vehículo</th>
                  <th className="py-3 px-4 text-right">Odómetro (km)</th>
                  <th className="py-3 px-4 text-right">Litros (L)</th>
                  <th className="py-3 px-4 text-right">Precio / L</th>
                  <th className="py-3 px-4 text-right">Total ($)</th>
                  <th className="py-3 px-4 text-center">Tanque</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-gray-500 font-mono">
                      {new Date(log.date).toLocaleDateString('es-AR')}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {log.vehicle ? `${log.vehicle.brand} ${log.vehicle.model}` : 'Vehículo general'}
                      <span className="ml-1.5 text-[11px] text-gray-400 font-mono">
                        ({log.vehicle?.plate})
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold">
                      {log.odometer.toLocaleString('es-AR')} km
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      {Number(log.liters).toFixed(1)} L
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500 font-mono">
                      ${Number(log.pricePerLiter || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900">
                      ${Number(log.totalCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {log.isFullTank ? (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded border border-emerald-100">
                          Lleno
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                          Parcial
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Eliminar carga"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal "+ Registrar Carga de Combustible" */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-900 text-emerald-400 rounded-lg">
                  <Fuel className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Registrar Carga de Combustible</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {/* Selección de Vehículo */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Vehículo *</label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  required
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
                >
                  <option value="">Selecciona un vehículo...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.brand} {v.model} ({v.plate}) - Odo: {v.currentOdometer} km
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha y Odómetro */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Carga *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Odómetro Actual (km) *</label>
                  <input
                    type="number"
                    value={form.odometer}
                    onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                    placeholder="Ej: 125400"
                    required
                    min="0"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Litros y Costo Total */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Litros (L) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.liters}
                    onChange={(e) => handleCostOrLitersChange('liters', e.target.value)}
                    placeholder="0.0"
                    required
                    min="0.1"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Monto Total ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.totalCost}
                    onChange={(e) => handleCostOrLitersChange('totalCost', e.target.value)}
                    placeholder="0.00"
                    required
                    min="1"
                    className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Precio / L ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pricePerLiter}
                    readOnly
                    placeholder="Auto"
                    className="w-full text-xs border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 font-mono text-gray-500"
                  />
                </div>
              </div>

              {/* Checkbox Tanque Lleno */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isFullTank"
                  checked={form.isFullTank}
                  onChange={(e) => setForm({ ...form, isFullTank: e.target.checked })}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <label htmlFor="isFullTank" className="text-xs text-gray-700 font-medium">
                  ¿Fue carga a tanque lleno? <span className="text-gray-400 font-normal">(Recomendado para medición exacta de L/100km)</span>
                </label>
              </div>

              {/* Checkbox Afectar Finanzas */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="affectFinance"
                    checked={form.affectFinance}
                    onChange={(e) => setForm({ ...form, affectFinance: e.target.checked })}
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <label htmlFor="affectFinance" className="text-xs text-gray-900 font-bold">
                    Descontar dinero de Caja o Banco
                  </label>
                </div>

                {form.affectFinance && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-600 mb-1">Método de Pago</label>
                      <select
                        value={form.paymentMethod}
                        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="CASH">Efectivo (Caja Chica)</option>
                        <option value="TRANSFER">Transferencia / Débito</option>
                      </select>
                    </div>

                    {form.paymentMethod === 'TRANSFER' && (
                      <div>
                        <label className="block text-[11px] font-medium text-gray-600 mb-1">Cuenta Bancaria</label>
                        <select
                          value={form.bankAccountId}
                          onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                        >
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notas opcionales */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notas / Estación de Servicio (opcional)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ej: YPF Ruta 9, Carga antes del viaje a Rosario"
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
                >
                  {submitting ? 'Guardando...' : 'Guardar Carga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
