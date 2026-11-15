import { LayoutGrid, List, Printer, RefreshCw, Search, Tag } from 'lucide-react';
import {
  printPickingList,
  printOrderReceipt,
  printRemitoX,
  printFacturaOficialA4,
} from '../../utils/printHelpers';
import OrderFulfillmentModal from '../modals/OrderFulfillmentModal';
import ConfirmModal from '../modals/ConfirmModal';
import { FulfillmentOrderCard } from './FulfillmentOrderCard';
import { FulfillmentListView } from './FulfillmentListView';
import { useFulfillmentDashboard } from './useFulfillmentDashboard';

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

  return (
    <div style={{ padding: '0 4px', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid #E5E7EB',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#111827' }}>
            Armado &amp; Facturación
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', height: '28px', borderRadius: '6px' }}
            onClick={f.fetchOrders}
            disabled={f.loading}
            title="Recargar pedidos"
            aria-label="Recargar pedidos en armado"
          >
            <RefreshCw size={13} className={f.loading ? 'spin' : ''} aria-hidden="true" />
          </button>

          <div
            role="group"
            aria-label="Cambiar modo de vista"
            style={{
              display: 'inline-flex',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              backgroundColor: '#F9FAFB',
              padding: '2px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              aria-pressed={f.viewMode === 'board'}
              onClick={() => f.setViewMode('board')}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '4px',
                backgroundColor: f.viewMode === 'board' ? '#FFFFFF' : 'transparent',
                color: f.viewMode === 'board' ? '#111827' : '#6B7280',
                boxShadow: f.viewMode === 'board' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <LayoutGrid size={13} aria-hidden="true" />
              Tablero
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              aria-pressed={f.viewMode === 'list'}
              onClick={() => f.setViewMode('list')}
              style={{
                height: '24px',
                padding: '0 8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '4px',
                backgroundColor: f.viewMode === 'list' ? '#FFFFFF' : 'transparent',
                color: f.viewMode === 'list' ? '#111827' : '#6B7280',
                boxShadow: f.viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <List size={13} aria-hidden="true" />
              Lista
            </button>
          </div>
        </div>

        <search aria-label="Filtrar pedidos en armado">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <label htmlFor="fulfillment-search" className="visually-hidden">
                Buscar pedidos en armado por cliente, #pedido o código web
              </label>
              <Search
                size={14}
                aria-hidden="true"
                style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-secondary)' }}
              />
              <input
                id="fulfillment-search"
                name="q"
                type="search"
                className="input"
                placeholder="Buscar cliente, #ID o DV-..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                style={{ paddingLeft: '28px', paddingRight: '8px', height: '28px', fontSize: '0.8rem', width: '175px' }}
                value={f.searchQuery}
                onChange={(e) => f.setSearchQuery(e.target.value)}
              />
            </div>

            <select
              aria-label="Filtrar por ruta"
              className="input"
              style={{ padding: '3px 8px', height: '28px', fontSize: '0.8rem', width: 'auto' }}
              value={f.selectedRoute}
              onChange={(e) => f.setSelectedRoute(e.target.value)}
            >
              <option value="ALL">Todas las Rutas</option>
              {f.uniqueRoutes.map((r: any) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por vendedor"
              className="input"
              style={{ padding: '3px 8px', height: '28px', fontSize: '0.8rem', width: 'auto' }}
              value={f.selectedSeller}
              onChange={(e) => f.setSelectedSeller(e.target.value)}
            >
              <option value="ALL">Vendedores</option>
              {f.uniqueSellers.map((s: any) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por zona de depósito"
              className="input"
              style={{ padding: '3px 8px', height: '28px', fontSize: '0.8rem', width: 'auto', fontWeight: 500 }}
              value={f.selectedZone}
              onChange={(e) => f.setSelectedZone(e.target.value)}
            >
              <option value="ALL">Zonas</option>
              <option value="FRIO">Frío</option>
              <option value="CAJAS">Cajas</option>
              <option value="TABLA">Tabla</option>
            </select>
          </div>
        </search>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              height: '28px',
              padding: '0 12px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: '#111827',
              borderColor: '#111827',
              borderRadius: '6px',
            }}
            onClick={f.handlePrintBatchA4}
            title="Imprimir lote de pedidos seleccionados (máximo 8 por hoja A4)"
          >
            <Printer size={13} aria-hidden="true" />
            Lote A4 {f.selectedOrderIds.length > 0 ? `(${f.selectedOrderIds.length})` : ''}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              borderColor: '#E5E7EB',
              color: '#374151',
              borderRadius: '6px',
            }}
            onClick={f.handlePrintConsolidated}
            title="Imprimir planilla de consolidado total por depósito"
          >
            <Printer size={13} aria-hidden="true" />
            Consolidado {f.selectedOrderIds.length > 0 ? `(${f.selectedOrderIds.length})` : ''}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              height: '28px',
              padding: '0 10px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              borderColor: '#E5E7EB',
              color: '#374151',
              borderRadius: '6px',
            }}
            onClick={() => f.handlePrintLabels()}
            title="Imprimir rótulos térmicos adhesivos para los bultos"
          >
            <Tag size={13} aria-hidden="true" />
            Rótulos Bultos {f.selectedOrderIds.length > 0 ? `(${f.selectedOrderIds.length})` : ''}
          </button>
        </div>
      </div>

      {f.viewMode === 'list' ? (
        <FulfillmentListView
          pending={f.pending}
          preparing={f.preparing}
          billedOrPendingCae={f.billedOrPendingCae}
          selectedOrderIds={f.selectedOrderIds}
          requestingCaeId={f.requestingCaeId}
          onToggleSelect={f.toggleSelectOrder}
          onToggleSelectAllPending={f.toggleSelectAllPending}
          onPrintPickingList={printPickingList}
          onPrintLabels={f.handlePrintLabels}
          onOpenFulfillmentModal={f.setFulfillmentModalOrder}
          onRevertToPending={f.handleRevertToPending}
          onRequestCae={f.handleRequestCae}
          onPrintFacturaA4={printFacturaOficialA4}
          onPrintRemitoX={printRemitoX}
          onPrintReceipt={printOrderReceipt}
        />
      ) : (
        <div
          className="fulfillment-board-grid"
          style={{ gridTemplateColumns: f.boardGridTemplate }}
        >
          <section aria-label="Pedidos pendientes de armado" style={COLUMN_CONTAINER_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: '#111827' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#111827' }} />
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
                    isSelected={f.selectedOrderIds.includes(o.id)}
                    onToggleSelect={f.toggleSelectOrder}
                    onPrintPickingList={printPickingList}
                    onPrintLabels={f.handlePrintLabels}
                    onOpenFulfillmentModal={f.setFulfillmentModalOrder}
                    onRevertToPending={f.handleRevertToPending}
                    onRequestCae={f.handleRequestCae}
                    onPrintFacturaA4={printFacturaOficialA4}
                    onPrintRemitoX={printRemitoX}
                    onPrintReceipt={printOrderReceipt}
                  />
                ))
              )}
            </div>
          </section>

          <section aria-label="Pedidos en picking" style={COLUMN_CONTAINER_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: '#111827' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#6B7280' }} />
                <span>En Picking ({f.preparing.length})</span>
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
                  title="Devolver todos los pedidos en picking a la columna Pendientes"
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
                    isSelected={false}
                    onToggleSelect={f.toggleSelectOrder}
                    onPrintPickingList={printPickingList}
                    onPrintLabels={f.handlePrintLabels}
                    onOpenFulfillmentModal={f.setFulfillmentModalOrder}
                    onRevertToPending={f.handleRevertToPending}
                    onRequestCae={f.handleRequestCae}
                    onPrintFacturaA4={printFacturaOficialA4}
                    onPrintRemitoX={printRemitoX}
                    onPrintReceipt={printOrderReceipt}
                  />
                ))
              )}
            </div>
          </section>

          <section aria-label="Pedidos facturados hoy y pendientes de CAE" style={COLUMN_CONTAINER_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: '#111827' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#9CA3AF' }} />
                <span>Facturados Hoy ({f.billedOrPendingCae.length})</span>
                <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6B7280' }}>
                  · {f.billedTotalLabel}
                </span>
                {f.pendingCaeCount > 0 && (
                  <span className="badge-minimal badge-minimal--danger">
                    {f.pendingCaeCount} sin CAE
                  </span>
                )}
              </h3>
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
                    isSelected={false}
                    requestingCaeId={f.requestingCaeId}
                    onToggleSelect={f.toggleSelectOrder}
                    onPrintPickingList={printPickingList}
                    onPrintLabels={f.handlePrintLabels}
                    onOpenFulfillmentModal={f.setFulfillmentModalOrder}
                    onRevertToPending={f.handleRevertToPending}
                    onRequestCae={f.handleRequestCae}
                    onPrintFacturaA4={printFacturaOficialA4}
                    onPrintRemitoX={printRemitoX}
                    onPrintReceipt={printOrderReceipt}
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
