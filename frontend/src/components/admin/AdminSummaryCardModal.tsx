import React from 'react';
import { Eye, X } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface AdminSummaryCardModalProps {
  summaryCardModal: { open: boolean; cardKey: string; cardLabel: string } | null;
  orders: any[];
  onClose: () => void;
  onSelectOrderDetails: (order: any) => void;
  onViewAllInOrdersTab: (cardKey: string) => void;
}

export const AdminSummaryCardModal: React.FC<AdminSummaryCardModalProps> = ({
  summaryCardModal,
  orders,
  onClose,
  onSelectOrderDetails,
  onViewAllInOrdersTab,
}) => {
  if (!summaryCardModal || !summaryCardModal.open) return null;

  const cardOrders = orders.filter((o) => {
    const statusInfo = getOrderStatusInfo(o);
    const logicalKey = statusInfo.label.toUpperCase().replace(' ', '_');
    if (summaryCardModal.cardKey === 'RECIBIDO') return o.status === 'PENDING' || o.status === 'RECIBIDO';
    if (summaryCardModal.cardKey === 'ARMADO') return o.status === 'PREPARING' || (o.status === 'PREPARED' && !o.invoiceNumber);
    if (summaryCardModal.cardKey === 'FACTURADO') {
      return (
        o.invoiceNumber ||
        o.status === 'DELIVERED' ||
        o.status === 'BILLED' ||
        (o.deliveryRoute && (o.deliveryRoute.status === 'IN_TRANSIT' || o.deliveryRoute.status === 'COMPLETED'))
      );
    }
    return logicalKey === summaryCardModal.cardKey;
  });

  return (
    <NativeModalDialog
      isOpen={Boolean(summaryCardModal?.open)}
      onClose={onClose}
      ariaLabelledBy="summary-card-modal-title"
      style={{ maxWidth: '1080px', width: '95vw', maxHeight: '90vh', padding: '20px 24px' }}
    >
      <div className="modal-header" style={{ paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 id="summary-card-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
          {summaryCardModal.cardLabel}
        </h3>
        <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: '4px 0 12px 0', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {cardOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Sin pedidos
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Vendedor</th>
                  <th className="text-right">Total</th>
                  <th>Estado</th>
                  <th>Ruta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cardOrders.map((o) => {
                  const statusInfo = getOrderStatusInfo(o);
                  const clientName = o.client?.name || o.persona?.name || 'Sin datos';
                  const city = o.client?.city || o.persona?.city;
                  const clientRoute =
                    o.persona?.saleRoute?.name || o.client?.saleRoute?.name || o.persona?.route || o.client?.route || o.deliveryZone || '-';

                  return (
                    <tr key={o.id}>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>#{o.id}</div>
                        {o.invoiceNumber && (
                          <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>{o.invoiceNumber}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{clientName}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                          <span>{o.items?.length || 0} ítems</span>
                          {city && <span>· {city}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                        <div>{new Date(o.createdAt).toLocaleDateString('es-AR')}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {new Date(o.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td>{o.seller?.username || '-'}</td>
                      <td className="text-right" style={{ fontWeight: 700, fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>
                        ${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}
                      </td>
                      <td>
                        <span
                          className={`badge badge-${statusInfo.badgeClass}`}
                          style={{
                            backgroundColor: `${statusInfo.color}15`,
                            color: statusInfo.color,
                            border: `1px solid ${statusInfo.color}30`,
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            fontWeight: 700,
                            borderRadius: '12px',
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>{clientRoute}</span>
                          {o.deliveryRoute && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                              Viaje #{o.deliveryRoute.id} ({o.deliveryRoute.status === 'IN_TRANSIT' ? 'En calle' : o.deliveryRoute.status === 'COMPLETED' ? 'Entregado' : 'Asignado'})
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                          onClick={() => {
                            onSelectOrderDetails(o);
                            onClose();
                          }}
                        >
                          <Eye size={13} aria-hidden="true" /> Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: 0 }}>
        <button type="button" className="btn btn-primary" onClick={() => onViewAllInOrdersTab(summaryCardModal.cardKey)}>
          Ver todos
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </NativeModalDialog>
  );
};
