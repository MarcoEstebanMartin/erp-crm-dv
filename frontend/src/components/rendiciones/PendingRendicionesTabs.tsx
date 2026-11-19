import { useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import { CheckCircle, Truck, User, RefreshCw, Lock, MapPin } from 'lucide-react';
import type { CollectorSettlementDTO } from '../../api/fieldReceipts.api';
import {
  type RendicionesTabType,
  type RouteGroup,
  type SellerGroup,
  formatCurrency,
  getDetectedRoutesAndCities,
} from './types';
import CajaDepositoTab from './CajaDepositoTab';
import { FieldSettlementCards } from './FieldSettlementCards';

interface PendingRendicionesTabsProps {
  activeTab: RendicionesTabType;
  onTabChange: (tab: RendicionesTabType) => void;
  loading: boolean;
  sellers: SellerGroup[];
  routes: RouteGroup[];
  sellerFieldSettlements?: CollectorSettlementDTO[];
  driverFieldSettlements?: CollectorSettlementDTO[];
  fieldBusyId?: number | null;
  declaredCashById?: Record<number, string>;
  setDeclaredCashById?: Dispatch<SetStateAction<Record<number, string>>>;
  onApproveFieldSettlement?: (s: CollectorSettlementDTO) => void;
  drawers: any[];
  onOpenAudit: (type: 'seller' | 'route', data: any) => void;
  onInspectDrawer: (drawer: any) => void;
  onOpenCloseCaja: (drawerId: number) => void;
  onOpenNewCaja: () => void;
}

const TAB_KEYS: RendicionesTabType[] = ['sellers', 'routes', 'diaria'];

export default function PendingRendicionesTabs({
  activeTab,
  onTabChange,
  loading,
  sellers,
  routes,
  sellerFieldSettlements = [],
  driverFieldSettlements = [],
  fieldBusyId = null,
  declaredCashById = {},
  setDeclaredCashById,
  onApproveFieldSettlement,
  drawers,
  onOpenAudit,
  onInspectDrawer,
  onOpenCloseCaja,
  onOpenNewCaja,
}: PendingRendicionesTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const totalSellersCount = sellers.length + sellerFieldSettlements.length;
  const totalDriversCount = routes.length + driverFieldSettlements.length;

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TAB_KEYS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TAB_KEYS.length - 1;
    else return;
    e.preventDefault();
    onTabChange(TAB_KEYS[nextIdx]);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <>
      <div role="tablist" aria-label="Cajas operativas" className="linear-tablist" style={{ marginBottom: '20px' }}>
        <button
          ref={(el) => { tabRefs.current[0] = el; }}
          type="button"
          role="tab"
          aria-selected={activeTab === 'sellers'}
          tabIndex={activeTab === 'sellers' ? 0 : -1}
          className="linear-tab"
          onClick={() => onTabChange('sellers')}
          onKeyDown={(e) => handleTabKeyDown(e, 0)}
        >
          <User size={15} aria-hidden="true" />
          Vendedores
          <span className="tabular-nums" style={{ backgroundColor: totalSellersCount > 0 ? 'rgba(0, 0, 0, 0.06)' : 'transparent', color: totalSellersCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '1px 7px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
            {totalSellersCount}
          </span>
        </button>

        <button
          ref={(el) => { tabRefs.current[1] = el; }}
          type="button"
          role="tab"
          aria-selected={activeTab === 'routes'}
          tabIndex={activeTab === 'routes' ? 0 : -1}
          className="linear-tab"
          onClick={() => onTabChange('routes')}
          onKeyDown={(e) => handleTabKeyDown(e, 1)}
        >
          <Truck size={15} aria-hidden="true" />
          Repartidores
          <span className="tabular-nums" style={{ backgroundColor: totalDriversCount > 0 ? 'rgba(0, 0, 0, 0.06)' : 'transparent', color: totalDriversCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', padding: '1px 7px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
            {totalDriversCount}
          </span>
        </button>

        <button
          ref={(el) => { tabRefs.current[2] = el; }}
          type="button"
          role="tab"
          aria-selected={activeTab === 'diaria'}
          tabIndex={activeTab === 'diaria' ? 0 : -1}
          className="linear-tab"
          onClick={() => onTabChange('diaria')}
          onKeyDown={(e) => handleTabKeyDown(e, 2)}
        >
          <Lock size={15} aria-hidden="true" />
          Caja Oficina
        </button>
      </div>

      <div role="tabpanel" style={{ minHeight: '300px' }}>
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="animate-spin" aria-hidden="true" style={{ margin: '0 auto 10px' }} />
          Cargando cajas...
        </div>
      ) : activeTab === 'sellers' ? (
        totalSellersCount === 0 ? (
          <div style={{ padding: '44px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
            <CheckCircle size={32} color="#10b981" aria-hidden="true" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Al día</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {setDeclaredCashById && onApproveFieldSettlement && (
              <FieldSettlementCards
                settlements={sellerFieldSettlements}
                channel="SELLER"
                busyId={fieldBusyId}
                declaredCashById={declaredCashById}
                setDeclaredCashById={setDeclaredCashById}
                onApprove={onApproveFieldSettlement}
              />
            )}
            {sellers.map((item) => {
              const detected = getDetectedRoutesAndCities(item.transactions);
              return (
                <div
                  key={item.user.id}
                  style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', gap: '16px', flexWrap: 'wrap' }}
                  className="list-card-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '50%', color: 'var(--color-primary)' }}>
                      <User size={20} aria-hidden="true" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 600 }}>{item.user.username.toUpperCase()}</h4>
                      <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="tabular-nums">{item.transactions.length} recibos</span>
                        {detected.primary && (
                          <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 8px', borderRadius: '10px', fontSize: '0.74rem', color: '#334155', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={12} aria-hidden="true" /> {detected.primary}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>A rendir</div>
                      <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {formatCurrency(item.totalToCollect)}
                      </div>
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={() => onOpenAudit('seller', item)}>
                      Arquear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : activeTab === 'routes' ? (
        totalDriversCount === 0 ? (
          <div style={{ padding: '44px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
            <CheckCircle size={32} color="#10b981" aria-hidden="true" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>Al día</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {setDeclaredCashById && onApproveFieldSettlement && (
              <FieldSettlementCards
                settlements={driverFieldSettlements}
                channel="DRIVER"
                busyId={fieldBusyId}
                declaredCashById={declaredCashById}
                setDeclaredCashById={setDeclaredCashById}
                onApprove={onApproveFieldSettlement}
              />
            )}
            {routes.map((item) => (
              <div
                key={item.routeId}
                style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', gap: '16px', flexWrap: 'wrap' }}
                className="list-card-item"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '50%', color: 'var(--color-primary)' }}>
                    <Truck size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 600 }}>{item.driverName}</h4>
                    <div className="tabular-nums" style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Viaje #{item.routeId} · {item.vehiclePlate}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>A rendir</div>
                    <div className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {formatCurrency(item.totalToCollect)}
                    </div>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => onOpenAudit('route', item)}>
                    Arquear
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
      </div>
    </>
  );
}
