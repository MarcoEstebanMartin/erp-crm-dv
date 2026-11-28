import { Printer } from 'lucide-react';
import {
  printOrderReceipt,
  printRemitoX,
  printFacturaOficialA4,
} from '../../utils/printHelpers';
import OrderFulfillmentModal from '../modals/OrderFulfillmentModal';
import ConfirmModal from '../modals/ConfirmModal';
import { usePendingDeliveryRoutesQuery } from '../../hooks/queries';
import { FulfillmentOrderCard } from './FulfillmentOrderCard';
import { FulfillmentListView } from './FulfillmentListView';
import { FulfillmentToolbar } from './FulfillmentToolbar';
import { useFulfillmentDashboard } from './useFulfillmentDashboard';
import { FULFILLMENT_STAGE_TONES } from '../../utils/fulfillmentCardMeta.helper';

const COLUMN_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '10px',
  padding: '12px',
  minWidth: 0,
} as const;

export default function FulfillmentDashboard() {
  const f = useFulfillmentDashboard();
  const { data: pendingRoutes = [] } = usePendingDeliveryRoutesQuery();
  const handleDeliveryUpdated = () => void f.fetchOrders();

  return (
    <div style={{ padding: '0 4px', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <FulfillmentToolbar
        loading={f.loading}
        viewMode={f.viewMode}
        setViewMode={f.setViewMode}
        fetchOrders={f.fetchOrders}
        searchQuery={f.searchQuery}
        setSearchQuery={f.setSearchQuery}
        selectedRoute={f.selectedRoute}
        setSelectedRoute={f.setSelectedRoute}
        uniqueRoutes={f.uniqueRoutes}
        selectedSeller={f.selectedSeller}
        setSelectedSeller={f.setSelectedSeller}
        uniqueSellers={f.uniqueSellers}
        selectedZone={f.selectedZone}
        setSelectedZone={f.setSelectedZone}
        selectedOrderIdsCount={f.selectedOrderIds.length}
        preparingCount={f.preparing.length}
        selectedPreparingIdsCount={f.selectedPreparingIds.length}
        handleStartFulfillmentQueue={f.handleStartFulfillmentQueue}
        handlePrintConsolidated={f.handlePrintConsolidated}
        handlePrintLabels={() => f.handlePrintLabels()}
      />

      {f.viewMode === 'list' ? (
        <FulfillmentListView
          pending={f.pending}
          preparing={f.preparing}
          billedOrPendingCae={f.billedOrPendingCae}
          pendingCaeCount={f.pendingCaeCount}
          pendingRoutes={pendingRoutes}
          selectedOrderIds={f.selectedOrderIds}
          selectedPreparingIds={f.selectedPreparingIds}
          requestingCaeId={f.requestingCaeId}
          onToggleSelect={f.toggleSelectOrder}
          onToggleSelectAllPending={f.toggleSelectAllPending}
          onToggleSelectPreparing={f.toggleSelectPreparing}
          onToggleSelectAllPreparing={f.toggleSelectAllPreparing}
          onPrintBatchA4={f.handlePrintBatchA4}
          onPrintConsolidatedBilled={f.handlePrintConsolidatedBilled}
          onPrintPickingList={f.handlePrintSinglePicking}
          onPrintLabels={f.handlePrintLabels}
          onOpenFulfillmentModal={f.setFulfillmentModalOrder}
          onRevertToPending={f.handleRevertToPending}
          onRequestCae={f.handleRequestCae}
          onPrintFacturaA4={printFacturaOficialA4}
          onPrintRemitoX={printRemitoX}
          onPrintReceipt={printOrderReceipt}
          onOrderDeliveryUpdated={handleDeliveryUpdated}
        />
      ) : (
        <div
          className="fulfillment-board-grid"
          style={{ gridTemplateColumns: f.boardGridTemplate }}
        >
          <section
            aria-label="Pedidos pendientes de armado"
            style={{
              ...COLUMN_CONTAINER_STYLE,
              borderTop: `3px solid ${FULFILLMENT_STAGE_TONES.PENDING.accent}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                gap: '8px',
                backgroundColor: FULFILLMENT_STAGE_TONES.PENDING.bg,
                border: `1px solid ${FULFILLMENT_STAGE_TONES.PENDING.border}`,
                borderRadius: '7px',
                padding: '6px 10px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: FULFILLMENT_STAGE_TONES.PENDING.text }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: FULFILLMENT_STAGE_TONES.PENDING.dot }} />
                <span>Pendientes ({f.pending.length})</span>
                <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6B7280' }}>
                  · {f.pendingTotalLabel}
                </span>
                {f.selectedOrderIds.length > 0 && (
                  <span className="badge-minimal badge-minimal--solid">
                    {f.selectedOrderIds.length} sel.
                  </span>
                )}
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={f.handlePrintBatchA4}
                  title="Imprimir lote A4 de pedidos seleccionados (máximo 8 por hoja A4)"
                  aria-label="Imprimir lote A4 de pedidos seleccionados (máximo 8 por hoja A4)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    padding: 0,
                    borderRadius: '5px',
                    backgroundColor: '#111827',
                    borderColor: '#111827',
                    color: '#FFFFFF',
                  }}
                >
                  <Printer size={13} aria-hidden="true" />
                </button>
                {f.pending.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600, color: '#4B5563' }}>
                    <input
                      type="checkbox"
                      checked={f.pending.length > 0 && f.pending.every((o) => f.selectedOrderIds.includes(o.id))}
                      onChange={f.toggleSelectAllPending}
                      style={{ accentColor: '#111827', cursor: 'pointer' }}
                    />
                    Todos
                  </label>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
              {f.pending.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '28px', fontSize: '0.82rem' }}>
                  Sin pedidos pendientes.
                </div>
              ) : (
                f.pending.map((o) => (
                  <FulfillmentOrderCard
                    key={o.id}
                    order={o}
                    column="PENDING"
                    pendingRoutes={pendingRoutes}
                    isSelected={f.selectedOrderIds.includes(o.id)}
                    onToggleSelect={f.toggleSelectOrder}
                    onPrintPickingList={f.handlePrintSinglePicking}
                    onPrintLabels={f.handlePrintLabels}
                    onOpenFulfillmentModal={f.setFulfillmentModalOrder}
                    onRevertToPending={f.handleRevertToPending}
                    onRequestCae={f.handleRequestCae}
                    onPrintFacturaA4={printFacturaOficialA4}
                    onPrintRemitoX={printRemitoX}
                    onPrintReceipt={printOrderReceipt}
                    onOrderDeliveryUpdated={handleDeliveryUpdated}
                  />
                ))
              )}
            </div>
          </section>

          <section
            aria-label="Pedidos en armado"
            style={{
              ...COLUMN_CONTAINER_STYLE,
              borderTop: `3px solid ${FULFILLMENT_STAGE_TONES.PREPARING.accent}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                gap: '8px',
                backgroundColor: FULFILLMENT_STAGE_TONES.PREPARING.bg,
                border: `1px solid ${FULFILLMENT_STAGE_TONES.PREPARING.border}`,
                borderRadius: '7px',
                padding: '6px 10px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: FULFILLMENT_STAGE_TONES.PREPARING.text }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: FULFILLMENT_STAGE_TONES.PREPARING.dot }} />
                <span>En Armado ({f.preparing.length})</span>
                <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6B7280' }}>
                  · {f.preparingTotalLabel}
                </span>
              </h3>
              {f.preparing.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px', borderRadius: '5px', fontWeight: 600 }}
                  onClick={f.handleRevertAllPreparingToPending}
                  title="Devolver todos los pedidos en armado a la columna Pendientes"
                >
                  Devolver Todos
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
              {f.preparing.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '28px', fontSize: '0.82rem' }}>
                  Sin pedidos en preparación.
                </div>
              ) : (
                f.preparing.map((o) => (
                  <FulfillmentOrderCard
                    key={o.id}
                    order={o}
                    column="PREPARING"
                    pendingRoutes={pendingRoutes}
                    isSelected={false}
                    onToggleSelect={f.toggleSelectOrder}
                    onPrintPickingList={f.handlePrintSinglePicking}
                    onPrintLabels={f.handlePrintLabels}
                    onOpenFulfillmentModal={f.setFulfillmentModalOrder}
                    onRevertToPending={f.handleRevertToPending}
                    onRequestCae={f.handleRequestCae}
                    onPrintFacturaA4={printFacturaOficialA4}
                    onPrintRemitoX={printRemitoX}
                    onPrintReceipt={printOrderReceipt}
                    onOrderDeliveryUpdated={handleDeliveryUpdated}
                  />
                ))
              )}
            </div>
          </section>

          <section
            aria-label="Pedidos facturados y pendientes de CAE"
            style={{
              ...COLUMN_CONTAINER_STYLE,
              borderTop: `3px solid ${FULFILLMENT_STAGE_TONES.BILLED.accent}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
                gap: '6px',
                backgroundColor: FULFILLMENT_STAGE_TONES.BILLED.bg,
                border: `1px solid ${FULFILLMENT_STAGE_TONES.BILLED.border}`,
                borderRadius: '7px',
                padding: '6px 10px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: FULFILLMENT_STAGE_TONES.BILLED.text }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: FULFILLMENT_STAGE_TONES.BILLED.dot }} />
                <span>Facturados ({f.billedOrPendingCae.length})</span>
                <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6B7280' }}>
                  · {f.billedTotalLabel}
                </span>
                {f.pendingCaeCount > 0 && (
                  <span className="badge-minimal badge-minimal--danger">
                    {f.pendingCaeCount} sin CAE
                  </span>
                )}
              </h3>
              {f.billedOrPendingCae.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    height: '24px',
                    borderRadius: '5px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  onClick={f.handlePrintConsolidatedBilled}
                  title="Imprimir consolidado de mercadería facturada"
                  aria-label="Imprimir consolidado de mercadería facturada"
                >
                  <Printer size={12} aria-hidden="true" />
                  Consolidado
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
              {f.billedOrPendingCae.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '28px', fontSize: '0.82rem' }}>
                  Sin facturaciones hoy ni Pre-Facturas pendientes de CAE.
                </div>
              ) : (
                f.billedOrPendingCae.map((o) => (
                  <FulfillmentOrderCard
                    key={o.id}
                    order={o}
                    column="BILLED"
                    pendingRoutes={pendingRoutes}
                    isSelected={false}
                    requestingCaeId={f.requestingCaeId}
                    onToggleSelect={f.toggleSelectOrder}
                    onPrintPickingList={f.handlePrintSinglePicking}
                    onPrintLabels={f.handlePrintLabels}
                    onOpenFulfillmentModal={f.setFulfillmentModalOrder}
                    onRevertToPending={f.handleRevertToPending}
                    onRequestCae={f.handleRequestCae}
                    onPrintFacturaA4={printFacturaOficialA4}
                    onPrintRemitoX={printRemitoX}
                    onPrintReceipt={printOrderReceipt}
                    onOrderDeliveryUpdated={handleDeliveryUpdated}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {f.fulfillmentModalOrder && (
        <OrderFulfillmentModal
          order={f.fulfillmentModalOrder}
          onClose={() => f.setFulfillmentModalOrder(null)}
          onSuccess={() => {
            f.setFulfillmentModalOrder(null);
            void f.fetchOrders();
          }}
        />
      )}

      {f.fulfillmentQueueOrders && f.fulfillmentQueueOrders.length > 0 && (
        <OrderFulfillmentModal
          queueOrders={f.fulfillmentQueueOrders}
          onClose={() => f.handleCloseFulfillmentQueue(false)}
          onSuccess={() => f.handleCloseFulfillmentQueue(true)}
        />
      )}

      <ConfirmModal {...f.confirmState} />

      <style>{`
        .fulfillment-card:hover {
          border-color: #CBD5E1 !important;
          box-shadow: 0 3px 8px rgba(17, 24, 39, 0.05) !important;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
