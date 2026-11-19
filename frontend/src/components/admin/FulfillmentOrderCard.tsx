import { AlertCircle, CheckSquare, FileText, Printer, RotateCcw, Tag } from 'lucide-react';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';
import { OrderDeliveryBadgeControl } from '../common/OrderDeliveryBadgeControl';
import {
  formatBigIntARS,
  formatOrderRelativeAge,
  resolveOrderFiscalChannelBadge,
  resolveOrderOriginLabel,
  toOrderIntegerPesosBigInt,
} from '../../utils/fulfillmentCardMeta.helper';
import {
  formatArgentinaDateKey,
  isOrderPendingCae,
  resolveOrderClientCity,
  resolveOrderClientName,
} from '../../utils/orderSearchAndStatus.helper';

export interface FulfillmentOrderCardProps {
  order: any;
  column: 'PENDING' | 'PREPARING' | 'BILLED';
  pendingRoutes?: any[];
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
  onOrderDeliveryUpdated?: () => void;
}

const SECONDARY_ACTION_STYLE = {
  height: '26px',
  padding: '0 8px',
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: '#FFFFFF',
  borderColor: '#E5E7EB',
  color: '#374151',
} as const;

export function FulfillmentOrderCard({
  order: o,
  column,
  pendingRoutes = [],
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
  onOrderDeliveryUpdated,
}: FulfillmentOrderCardProps) {
  const statusInfo = getOrderStatusInfo(o);
  const clientName = resolveOrderClientName(o, 'Cliente sin Nombre');
  const clientCity = resolveOrderClientCity(o);
  const originLabel = resolveOrderOriginLabel(o);
  const channelBadge = resolveOrderFiscalChannelBadge(o);
  const relativeAge = formatOrderRelativeAge(o.createdAt);
  const pendingCae = isOrderPendingCae(o);
  const orderDateKey = formatArgentinaDateKey(o.updatedAt || o.createdAt || new Date());
  const todayKey = formatArgentinaDateKey(new Date());
  const isPriorDayPendingCae = pendingCae && Boolean(orderDateKey) && orderDateKey !== todayKey;
  const formattedShortDate = new Date(o.updatedAt || o.createdAt || Date.now()).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  const totalFormatted = formatBigIntARS(toOrderIntegerPesosBigInt(o.totalAmount));

  return (
    <article
      className="fulfillment-card"
      style={{
        backgroundColor: isSelected ? '#F8FAFC' : '#FFFFFF',
        borderRadius: '8px',
        padding: '10px 12px',
        borderStyle: 'solid',
        borderWidth: isSelected ? '1.5px' : '1px',
        borderColor: isSelected ? '#111827' : '#E5E7EB',
        borderLeftWidth: isPriorDayPendingCae ? '3px' : isSelected ? '1.5px' : '1px',
        borderLeftColor: isPriorDayPendingCae ? '#E30613' : isSelected ? '#111827' : '#E5E7EB',
        boxShadow: '0 1px 2px rgba(17, 24, 39, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          {column === 'PENDING' && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(o.id)}
              style={{
                cursor: 'pointer',
                width: '14px',
                height: '14px',
                accentColor: '#111827',
                flexShrink: 0,
              }}
              aria-label={`Seleccionar pedido #${o.id} para lote A4`}
            />
          )}
          <span
            className="tabular-nums"
            style={{
              fontWeight: 700,
              fontSize: '0.75rem',
              backgroundColor: '#F3F4F6',
              padding: '1px 6px',
              borderRadius: '4px',
              color: '#111827',
              border: '1px solid #E5E7EB',
              flexShrink: 0,
            }}
          >
            #{o.id}
          </span>
          <span
            style={{
              fontWeight: 600,
              fontSize: '0.86rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#111827',
            }}
            title={clientName}
          >
            {clientName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <span
            className={channelBadge.isOfficial ? 'badge-minimal badge-minimal--solid' : 'badge-minimal'}
            title={channelBadge.title}
          >
            {channelBadge.code}
          </span>
          {relativeAge && (
            <span className="tabular-nums" style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 500 }}>
              {relativeAge}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.75rem',
          color: '#6B7280',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          <span>{o.items?.length || 0} ítems</span>
          <span aria-hidden="true">·</span>
          <span style={{ color: '#4B5563', fontWeight: 500 }}>{originLabel}</span>
          {clientCity && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>
                {clientCity}
              </span>
            </>
          )}
          {column === 'BILLED' && statusInfo.label === 'Entregado' && (
            <span className="badge-minimal" style={{ padding: '1px 5px', fontSize: '0.67rem' }}>
              Entregado
            </span>
          )}
        </div>

        <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', flexShrink: 0 }}>
          {totalFormatted}
        </div>
      </div>

      {column === 'BILLED' && pendingCae && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            backgroundColor: '#FEF2F2',
            border: '1px solid rgba(227, 6, 19, 0.28)',
            borderRadius: '6px',
            padding: '5px 8px',
          }}
        >
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#E30613',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <AlertCircle size={12} aria-hidden="true" />
            {isPriorDayPendingCae
              ? `${formattedShortDate} · Sin CAE`
              : 'Sin CAE'}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={requestingCaeId === o.id}
            style={{
              height: '22px',
              padding: '0 8px',
              fontSize: '0.7rem',
              fontWeight: 600,
              backgroundColor: '#E30613',
              borderColor: '#E30613',
              color: '#FFFFFF',
              borderRadius: '4px',
              flexShrink: 0,
            }}
            onClick={() => onRequestCae(o.id)}
            title="Solicitar CAE"
          >
            {requestingCaeId === o.id ? 'Solicitando...' : 'Solicitar CAE'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
        <OrderDeliveryBadgeControl
          order={o}
          pendingRoutes={pendingRoutes}
          compact
          hideSelector
          onUpdated={() => onOrderDeliveryUpdated?.()}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, marginLeft: 'auto' }}>
          {column === 'PENDING' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ ...SECONDARY_ACTION_STYLE, width: '28px', padding: 0 }}
                onClick={() => onPrintPickingList(o)}
                title="Hoja de armado"
                aria-label={`Imprimir hoja de armado pedido #${o.id}`}
              >
                <Printer size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ ...SECONDARY_ACTION_STYLE, width: '28px', padding: 0 }}
                onClick={() => onPrintLabels(o)}
                title="Rótulos de bultos"
                aria-label={`Imprimir rótulos pedido #${o.id}`}
              >
                <Tag size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  height: '26px',
                  padding: '0 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#111827',
                  borderColor: '#111827',
                  color: '#FFFFFF',
                }}
                onClick={() => onOpenFulfillmentModal(o)}
              >
                Facturar
              </button>
            </>
          )}

          {column === 'PREPARING' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ ...SECONDARY_ACTION_STYLE, width: '28px', padding: 0 }}
                onClick={() => onRevertToPending(o.id)}
                title="Volver a Pendientes"
                aria-label={`Devolver pedido #${o.id} a Pendientes`}
              >
                <RotateCcw size={12} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  height: '26px',
                  padding: '0 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#111827',
                  borderColor: '#111827',
                  color: '#FFFFFF',
                }}
                onClick={() => onOpenFulfillmentModal(o)}
              >
                <CheckSquare size={12} aria-hidden="true" />
                Confirmar
              </button>
            </>
          )}

          {column === 'BILLED' && (
            <>
              {o.billingType === 'OFFICIAL' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ ...SECONDARY_ACTION_STYLE, fontWeight: 600, color: '#111827' }}
                  onClick={() => onPrintFacturaA4(o)}
                  title="Factura A4"
                >
                  <FileText size={12} aria-hidden="true" />
                  A4
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ ...SECONDARY_ACTION_STYLE, fontWeight: 600, color: '#111827' }}
                  onClick={() => onPrintRemitoX(o)}
                  title="Boleta A4"
                >
                  <FileText size={12} aria-hidden="true" />
                  A4
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                style={SECONDARY_ACTION_STYLE}
                onClick={() => onPrintReceipt(o)}
                title="Ticket 80mm"
              >
                <Printer size={12} aria-hidden="true" />
                Ticket
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
