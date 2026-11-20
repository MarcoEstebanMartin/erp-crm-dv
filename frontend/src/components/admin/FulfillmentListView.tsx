import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { OrderDeliveryBadgeControl } from '../common/OrderDeliveryBadgeControl';
import { FulfillmentListRowActions } from './FulfillmentListRowActions';
import {
  FulfillmentStageFilterBar,
  type FulfillmentListStageFilter,
} from './FulfillmentStageFilterBar';
import {
  FULFILLMENT_STAGE_TONES,
  formatBigIntARS,
  formatOrderRelativeAge,
  resolveOrderFiscalChannelBadge,
  resolveOrderOriginLabel,
  toOrderIntegerPesosBigInt,
  type FulfillmentStageKey,
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
  pendingCaeCount: number;
  pendingRoutes?: any[];
  selectedOrderIds: number[];
  selectedPreparingIds: number[];
  requestingCaeId?: number | null;
  onToggleSelect: (id: number) => void;
  onToggleSelectAllPending: () => void;
  onToggleSelectPreparing: (id: number) => void;
  onToggleSelectAllPreparing: () => void;
  onPrintBatchA4: () => void;
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

interface ListRow {
  order: any;
  stage: FulfillmentStageKey;
  stageLabel: string;
}

export function FulfillmentListView({
  pending,
  preparing,
  billedOrPendingCae,
  pendingCaeCount,
  pendingRoutes = [],
  selectedOrderIds,
  selectedPreparingIds,
  requestingCaeId,
  onToggleSelect,
  onToggleSelectAllPending,
  onToggleSelectPreparing,
  onToggleSelectAllPreparing,
  onPrintBatchA4,
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
  const [stageFilter, setStageFilter] = useState<FulfillmentListStageFilter>('ALL');

  const allRows: ListRow[] = [
    ...pending.map((order): ListRow => ({ order, stage: 'PENDING', stageLabel: 'Pendiente' })),
    ...preparing.map((order): ListRow => ({ order, stage: 'PREPARING', stageLabel: 'En Armado' })),
    ...billedOrPendingCae.map((order): ListRow => ({ order, stage: 'BILLED', stageLabel: 'Facturado' })),
  ];

  const rows = stageFilter === 'ALL' ? allRows : allRows.filter((r) => r.stage === stageFilter);
  const allPendingSelected = pending.length > 0 && pending.every((o) => selectedOrderIds.includes(o.id));
  const allPreparingSelected =
    preparing.length > 0 && preparing.every((o) => selectedPreparingIds.includes(o.id));
  const headerSelectMode: 'PENDING' | 'PREPARING' | 'NONE' =
    stageFilter === 'PREPARING'
      ? preparing.length > 0
        ? 'PREPARING'
        : 'NONE'
      : stageFilter === 'PENDING'
        ? pending.length > 0
          ? 'PENDING'
          : 'NONE'
        : stageFilter === 'ALL'
          ? pending.length > 0
            ? 'PENDING'
            : preparing.length > 0
              ? 'PREPARING'
              : 'NONE'
          : 'NONE';
  const headerChecked =
    headerSelectMode === 'PREPARING'
      ? allPreparingSelected
      : headerSelectMode === 'PENDING'
        ? allPendingSelected
        : false;
  const handleHeaderToggle = () => {
    if (headerSelectMode === 'PREPARING') {
      onToggleSelectAllPreparing();
    } else if (headerSelectMode === 'PENDING') {
      onToggleSelectAllPending();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <FulfillmentStageFilterBar
        stageFilter={stageFilter}
        onSelectStage={setStageFilter}
        totalCount={allRows.length}
        pendingCount={pending.length}
        preparingCount={preparing.length}
        billedCount={billedOrPendingCae.length}
        pendingCaeCount={pendingCaeCount}
        selectedPendingCount={selectedOrderIds.length}
        onPrintBatchA4={onPrintBatchA4}
      />

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
                  checked={headerChecked}
                  onChange={handleHeaderToggle}
                  disabled={headerSelectMode === 'NONE'}
                  aria-label={
                    headerSelectMode === 'PREPARING'
                      ? 'Seleccionar todos los pedidos en armado para facturar'
                      : 'Seleccionar todos los pedidos pendientes para lote A4'
                  }
                  style={{ accentColor: '#111827', cursor: headerSelectMode !== 'NONE' ? 'pointer' : 'not-allowed' }}
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
              const isSelected =
                stage === 'PREPARING'
                  ? selectedPreparingIds.includes(o.id)
                  : selectedOrderIds.includes(o.id);
              const tone = FULFILLMENT_STAGE_TONES[stage];
              const rowAccent = pendingCae ? '#E30613' : tone.accent;

              return (
                <tr
                  key={o.id}
                  style={{
                    backgroundColor: isSelected ? '#F8FAFC' : undefined,
                    boxShadow: `inset 3px 0 0 ${rowAccent}`,
                  }}
                >
                  <td style={{ textAlign: 'center' }}>
                    {stage === 'PENDING' ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(o.id)}
                        aria-label={`Seleccionar pedido #${o.id} para lote A4`}
                        style={{ accentColor: '#111827', cursor: 'pointer' }}
                      />
                    ) : stage === 'PREPARING' ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectPreparing(o.id)}
                        aria-label={`Seleccionar pedido #${o.id} para revisar y facturar`}
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
                    {pendingCae ? (
                      <span className="badge-minimal badge-minimal--danger">
                        <AlertCircle size={11} aria-hidden="true" />
                        Sin CAE
                      </span>
                    ) : (
                      <span
                        className="badge-minimal"
                        style={{
                          backgroundColor: tone.bg,
                          borderColor: tone.border,
                          color: tone.text,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: tone.dot }}
                        />
                        {stageLabel}
                      </span>
                    )}
                  </td>
                  <td>
                    <OrderDeliveryBadgeControl
                      order={o}
                      pendingRoutes={pendingRoutes}
                      compact
                      hideSelector
                      emptyFallback={<span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>—</span>}
                      onUpdated={() => onOrderDeliveryUpdated?.()}
                    />
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                    {formatBigIntARS(toOrderIntegerPesosBigInt(o.totalAmount))}
                  </td>
                  <td>
                    <FulfillmentListRowActions
                      order={o}
                      stage={stage}
                      pendingCae={pendingCae}
                      requestingCaeId={requestingCaeId}
                      onPrintPickingList={onPrintPickingList}
                      onPrintLabels={onPrintLabels}
                      onOpenFulfillmentModal={onOpenFulfillmentModal}
                      onRevertToPending={onRevertToPending}
                      onRequestCae={onRequestCae}
                      onPrintFacturaA4={onPrintFacturaA4}
                      onPrintRemitoX={onPrintRemitoX}
                      onPrintReceipt={onPrintReceipt}
                    />
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
}
