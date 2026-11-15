import { Search } from 'lucide-react';
import type { BillingSubTab } from './useBillingDashboard';
import type { SalesInvoiceTypeFilter } from './sales/sales.types';

interface BillingFilterBarProps {
  activeSubTab: BillingSubTab;
  query: string;
  setQuery: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  salesInvoiceTypeFilter: SalesInvoiceTypeFilter;
  setSalesInvoiceTypeFilter: (val: SalesInvoiceTypeFilter) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  onSelectToday: () => void;
  onClearFilters: () => void;
}

export function BillingFilterBar({
  activeSubTab,
  query,
  setQuery,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  salesInvoiceTypeFilter,
  setSalesInvoiceTypeFilter,
  statusFilter,
  setStatusFilter,
  onSelectToday,
  onClearFilters,
}: BillingFilterBarProps) {
  const hasFilters = Boolean(
    query || startDate || endDate || salesInvoiceTypeFilter !== 'ALL' || statusFilter !== 'ALL',
  );

  return (
    <div className="card" style={{ padding: '16px' }}>
      <search aria-label="Filtros de comprobantes e impuestos">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <label htmlFor="billing-search-query" className="visually-hidden">
              Buscar por número de comprobante, cliente, proveedor o CUIT
            </label>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }}
            />
            <input
              id="billing-search-query"
              name="q"
              type="search"
              className="input"
              placeholder="Buscar por comprobante, cliente o CUIT..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="billing-start-date" className="visually-hidden">
              Fecha desde
            </label>
            <input
              id="billing-start-date"
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '155px', fontSize: '0.85rem', height: '36px' }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>a</span>
            <label htmlFor="billing-end-date" className="visually-hidden">
              Fecha hasta
            </label>
            <input
              id="billing-end-date"
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '155px', fontSize: '0.85rem', height: '36px' }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              style={{ height: '36px', padding: '0 10px', fontSize: '0.8rem' }}
              onClick={onSelectToday}
              title="Filtrar comprobantes de hoy (hora Argentina)"
            >
              Hoy
            </button>
          </div>

          {(activeSubTab === 'ventas' || activeSubTab === 'notas-credito') && (
            <div>
              <label htmlFor="billing-branch-filter" className="visually-hidden">
                Filtrar por sucursal de facturación
              </label>
              <select
                id="billing-branch-filter"
                className="input"
                value={salesInvoiceTypeFilter}
                onChange={(e) => setSalesInvoiceTypeFilter(e.target.value as SalesInvoiceTypeFilter)}
                style={{
                  width: '215px',
                  fontSize: '0.85rem',
                  height: '36px',
                  padding: '0 10px',
                  lineHeight: 'normal',
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">Todas las Sucursales</option>
                <option value="OFFICIAL">Sucursal A (Oficial A/B)</option>
                <option value="INTERNAL">Sucursal X (Presup. Interno)</option>
              </select>
            </div>
          )}

          {activeSubTab === 'notas-credito' && (
            <div>
              <label htmlFor="billing-cn-status-filter" className="visually-hidden">
                Filtrar por estado de Nota de Crédito
              </label>
              <select
                id="billing-cn-status-filter"
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  width: '195px',
                  fontSize: '0.85rem',
                  height: '36px',
                  padding: '0 10px',
                  lineHeight: 'normal',
                  boxSizing: 'border-box',
                }}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDING_APPROVAL">Pendientes Aprobación</option>
                <option value="APPROVED">Aprobadas</option>
                <option value="REJECTED">Rechazadas</option>
              </select>
            </div>
          )}

          {hasFilters && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '8px 12px', fontSize: '0.85rem', height: '36px' }}
              onClick={onClearFilters}
            >
              Limpiar Filtros
            </button>
          )}
        </div>
      </search>
    </div>
  );
}
