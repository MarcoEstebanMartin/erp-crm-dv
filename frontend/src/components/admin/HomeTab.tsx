import React, { useMemo } from 'react';
import { api } from '../../utils/api';
import { 
  Receipt, 
  UserPlus, 
  ShoppingCart, 
  Printer, 
  Search, 
  BookOpen, 
  DollarSign, 
  Truck 
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
                localStorage.setItem('open_fleet_gasto_modal', 'true');
                setActiveTab('logistica');
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
    </div>
  );
}
