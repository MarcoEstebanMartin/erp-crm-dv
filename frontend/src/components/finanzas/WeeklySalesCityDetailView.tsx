import { useId } from 'react';
import { Search } from 'lucide-react';
import type { CitySaleDetailItem } from '../../utils/api/admin.api';
import { formatShortArDate } from '../reports/reportDateHelpers';

export type CityDetailBranchFilter = 'ALL' | 'A' | 'X';

interface WeeklySalesCityDetailViewProps {
  cityLabel: string;
  items: CitySaleDetailItem[];
  totalAmount: number;
  branchFilter: CityDetailBranchFilter;
  onBranchFilterChange: (next: CityDetailBranchFilter) => void;
  search: string;
  onSearchChange: (next: string) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

const formatSignedPeso = (value: number) => {
  const rounded = Math.round(value || 0);
  const absFormatted = `$${Math.abs(rounded).toLocaleString('es-AR')}`;
  return rounded < 0 ? `-${absFormatted}` : absFormatted;
};

const BRANCH_OPTIONS: Array<{ value: CityDetailBranchFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'A', label: 'Sucursal A' },
  { value: 'X', label: 'Sucursal X' },
];

export function WeeklySalesCityDetailView({
  cityLabel,
  items,
  totalAmount,
  branchFilter,
  onBranchFilterChange,
  search,
  onSearchChange,
  isLoading,
  isError,
  onRetry,
}: WeeklySalesCityDetailViewProps) {
  const searchId = useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '8px 20px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
          backgroundColor: '#ffffff',
        }}
      >
        <div
          role="group"
          aria-label="Filtrar por sucursal"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: '8px',
            padding: '2px',
          }}
        >
          {BRANCH_OPTIONS.map((option) => {
            const active = branchFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => onBranchFilterChange(option.value)}
                style={{
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  minBlockSize: '28px',
                  fontSize: '0.76rem',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  backgroundColor: active ? '#ffffff' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: '250px' }}>
          <label htmlFor={searchId} className="visually-hidden">
            Buscar cliente o comprobante
          </label>
          <Search
            size={14}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
              pointerEvents: 'none',
            }}
          />
          <input
            id={searchId}
            type="search"
            className="input"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              minBlockSize: '30px',
              padding: '4px 10px 4px 30px',
              fontSize: '0.78rem',
            }}
          />
        </div>
      </div>

      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label={`Ventas en ${cityLabel}`}
        tabIndex={0}
        style={{
          flex: 1,
          overflowY: 'auto',
          border: 'none',
          borderRadius: 0,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left', padding: '8px 14px 8px 20px', width: '68px' }}>
                Fecha
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '8px 12px' }}>
                Cliente
              </th>
              <th scope="col" style={{ textAlign: 'left', padding: '8px 12px' }}>
                Comprobante
              </th>
              <th scope="col" style={{ textAlign: 'center', padding: '8px 10px', width: '54px' }}>
                Suc.
              </th>
              <th scope="col" style={{ textAlign: 'right', padding: '8px 20px 8px 12px', width: '124px' }}>
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  Cargando...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: '#E30613' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                    <span>No se pudieron cargar las ventas</span>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onRetry}
                      style={{ padding: '4px 10px', minHeight: '28px', fontSize: '0.76rem' }}
                    >
                      Reintentar
                    </button>
                  </div>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  Sin ventas
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isCreditNote = item.kind === 'CREDIT_NOTE' || item.amount < 0;
                return (
                  <tr key={`${item.kind}-${item.id}`}>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '7px 14px 7px 20px',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatShortArDate(item.date)}
                    </td>
                    <th
                      scope="row"
                      title={item.clientName}
                      style={{
                        textAlign: 'left',
                        padding: '7px 12px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        background: 'transparent',
                        maxWidth: '230px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.clientName}
                    </th>
                    <td
                      className="tabular-nums"
                      style={{
                        padding: '7px 12px',
                        color: isCreditNote ? '#E30613' : 'var(--text-secondary)',
                        fontWeight: isCreditNote ? 600 : 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.voucher}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        padding: '7px 10px',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      {item.branch}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        padding: '7px 20px 7px 12px',
                        fontWeight: 700,
                        color: isCreditNote ? '#E30613' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatSignedPeso(item.amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {!isLoading && !isError && items.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', backgroundColor: '#f8fafc' }}>
                <th
                  scope="row"
                  colSpan={3}
                  style={{ textAlign: 'left', padding: '9px 12px 9px 20px', fontWeight: 700, color: 'var(--text-primary)' }}
                >
                  Total
                </th>
                <td
                  className="tabular-nums"
                  style={{ textAlign: 'center', padding: '9px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                  {items.length}
                </td>
                <td
                  className="tabular-nums"
                  style={{
                    textAlign: 'right',
                    padding: '9px 20px 9px 12px',
                    fontWeight: 700,
                    color: totalAmount < 0 ? '#E30613' : 'var(--text-primary)',
                  }}
                >
                  {formatSignedPeso(totalAmount)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
