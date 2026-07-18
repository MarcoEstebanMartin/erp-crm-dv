import React, { useMemo, useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { 
  Receipt, 
  UserPlus, 
  ShoppingCart, 
  Printer, 
  Search, 
  BookOpen, 
  DollarSign, 
  Truck,
  X
} from 'lucide-react';

interface HomeTabProps {
  orders: any[];
  setActiveTab: (tab: string) => void;
  setSummaryCardModal: (modal: { open: boolean; cardKey: string; cardLabel: string } | null) => void;
  setClientModal: (modal: any) => void;
  setClientSearchModal: (modal: any) => void;
  setQuickClientQuery: (query: string) => void;
  setIsPriceListModalOpen: (open: boolean) => void;
  setIsQuickSearchModalOpen: (open: boolean) => void;
}

export default function HomeTab({
  orders,
  setActiveTab,
  setSummaryCardModal,
  setClientModal,
  setClientSearchModal,
  setQuickClientQuery,
  setIsPriceListModalOpen,
  setIsQuickSearchModalOpen
}: HomeTabProps) {
  
  // Computed metrics from orders list
  const recibidosOrdersCount = useMemo(() => orders.filter(o => o.status === 'PENDING' || o.status === 'PREPARING').length, [orders]);
  const armadosOrdersCount = useMemo(() => orders.filter(o => o.status === 'PREPARED' && !o.invoiceNumber).length, [orders]);
  const facturadosOrdersCount = useMemo(() => orders.filter(o => o.invoiceNumber && (!o.deliveryRoute || o.deliveryRoute.status === 'PENDING')).length, [orders]);
  const enViajeOrdersCount = useMemo(() => orders.filter(o => o.deliveryRoute && o.deliveryRoute.status === 'IN_TRANSIT').length, [orders]);
  const entregadosOrdersCount = useMemo(() => orders.filter(o => (o.status === 'DELIVERED' && !o.deliveryRouteId) || (o.deliveryRoute && o.deliveryRoute.status === 'COMPLETED')).length, [orders]);

  // Estados para el nuevo modal de Gasto de Flota
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);

  // Formulario de Gasto de Flota
  const [gastoForm, setGastoForm] = useState({
    vehicleId: '',
    type: 'FUEL',
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

  // Cargar datos al abrir el modal
  useEffect(() => {
    if (!showGastoModal) return;

    const loadModalData = async () => {
      setLoadingData(true);
      setErrorData(null);
      try {
        const [vehiclesData, suppliersData, bankAccountsData] = await Promise.all([
          api.getVehicles(),
          api.getPersonas('provider'),
          api.getBankAccounts()
        ]);
        setVehicles(vehiclesData || []);
        setSuppliers(suppliersData || []);
        setBankAccounts(bankAccountsData || []);
      } catch (err: any) {
        console.error('Error al cargar datos para gasto de flota:', err);
        setErrorData(err.message || 'Error al obtener datos de flota y proveedores.');
      } finally {
        setLoadingData(false);
      }
    };

    loadModalData();
  }, [showGastoModal]);

  // Vehículo seleccionado actualmente en el formulario
  const selectedVehicle = useMemo(() => {
    if (!gastoForm.vehicleId) return null;
    return vehicles.find(v => v.id === Number(gastoForm.vehicleId)) || null;
  }, [gastoForm.vehicleId, vehicles]);

  // Sugerir odómetro actual del vehículo seleccionado
  useEffect(() => {
    if (selectedVehicle) {
      setGastoForm(prev => ({
        ...prev,
        odometer: prev.odometer ? prev.odometer : String(selectedVehicle.currentOdometer || 0)
      }));
    }
  }, [selectedVehicle]);

  // Guardar Gasto
  const handleSaveGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gastoForm.vehicleId) {
      alert('Debe seleccionar un vehículo.');
      return;
    }
    if (!gastoForm.cost || Number(gastoForm.cost) <= 0) {
      alert('Debe ingresar un costo válido mayor a cero.');
      return;
    }
    if (!gastoForm.odometer || Number(gastoForm.odometer) < 0) {
      alert('Debe ingresar un kilometraje válido.');
      return;
    }
    if (gastoForm.affectFinance) {
      if ((gastoForm.paymentMethod === 'BANK_TRANSFER' || gastoForm.paymentMethod === 'CHECK') && !gastoForm.bankAccountId) {
        alert('Debe seleccionar la cuenta bancaria de origen para el pago.');
        return;
      }
    }

    try {
      const vId = Number(gastoForm.vehicleId);
      await api.createVehicleMaintenance(vId, {
        type: gastoForm.type,
        description: gastoForm.description.trim(),
        cost: Number(gastoForm.cost),
        odometer: Number(gastoForm.odometer),
        date: gastoForm.date,
        supplierId: gastoForm.supplierId ? Number(gastoForm.supplierId) : null,
        affectFinance: gastoForm.affectFinance,
        paymentMethod: gastoForm.paymentMethod,
        bankAccountId: gastoForm.bankAccountId ? Number(gastoForm.bankAccountId) : null,
        billingType: gastoForm.billingType
      });

      alert('¡Gasto de flota registrado con éxito!');
      setShowGastoModal(false);
      // Limpiar formulario
      setGastoForm({
        vehicleId: '',
        type: 'FUEL',
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
    } catch (err: any) {
      alert(err.message || 'Error al registrar el gasto de flota.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {(() => {
            const hour = new Date().getHours();
            const greeting = hour >= 6 && hour < 12 ? '¡Buen día' : hour >= 12 && hour < 20 ? '¡Buenas tardes' : '¡Buenas noches';
            const user = api.getCurrentUser();
            return `${greeting}, ${user ? user.username : 'Usuario'}!`;
          })()}
        </h1>
        <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '-0.01em' }}>
          {(() => {
            const today = new Date();
            const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            const dateStr = today.toLocaleDateString('es-AR', options);
            return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
          })()}
        </div>
      </div>

      {/* Grilla de Métricas de Pedidos */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div className="card stat-card" style={{ borderLeft: '4px solid var(--accent-color)' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'RECIBIDO', cardLabel: 'Pedidos Recibidos' })}>
          <div className="stat-label">Pedidos Recibidos</div>
          <div className="stat-value" style={{ color: 'var(--accent-color)', fontSize: '1.8rem' }}>
            {recibidosOrdersCount}
          </div>
          <div className="stat-desc">Toma de pedidos (vendedores)</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #F59E0B' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'ARMADO', cardLabel: 'Pedidos Armados' })}>
          <div className="stat-label">Pedidos Armados</div>
          <div className="stat-value" style={{ color: '#F59E0B', fontSize: '1.8rem' }}>
            {armadosOrdersCount}
          </div>
          <div className="stat-desc">Pendientes de facturación</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #10B981' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'FACTURADO', cardLabel: 'Pedidos Facturados' })}>
          <div className="stat-label">Pedidos Facturados</div>
          <div className="stat-value" style={{ color: '#10B981', fontSize: '1.8rem' }}>
            {facturadosOrdersCount}
          </div>
          <div className="stat-desc">Listos para cargar al viaje</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid #8B5CF6' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'EN_VIAJE', cardLabel: 'Pedidos en Viaje' })}>
          <div className="stat-label">Pedidos en Viaje</div>
          <div className="stat-value" style={{ color: '#8B5CF6', fontSize: '1.8rem' }}>
            {enViajeOrdersCount}
          </div>
          <div className="stat-desc">Repartos activos en calle</div>
        </div>

        <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-success)' }} onClick={() => setSummaryCardModal({ open: true, cardKey: 'ENTREGADO', cardLabel: 'Pedidos Entregados' })}>
          <div className="stat-label">Pedidos Entregados</div>
          <div className="stat-value" style={{ color: 'var(--color-success)', fontSize: '1.8rem' }}>
            {entregadosOrdersCount}
          </div>
          <div className="stat-desc">Operación completada con éxito</div>
        </div>
      </div>

      {/* Accesos Directos (Acciones Rápidas) */}
      <div style={{ marginTop: '24px' }}>
        <style>{`
          .stat-card {
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
          }
          .quick-action-card:hover {
            transform: translateY(-2px);
            border-color: #a1a1a6 !important;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
            background-color: var(--bg-hover, #fbfbfd) !important;
          }
          .quick-action-card:active {
            transform: translateY(0);
          }
        `}</style>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
          Accesos Directos
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '16px' 
        }}>
          {[
            {
              title: 'Facturar Directo',
              desc: 'Emitir comprobante de venta',
              icon: <Receipt size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => {
                localStorage.setItem('preselected_billing_client', 'direct');
                setActiveTab('billing');
              }
            },
            {
              title: 'Agregar Cliente',
              desc: 'Registrar nueva persona',
              icon: <UserPlus size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => {
                setActiveTab('clients');
                setClientModal({ 
                  open: true, 
                  mode: 'create', 
                  data: { 
                    id: 0, 
                    name: '', 
                    cuit: '', 
                    address: '', 
                    city: '', 
                    phone: '', 
                    email: '', 
                    creditLimit: 0, 
                    priceList: 'A', 
                    discount: 0, 
                    isClient: true, 
                    isProvider: false, 
                    isSeller: false, 
                    isCommissionAgent: false,
                    route: '',
                    saleRouteId: null,
                    sellerId: null,
                    isActive: true
                  } 
                });
              }
            },
            {
              title: 'Tomar Pedido',
              desc: 'Registrar nuevo pedido',
              icon: <ShoppingCart size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => {
                setClientSearchModal({ open: true, action: 'order' });
                setQuickClientQuery('');
              }
            },
            {
              title: 'Lista de Precios',
              desc: 'Generar PDF general',
              icon: <Printer size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => setIsPriceListModalOpen(true)
            },
            {
              title: 'Buscar Precio',
              desc: 'Consulta rápida (Lupa)',
              icon: <Search size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => setIsQuickSearchModalOpen(true)
            },
            {
              title: 'Cuenta Corriente',
              desc: 'Estado y movimientos de CC',
              icon: <BookOpen size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => {
                setClientSearchModal({ open: true, action: 'ledger' });
                setQuickClientQuery('');
              }
            },
            {
              title: 'Cargar Recibo',
              desc: 'Registrar cobro de cliente',
              icon: <DollarSign size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => {
                setClientSearchModal({ open: true, action: 'payment' });
                setQuickClientQuery('');
              }
            },
            {
              title: 'Gasto de Flota',
              desc: 'Combustible, service o taller',
              icon: <Truck size={20} style={{ color: 'var(--text-secondary)' }} />,
              onClick: () => {
                setShowGastoModal(true);
              }
            }
          ].map((act) => (
            <button
              key={act.title}
              onClick={act.onClick}
              className="quick-action-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-color, #e5e5e7)',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                gap: '8px',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-light, #f5f5f7)',
                border: '1px solid var(--border-color, #e5e5e7)'
              }}>
                {act.icon}
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{act.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Modal flotante autocontenido para registrar Gasto de Flota de forma directa */}
      {showGastoModal && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          backgroundColor: 'rgba(0,0,0,0.4)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div style={{ 
            backgroundColor: 'var(--bg-card, #fff)', 
            borderRadius: '8px', 
            width: '520px', 
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px', 
            border: '1px solid var(--border-color)', 
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Registrar Gasto de Flota
              </h2>
              <button 
                type="button" 
                onClick={() => setShowGastoModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  padding: '4px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  color: 'var(--text-secondary)',
                  borderRadius: '50%',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-light, #f5f5f7)')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <X size={18} />
              </button>
            </div>

            {loadingData ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Cargando datos de flota y proveedores...
              </div>
            ) : errorData ? (
              <div style={{ padding: '20px', backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '6px', color: '#991B1B', fontSize: '0.85rem', marginBottom: '16px' }}>
                {errorData}
              </div>
            ) : (
              <form onSubmit={handleSaveGasto} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Vehículo de la Flota *</label>
                  <select 
                    required
                    value={gastoForm.vehicleId}
                    onChange={(e) => setGastoForm({ ...gastoForm, vehicleId: e.target.value, odometer: '' })}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '4px', 
                      border: '1px solid var(--border-color)', 
                      fontSize: '0.84rem', 
                      backgroundColor: 'var(--bg-card, #fff)',
                      color: 'var(--text-primary)',
                      outline: 'none'
                    }}
                  >
                    <option value="">-- Seleccionar Vehículo --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model} ({v.currentOdometer} km)</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tipo de Gasto *</label>
                    <select 
                      value={gastoForm.type}
                      onChange={(e) => setGastoForm({ ...gastoForm, type: e.target.value })}
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '0.84rem', 
                        backgroundColor: 'var(--bg-card, #fff)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="FUEL">Carga de Combustible</option>
                      <option value="SERVICE">Service Programado</option>
                      <option value="REPAIR">Reparación / Taller</option>
                      <option value="CLEANING">Lavadero / Limpieza</option>
                      <option value="OTHER">Otros Gastos</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Fecha *</label>
                    <input 
                      type="date" 
                      required 
                      value={gastoForm.date}
                      onChange={(e) => setGastoForm({ ...gastoForm, date: e.target.value })}
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '0.84rem', 
                        backgroundColor: 'var(--bg-card, #fff)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Kilometraje del Evento (km) *
                    </label>
                    <input 
                      type="number" 
                      required 
                      value={gastoForm.odometer}
                      onChange={(e) => setGastoForm({ ...gastoForm, odometer: e.target.value })}
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '0.84rem', 
                        backgroundColor: 'var(--bg-card, #fff)',
                        color: 'var(--text-primary)'
                      }}
                      placeholder={selectedVehicle ? String(selectedVehicle.currentOdometer) : '0'}
                    />
                    {selectedVehicle && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Actual: {selectedVehicle.currentOdometer} km
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Costo Total ($) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      required 
                      value={gastoForm.cost}
                      onChange={(e) => setGastoForm({ ...gastoForm, cost: e.target.value })}
                      style={{ 
                        padding: '8px 12px', 
                        borderRadius: '4px', 
                        border: '1px solid var(--border-color)', 
                        fontSize: '0.84rem', 
                        backgroundColor: 'var(--bg-card, #fff)',
                        color: 'var(--text-primary)'
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Descripción / Detalle *</label>
                  <input 
                    type="text" 
                    required 
                    value={gastoForm.description}
                    onChange={(e) => setGastoForm({ ...gastoForm, description: e.target.value })}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '4px', 
                      border: '1px solid var(--border-color)', 
                      fontSize: '0.84rem', 
                      backgroundColor: 'var(--bg-card, #fff)',
                      color: 'var(--text-primary)'
                    }}
                    placeholder="ej: Carga 50L Gasoil Infinia o Cambio de aceite"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>Proveedor / Taller (Opcional)</label>
                  <select 
                    value={gastoForm.supplierId}
                    onChange={(e) => setGastoForm({ ...gastoForm, supplierId: e.target.value })}
                    style={{ 
                      padding: '8px 12px', 
                      borderRadius: '4px', 
                      border: '1px solid var(--border-color)', 
                      fontSize: '0.84rem', 
                      backgroundColor: 'var(--bg-card, #fff)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">-- Seleccionar Proveedor --</option>
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
                  backgroundColor: 'var(--bg-light, #f5f5f7)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      id="affectFinanceHome"
                      checked={gastoForm.affectFinance}
                      onChange={(e) => setGastoForm({ ...gastoForm, affectFinance: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="affectFinanceHome" style={{ fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                      Registrar egreso contable en el ERP (Pago)
                    </label>
                  </div>

                  {gastoForm.affectFinance && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Método de Pago</label>
                          <select 
                            value={gastoForm.paymentMethod}
                            onChange={(e) => setGastoForm({ ...gastoForm, paymentMethod: e.target.value })}
                            style={{ 
                              padding: '6px 10px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border-color)', 
                              fontSize: '0.8rem', 
                              backgroundColor: 'var(--bg-card, #fff)',
                              color: 'var(--text-primary)'
                            }}
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
                            value={gastoForm.billingType}
                            onChange={(e) => setGastoForm({ ...gastoForm, billingType: e.target.value })}
                            style={{ 
                              padding: '6px 10px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border-color)', 
                              fontSize: '0.8rem', 
                              backgroundColor: 'var(--bg-card, #fff)',
                              color: 'var(--text-primary)'
                            }}
                          >
                            <option value="INTERNAL">Interno (Sucursal X)</option>
                            <option value="OFFICIAL">Oficial (Factura A/B)</option>
                          </select>
                        </div>
                      </div>

                      {(gastoForm.paymentMethod === 'BANK_TRANSFER' || gastoForm.paymentMethod === 'CHECK') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Cuenta Bancaria</label>
                          <select 
                            required
                            value={gastoForm.bankAccountId}
                            onChange={(e) => setGastoForm({ ...gastoForm, bankAccountId: e.target.value })}
                            style={{ 
                              padding: '6px 10px', 
                              borderRadius: '4px', 
                              border: '1px solid var(--border-color)', 
                              fontSize: '0.8rem', 
                              backgroundColor: 'var(--bg-card, #fff)',
                              color: 'var(--text-primary)'
                            }}
                          >
                            <option value="">-- Seleccionar Cuenta --</option>
                            {bankAccounts.map(b => (
                              <option key={b.id} value={b.id}>{b.bankName} - {b.accountNumber}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {gastoForm.paymentMethod === 'CASH' && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          💡 <em>Se descontará del saldo de tu caja diaria activa.</em>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowGastoModal(false)}
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '0.84rem', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '4px', 
                      backgroundColor: 'transparent', 
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-light, #f5f5f7)')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '0.84rem', 
                      border: 'none', 
                      borderRadius: '4px', 
                      backgroundColor: 'var(--text-primary, #111)', 
                      color: 'var(--bg-card, #fff)', 
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Guardar Gasto
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

