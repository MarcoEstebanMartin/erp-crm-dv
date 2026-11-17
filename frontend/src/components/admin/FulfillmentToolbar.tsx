import { LayoutGrid, List, Printer, RefreshCw, Search, Tag } from 'lucide-react';

interface FulfillmentToolbarProps {
  loading: boolean;
  viewMode: 'board' | 'list';
  setViewMode: (mode: 'board' | 'list') => void;
  fetchOrders: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedRoute: string;
  setSelectedRoute: (route: string) => void;
  uniqueRoutes: string[];
  selectedSeller: string;
  setSelectedSeller: (seller: string) => void;
  uniqueSellers: string[];
  selectedZone: string;
  setSelectedZone: (zone: string) => void;
  selectedOrderIdsCount: number;
  handlePrintBatchA4: () => void;
  handlePrintConsolidated: () => void;
  handlePrintLabels: () => void;
}

export function FulfillmentToolbar({
  loading,
  viewMode,
  setViewMode,
  fetchOrders,
  searchQuery,
  setSearchQuery,
  selectedRoute,
  setSelectedRoute,
  uniqueRoutes,
  selectedSeller,
  setSelectedSeller,
  uniqueSellers,
  selectedZone,
  setSelectedZone,
  selectedOrderIdsCount,
  handlePrintBatchA4,
  handlePrintConsolidated,
  handlePrintLabels,
}: FulfillmentToolbarProps) {
  return (
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
          onClick={fetchOrders}
          disabled={loading}
          title="Recargar pedidos"
          aria-label="Recargar pedidos en armado"
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} aria-hidden="true" />
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
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            style={{
              height: '24px',
              padding: '0 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '4px',
              backgroundColor: viewMode === 'list' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'list' ? '#111827' : '#6B7280',
              boxShadow: viewMode === 'list' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <List size={13} aria-hidden="true" />
            Lista
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={viewMode === 'board'}
            onClick={() => setViewMode('board')}
            style={{
              height: '24px',
              padding: '0 8px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '4px',
              backgroundColor: viewMode === 'board' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'board' ? '#111827' : '#6B7280',
              boxShadow: viewMode === 'board' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <LayoutGrid size={13} aria-hidden="true" />
            Tablero
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
              placeholder="Buscar..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ paddingLeft: '28px', paddingRight: '8px', height: '28px', fontSize: '0.8rem', width: '165px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            aria-label="Filtrar por ruta"
            className="input"
            style={{ padding: '3px 8px', height: '28px', fontSize: '0.8rem', width: 'auto' }}
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
          >
            <option value="ALL">Rutas</option>
            {uniqueRoutes.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por vendedor"
            className="input"
            style={{ padding: '3px 8px', height: '28px', fontSize: '0.8rem', width: 'auto' }}
            value={selectedSeller}
            onChange={(e) => setSelectedSeller(e.target.value)}
          >
            <option value="ALL">Vendedores</option>
            {uniqueSellers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por zona de depósito"
            className="input"
            style={{ padding: '3px 8px', height: '28px', fontSize: '0.8rem', width: 'auto', fontWeight: 500 }}
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
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
          onClick={handlePrintBatchA4}
          title="Imprimir lote de pedidos seleccionados (máximo 8 por hoja A4)"
        >
          <Printer size={13} aria-hidden="true" />
          Lote A4 {selectedOrderIdsCount > 0 ? `(${selectedOrderIdsCount})` : ''}
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
          onClick={handlePrintConsolidated}
          title="Imprimir planilla de consolidado total por depósito"
        >
          <Printer size={13} aria-hidden="true" />
          Consolidado {selectedOrderIdsCount > 0 ? `(${selectedOrderIdsCount})` : ''}
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
          onClick={handlePrintLabels}
          title="Imprimir rótulos térmicos adhesivos para los bultos"
        >
          <Tag size={13} aria-hidden="true" />
          Rótulos Bultos {selectedOrderIdsCount > 0 ? `(${selectedOrderIdsCount})` : ''}
        </button>
      </div>
    </div>
  );
}
