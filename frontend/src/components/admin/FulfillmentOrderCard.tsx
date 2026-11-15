import { CheckSquare, Printer, Zap } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import {
  formatArgentinaDateKey,
  isOrderPendingCae,
  resolveOrderClientCity,
  resolveOrderClientName,
} from '../../utils/orderSearchAndStatus.helper';

export interface FulfillmentOrderCardProps {
  order: any;
  column: 'PENDING' | 'PREPARING' | 'BILLED';
  isSelected: boolean;
  requestingCaeId?: number | null;
  onToggleSelect: (id: number) => void;
  onPrintPickingList: (order: any) => void;
  onPrintLabels: (order: any) => void;
  onOpenFulfillmentModal: (order: any) => void;
  onRevertToPending: (orderId: number) => void;
  onRequestCae: (orderId: number) => void;
  onPrintFacturaA4: (order: any) => void;
  onPrintRemitoX: (order: any) => void;
  onPrintReceipt: (order: any) => void;
}

export function FulfillmentOrderCard({
  order: o,
  column,
  isSelected,
  requestingCaeId,
  onToggleSelect,
  onPrintPickingList,
  onPrintLabels,
  onOpenFulfillmentModal,
  onRevertToPending,
  onRequestCae,
  onPrintFacturaA4,
  onPrintRemitoX,
  onPrintReceipt,
}: FulfillmentOrderCardProps) {
  const statusInfo = getOrderStatusInfo(o);
  const clientName = resolveOrderClientName(o, 'Cliente sin Nombre');
  const clientCity = resolveOrderClientCity(o);
  const pendingCae = isOrderPendingCae(o);
  const orderDateKey = formatArgentinaDateKey(o.updatedAt || o.createdAt || new Date());
  const todayKey = formatArgentinaDateKey(new Date());
  const isPriorDayPendingCae = pendingCae && Boolean(orderDateKey) && orderDateKey !== todayKey;
  const formattedShortDate = new Date(o.updatedAt || o.createdAt || Date.now()).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });

  return (
    <div
      style={{
        background: isSelected ? '#F8FAFC' : 'var(--background-card)',
        borderRadius: '8px',
        padding: '8px 10px',
        border: isSelected
          ? '2px solid #6366F1'
          : isPriorDayPendingCae
            ? '1px solid #F59E0B'
            : '1px solid var(--border-color)',
        boxShadow: isSelected ? '0 2px 8px rgba(99, 102, 241, 0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        transition: 'all 0.15s ease',
        cursor: 'default',
      }}
      className="fulfillment-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
          {column === 'PENDING' && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(o.id)}
              style={{
                cursor: 'pointer',
                width: '15px',
                height: '15px',
                accentColor: '#6366F1',
                flexShrink: 0,
              }}
              aria-label={`Seleccionar pedido #${o.id} para lote A4`}
              title="Seleccionar para imprimir en lote A4"
            />
          )}
          <span
            style={{
              fontWeight: 800,
              fontSize: '0.78rem',
              background: '#F1F5F9',
              padding: '1px 6px',
              borderRadius: '4px',
              color: '#334155',
              border: '1px solid #E2E8F0',
              flexShrink: 0,
            }}
          >
            #{o.id}
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.86rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-main)',
            }}
            title={clientName}
          >
            {clientName}
          </span>
        </div>
        <span
          className="badge"
          style={{
            backgroundColor: statusInfo.color + '18',
            color: statusInfo.color,
            fontWeight: 700,
            fontSize: '0.7rem',
            padding: '2px 7px',
            borderRadius: '10px',
            flexShrink: 0,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>{o.items?.length || 0} items</span>
          {clientCity && <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{clientCity}</span>}
        </div>
        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>
          ${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
        {column === 'PENDING' && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px',
                height: '26px',
                padding: '0 6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: '#F8FAFC',
                borderColor: '#E2E8F0',
                color: '#475569',
              }}
              onClick={() => onPrintPickingList(o)}
              title="Imprimir Hoja de Armado"
            >
              <Printer size={13} /> Hoja
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px',
                height: '26px',
                padding: '0 6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#FEF3C7',
                borderColor: '#F59E0B',
                color: '#B45309',
              }}
              onClick={() => onPrintLabels(o)}
              title="Imprimir Rótulos Térmicos de Bultos"
            >
              Rótulo
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                flex: 1.2,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '4px',
                height: '26px',
                padding: '0 6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#6366F1',
                borderColor: '#6366F1',
                color: '#FFFFFF',
              }}
              onClick={() => onOpenFulfillmentModal(o)}
              title="Facturar Directamente"
            >
              Facturar
            </button>
          </>
        )}

        {column === 'PREPARING' && (
          <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                height: '26px',
                padding: '0 8px',
                fontSize: '0.74rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#F8FAFC',
                borderColor: '#E2E8F0',
                color: '#475569',
              }}
              onClick={() => onRevertToPending(o.id)}
              title="Devolver este pedido a la columna Pendientes"
            >
              Volver
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '5px',
                height: '26px',
                padding: '0 8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                backgroundColor: '#4F46E5',
                color: 'white',
                borderColor: '#4F46E5',
              }}
              onClick={() => onOpenFulfillmentModal(o)}
            >
              <CheckSquare size={13} /> Confirmar Armado
            </button>
          </div>
        )}

        {column === 'BILLED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
            {pendingCae && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '6px',
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  borderRadius: '6px',
                  padding: '4px 8px',
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: '#B45309',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Zap size={12} />
                  {isPriorDayPendingCae
                    ? `Pre-Factura del ${formattedShortDate} — Pendiente CAE`
                    : 'PENDIENTE CAE (PRE-FACTURA)'}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={requestingCaeId === o.id}
                  style={{
                    height: '22px',
                    padding: '0 8px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: '#D97706',
                    borderColor: '#D97706',
                    color: 'white',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                  onClick={() => onRequestCae(o.id)}
                  title="Solicitar CAE a AFIP ahora"
                >
                  {requestingCaeId === o.id ? 'Solicitando...' : 'Solicitar CAE'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              {o.billingType === 'OFFICIAL' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '4px',
                    height: '26px',
                    padding: '0 6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    backgroundColor: '#F8FAFC',
                    borderColor: '#CBD5E1',
                    color: '#0F172A',
                  }}
                  onClick={() => onPrintFacturaA4(o)}
                  title="Imprimir Factura Oficial A4"
                >
                  Factura A4
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '4px',
                    height: '26px',
                    padding: '0 6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    backgroundColor: '#F8FAFC',
                    borderColor: '#CBD5E1',
                    color: '#0F172A',
                  }}
                  onClick={() => onPrintRemitoX(o)}
                  title="Imprimir Boleta Remito X en hoja A4"
                >
                  Boleta A4
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '4px',
                  height: '26px',
                  padding: '0 6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  backgroundColor: '#F8FAFC',
                  borderColor: '#CBD5E1',
                  color: '#475569',
                }}
                onClick={() => onPrintReceipt(o)}
                title="Imprimir Ticket Térmico de 80mm"
              >
                <Printer size={13} /> Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
