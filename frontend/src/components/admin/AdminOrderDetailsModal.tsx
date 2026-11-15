import React from 'react';
import { Ban, Check, DollarSign, Printer, StickyNote, X } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { printOrderTicket } from './orderTicketPrinter';
import { calculateExactLineSubtotalInt } from '../../utils/weeklyPromoCartEvaluator';
import {
  formatBigIntARS,
  toOrderIntegerPesosBigInt,
} from '../../utils/fulfillmentCardMeta.helper';
import { resolveOrderPersona } from '../../utils/orderSearchAndStatus.helper';
import { NativeModalDialog } from '../modals/NativeModalDialog';

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

  const persona = resolveOrderPersona(orderDetailsModal);
  const statusInfo = getOrderStatusInfo(orderDetailsModal);
  const labelUpper = statusInfo.label.toUpperCase();
  let currentIdx = 0;
  if (
    orderDetailsModal.status === 'PREPARING' ||
    orderDetailsModal.status === 'PREPARED' ||
    labelUpper.includes('PICKING') ||
    labelUpper.includes('ARMADO')
  ) {
    currentIdx = 1;
  } else if (
    orderDetailsModal.invoiceNumber ||
    orderDetailsModal.status === 'DELIVERED' ||
    orderDetailsModal.status === 'INVOICED' ||
    labelUpper.includes('FACTURADO') ||
    labelUpper.includes('ENTREGADO') ||
    labelUpper.includes('VIAJE')
  ) {
    currentIdx = 2;
  }

  return (
    <NativeModalDialog
      isOpen={Boolean(orderDetailsModal)}
      onClose={onClose}
      ariaLabelledBy="order-details-modal-title"
      style={{ maxWidth: '820px', width: '95vw', padding: '24px 28px' }}
    >
      <div
        className="modal-header"
        style={{
          paddingBottom: '14px',
          marginBottom: '18px',
          borderBottom: '1px solid #E5E7EB',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 id="order-details-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#111827' }}>
            Pedido #{orderDetailsModal.id}
          </h3>
          <span
            className={
              orderDetailsModal.status === 'CANCELLED'
                ? 'badge-minimal badge-minimal--danger'
                : 'badge-minimal'
            }
          >
            {statusInfo.label}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '6px' }}
          onClick={onClose}
          aria-label="Cerrar detalle de pedido"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {orderDetailsModal.status !== 'CANCELLED' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              padding: '14px 18px',
              backgroundColor: '#F9FAFB',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
            }}
          >
            {[
              { key: 'RECIBIDO', label: '1. Recibido' },
              { key: 'EN_PICKING', label: '2. En Picking' },
              { key: 'FACTURADO', label: '3. Facturado' },
            ].map((step, idx, arr) => {
              const isCompleted = idx <= currentIdx;
              const isActive = idx === currentIdx;
              return (
                <React.Fragment key={step.key}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flex: 1,
                      justifyContent:
                        idx === 0 ? 'flex-start' : idx === arr.length - 1 ? 'flex-end' : 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: isCompleted ? '#111827' : '#E5E7EB',
                        color: isCompleted ? '#FFFFFF' : '#6B7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                      }}
                    >
                      {isCompleted ? <Check size={14} aria-hidden="true" /> : idx + 1}
                    </div>
                    <span
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isCompleted ? '#111827' : '#6B7280',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div
                      style={{
                        height: '2px',
                        flex: 1,
                        backgroundColor: idx < currentIdx ? '#111827' : '#E5E7EB',
                        margin: '0 10px',
                        borderRadius: '2px',
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              color: '#E30613',
              border: '1px solid rgba(227, 6, 19, 0.28)',
              borderRadius: '8px',
              fontSize: '0.86rem',
              fontWeight: 600,
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Ban size={15} aria-hidden="true" />
            Este pedido ha sido CANCELADO.
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
            marginBottom: '18px',
            padding: '14px 18px',
            backgroundColor: '#F9FAFB',
            borderRadius: '10px',
            border: '1px solid #E5E7EB',
            fontSize: '0.86rem',
          }}
        >
          <div>
            <span style={{ color: '#6B7280', fontSize: '0.7rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
              Cliente
            </span>
            <strong style={{ color: '#111827', fontSize: '0.94rem' }}>
              {persona?.name || orderDetailsModal.clientName || 'S/D'}
            </strong>
          </div>
          <div>
            <span style={{ color: '#6B7280', fontSize: '0.7rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
              CUIT / C.U.I.L.
            </span>
            <strong style={{ color: '#111827' }}>{persona?.cuit || 'S/D'}</strong>
          </div>
          <div>
            <span style={{ color: '#6B7280', fontSize: '0.7rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
              Dirección de Entrega
            </span>
            <strong style={{ color: '#111827' }}>{persona?.address || 'S/D'}</strong>
          </div>
          <div>
            <span style={{ color: '#6B7280', fontSize: '0.7rem', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
              Fecha de Carga
            </span>
            <strong className="tabular-nums" style={{ color: '#111827' }}>
              {new Date(orderDetailsModal.createdAt).toLocaleString('es-AR')}
            </strong>
          </div>
          {orderDetailsModal.notes && (
            <div
              style={{
                gridColumn: '1 / -1',
                marginTop: '4px',
                padding: '9px 12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <StickyNote size={14} aria-hidden="true" style={{ flexShrink: 0, color: '#6B7280' }} />
              <span>
                <strong>Notas / Indicaciones:</strong> {orderDetailsModal.notes}
              </span>
            </div>
          )}
        </div>

        <div
          className="table-container"
          role="region"
          aria-label={`Artículos del pedido #${orderDetailsModal.id}`}
          tabIndex={0}
          style={{ marginTop: 0, marginBottom: '18px' }}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Artículo</th>
                <th scope="col" style={{ textAlign: 'right' }}>Cantidad</th>
                <th scope="col" style={{ textAlign: 'right' }}>Precio Unit.</th>
                <th scope="col" style={{ textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(orderDetailsModal.items || []).map((item: any, idx: number) => {
                const priceInt = Number(toOrderIntegerPesosBigInt(item.unitPrice ?? item.price ?? 0));
                const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                const subtotalInt =
                  item.subtotal != null
                    ? Number(toOrderIntegerPesosBigInt(item.subtotal))
                    : calculateExactLineSubtotalInt({
                        unitPriceInt: priceInt,
                        quantity: item.quantity,
                        isPesable: Boolean(isPesable),
                        weight: item.weight,
                        approximateWeight: item.product?.approximateWeight,
                      });
                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: '#111827' }}>{item.product?.name}</td>
                    <td style={{ textAlign: 'right', color: '#374151' }}>
                      {item.quantity} u.
                      {isPesable && (
                        <span className="badge-minimal" style={{ marginLeft: '6px', fontSize: '0.72rem' }}>
                          {item.weight
                            ? `${Number(item.weight).toFixed(2)} Kg`
                            : `${(item.quantity * (item.product?.approximateWeight || 1)).toLocaleString('es-AR')} Kg aprox`}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', color: '#374151' }}>
                      ${priceInt.toLocaleString('es-AR')}
                      {isPesable && ' / Kg'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                      ${subtotalInt.toLocaleString('es-AR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 18px',
            backgroundColor: '#F9FAFB',
            borderRadius: '10px',
            border: '1px solid #E5E7EB',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#4B5563' }}>Monto Total:</span>
          <span className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 800, color: '#111827' }}>
            {formatBigIntARS(toOrderIntegerPesosBigInt(orderDetailsModal.totalAmount))}
          </span>
        </div>
      </div>

      <div
        className="modal-footer"
        style={{ borderTop: '1px solid #E5E7EB', paddingTop: '14px', marginTop: '12px' }}
      >
        {!orderDetailsModal.invoiceNumber && orderDetailsModal.status !== 'CANCELLED' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onFastInvoice(orderDetailsModal);
              onClose();
            }}
          >
            <DollarSign size={16} aria-hidden="true" />
            <span>Facturar Directo</span>
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            printOrderTicket(orderDetailsModal);
            onClose();
          }}
        >
          <Printer size={16} aria-hidden="true" />
          <span>Imprimir Ticket</span>
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </NativeModalDialog>
  );
};
