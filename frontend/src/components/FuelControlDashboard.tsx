import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { useConfirm } from '../context/ConfirmContext';
import { 
  Fuel, Plus, Trash2, TrendingUp, AlertCircle, RefreshCw, 
  DollarSign, Gauge, Car
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header & Acciones Rápidas */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 20px', 
        backgroundColor: 'var(--bg-card, #fff)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
            <Fuel size={20} color="var(--text-primary)" />
            Control de Combustible y Eficiencia
          </h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Monitoreo continuo de consumo promedio (L/100 km) y costos por vehículo.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 12px', 
              fontSize: '0.8rem', 
              fontWeight: 500, 
              color: 'var(--text-primary)', 
              backgroundColor: 'var(--bg-app, #F9FAFB)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '6px', 
              cursor: 'pointer' 
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => handleOpenModal()}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 14px', 
              fontSize: '0.8rem', 
              fontWeight: 600, 
              color: '#fff', 
              backgroundColor: 'var(--accent-color, #111827)', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
            }}
          >
            <Plus size={15} color="#10B981" />
            Cargar Combustible
          </button>
        </div>
      </div>

      {error && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: 'rgba(239, 68, 68, 0.05)', 
          border: '1px solid rgba(239, 68, 68, 0.2)', 
          color: '#DC2626', 
          borderRadius: '6px', 
          fontSize: '0.84rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px' 
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Minimalistas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '18px 20px', backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gasto Total</span>
            <div style={{ padding: '6px', backgroundColor: '#ECFDF5', borderRadius: '6px', display: 'flex' }}>
              <DollarSign size={16} color="#10B981" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', letterSpacing: '-0.02em' }}>
            ${summary.totalFleetSpent.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Acumulado en cargas</span>
        </div>

        <div style={{ padding: '18px 20px', backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Litros Consumidos</span>
            <div style={{ padding: '6px', backgroundColor: '#EFF6FF', borderRadius: '6px', display: 'flex' }}>
              <Fuel size={16} color="#3B82F6" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', letterSpacing: '-0.02em' }}>
            {summary.totalFleetLiters.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>L</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Total de litros despachados</span>
        </div>

        <div style={{ padding: '18px 20px', backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Promedio Flota</span>
            <div style={{ padding: '6px', backgroundColor: '#EEF2FF', borderRadius: '6px', display: 'flex' }}>
              <Gauge size={16} color="#6366F1" />
            </div>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px', letterSpacing: '-0.02em' }}>
            {summary.averageFleetLitersPer100Km > 0 ? summary.averageFleetLitersPer100Km.toFixed(1) : '--'} <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>L/100 km</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>Rendimiento medio global</span>
        </div>

        <div style={{ padding: '18px 20px', backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mayor Consumo</span>
            <div style={{ padding: '6px', backgroundColor: '#FEF2F2', borderRadius: '6px', display: 'flex' }}>
              <TrendingUp size={16} color="#EF4444" />
            </div>
          </div>
          {highestConsumingVehicle ? (
            <div style={{ marginTop: '6px' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {highestConsumingVehicle.brand} {highestConsumingVehicle.model}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ padding: '2px 6px', backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: '0.75rem', borderRadius: '4px' }}>
                  {highestConsumingVehicle.litersPer100Km} L/100 km
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>({highestConsumingVehicle.plate})</span>
              </div>
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>Requiere al menos 2 cargas</span>
          )}
        </div>
      </div>

      {/* Ranking de Vehículos por Consumo Promedio */}
      <div style={{ backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
            Ranking de Eficiencia y Consumo (L / 100 km)
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
            Comparativa del consumo promedio por unidad ordenado de mayor a menor consumo.
          </span>
        </div>

        {vehicleStats.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            No se registran datos de vehículos activos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {vehicleStats.map((stat: any) => {
              const maxLitersPer100 = Math.max(...vehicleStats.map((s: any) => s.litersPer100Km || 0), 1);
              const percentage = stat.litersPer100Km > 0 ? (stat.litersPer100Km / maxLitersPer100) * 100 : 0;
              
              let badgeText = 'Normal';
              let badgeBg = 'var(--bg-secondary, #F3F4F6)';
              let badgeColor = 'var(--text-secondary)';
              let barBg = '#374151';

              if (stat.litersPer100Km > 0) {
                if (summary.averageFleetLitersPer100Km > 0 && stat.litersPer100Km > summary.averageFleetLitersPer100Km * 1.25) {
                  badgeText = 'Alto Consumo';
                  badgeBg = '#FEF2F2';
                  badgeColor = '#DC2626';
                  barBg = '#EF4444';
                } else if (summary.averageFleetLitersPer100Km > 0 && stat.litersPer100Km < summary.averageFleetLitersPer100Km * 0.85) {
                  badgeText = 'Eficiente';
                  badgeBg = '#ECFDF5';
                  badgeColor = '#059669';
                  barBg = '#10B981';
                }
              }

              return (
                <div key={stat.vehicleId} style={{ padding: '12px 16px', backgroundColor: 'var(--bg-app, #F9FAFB)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Car size={16} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {stat.brand} {stat.model}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', padding: '2px 6px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                        {stat.plate}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', backgroundColor: badgeBg, color: badgeColor }}>
                        {badgeText}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '0.82rem' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Gasto: </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${stat.vehicleSpent.toLocaleString('es-AR')}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Cargas: </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat.logsCount}</span>
                      </div>
                      <div style={{ minWidth: '110px', textAlign: 'right' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {stat.litersPer100Km > 0 ? `${stat.litersPer100Km} L/100km` : 'Midiendo...'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro barra de nivel */}
                  <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${Math.max(percentage, 3)}%`, 
                        backgroundColor: barBg, 
                        borderRadius: '3px',
                        transition: 'width 0.4s ease'
                      }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabla de Cargas Recientes */}
      <div style={{ backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Historial de Cargas Registradas</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Listado detallado de recargas por fecha y odómetro</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Filtrar por Vehículo:</label>
            <select
              value={selectedVehicleFilter}
              onChange={(e) => setSelectedVehicleFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              style={{ padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', backgroundColor: '#fff' }}
            >
              <option value="ALL">Todos los vehículos ({vehicles.length})</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            No se han registrado cargas de combustible para el criterio seleccionado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.83rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-app, #F9FAFB)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <th style={{ padding: '10px 16px' }}>Fecha</th>
                  <th style={{ padding: '10px 16px' }}>Vehículo</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Odómetro (km)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Litros (L)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Precio / L</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Total ($)</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center' }}>Tanque</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {new Date(log.date).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.vehicle ? `${log.vehicle.brand} ${log.vehicle.model}` : 'Vehículo general'}
                      <span style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ({log.vehicle?.plate})
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {log.odometer.toLocaleString('es-AR')} km
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {Number(log.liters).toFixed(1)} L
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      ${Number(log.pricePerLiter || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      ${Number(log.totalCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {log.isFullTank ? (
                        <span style={{ padding: '2px 6px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                          Lleno
                        </span>
                      ) : (
                        <span style={{ padding: '2px 6px', backgroundColor: '#F3F4F6', color: '#4B5563', fontSize: '0.72rem', borderRadius: '4px' }}>
                          Parcial
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                        title="Eliminar carga"
                      >
                        <Trash2 size={15} color="#EF4444" />
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-app, #F9FAFB)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '6px', backgroundColor: '#111827', borderRadius: '6px', display: 'flex' }}>
                  <Fuel size={16} color="#10B981" />
                </div>
                <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Registrar Carga de Combustible</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.83rem' }}>
              {/* Selección de Vehículo */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Vehículo *</label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  required
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.83rem', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Fecha Carga *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.83rem', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Odómetro Actual (km) *</label>
                  <input
                    type="number"
                    value={form.odometer}
                    onChange={(e) => setForm({ ...form, odometer: e.target.value })}
                    placeholder="Ej: 125400"
                    required
                    min="0"
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.83rem', fontFamily: 'monospace', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Litros y Costo Total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Litros (L) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.liters}
                    onChange={(e) => handleCostOrLitersChange('liters', e.target.value)}
                    placeholder="0.0"
                    required
                    min="0.1"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.83rem', fontFamily: 'monospace', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Monto Total ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.totalCost}
                    onChange={(e) => handleCostOrLitersChange('totalCost', e.target.value)}
                    placeholder="0.00"
                    required
                    min="1"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.83rem', fontFamily: 'monospace', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Precio / L ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pricePerLiter}
                    readOnly
                    placeholder="Auto"
                    style={{ width: '100%', padding: '8px 10px', fontSize: '0.83rem', fontFamily: 'monospace', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app, #F9FAFB)', color: 'var(--text-muted)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              {/* Checkbox Tanque Lleno */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '4px' }}>
                <input
                  type="checkbox"
                  id="isFullTank"
                  checked={form.isFullTank}
                  onChange={(e) => setForm({ ...form, isFullTank: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="isFullTank" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer' }}>
                  ¿Fue carga a tanque lleno? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Recomendado para medición L/100km)</span>
                </label>
              </div>

              {/* Checkbox Afectar Finanzas */}
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-app, #F9FAFB)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="affectFinance"
                    checked={form.affectFinance}
                    onChange={(e) => setForm({ ...form, affectFinance: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="affectFinance" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}>
                    Descontar dinero de Caja o Banco
                  </label>
                </div>

                {form.affectFinance && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '4px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '2px' }}>Método de Pago</label>
                      <select
                        value={form.paymentMethod}
                        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                        style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                      >
                        <option value="CASH">Efectivo (Caja Chica)</option>
                        <option value="TRANSFER">Transferencia / Débito</option>
                      </select>
                    </div>

                    {form.paymentMethod === 'TRANSFER' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '2px' }}>Cuenta Bancaria</label>
                        <select
                          value={form.bankAccountId}
                          onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                          style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
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
                <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Notas / Estación de Servicio (opcional)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ej: YPF Ruta 9, Carga antes del viaje a Rosario"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '0.83rem', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#fff', backgroundColor: 'var(--accent-color, #111827)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
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
