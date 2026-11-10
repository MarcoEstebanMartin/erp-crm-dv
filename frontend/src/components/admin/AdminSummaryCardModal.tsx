import React from 'react';
import { Eye } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';

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
    <div className="modal-overlay" style={{ zIndex: 1200 }}>
      <div className="modal-content" style={{ maxWidth: '1100px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{summaryCardModal.cardLabel}</h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Listado detallado con estado de facturación y asignación de viaje</span>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '12px 0', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {cardOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              No hay pedidos en esta categoría actualmente.
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th>Nro Pedido</th>
                    <th>Cliente / Localidad</th>
                    <th>Fecha</th>
                    <th>Vendedor</th>
                    <th className="text-right">Monto</th>
                    <th>Estado Interno</th>
                    <th>📍 Ruta</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cardOrders.map((o) => {
                    const statusInfo = getOrderStatusInfo(o);
                    const clientName = o.client?.name || o.persona?.name || 'Cliente S/D';
                    const city = o.client?.city || o.persona?.city;
                    const clientRoute = o.persona?.saleRoute?.name || o.client?.saleRoute?.name || o.persona?.route || o.client?.route || o.deliveryZone || 'Sin Ruta';

                    return (
                      <tr key={o.id}>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>#{o.id}</div>
                          {o.invoiceNumber && (
                            <div style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>📄 Fact. {o.invoiceNumber}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{clientName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                            <span>📦 {o.items?.length || 0} items</span>
                            {city && <span>📍 {city}</span>}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.78rem' }}>
                          <div>{new Date(o.createdAt).toLocaleDateString('es-AR')}</div>
                          <div style={{ color: 'var(--text-secondary)' }}>{new Date(o.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td>{o.seller?.username || 'Sistema'}</td>
                        <td className="text-right" style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                          ${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}
                        </td>
                        <td>
                          <span
                            className={`badge badge-${statusInfo.badgeClass}`}
                            style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color, border: `1px solid ${statusInfo.color}30`, fontSize: '0.72rem', padding: '3px 8px', fontWeight: 700, borderRadius: '12px' }}
                          >
                            {statusInfo.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span className="badge" style={{ backgroundColor: '#F3F4F6', color: '#1F2937', border: '1px solid #E5E7EB', fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '10px', maxWidth: 'fit-content' }}>
                              📍 {clientRoute}
                            </span>
                            {o.deliveryRoute && (
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: o.deliveryRoute.status === 'IN_TRANSIT' ? '#059669' : o.deliveryRoute.status === 'COMPLETED' ? '#2563EB' : '#D97706' }}>
                                🚚 Viaje #{o.deliveryRoute.id} ({o.deliveryRoute.status === 'IN_TRANSIT' ? 'En Calle' : o.deliveryRoute.status === 'COMPLETED' ? 'Entregado' : 'Asignado'})
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                            onClick={() => { onSelectOrderDetails(o); onClose(); }}
                          >
                            <Eye size={13} /> Detalle
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

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => onViewAllInOrdersTab(summaryCardModal.cardKey)}>
            Ver en Listado Completo
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};
