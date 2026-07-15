import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  Layers, 
  Settings, 
  Activity, 
  FileText, 
  Check, 
  Clock, 
  ChevronRight, 
  ChevronDown, 
  Wrench, 
  AlertCircle 
} from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
}

interface Maintenance {
  id: number;
  type: 'SERVICE' | 'REPAIR' | 'FUEL' | 'CLEANING' | 'OTHER';
  description: string;
  cost: number;
  odometer: number;
  date: string;
  supplier?: Supplier | null;
  transactionId?: number | null;
}

interface Expiry {
  id: number;
  type: 'INSURANCE' | 'VTE_ITV' | 'PATENT' | 'CARNET' | 'OTHER';
  description: string;
  expirationDate: string;
  alertSent: boolean;
}

interface Vehicle {
  id: number;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentOdometer: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  notes?: string | null;
  maintenances: Maintenance[];
  expirations: Expiry[];
}

export default function FleetDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selección de vehículo para ficha de detalle
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  
  // Proveedores y Cuentas bancarias para formularios
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  
  // Modales
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showExpiryModal, setShowExpiryModal] = useState(false);

  // Estados de Formularios
  const [vehicleForm, setVehicleForm] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    currentOdometer: 0,
    status: 'ACTIVE' as Vehicle['status'],
    notes: ''
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'SERVICE' as Maintenance['type'],
    description: '',
    cost: '',
    odometer: '',
    date: new Date().toISOString().substring(0, 10),
    supplierId: '',
    affectFinance: false,
    paymentMethod: 'CASH',
    bankAccountId: '',
    billingType: 'INTERNAL'
  });

  const [expiryForm, setExpiryForm] = useState({
    type: 'INSURANCE' as Expiry['type'],
    description: '',
    expirationDate: new Date().toISOString().substring(0, 10)
  });

  useEffect(() => {
    const init = async () => {
      await fetchVehicles();
      await loadFormResources();
      
      if (localStorage.getItem('open_fleet_gasto_modal') === 'true') {
        localStorage.removeItem('open_fleet_gasto_modal');
        setShowMaintenanceModal(true);
      }
    };
    init();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const data = await api.getVehicles();
      setVehicles(data);
      // Auto-seleccionar el primero si no hay ninguno seleccionado
      if (data.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(data[0].id);
      }
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
      setSuppliers(supplierData || []);
    } catch (e) {
      console.error('Error al cargar recursos secundarios para flota:', e);
    }
  };

  // Guardar Vehículo (Crear/Editar)
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        await api.updateVehicle(editingVehicle.id, vehicleForm);
      } else {
        await api.createVehicle(vehicleForm);
      }
      setShowVehicleModal(false);
      setEditingVehicle(null);
      resetVehicleForm();
      fetchVehicles();
    } catch (e: any) {
      alert(e.message || 'Error al guardar vehículo.');
    }
  };

  const handleEditVehicleClick = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      currentOdometer: vehicle.currentOdometer,
      status: vehicle.status,
      notes: vehicle.notes || ''
    });
    setShowVehicleModal(true);
  };

  const handleDeleteVehicleClick = async (id: number) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este vehículo de la flota?')) return;
    try {
      await api.deleteVehicle(id);
      if (selectedVehicleId === id) setSelectedVehicleId(null);
      fetchVehicles();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar vehículo.');
    }
  };

  // Registrar Mantenimiento
  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;

    const currentVehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (currentVehicle && Number(maintenanceForm.odometer) < currentVehicle.currentOdometer) {
      if (!window.confirm(`El kilometraje ingresado (${maintenanceForm.odometer} km) es inferior al kilometraje actual del vehículo (${currentVehicle.currentOdometer} km). ¿Desea continuar de todas formas?`)) {
        return;
      }
    }

    try {
      await api.createVehicleMaintenance(selectedVehicleId, {
        ...maintenanceForm,
        cost: Number(maintenanceForm.cost),
        odometer: Number(maintenanceForm.odometer),
        supplierId: maintenanceForm.supplierId ? Number(maintenanceForm.supplierId) : null,
        bankAccountId: maintenanceForm.bankAccountId ? Number(maintenanceForm.bankAccountId) : null
      });
      setShowMaintenanceModal(false);
      resetMaintenanceForm();
      fetchVehicles();
    } catch (e: any) {
      alert(e.message || 'Error al registrar actividad.');
    }
  };

  // Registrar Vencimiento
  const handleSaveExpiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) return;
    try {
      await api.createVehicleExpiry(selectedVehicleId, expiryForm);
      setShowExpiryModal(false);
      resetExpiryForm();
      fetchVehicles();
    } catch (e: any) {
      alert(e.message || 'Error al registrar vencimiento.');
    }
  };

  const handleDeleteExpiry = async (id: number) => {
    if (!window.confirm('¿Eliminar esta alerta de vencimiento?')) return;
    try {
      await api.deleteVehicleExpiry(id);
      fetchVehicles();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar vencimiento.');
    }
  };

  const handleDeleteMaintenance = async (id: number) => {
    if (!window.confirm('¿Eliminar este registro de mantenimiento? Si tiene un gasto financiero asociado, este se anulará también de la caja/banco.')) return;
    try {
      await api.deleteVehicleMaintenance(id);
      fetchVehicles();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar mantenimiento.');
    }
  };

  const resetVehicleForm = () => {
    setVehicleForm({
      plate: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      currentOdometer: 0,
      status: 'ACTIVE',
      notes: ''
    });
  };

  const resetMaintenanceForm = () => {
    setMaintenanceForm({
      type: 'SERVICE',
      description: '',
      cost: '',
      odometer: '',
      date: new Date().toISOString().substring(0, 10),
      supplierId: '',
      affectFinance: false,
      paymentMethod: 'CASH',
      bankAccountId: '',
      billingType: 'INTERNAL'
    });
  };

  const resetExpiryForm = () => {
    setExpiryForm({
      type: 'INSURANCE',
      description: '',
      expirationDate: new Date().toISOString().substring(0, 10)
    });
  };

  // Helpers de Formato y Estilo
  const getStatusBadge = (status: Vehicle['status']) => {
    let dotColor = '#10b981'; // Verde
    let label = 'Activo';
    if (status === 'MAINTENANCE') {
      dotColor = '#eab308'; // Amarillo
      label = 'En Taller';
    } else if (status === 'OUT_OF_SERVICE') {
      dotColor = '#E30613'; // Rojo corporativo
      label = 'Parado';
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: dotColor }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
      </div>
    );
  };

  const getMaintenanceLabel = (type: Maintenance['type']) => {
    switch (type) {
      case 'SERVICE': return 'Service';
      case 'REPAIR': return 'Reparación';
      case 'FUEL': return 'Combustible';
      case 'CLEANING': return 'Lavado';
      default: return 'Otro';
    }
  };

  const getExpiryLabel = (type: Expiry['type']) => {
    switch (type) {
      case 'INSURANCE': return 'Seguro';
      case 'VTE_ITV': return 'VTE / ITV';
      case 'PATENT': return 'Patente';
      case 'CARNET': return 'Licencia Chofer';
      default: return 'Otro';
    }
  };

  const isExpiryClose = (dateStr: string) => {
    const exp = new Date(dateStr);
    const today = new Date();
    const diff = exp.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 10; // Faltan 10 días o menos o ya venció
  };

  const isExpiryOverdue = (dateStr: string) => {
    const exp = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return exp < today; // Vencido
  };

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  // Reunir todas las alertas críticas de todos los vehículos
  const criticalExpirations = vehicles.flatMap(v => 
    v.expirations
      .filter(e => isExpiryClose(e.expirationDate))
      .map(e => ({ vehicle: v, expiry: e }))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', color: 'var(--text-primary)' }}>
      
      {/* Alertas críticas generales */}
      {criticalExpirations.length > 0 && (
        <div style={{ 
          border: '1px solid rgba(227, 6, 19, 0.2)', 
          backgroundColor: 'rgba(227, 6, 19, 0.03)', 
          borderRadius: '8px', 
          padding: '12px 18px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <AlertCircle size={20} color="#E30613" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#E30613' }}>
              Documentación Vencida o Próxima a Vencer
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginTop: '4px' }}>
              {criticalExpirations.slice(0, 4).map(({ vehicle, expiry }) => {
                const isOverdue = isExpiryOverdue(expiry.expirationDate);
                return (
                  <span key={expiry.id} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    🚗 <strong>{vehicle.plate}</strong> ({vehicle.brand} {vehicle.model}): {getExpiryLabel(expiry.type)} - 
                    <span style={{ 
                      color: '#E30613', 
                      fontWeight: 600, 
                      marginLeft: '4px',
                      textDecoration: isOverdue ? 'underline' : 'none'
                    }}>
                      {isOverdue ? 'VENCIDO el ' : 'Vence el '}
                      {new Date(expiry.expirationDate).toLocaleDateString()}
                    </span>
                  </span>
                );
              })}
              {criticalExpirations.length > 4 && (
                <span style={{ fontSize: '0.8rem', color: '#E30613', fontWeight: 600 }}>
                  + {criticalExpirations.length - 4} alertas más
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid principal de la Flota */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', alignItems: 'start' }}>
        
        {/* Columna Izquierda: Listado de Vehículos */}
        <div style={{ 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px', 
          backgroundColor: 'var(--bg-card, #fff)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 20px', 
            borderBottom: '1px solid var(--border-color)' 
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>Flota Activa ({vehicles.length})</span>
            <button 
              className="btn btn-ghost" 
              onClick={() => { setEditingVehicle(null); resetVehicleForm(); setShowVehicleModal(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '0.78rem', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
            >
              <Plus size={14} /> Registrar Vehículo
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando unidades...</div>
          ) : vehicles.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Layers size={32} style={{ opacity: 0.2, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay vehículos registrados en la flota.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {vehicles.map((v) => {
                const isSelected = selectedVehicleId === v.id;
                // Ver si este vehiculo particular tiene algun vencimiento critico
                const hasCritical = v.expirations.some(e => isExpiryClose(e.expirationDate));
                
                return (
                  <div 
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(0, 0, 0, 0.015)' : 'transparent',
                      transition: 'background 0.2s',
                      borderLeft: isSelected ? '3px solid #E30613' : '3px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {v.plate}
                        </span>
                        {hasCritical && (
                          <AlertTriangle size={13} color="#E30613" title="Vencimiento crítico cercano" />
                        )}
                        {getStatusBadge(v.status)}
                      </div>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {v.brand} {v.model} ({v.year})
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{v.currentOdometer.toLocaleString()} km</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Odómetro</span>
                      </div>
                      <ChevronRight size={16} style={{ opacity: 0.3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Ficha de Detalle del Vehículo Seleccionado */}
        <div>
          {selectedVehicle ? (
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              backgroundColor: 'var(--bg-card, #fff)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              padding: '24px'
            }}>
              
              {/* Encabezado Ficha */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '18px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{selectedVehicle.plate}</span>
                    {getStatusBadge(selectedVehicle.status)}
                  </div>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {selectedVehicle.brand} {selectedVehicle.model} — Año {selectedVehicle.year}
                  </span>
                  {selectedVehicle.notes && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
                      Nota: {selectedVehicle.notes}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn" 
                    onClick={() => handleEditVehicleClick(selectedVehicle)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Edit3 size={14} /> Editar
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => handleDeleteVehicleClick(selectedVehicle.id)}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', border: '1px solid rgba(227,6,19,0.2)', borderRadius: '4px', backgroundColor: 'rgba(227,6,19,0.02)', color: '#E30613', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Trash2 size={14} /> Borrar
                  </button>
                </div>
              </div>

              {/* Sección Vencimientos / Documentos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} /> Vencimientos y Seguros
                  </h3>
                  <button 
                    onClick={() => setShowExpiryModal(true)}
                    style={{ fontSize: '0.78rem', color: '#E30613', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Agregar Alerta
                  </button>
                </div>

                {selectedVehicle.expirations.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '10px 0' }}>
                    No hay alertas de vencimiento cargadas.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedVehicle.expirations.map((exp) => {
                      const isOverdue = isExpiryOverdue(exp.expirationDate);
                      const isClose = isExpiryClose(exp.expirationDate);
                      let boxBorder = 'var(--border-color)';
                      let boxBg = 'transparent';
                      let textDateColor = 'var(--text-secondary)';
                      
                      if (isOverdue) {
                        boxBorder = 'rgba(227, 6, 19, 0.2)';
                        boxBg = 'rgba(227, 6, 19, 0.02)';
                        textDateColor = '#E30613';
                      } else if (isClose) {
                        boxBorder = 'rgba(234, 179, 8, 0.3)';
                        boxBg = 'rgba(234, 179, 8, 0.02)';
                        textDateColor = '#eab308';
                      }

                      return (
                        <div 
                          key={exp.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            border: `1px solid ${boxBorder}`,
                            backgroundColor: boxBg,
                            borderRadius: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{getExpiryLabel(exp.type)}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{exp.description}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: textDateColor }}>
                                {isOverdue ? 'VENCIDO el ' : 'Vence el '}
                                {new Date(exp.expirationDate).toLocaleDateString()}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Fecha</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteExpiry(exp.id)}
                              style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#E30613'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Historial de Mantenimientos, Combustible y Services */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={16} /> Historial de Actividades
                  </h3>
                  <button 
                    onClick={() => setShowMaintenanceModal(true)}
                    style={{ fontSize: '0.78rem', color: '#E30613', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} /> Registrar Actividad
                  </button>
                </div>

                {selectedVehicle.maintenances.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '10px 0' }}>
                    No hay actividades registradas en el historial.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedVehicle.maintenances.map((m) => (
                      <div 
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ 
                            width: '28px', 
                            height: '28px', 
                            borderRadius: '50%', 
                            backgroundColor: 'var(--border-color)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            opacity: 0.8
                          }}>
                            {m.type === 'FUEL' ? <DollarSign size={14} /> : <Wrench size={14} />}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                              {getMaintenanceLabel(m.type)} — <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{m.description}</span>
                            </span>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                              {m.odometer.toLocaleString()} km {m.supplier ? `• ${m.supplier.name}` : ''}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>$ {Number(m.cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{new Date(m.date).toLocaleDateString()}</span>
                          </div>
                          <button 
                            onClick={() => handleDeleteMaintenance(m.id)}
                            style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#E30613'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div style={{ 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px', 
              backgroundColor: 'var(--bg-card, #fff)',
              padding: '60px 20px', 
              textAlign: 'center', 
              color: 'var(--text-secondary)' 
            }}>
              <Layers size={40} style={{ opacity: 0.15, marginBottom: '12px' }} />
              <p style={{ margin: 0, fontSize: '0.88rem' }}>Seleccione una unidad de la flota para ver su ficha técnica e historial.</p>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          MODAL: REGISTRO DE VEHÍCULO
          ==================================================================== */}
      {showVehicleModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-card, #fff)', borderRadius: '8px', width: '480px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 20px 0' }}>
              {editingVehicle ? 'Editar Vehículo' : 'Registrar Nuevo Vehículo'}
            </h2>
            <form onSubmit={handleSaveVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Patente / Dominio</label>
                  <input 
                    type="text" 
                    required 
                    disabled={!!editingVehicle}
                    value={vehicleForm.plate}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                    placeholder="AE123XX"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Año</label>
                  <input 
                    type="number" 
                    required 
                    value={vehicleForm.year}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, year: Number(e.target.value) })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Marca</label>
                  <input 
                    type="text" 
                    required 
                    value={vehicleForm.brand}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                    placeholder="Mercedes Benz"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Modelo</label>
                  <input 
                    type="text" 
                    required 
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                    placeholder="Accelo 815"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Kilometraje Inicial (Odómetro)</label>
                  <input 
                    type="number" 
                    required 
                    value={vehicleForm.currentOdometer}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, currentOdometer: Number(e.target.value) })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Estado de la Unidad</label>
                  <select 
                    value={vehicleForm.status}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value as Vehicle['status'] })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem', backgroundColor: 'var(--bg-card, #fff)' }}
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="MAINTENANCE">En Taller (Mantenimiento)</option>
                    <option value="OUT_OF_SERVICE">Fuera de Servicio (Parado)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Notas / Observaciones</label>
                <textarea 
                  value={vehicleForm.notes}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem', resize: 'none', height: '60px' }}
                  placeholder="Detalles sobre chofer asignado permanente, etc..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowVehicleModal(false)}
                  style={{ padding: '8px 16px', fontSize: '0.84rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '8px 16px', fontSize: '0.84rem', border: 'none', borderRadius: '4px', backgroundColor: '#E30613', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Guardar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: REGISTRO DE ACTIVIDAD (MANTENIMIENTO / COMBUSTIBLE)
          ==================================================================== */}
      {showMaintenanceModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-card, #fff)', borderRadius: '8px', width: '500px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 20px 0' }}>
              Registrar Actividad en {selectedVehicle?.plate}
            </h2>
            <form onSubmit={handleSaveMaintenance} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Tipo de Actividad</label>
                  <select 
                    value={maintenanceForm.type}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value as Maintenance['type'] })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem', backgroundColor: 'var(--bg-card, #fff)' }}
                  >
                    <option value="SERVICE">Service Programado</option>
                    <option value="REPAIR">Reparación / Taller</option>
                    <option value="FUEL">Carga de Combustible</option>
                    <option value="CLEANING">Lavadero / Limpieza</option>
                    <option value="OTHER">Otros Gastos</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Fecha</label>
                  <input 
                    type="date" 
                    required 
                    value={maintenanceForm.date}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Kilometraje del Evento (km)</label>
                  <input 
                    type="number" 
                    required 
                    value={maintenanceForm.odometer}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, odometer: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                    placeholder={selectedVehicle ? String(selectedVehicle.currentOdometer) : '0'}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Costo Total ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    value={maintenanceForm.cost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                    style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Descripción / Detalle</label>
                <input 
                  type="text" 
                  required 
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                  placeholder="ej: Carga 50L Gasoil Infinia o Cambio pastillas freno"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Proveedor / Taller (Opcional)</label>
                <select 
                  value={maintenanceForm.supplierId}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, supplierId: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem', backgroundColor: 'var(--bg-card, #fff)' }}
                >
                  <option value="">-- Seleccionar Taller/Estación --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Integración Financiera */}
              <div style={{ 
                border: '1px solid var(--border-color)', 
                borderRadius: '6px', 
                padding: '14px', 
                backgroundColor: 'rgba(0,0,0,0.01)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    id="affectFinance"
                    checked={maintenanceForm.affectFinance}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, affectFinance: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="affectFinance" style={{ fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    Registrar egreso contable en el ERP (Pago)
                  </label>
                </div>

                {maintenanceForm.affectFinance && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.2s' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Método de Pago</label>
                        <select 
                          value={maintenanceForm.paymentMethod}
                          onChange={(e) => setMaintenanceForm({ ...maintenanceForm, paymentMethod: e.target.value })}
                          style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem', backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          <option value="CASH">Efectivo (Caja Diaria)</option>
                          <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                          <option value="CHECK">Cheque</option>
                          <option value="OTHER">Otro</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Tipo de Gasto</label>
                        <select 
                          value={maintenanceForm.billingType}
                          onChange={(e) => setMaintenanceForm({ ...maintenanceForm, billingType: e.target.value })}
                          style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem', backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          <option value="INTERNAL">Interno (Sucursal X)</option>
                          <option value="OFFICIAL">Oficial (Factura A/B)</option>
                        </select>
                      </div>
                    </div>

                    {(maintenanceForm.paymentMethod === 'BANK_TRANSFER' || maintenanceForm.paymentMethod === 'CHECK') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Cuenta Bancaria</label>
                        <select 
                          required
                          value={maintenanceForm.bankAccountId}
                          onChange={(e) => setMaintenanceForm({ ...maintenanceForm, bankAccountId: e.target.value })}
                          style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.8rem', backgroundColor: 'var(--bg-card, #fff)' }}
                        >
                          <option value="">-- Seleccionar Cuenta --</option>
                          {bankAccounts.map(b => (
                            <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {maintenanceForm.paymentMethod === 'CASH' && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        💡 <em>Se descontará del saldo de su caja diaria activa.</em>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowMaintenanceModal(false)}
                  style={{ padding: '8px 16px', fontSize: '0.84rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '8px 16px', fontSize: '0.84rem', border: 'none', borderRadius: '4px', backgroundColor: '#E30613', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Confirmar Actividad
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: REGISTRO DE VENCIMIENTO
          ==================================================================== */}
      {showExpiryModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-card, #fff)', borderRadius: '8px', width: '420px', padding: '24px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 20px 0' }}>
              Agregar Vencimiento para {selectedVehicle?.plate}
            </h2>
            <form onSubmit={handleSaveExpiry} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Tipo de Alerta</label>
                <select 
                  value={expiryForm.type}
                  onChange={(e) => setExpiryForm({ ...expiryForm, type: e.target.value as Expiry['type'] })}
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem', backgroundColor: 'var(--bg-card, #fff)' }}
                >
                  <option value="INSURANCE">Póliza de Seguro</option>
                  <option value="VTE_ITV">VTE / ITV (Revisión Técnica)</option>
                  <option value="PATENT">Vencimiento de Patente</option>
                  <option value="CARNET">Licencia de Conducir (Chofer)</option>
                  <option value="OTHER">Otro Vencimiento</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Fecha de Vencimiento</label>
                <input 
                  type="date" 
                  required 
                  value={expiryForm.expirationDate}
                  onChange={(e) => setExpiryForm({ ...expiryForm, expirationDate: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Aclaración / Detalle</label>
                <input 
                  type="text" 
                  required 
                  value={expiryForm.description}
                  onChange={(e) => setExpiryForm({ ...expiryForm, description: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}
                  placeholder="ej: Compañía Rivadavia - Póliza N° 129384"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowExpiryModal(false)}
                  style={{ padding: '8px 16px', fontSize: '0.84rem', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'transparent', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '8px 16px', fontSize: '0.84rem', border: 'none', borderRadius: '4px', backgroundColor: '#E30613', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Guardar Alerta
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
