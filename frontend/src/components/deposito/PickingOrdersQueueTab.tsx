import React from 'react';
import { Play, Eye, RefreshCw } from 'lucide-react';
import type { Order, ProductLot } from '../../types';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isSentinelExpiration,
} from '../stock/lotLabel';

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
  onStartPicking: (orderId: number) => void;
  onSelectOrder: (order: Order) => void;
  onBatchStartPicking: () => void;
  onOpenConsolidatedView: () => void;
  onToggleSelectAll: () => void;
}

export const PickingOrdersQueueTab: React.FC<PickingOrdersQueueTabProps> = ({
  expiringLots, filteredOrders, uniqueRoutes, orderSearchQuery, setOrderSearchQuery,
  routeFilter, setRouteFilter, withdrawalFilter, setWithdrawalFilter, selectedStatus, setSelectedStatus,
  selectedOrderIds, setSelectedOrderIds, loading, onRefresh, onStartPicking, onSelectOrder,
  onBatchStartPicking, onOpenConsolidatedView, onToggleSelectAll,
}) => {
  return (
    <div>
      {expiringLots.filter((lot) => !isSentinelExpiration(lot.expirationDate)).length > 0 && (
        <div className="card" style={{ backgroundColor: '#FFF2F2', border: '1px solid #FFD1D1', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#C0392B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Lotes Próximos a Vencer (Menos de 30 días)
          </h4>
          <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {expiringLots.filter((lot) => !isSentinelExpiration(lot.expirationDate)).map((lot) => {
              const daysLeft = Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
              const isExpired = daysLeft <= 0;
              return (
                <div key={lot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', padding: '6px 10px', backgroundColor: '#fff', borderRadius: '4px', borderLeft: isExpired ? '4px solid #C0392B' : '4px solid #F39C12' }}>
                  <div>
                    <strong>{lot.product?.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>(SKU: {lot.product?.sku})</span>
                    <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      Lote: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{extractCleanLotNumber(lot.lotNumber)}</span> | Vence: {formatCleanExpirationDate(lot.expirationDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 'bold', color: isExpired ? '#C0392B' : '#E67E22', backgroundColor: isExpired ? '#FDEDEC' : '#FEF9E7', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', display: 'inline-block', marginBottom: '2px' }}>
                      {isExpired ? 'VENCIDO' : `Vence en ${daysLeft} días`}
                    </span>
                    <div style={{ fontWeight: 600 }}>Stock: {lot.stock} u.</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
        Pedidos en cola de distribución cargados por vendedores. Iniciá el picking para armar bultos físicos.
      </p>

      <div className="actions-bar" style={{ flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div className="search-input-wrapper" style={{ minWidth: '280px' }}>
          <input type="text" className="input" placeholder="Buscar nro pedido, cliente, localidad..." value={orderSearchQuery} onChange={(e) => setOrderSearchQuery(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="select" style={{ width: '200px', height: '38px', padding: '6px 12px' }} value={routeFilter}
            onChange={(e) => { setRouteFilter(e.target.value); if (e.target.value !== 'ALL') setWithdrawalFilter(false); }}
          >
            <option value="ALL">📍 Todas las Rutas</option>
            {uniqueRoutes.map((r) => (<option key={r} value={r}>🛣️ {r}</option>))}
          </select>

          <button
            type="button" className="btn"
            style={{
              height: '38px', padding: '0 16px',
              backgroundColor: withdrawalFilter ? 'var(--color-corp-red)' : 'var(--bg-card)',
              borderColor: withdrawalFilter ? 'var(--color-corp-red)' : 'var(--border-color)',
              color: withdrawalFilter ? '#fff' : 'var(--text-secondary)',
              boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', fontWeight: 600,
            }}
            onClick={() => { const val = !withdrawalFilter; setWithdrawalFilter(val); if (val) setRouteFilter('ALL'); }}
          >
            🏢 Retiros Depósito
          </button>

          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '38px' }}>
            {[
              { id: 'ALL', label: 'Todos' },
              { id: 'PENDING', label: 'Pendientes' },
              { id: 'PREPARING', label: 'En Preparación' },
            ].map((st) => (
              <button
                key={st.id} type="button"
                style={{
                  padding: '0 12px', fontSize: '0.8rem', border: 'none', borderRadius: 0, boxShadow: 'none',
                  backgroundColor: selectedStatus === st.id ? 'var(--accent-color)' : 'var(--bg-card)',
                  color: selectedStatus === st.id ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: selectedStatus === st.id ? 600 : 400,
                }}
                onClick={() => setSelectedStatus(st.id)}
              >
                {st.label}
              </button>
            ))}
          </div>

          <button className="btn btn-secondary" style={{ height: '38px' }} onClick={onRefresh}><RefreshCw size={16} /></button>
        </div>
      </div>

      {Object.keys(selectedOrderIds).length > 0 && (
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>⚡ {Object.keys(selectedOrderIds).length} pedido(s) seleccionado(s)</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px' }} onClick={() => setSelectedOrderIds({})}>Limpiar</button>
            <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px', border: '1px solid var(--accent-color)' }} onClick={onBatchStartPicking} disabled={loading}>🏁 Iniciar Picking en Lote</button>
            <button type="button" className="btn btn-primary" style={{ padding: '6px 14px', backgroundColor: 'var(--color-primary)' }} onClick={onOpenConsolidatedView}>👁️ Ver Picking Consolidado</button>
          </div>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds[o.id])}
                  ref={(el) => {
                    if (el) {
                      const checkedCount = filteredOrders.filter((o) => selectedOrderIds[o.id]).length;
                      el.indeterminate = checkedCount > 0 && checkedCount < filteredOrders.length;
                    }
                  }}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th>Nro Pedido</th>
              <th>Cliente / Localidad</th>
              <th>Ruta / Despacho</th>
              <th>Items a preparar</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>No hay pedidos para mostrar con los filtros seleccionados.</td></tr>
            ) : (
              filteredOrders.map((o) => {
                const isChecked = !!selectedOrderIds[o.id];
                const isWithdrawal = !o.persona?.route || o.persona.route.trim() === '' || o.persona.route.toUpperCase() === 'RETIRO';
                return (
                  <tr key={o.id} style={{ backgroundColor: isChecked ? 'rgba(0,0,0,0.015)' : 'transparent' }}>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <input
                        type="checkbox" checked={isChecked}
                        onChange={() => setSelectedOrderIds((prev) => {
                          const copy = { ...prev };
                          if (copy[o.id]) delete copy[o.id]; else copy[o.id] = true;
                          return copy;
                        })}
                      />
                    </td>
                    <td style={{ fontWeight: 700 }}>#{o.id}</td>
                    <td style={{ fontWeight: 600 }}>
                      <div>{o.persona?.name || o.client?.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>📍 {o.persona?.city || 'Sin Localidad'}</div>
                    </td>
                    <td>
                      {isWithdrawal ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10B981', backgroundColor: '#ECFDF5', border: '1px solid rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>🏢 RETIRO DEPÓSITO</span>
                      ) : (
                        o.persona?.route && (
                          <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>🛣️ {o.persona.route}</span>
                        )
                      )}
                    </td>
                    <td>{(o.items || []).length} artículos distintos</td>
                    <td>
                      <span className={`badge ${o.status === 'PENDING' ? 'badge-pending' : 'badge-preparing'}`}>
                        {o.status === 'PENDING' ? 'Esperando Picking' : 'En Preparación'}
                      </span>
                    </td>
                    <td>
                      {o.status === 'PENDING' ? (
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onStartPicking(o.id)}>
                          <Play size={12} /><span>Iniciar Armado</span>
                        </button>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onSelectOrder(o)}>
                          <Eye size={12} /><span>Ver Picking List</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
