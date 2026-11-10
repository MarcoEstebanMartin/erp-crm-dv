import { CheckCircle, Truck, User, RefreshCw, Lock } from 'lucide-react';
import {
  type RendicionesTabType,
  type RouteGroup,
  type SellerGroup,
  formatCurrency,
  getDetectedRoutesAndCities
} from './types';
import CajaDepositoTab from './CajaDepositoTab';

interface PendingRendicionesTabsProps {
  activeTab: RendicionesTabType;
  onTabChange: (tab: RendicionesTabType) => void;
  loading: boolean;
  sellers: SellerGroup[];
  routes: RouteGroup[];
  drawers: any[];
  onOpenAudit: (type: 'seller' | 'route', data: any) => void;
  onInspectDrawer: (drawer: any) => void;
  onOpenCloseCaja: (drawerId: number) => void;
  onOpenNewCaja: () => void;
}

export default function PendingRendicionesTabs({
  activeTab,
  onTabChange,
  loading,
  sellers,
  routes,
  drawers,
  onOpenAudit,
  onInspectDrawer,
  onOpenCloseCaja,
  onOpenNewCaja
}: PendingRendicionesTabsProps) {
  return (
    <>
      {/* Tabs de Vendedores, Repartidores y Caja Diaria */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', gap: '24px' }}>
        <button
          type="button"
          onClick={() => onTabChange('sellers')}
          style={{
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'sellers' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'sellers' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'sellers' ? 600 : 400,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <User size={16} />
          Cajas de Vendedores
          <span
            style={{
              backgroundColor: sellers.length > 0 ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
              color: sellers.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            {sellers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('routes')}
          style={{
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'routes' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'routes' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'routes' ? 600 : 400,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Truck size={16} />
          Cajas de Repartidores
          <span
            style={{
              backgroundColor: routes.length > 0 ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
              color: routes.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            {routes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('diaria')}
          style={{
            padding: '12px 6px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'diaria' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: activeTab === 'diaria' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'diaria' ? 600 : 400,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Lock size={16} />
          Caja Diaria (Depósito)
        </button>
      </div>

      {/* Listado Principal */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
          Cargando cajas pendientes...
        </div>
      ) : activeTab === 'sellers' ? (
        sellers.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
            <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontWeight: 600 }}>Cajas de Vendedores al Día</h3>
            <p style={{ margin: 0, fontSize: '0.88rem' }}>No hay cobranzas móviles pendientes de verificar en la calle.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sellers.map((item) => {
              const detected = getDetectedRoutesAndCities(item.transactions);
              return (
                <div
                  key={item.user.id}
                  style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', transition: 'box-shadow 0.2s, border-color 0.2s', cursor: 'default' }}
                  className="list-card-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '50%', color: 'var(--color-primary)' }}>
                      <User size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{item.user.username.toUpperCase()}</h4>
                      <div style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{item.transactions.length} recibo(s) pendiente(s) de rendir</span>
                        {detected.primary && (
                          <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 8px', borderRadius: '10px', fontSize: '0.74rem', color: '#334155', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            📍 {detected.primary}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total a Rendir</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {formatCurrency(item.totalToCollect)}
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={() => onOpenAudit('seller', item)}
                      style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer' }}
                    >
                      Realizar Arqueo
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'routes' ? (
        routes.length === 0 ? (
          <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
            <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontWeight: 600 }}>Cajas de Reparto al Día</h3>
            <p style={{ margin: 0, fontSize: '0.88rem' }}>No hay hojas de ruta liquidadas pendientes de arqueo financiero.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {routes.map((item) => (
              <div
                key={item.routeId}
                style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', transition: 'box-shadow 0.2s, border-color 0.2s', cursor: 'default' }}
                className="list-card-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '50%', color: 'var(--color-primary)' }}>
                    <Truck size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{item.driverName}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Viaje #{item.routeId} | Patente: {item.vehiclePlate}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total a Rendir</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {formatCurrency(item.totalToCollect)}
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() => onOpenAudit('route', item)}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer' }}
                  >
                    Realizar Arqueo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <CajaDepositoTab
          activeDrawer={drawers.find((d) => d.branch === 'DEPOSITO')}
          onInspect={onInspectDrawer}
          onOpenCloseModal={onOpenCloseCaja}
          onOpenNewModal={onOpenNewCaja}
        />
      )}
    </>
  );
}
