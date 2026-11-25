import React from 'react';
import { AlertTriangle, ChevronRight, Layers, Play, RefreshCw, Search } from 'lucide-react';
import type { Order, ProductLot } from '../../types';
import { isSentinelExpiration } from '../stock/lotLabel';

interface PickingOrdersQueueTabProps {
  expiringLots: ProductLot[];
  filteredOrders: Order[];
  uniqueRoutes: string[];
  orderSearchQuery: string;
  setOrderSearchQuery: (q: string) => void;
  routeFilter: string;
  setRouteFilter: (r: string) => void;
  withdrawalFilter: boolean;
  setWithdrawalFilter: (w: boolean) => void;
  selectedStatus: string;
  setSelectedStatus: (s: string) => void;
  selectedOrderIds: Record<number, boolean>;
  setSelectedOrderIds: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  loading: boolean;
  onRefresh: () => void;
  onOpenOrder: (order: Order) => void;
  onBatchStartPicking: () => void;
  onOpenConsolidatedView: () => void;
  onToggleSelectAll: () => void;
  onOpenExpiringStock?: () => void;
}

export const PickingOrdersQueueTab: React.FC<PickingOrdersQueueTabProps> = ({
  expiringLots,
  filteredOrders,
  uniqueRoutes,
  orderSearchQuery,
  setOrderSearchQuery,
  routeFilter,
  setRouteFilter,
  withdrawalFilter,
  setWithdrawalFilter,
  selectedStatus,
  setSelectedStatus,
  selectedOrderIds,
  setSelectedOrderIds,
  loading,
  onRefresh,
  onOpenOrder,
  onBatchStartPicking,
  onOpenConsolidatedView,
  onToggleSelectAll,
  onOpenExpiringStock,
}) => {
  const realExpiringCount = expiringLots.filter((lot) => !isSentinelExpiration(lot.expirationDate)).length;
  const selectedCount = Object.keys(selectedOrderIds).length;
  const allSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds[o.id]);

  return (
    <div className="dep-shell">
      <search aria-label="Filtrar pedidos" className="dep-toolbar">
        <div className="dep-search-row">
          <div className="dep-search-box">
            <label htmlFor="picking-orders-search" className="visually-hidden">Buscar pedidos</label>
            <Search size={16} aria-hidden="true" className="dep-search-icon" />
            <input
              id="picking-orders-search"
              type="search"
              className="input"
              placeholder="Pedido, cliente o localidad..."
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ minBlockSize: '42px', minInlineSize: '42px', padding: '0 10px' }}
            onClick={onRefresh}
            aria-label="Actualizar"
          >
            <RefreshCw size={16} className={loading ? 'spin-animation' : ''} aria-hidden="true" />
          </button>
        </div>

        <div className="dep-chips-row">
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'PENDING', label: 'Pendientes' },
            { id: 'PREPARING', label: 'En curso' },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              className={`dep-chip ${selectedStatus === st.id ? 'dep-chip--active' : ''}`}
              onClick={() => setSelectedStatus(st.id)}
            >
              {st.label}
            </button>
          ))}

          <button
            type="button"
            className={`dep-chip ${withdrawalFilter ? 'dep-chip--active' : ''}`}
            onClick={() => {
              const next = !withdrawalFilter;
              setWithdrawalFilter(next);
              if (next) setRouteFilter('ALL');
            }}
          >
            Retiro
          </button>

          {uniqueRoutes.length > 0 && (
            <>
              <label htmlFor="picking-route-filter" className="visually-hidden">Ruta</label>
              <select
                id="picking-route-filter"
                className="select"
                style={{ width: 'auto', minWidth: '140px', minBlockSize: '36px', padding: '4px 10px', fontSize: '0.82rem' }}
                value={routeFilter}
                onChange={(e) => {
                  setRouteFilter(e.target.value);
                  if (e.target.value !== 'ALL') setWithdrawalFilter(false);
                }}
              >
                <option value="ALL">Todas las rutas</option>
                {uniqueRoutes.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </>
          )}

          {realExpiringCount > 0 && onOpenExpiringStock && (
            <button
              type="button"
              className="dep-chip dep-chip--danger"
              onClick={onOpenExpiringStock}
              style={{ marginInlineStart: 'auto' }}
            >
              <AlertTriangle size={13} aria-hidden="true" />
              <span className="tabular-nums">{realExpiringCount} por vencer</span>
            </button>
          )}
        </div>
      </search>

      {selectedCount > 0 && (
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '10px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={onToggleSelectAll}>
              {allSelected ? 'Quitar todos' : 'Todos'}
            </button>
            <span className="tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 700 }}>{selectedCount} selec.</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setSelectedOrderIds({})}>Limpiar</button>
            <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={onBatchStartPicking} disabled={loading}>Iniciar</button>
            <button type="button" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={onOpenConsolidatedView}>
              <Layers size={14} aria-hidden="true" />
              <span>Consolidado</span>
            </button>
          </div>
        </div>
      )}

      {filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', background: 'var(--bg-card)', border: '1px dashed var(--border-color)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Sin pedidos pendientes.
        </div>
      ) : (
        <div className="dep-orders-grid" role="list" aria-label="Cola de pedidos">
          {filteredOrders.map((o) => {
            const isChecked = Boolean(selectedOrderIds[o.id]);
            const isPreparing = o.status === 'PREPARING';
            const isWithdrawal =
              !o.persona?.route ||
              o.persona.route.trim() === '' ||
              o.persona.route.toUpperCase() === 'RETIRO';

            return (
              <article
                key={o.id}
                role="listitem"
                className={`dep-order-card ${isPreparing ? 'dep-order-card--preparing' : ''} ${isChecked ? 'dep-order-card--selected' : ''}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minInlineSize: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar pedido #${o.id}`}
                      checked={isChecked}
                      onChange={() =>
                        setSelectedOrderIds((prev) => {
                          const copy = { ...prev };
                          if (copy[o.id]) delete copy[o.id];
                          else copy[o.id] = true;
                          return copy;
                        })
                      }
                      style={{ width: '18px', height: '18px', flexShrink: 0 }}
                    />
                    <div style={{ minInlineSize: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="tabular-nums" style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                          #{o.id}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', overflowWrap: 'break-word' }}>
                          {o.persona?.name || o.client?.name}
                        </span>
                      </div>
                      {o.persona?.city && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {o.persona.city}
                        </div>
                      )}
                    </div>
                  </label>

                  <span className={`badge ${isPreparing ? 'badge-preparing' : 'badge-pending'}`} style={{ flexShrink: 0 }}>
                    {isPreparing ? 'En curso' : 'Pendiente'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: isWithdrawal ? '#ecfdf5' : '#f1f5f9',
                        color: isWithdrawal ? '#047857' : '#334155',
                        border: isWithdrawal ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                      }}
                    >
                      {isWithdrawal ? 'Retiro' : o.persona?.route}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {(o.items || []).length} ítems
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`btn ${isPreparing ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ minBlockSize: '38px', padding: '6px 14px', fontSize: '0.84rem', fontWeight: 600 }}
                    disabled={loading}
                    onClick={() => onOpenOrder(o)}
                  >
                    {isPreparing ? (
                      <>
                        <span>Continuar</span>
                        <ChevronRight size={15} aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <Play size={13} aria-hidden="true" />
                        <span>Armar</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
