import React from 'react';
import { DollarSign, Printer } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { printOrderTicket } from './adminPrintHelpers';

interface AdminOrderDetailsModalProps {
  orderDetailsModal: any | null;
  onClose: () => void;
  onFastInvoice: (order: any) => void;
}

export const AdminOrderDetailsModal: React.FC<AdminOrderDetailsModalProps> = ({
  orderDetailsModal,
  onClose,
  onFastInvoice,
}) => {
  if (!orderDetailsModal) return null;

  const statusInfo = getOrderStatusInfo(orderDetailsModal);
  const labelUpper = statusInfo.label.toUpperCase();
  let currentIdx = 0;
  if (orderDetailsModal.status === 'PREPARING' || orderDetailsModal.status === 'PREPARED' || labelUpper.includes('PICKING') || labelUpper.includes('ARMADO')) {
    currentIdx = 1;
  } else if (orderDetailsModal.invoiceNumber || orderDetailsModal.status === 'DELIVERED' || orderDetailsModal.status === 'INVOICED' || labelUpper.includes('FACTURADO') || labelUpper.includes('ENTREGADO') || labelUpper.includes('VIAJE')) {
    currentIdx = 2;
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '16px', padding: '24px 28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
        <div className="modal-header" style={{ paddingBottom: '16px', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>Pedido #{orderDetailsModal.id}</h3>
            <span className={`badge badge-${statusInfo.badgeClass}`} style={{ backgroundColor: statusInfo.color + '18', color: statusInfo.color, border: `1px solid ${statusInfo.color}35`, fontWeight: 700, fontSize: '0.8rem', padding: '4px 10px' }}>
              {statusInfo.label}
            </span>
          </div>
          <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '1.2rem', fontWeight: 700, borderRadius: '8px' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {orderDetailsModal.status !== 'CANCELLED' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', padding: '16px 20px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              {[
                { key: 'RECIBIDO', label: '1. Recibido' },
                { key: 'EN_PICKING', label: '2. En Picking' },
                { key: 'FACTURADO', label: '3. Facturado' },
              ].map((step, idx, arr) => {
                const isCompleted = idx <= currentIdx;
                const isActive = idx === currentIdx;
                return (
                  <React.Fragment key={step.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: idx === 0 ? 'flex-start' : idx === arr.length - 1 ? 'flex-end' : 'center' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isCompleted ? '#10B981' : '#E2E8F0', color: isCompleted ? '#ffffff' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, boxShadow: isActive ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none' }}>
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#0F172A' : isCompleted ? '#10B981' : '#64748B' }}>{step.label}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div style={{ height: '3px', flex: 1, backgroundColor: idx < currentIdx ? '#10B981' : '#E2E8F0', margin: '0 12px', borderRadius: '2px' }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '10px 16px', backgroundColor: '#FEF2F2', color: '#EF4444', border: '1px solid #FCA5A5', borderRadius: '10px', fontSize: '0.875rem', fontWeight: 600, marginBottom: '20px' }}>
              🚫 Este pedido ha sido CANCELADO.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px', padding: '16px 20px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.875rem' }}>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.72rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Cliente</span>
              <strong style={{ color: '#0F172A', fontSize: '0.95rem' }}>{orderDetailsModal.client?.name || orderDetailsModal.persona?.name || 'S/D'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.72rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>CUIT / C.U.I.L.</span>
              <strong style={{ color: '#0F172A' }}>{orderDetailsModal.client?.cuit || orderDetailsModal.persona?.cuit || 'S/D'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.72rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Dirección de Entrega</span>
              <strong style={{ color: '#0F172A' }}>{orderDetailsModal.client?.address || orderDetailsModal.persona?.address || 'S/D'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748B', fontSize: '0.72rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>Fecha de Carga</span>
              <strong style={{ color: '#0F172A' }}>{new Date(orderDetailsModal.createdAt).toLocaleString('es-AR')}</strong>
            </div>
            {orderDetailsModal.notes && (
              <div style={{ gridColumn: '1 / -1', marginTop: '4px', padding: '10px 14px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', color: '#92400E' }}>
                <strong>📝 Notas / Indicaciones:</strong> {orderDetailsModal.notes}
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Artículo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Cantidad</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Precio Unit.</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orderDetailsModal.items.map((item: any, idx: number) => {
                  const price = Number(item.unitPrice ?? item.price ?? 0);
                  const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                  const subtotal = item.subtotal ? Number(item.subtotal) : isPesable ? item.quantity * (item.product?.approximateWeight || 1) * price : item.quantity * price;
                  return (
                    <tr key={idx} style={{ borderBottom: idx < orderDetailsModal.items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0F172A' }}>{item.product?.name}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>
                        {item.quantity} u.
                        {isPesable && (
                          <span style={{ fontSize: '0.75rem', color: '#DC2626', backgroundColor: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', fontWeight: 600 }}>
                            ({item.weight ? `${Number(item.weight).toFixed(2)} Kg` : `${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString()} Kg aprox`})
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#334155' }}>
                        ${Math.round(price).toLocaleString('es-AR')}{isPesable && ' / Kg'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                        ${Math.round(subtotal).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>Monto Total:</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>${Math.round(Number(orderDetailsModal.totalAmount)).toLocaleString('es-AR')}</span>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {!orderDetailsModal.invoiceNumber && orderDetailsModal.status !== 'CANCELLED' && (
            <button className="btn btn-primary" style={{ backgroundColor: '#6366F1', borderColor: '#6366F1', color: 'white', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => { onFastInvoice(orderDetailsModal); onClose(); }}>
              <DollarSign size={18} /><span>Facturar Directo</span>
            </button>
          )}
          <button className="btn btn-secondary" style={{ padding: '10px 18px', borderRadius: '8px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => { printOrderTicket(orderDetailsModal); onClose(); }}>
            <Printer size={18} /><span>Imprimir Ticket</span>
          </button>
          <button className="btn" style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: '#1E293B', color: '#fff', fontWeight: 700 }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
