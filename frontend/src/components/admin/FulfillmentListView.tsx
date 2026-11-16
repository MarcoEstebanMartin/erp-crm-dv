import { AlertCircle, CheckSquare, FileText, Printer, RotateCcw, Tag } from 'lucide-react';
import { OrderDeliveryBadgeControl } from '../common/OrderDeliveryBadgeControl';
import {
  formatBigIntARS,
  formatOrderRelativeAge,
  resolveOrderFiscalChannelBadge,
  resolveOrderOriginLabel,
  toOrderIntegerPesosBigInt,
} from '../../utils/fulfillmentCardMeta.helper';
import {
  isOrderPendingCae,
  resolveOrderClientCity,
  resolveOrderClientName,
} from '../../utils/orderSearchAndStatus.helper';

interface FulfillmentListViewProps {
  pending: any[];
  preparing: any[];
  billedOrPendingCae: any[];
  pendingRoutes?: any[];
  selectedOrderIds: number[];
  requestingCaeId?: number | null;
  onToggleSelect: (id: number) => void;
  onToggleSelectAllPending: () => void;
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

type FulfillmentStage = 'PENDING' | 'PREPARING' | 'BILLED';

interface ListRow {
  order: any;
  stage: FulfillmentStage;
  stageLabel: string;
}

export function FulfillmentListView({
  pending,
  preparing,
  billedOrPendingCae,
  pendingRoutes = [],
  selectedOrderIds,
  requestingCaeId,
  onToggleSelect,
  onToggleSelectAllPending,
  onPrintPickingList,
  onPrintLabels,
  onOpenFulfillmentModal,
  onRevertToPending,
  onRequestCae,
  onPrintFacturaA4,
  onPrintRemitoX,
  onPrintReceipt,
  onOrderDeliveryUpdated,
}: FulfillmentListViewProps) {
  const rows: ListRow[] = [
    ...pending.map((order): ListRow => ({ order, stage: 'PENDING', stageLabel: 'Pendiente' })),
    ...preparing.map((order): ListRow => ({ order, stage: 'PREPARING', stageLabel: 'En Picking' })),
    ...billedOrPendingCae.map((order): ListRow => ({ order, stage: 'BILLED', stageLabel: 'Facturado' })),
  ];

  const allPendingSelected = pending.length > 0 && pending.every((o) => selectedOrderIds.includes(o.id));

  return (
    <div
      className="table-container table-container--sticky"
      role="region"
      aria-label="Listado compacto de pedidos en armado y facturación"
      tabIndex={0}
      style={{ marginTop: 0 }}
    >
      <table>
        <thead>
          <tr>
            <th scope="col" style={{ width: '36px', textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allPendingSelected}
                onChange={onToggleSelectAllPending}
                disabled={pending.length === 0}
                aria-label="Seleccionar todos los pedidos pendientes para lote A4"
                style={{ accentColor: '#111827', cursor: pending.length > 0 ? 'pointer' : 'not-allowed' }}
              />
            </th>
            <th scope="col">Pedido</th>
            <th scope="col">Cliente / Localidad</th>
            <th scope="col">Origen</th>
            <th scope="col">Antigüedad</th>
            <th scope="col">Canal</th>
            <th scope="col">Etapa</th>
            <th scope="col">Entrega</th>
            <th scope="col" style={{ textAlign: 'right' }}>Total</th>
            <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ textAlign: 'center', padding: '28px 14px', color: 'var(--text-secondary)' }}>
                No hay pedidos que coincidan con los filtros seleccionados.
              </td>
            </tr>
          ) : (
            rows.map(({ order: o, stage, stageLabel }) => {
              const clientName = resolveOrderClientName(o, 'Cliente sin Nombre');
              const clientCity = resolveOrderClientCity(o);
              const originLabel = resolveOrderOriginLabel(o);
              const age = formatOrderRelativeAge(o.createdAt);
              const channelBadge = resolveOrderFiscalChannelBadge(o);
              const pendingCae = isOrderPendingCae(o);
              const isSelected = selectedOrderIds.includes(o.id);

              return (
                <tr key={o.id} style={{ backgroundColor: isSelected ? '#F8FAFC' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    {stage === 'PENDING' ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(o.id)}
                        aria-label={`Seleccionar pedido #${o.id} para lote A4`}
                        style={{ accentColor: '#111827', cursor: 'pointer' }}
                      />
                    ) : null}
                  </td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>#{o.id}</td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{clientName}</div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
                      {o.items?.length || 0} ítems{clientCity ? ` · ${clientCity}` : ''}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#4B5563', whiteSpace: 'nowrap' }}>{originLabel}</td>
                  <td style={{ fontSize: '0.78rem', color: '#6B7280', whiteSpace: 'nowrap' }}>{age || '—'}</td>
                  <td>
                    <span
                      className={channelBadge.isOfficial ? 'badge-minimal badge-minimal--solid' : 'badge-minimal'}
                      title={channelBadge.title}
                    >
                      {channelBadge.code}
                    </span>
                  </td>
                  <td>
                    <span className={pendingCae ? 'badge-minimal badge-minimal--danger' : 'badge-minimal'}>
                      {pendingCae && <AlertCircle size={11} aria-hidden="true" />}
                      {pendingCae ? 'Sin CAE' : stageLabel}
                    </span>
                  </td>
                  <td>
                    <OrderDeliveryBadgeControl
                      order={o}
                      pendingRoutes={pendingRoutes}
                      compact
                      onUpdated={() => onOrderDeliveryUpdated?.()}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                    {formatBigIntARS(toOrderIntegerPesosBigInt(o.totalAmount))}
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', flexWrap: 'wrap' }}>
                      {stage === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => onPrintPickingList(o)}
                            title="Imprimir Hoja de Armado"
                            aria-label={`Imprimir hoja de armado pedido #${o.id}`}
                          >
                            <Printer size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => onPrintLabels(o)}
                            title="Imprimir Rótulos de Bultos"
                            aria-label={`Imprimir rótulos pedido #${o.id}`}
                          >
                            <Tag size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => onOpenFulfillmentModal(o)}
                          >
                            Facturar
                          </button>
                        </>
                      )}

                      {stage === 'PREPARING' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => onRevertToPending(o.id)}
                            title="Devolver a Pendientes"
                            aria-label={`Devolver pedido #${o.id} a Pendientes`}
                          >
                            <RotateCcw size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => onOpenFulfillmentModal(o)}
                          >
                            <CheckSquare size={13} aria-hidden="true" />
                            Confirmar
                          </button>
                        </>
                      )}

                      {stage === 'BILLED' && (
                        <>
                          {pendingCae && (
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={requestingCaeId === o.id}
                              style={{
                                padding: '4px 9px',
                                fontSize: '0.74rem',
                                backgroundColor: '#E30613',
                                borderColor: '#E30613',
                              }}
                              onClick={() => onRequestCae(o.id)}
                            >
                              {requestingCaeId === o.id ? 'Solicitando...' : 'Solicitar CAE'}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => (o.billingType === 'OFFICIAL' ? onPrintFacturaA4(o) : onPrintRemitoX(o))}
                            title={o.billingType === 'OFFICIAL' ? 'Factura A4' : 'Boleta A4'}
                          >
                            <FileText size={13} aria-hidden="true" />
                            {o.billingType === 'OFFICIAL' ? 'A4' : 'Rem. X'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
                            onClick={() => onPrintReceipt(o)}
                            title="Imprimir Ticket"
                            aria-label={`Imprimir ticket pedido #${o.id}`}
                          >
                            <Printer size={13} aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
