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
  X,
  Calendar,
  MapPin,
  User,
  Settings,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Clock
} from 'lucide-react';
import WeeklyScheduleModal from '../modals/WeeklyScheduleModal';

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
  
  // Computed metrics from orders list (3 Master Operational Pillars)
  const recibidosOrdersCount = useMemo(() => orders.filter(o => o.status === 'PENDING' || o.status === 'RECIBIDO').length, [orders]);
  const armadosOrdersCount = useMemo(() => orders.filter(o => o.status === 'PREPARING' || (o.status === 'PREPARED' && !o.invoiceNumber)).length, [orders]);
  const facturadosDespachadosOrdersCount = useMemo(() => orders.filter(o => o.invoiceNumber || o.status === 'DELIVERED' || o.status === 'BILLED' || (o.deliveryRoute && (o.deliveryRoute.status === 'IN_TRANSIT' || o.deliveryRoute.status === 'COMPLETED'))).length, [orders]);

  // Estados para resumen de finanzas, cuentas por cobrar y cajas pendientes
  const [financesSummary, setFinancesSummary] = useState<{
    totalOutstandingBalance: number;
    pendingClientsCount: number;
    pendingRendicionesAmount: number;
    pendingRendicionesCount: number;
    pendingSellersCount: number;
    pendingDriversCount: number;
  } | null>(null);
  const [loadingFinances, setLoadingFinances] = useState(false);

  const fetchFinancesSummary = async () => {
    setLoadingFinances(true);
    try {
      const res = await api.getCollectionsSummary();
      if (res) {
        setFinancesSummary(res);
      }
    } catch (err) {
      console.error('Error al obtener resumen de finanzas/rendiciones:', err);
    } finally {
      setLoadingFinances(false);
    }
  };

  // Estados para Cronograma Semanal
  const [weeklyScheduleData, setWeeklyScheduleData] = useState<{ currentWeek: string; items: any[] }>({ currentWeek: 'SEMANA_1', items: [] });
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedDayTab, setSelectedDayTab] = useState<string>(''); // Vacio = Día de hoy por defecto

  const fetchWeeklySchedule = async () => {
    setLoadingSchedule(true);
    try {
      const res = await api.getWeeklySchedule();
      if (res) {
        setWeeklyScheduleData({
          currentWeek: res.currentWeek || 'SEMANA_1',
          items: res.items || []
        });
      }
    } catch (err) {
      console.error('Error al cargar cronograma semanal:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    fetchWeeklySchedule();
    fetchFinancesSummary();
  }, []);

  const handleToggleCurrentWeek = async () => {
    const nextWeek = weeklyScheduleData.currentWeek === 'SEMANA_1' ? 'SEMANA_2' : 'SEMANA_1';
    try {
      await api.setCurrentWeek(nextWeek);
      fetchWeeklySchedule();
    } catch (err) {
      console.error('Error al cambiar semana:', err);
    }
  };

  // Día de la semana actual en español
  const dayNamesEs = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const todayIndex = new Date().getDay();
  const todayName = dayNamesEs[todayIndex];

  const activeDayName = selectedDayTab || todayName;

  // Filtrar ítems para la semana activa y el día seleccionado
  const activeDayScheduleItems = useMemo(() => {
    return weeklyScheduleData.items.filter(item => {
      const isWeekMatch = item.weekType === weeklyScheduleData.currentWeek || item.weekType === 'TODAS';
      const isDayMatch = item.dayOfWeek === activeDayName;
      return isWeekMatch && isDayMatch;
    });
  }, [weeklyScheduleData, activeDayName]);

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
        
        // Asignar proveedores de la base de datos (filtrados si están activos)
        const filteredSuppliers = (suppliersData || []).filter((s: any) => s.isActive !== false);
        setSuppliers(filteredSuppliers);
        
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

      {/* Grilla de Métricas de Pedidos Master (3 Tarjetas Principales) */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div 
          className="card stat-card" 
          style={{ 
            borderLeft: '4px solid #007AFF', 
            padding: '16px 20px',
            background: 'var(--background-card)',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
          }} 
          onClick={() => setSummaryCardModal({ open: true, cardKey: 'RECIBIDO', cardLabel: 'Pedidos Recibidos' })}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label" style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              📥 Pedidos Recibidos
            </div>
            <span style={{ fontSize: '1.2rem' }}>📋</span>
          </div>
          <div className="stat-value" style={{ color: '#007AFF', fontSize: '2.2rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
            {recibidosOrdersCount}
          </div>
          <div className="stat-desc" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Pendientes de recolección en depósito
          </div>
        </div>

        <div 
          className="card stat-card" 
          style={{ 
            borderLeft: '4px solid #F59E0B', 
            padding: '16px 20px',
            background: 'var(--background-card)',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
          }} 
          onClick={() => setSummaryCardModal({ open: true, cardKey: 'ARMADO', cardLabel: 'Pedidos En Armado / Picking' })}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label" style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              📦 En Armado / Picking
            </div>
            <span style={{ fontSize: '1.2rem' }}>⚖️</span>
          </div>
          <div className="stat-value" style={{ color: '#F59E0B', fontSize: '2.2rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
            {armadosOrdersCount}
          </div>
          <div className="stat-desc" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Mercadería en embalaje y control
          </div>
        </div>

        <div 
          className="card stat-card" 
          style={{ 
            borderLeft: '4px solid #10B981', 
            padding: '16px 20px',
            background: 'var(--background-card)',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
          }} 
          onClick={() => setSummaryCardModal({ open: true, cardKey: 'FACTURADO', cardLabel: 'Pedidos Facturados & Despachos' })}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label" style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              🚚 Facturados & Despachos
            </div>
            <span style={{ fontSize: '1.2rem' }}>🧾</span>
          </div>
          <div className="stat-value" style={{ color: '#10B981', fontSize: '2.2rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
            {facturadosDespachadosOrdersCount}
          </div>
          <div className="stat-desc" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Comprobantes emitidos / Reparto activo
          </div>
        </div>
      </div>

      {/* Grilla de Resumen Financiero & Rendiciones (2 Tarjetas Principales para Administradores) */}
      <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
        {/* Dinero por Cobrar */}
        <div 
          className="card stat-card" 
          style={{ 
            borderLeft: '4px solid #8B5CF6', 
            padding: '16px 20px',
            background: 'var(--background-card)',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
          }} 
          onClick={() => {
            setClientSearchModal({ open: true, action: 'ledger' });
            setQuickClientQuery('');
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label" style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              💳 Dinero por Cobrar (Cuentas Corrientes)
            </div>
            <span style={{ fontSize: '1.2rem' }}>📊</span>
          </div>
          <div className="stat-value" style={{ color: '#8B5CF6', fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
            {loadingFinances ? 'Cargando...' : `$ ${financesSummary?.totalOutstandingBalance?.toLocaleString('es-AR') ?? '0'}`}
          </div>
          <div className="stat-desc" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {financesSummary?.pendingClientsCount ? `${financesSummary.pendingClientsCount} clientes con saldo pendiente` : 'Sin saldos deudores acumulados'}
          </div>
        </div>

        {/* Recordatorio de Cajas Pendientes */}
        <div 
          className="card stat-card" 
          style={{ 
            borderLeft: (financesSummary?.pendingRendicionesCount || 0) > 0 ? '4px solid #E30613' : '4px solid #10B981', 
            padding: '16px 20px',
            background: 'var(--background-card)',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)' 
          }} 
          onClick={() => setActiveTab('rendiciones')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="stat-label" style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
              📬 Cajas & Rendiciones Pendientes (Dinero a Rendir)
            </div>
            <span style={{ fontSize: '1.2rem' }}>💰</span>
          </div>
          <div className="stat-value" style={{ color: (financesSummary?.pendingRendicionesCount || 0) > 0 ? '#E30613' : '#10B981', fontSize: '1.8rem', fontWeight: 800, margin: '6px 0 2px 0' }}>
            {loadingFinances ? 'Cargando...' : `$ ${financesSummary?.pendingRendicionesAmount?.toLocaleString('es-AR') ?? '0'}`}
          </div>
          <div className="stat-desc" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {(financesSummary?.pendingRendicionesCount || 0) > 0 ? (
              <>
                <span style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
                  ⚠️ {financesSummary?.pendingRendicionesCount} caja(s) por rendir
                </span>
                <span>({financesSummary?.pendingSellersCount || 0} vend. / {financesSummary?.pendingDriversCount || 0} choc.)</span>
              </>
            ) : (
              <span style={{ color: '#10B981', fontWeight: 600 }}>✓ Todas las cajas rendidas y al día</span>
            )}
          </div>
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
              title: 'Rendición de Cajas',
              desc: (financesSummary?.pendingRendicionesCount || 0) > 0 
                ? `${financesSummary?.pendingRendicionesCount} pendientes ($${Math.round(financesSummary?.pendingRendicionesAmount || 0).toLocaleString('es-AR')})` 
                : 'Auditar rendiciones al día',
              badge: (financesSummary?.pendingRendicionesCount || 0) > 0 ? `${financesSummary?.pendingRendicionesCount}` : null,
              badgeColor: '#E30613',
              icon: <DollarSign size={20} style={{ color: (financesSummary?.pendingRendicionesCount || 0) > 0 ? '#E30613' : 'var(--text-secondary)' }} />,
              onClick: () => {
                setActiveTab('rendiciones');
              }
            },
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
              title: 'Cuentas por Cobrar',
              desc: financesSummary?.totalOutstandingBalance 
                ? `$${Math.round(financesSummary.totalOutstandingBalance).toLocaleString('es-AR')} por cobrar` 
                : 'Estado de Cuenta Corriente',
              icon: <BookOpen size={20} style={{ color: '#8B5CF6' }} />,
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
          ].map((act: any) => (
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
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
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
                {act.badge && (
                  <span style={{
                    backgroundColor: act.badgeColor || '#E30613',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    {act.badge}
                  </span>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{act.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{act.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ====================================================================
          OPCIÓN 1: CINTA INLINE ULTRA-DELGADA (LINEAR STYLE)
          ==================================================================== */}
      <div style={{
        marginTop: '16px',
        padding: '10px 16px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid var(--border-color, #e5e5e7)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '0.83rem'
      }}>
        {/* Left side: Integrated Ribbon text */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <Calendar size={15} style={{ color: 'var(--color-corp-red, #E30613)', flexShrink: 0 }} />

          {/* Badge interactivo Semana 1 / Semana 2 */}
          <button
            onClick={handleToggleCurrentWeek}
            title="Haz clic para alternar entre Semana 1 y Semana 2"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.74rem',
              fontWeight: 700,
              backgroundColor: weeklyScheduleData.currentWeek === 'SEMANA_1' ? '#FEF2F2' : '#EFF6FF',
              color: weeklyScheduleData.currentWeek === 'SEMANA_1' ? 'var(--color-corp-red, #E30613)' : '#2563EB',
              border: weeklyScheduleData.currentWeek === 'SEMANA_1' ? '1px solid #FCA5A5' : '1px solid #BFDBFE',
              cursor: 'pointer'
            }}
          >
            <span>{weeklyScheduleData.currentWeek === 'SEMANA_1' ? 'Semana 1' : 'Semana 2'}</span>
            <RefreshCw size={10} style={{ opacity: 0.7 }} />
          </button>

          <span style={{ color: '#9CA3AF' }}>·</span>

          <span style={{ fontWeight: 600, color: '#374151' }}>
            Hoy ({todayName.charAt(0) + todayName.slice(1).toLowerCase()}):
          </span>

          {activeDayScheduleItems.length === 0 ? (
            <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Sin actividad agendada</span>
          ) : activeDayScheduleItems.some((i: any) => i.activityType === 'FERIADO') ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#991B1B',
              fontWeight: 700,
              backgroundColor: '#FEF2F2',
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid #FCA5A5'
            }}>
              <span>🎉 Feriado · No se trabaja</span>
            </span>
          ) : (
            activeDayScheduleItems.map((item: any, idx: number) => {
              const isPreventa = item.activityType === 'PREVENTA';
              const isReparto = item.activityType === 'REPARTO';

              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <span style={{ color: '#D1D5DB' }}>·</span>}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#111827',
                    fontWeight: 500
                  }}>
                    {isPreventa ? (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }} />
                    ) : (
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3B82F6', display: 'inline-block' }} />
                    )}
                    <span style={{ color: '#4B5563', fontWeight: 600 }}>
                      {isPreventa ? (item.sellerName ? `${item.sellerName}:` : 'Preventa:') : 'Reparto:'}
                    </span>
                    <strong style={{ color: '#111827' }}>{item.location}</strong>
                  </span>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Right side: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setSelectedDayTab(prev => prev === 'FULL' ? '' : 'FULL')}
            style={{
              background: 'none',
              border: 'none',
              color: selectedDayTab === 'FULL' ? 'var(--color-corp-red, #E30613)' : '#6B7280',
              fontSize: '0.78rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {selectedDayTab === 'FULL' ? 'Ocultar semana' : 'Ver semana'}
          </button>
          <span style={{ color: '#E5E7EB' }}>|</span>
          <button
            onClick={() => setIsScheduleModalOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#3B82F6',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Settings size={13} />
            Editar
          </button>
        </div>
      </div>

      {/* Vista Desplegable de la Semana Completa (Si presiona "Ver semana") */}
      {selectedDayTab === 'FULL' && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: '#FAF9F8',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '8px'
        }}>
          {['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'].map(day => {
            const isToday = day === todayName;
            const dayItems = weeklyScheduleData.items.filter(i => (i.weekType === weeklyScheduleData.currentWeek || i.weekType === 'TODAS') && i.dayOfWeek === day);
            const feriado = dayItems.find(i => i.activityType === 'FERIADO');
            const preventa = dayItems.find(i => i.activityType === 'PREVENTA' || i.activityType === 'AMBOS');
            const reparto = dayItems.find(i => i.activityType === 'REPARTO' || i.activityType === 'AMBOS');

            return (
              <div
                key={day}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: isToday ? '#ffffff' : 'transparent',
                  border: isToday ? '1px solid #FCA5A5' : '1px solid transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isToday ? 'var(--color-corp-red, #E30613)' : '#374151' }}>
                    {day.substring(0, 3)}
                  </span>
                  {isToday && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#E30613' }}>HOY</span>}
                </div>

                <div style={{ fontSize: '0.73rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {feriado ? (
                    <span style={{ color: '#991B1B', fontWeight: 600 }}>🎉 Feriado (No se trabaja)</span>
                  ) : (
                    <>
                      {preventa && <span style={{ color: '#065F46' }}>🟢 {preventa.location}</span>}
                      {reparto && <span style={{ color: '#1E40AF' }}>🚛 {reparto.location}</span>}
                      {!preventa && !reparto && <span style={{ color: '#9CA3AF' }}>-</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      <WeeklyScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        items={weeklyScheduleData.items}
        currentWeek={weeklyScheduleData.currentWeek}
        onRefresh={fetchWeeklySchedule}
      />
    </div>
  );
}

