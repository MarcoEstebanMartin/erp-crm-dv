import React, { useEffect, useState } from 'react';
import { Eye, Edit } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { formatIntegerARS } from '../../utils/currency';
import type { Order } from '../../types';

interface VendedorHistoryTabProps {
  orders: Order[];
  onViewOrderDetails: (order: Order) => void;
  onEditOrder: (order: Order) => void;
}

function useIsMobileViewport(breakpointPx = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(`(max-width: ${breakpointPx}px)`).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [breakpointPx]);

  return isMobile;
}

export const VendedorHistoryTab: React.FC<VendedorHistoryTabProps> = ({ orders, onViewOrderDetails, onEditOrder }) => {
  const isMobile = useIsMobileViewport(768);

  if (isMobile) {
    return (
      <div className="vendedor-history-cards" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} aria-label="Historial de pedidos móvil">
        {orders.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>Sin pedidos</div>
        ) : (
          orders.map((o, idx) => {
            const statusInfo = getOrderStatusInfo(o);
            const deferredStyle = idx >= 8 ? { contentVisibility: 'auto' as const, containIntrinsicSize: 'auto none auto 112px' } : undefined;
            return (
              <div key={`m-${o.id}`} className="card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', ...deferredStyle }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{o.client?.name || o.persona?.name || '-'}</div>
                    <div className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {new Date(o.createdAt).toLocaleDateString('es-AR')} · Pedido #{o.id}
                    </div>
                  </div>
                  <span className={`badge badge-${statusInfo.badgeClass}`} style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color, border: `1px solid ${statusInfo.color}30`, fontWeight: 600, flexShrink: 0 }}>
                    {statusInfo.label}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '1rem' }}>{formatIntegerARS(o.totalAmount)}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} aria-label={`Ver detalle pedido #${o.id}`} onClick={() => onViewOrderDetails(o)}><Eye size={14} aria-hidden="true" /></button>
                    {o.status === 'PENDING' && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px' }} aria-label={`Editar pedido #${o.id}`} onClick={() => onEditOrder(o)}><Edit size={14} aria-hidden="true" /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="table-container table-container--sticky vendedor-history-table-desktop" role="region" aria-label="Historial de pedidos" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Cliente</th>
            <th scope="col">Total</th>
            <th scope="col">Estado</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0' }}>Sin pedidos</td></tr>
          ) : (
            orders.map((o) => {
              const statusInfo = getOrderStatusInfo(o);
              return (
                <tr key={o.id}>
                  <td className="tabular-nums" style={{ fontSize: '0.8rem' }}>{new Date(o.createdAt).toLocaleDateString('es-AR')}</td>
                  <td style={{ fontWeight: 500 }}>{o.client?.name || o.persona?.name || '-'}</td>
                  <td className="tabular-nums" style={{ fontWeight: 600 }}>{formatIntegerARS(o.totalAmount)}</td>
                  <td>
                    <span className={`badge badge-${statusInfo.badgeClass}`} style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color, border: `1px solid ${statusInfo.color}30`, fontWeight: 600 }}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Ver detalle" aria-label={`Ver detalle pedido #${o.id}`} onClick={() => onViewOrderDetails(o)}><Eye size={12} aria-hidden="true" /></button>
                    {o.status === 'PENDING' && (
                      <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} title="Editar pedido" aria-label={`Editar pedido #${o.id}`} onClick={() => onEditOrder(o)}><Edit size={12} aria-hidden="true" /></button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
