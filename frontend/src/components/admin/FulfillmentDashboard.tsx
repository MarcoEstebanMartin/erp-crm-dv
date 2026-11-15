import { Printer, Search, RefreshCw } from 'lucide-react';
import {
  printPickingList,
  printOrderReceipt,
  printRemitoX,
  printFacturaOficialA4,
} from '../../utils/printHelpers';
import OrderFulfillmentModal from '../modals/OrderFulfillmentModal';
import ConfirmModal from '../modals/ConfirmModal';
import { FulfillmentOrderCard } from './FulfillmentOrderCard';
import { useFulfillmentDashboard } from './useFulfillmentDashboard';

export default function FulfillmentDashboard() {
  const f = useFulfillmentDashboard();

  return (
    <div style={{ padding: '0 12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--background-card)',
          padding: '8px 14px',
          borderRadius: '10px',
          border: '1px solid var(--border-color)',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.3px' }}>
            Armado &amp; Facturación
          </h2>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', height: '28px', borderRadius: '6px' }}
            onClick={f.fetchOrders}
            disabled={f.loading}
            title="Recargar pedidos"
          >
            <RefreshCw size={13} className={f.loading ? 'spin' : ''} />
          </button>
        </div>

        <search aria-label="Filtrar pedidos en armado">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ position: 'relative' }}>
              <label htmlFor="fulfillment-search" className="visually-hidden">
                Buscar pedidos en armado por cliente, #pedido o código web
              </label>
              <Search
                size={14}
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
                style={{ paddingLeft: '28px', paddingRight: '8px', height: '28px', fontSize: '0.82rem', width: '175px' }}
                value={f.searchQuery}
                onChange={(e) => f.setSearchQuery(e.target.value)}
              />
            </div>

            <select
              aria-label="Filtrar por ruta"
              className="input"
              style={{ padding: '3px 6px', height: '28px', fontSize: '0.82rem' }}
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
              style={{ padding: '3px 6px', height: '28px', fontSize: '0.82rem' }}
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
              style={{ padding: '3px 6px', height: '28px', fontSize: '0.82rem', fontWeight: 600 }}
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

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#6366F1',
              borderColor: '#6366F1',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 12px',
              borderRadius: '6px',
              boxShadow: '0 2px 6px rgba(99, 102, 241, 0.2)',
            }}
            onClick={f.handlePrintBatchA4}
            title="Imprimir lote de pedidos seleccionados (máximo 8 por hoja A4)"
          >
            <Printer size={13} /> Lote A4 {f.selectedOrderIds.length > 0 ? `(${f.selectedOrderIds.length})` : ''}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#F8FAFC',
              borderColor: '#E2E8F0',
              color: '#334155',
              fontWeight: 700,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 12px',
              borderRadius: '6px',
            }}
            onClick={f.handlePrintConsolidated}
            title="Imprimir planilla de consolidado total por depósito"
          >
            <Printer size={13} /> Consolidado {f.selectedOrderIds.length > 0 ? `(${f.selectedOrderIds.length})` : ''}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#FEF3C7',
              borderColor: '#F59E0B',
              color: '#B45309',
              fontWeight: 800,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 12px',
              borderRadius: '6px',
            }}
            onClick={() => f.handlePrintLabels()}
            title="Imprimir rótulos térmicos adhesivos para los bultos"
          >
            Rótulos Bultos {f.selectedOrderIds.length > 0 ? `(${f.selectedOrderIds.length})` : ''}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', flexGrow: 1, minHeight: 0 }}>
        {/* Columna Pendientes */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366F1' }} />
              Pendientes ({f.pending.length})
              {f.selectedOrderIds.length > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    backgroundColor: '#EEF2FF',
                    color: '#4338CA',
                    border: '1px solid #C7D2FE',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    marginLeft: '4px',
                  }}
                >
                  {f.selectedOrderIds.length} sel.
                </span>
              )}
            </h3>

            {f.pending.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={f.pending.length > 0 && f.pending.every((o) => f.selectedOrderIds.includes(o.id))}
                  onChange={f.toggleSelectAllPending}
                  style={{ accentColor: 'var(--accent-color, #111827)', cursor: 'pointer' }}
                />
                Todos
              </label>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
            {f.pending.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '30px', fontSize: '0.85rem' }}>
                No hay pedidos pendientes.
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
        </div>

        {/* Columna En Picking */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              En Picking ({f.preparing.length})
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
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '30px', fontSize: '0.85rem' }}>
                No hay pedidos en preparación.
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
        </div>

        {/* Columna Facturados Hoy y Pre-Facturas sin CAE */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
              Facturados Hoy ({f.billedOrPendingCae.length})
              {f.pendingCaeCount > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    border: '1px solid #F59E0B',
                    padding: '1px 7px',
                    borderRadius: '10px',
                  }}
                >
                  {f.pendingCaeCount} sin CAE
                </span>
              )}
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
            {f.billedOrPendingCae.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '30px', fontSize: '0.85rem' }}>
                Aún no hay facturaciones hoy ni Pre-Facturas pendientes de CAE.
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
        </div>
      </div>

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
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
