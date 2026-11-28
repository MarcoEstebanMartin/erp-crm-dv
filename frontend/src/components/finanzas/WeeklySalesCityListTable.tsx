import { ChevronRight } from 'lucide-react';
import { formatCityLabel } from '../reports/reportDateHelpers';

export interface SalesByCityRow {
  city: string;
  official: number;
  internal: number;
  total: number;
  officialCount: number;
  internalCount: number;
  count: number;
  sharePct: number;
}

interface WeeklySalesCityListTableProps {
  rows: SalesByCityRow[];
  isLoading: boolean;
  isDimmed: boolean;
  officialSales: number;
  internalSales: number;
  totalSales: number;
  totalOrders: number;
  onSelectCity: (city: string) => void;
  registerCityButtonRef: (city: string, el: HTMLButtonElement | null) => void;
}

const formatPeso = (value: number) => `$${Math.round(value || 0).toLocaleString('es-AR')}`;

export function WeeklySalesCityListTable({
  rows,
  isLoading,
  isDimmed,
  officialSales,
  internalSales,
  totalSales,
  totalOrders,
  onSelectCity,
  registerCityButtonRef,
}: WeeklySalesCityListTableProps) {
  return (
    <div
      className="table-container table-container--sticky"
      role="region"
      aria-label="Ventas por localidad y sucursal"
      tabIndex={0}
      style={{ flex: 1, overflowY: 'auto', border: 'none', borderRadius: 0, opacity: isDimmed ? 0.6 : 1 }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left', padding: '8px 20px' }}>Localidad</th>
            <th scope="col" style={{ textAlign: 'right', padding: '8px 14px' }}>Sucursal A</th>
            <th scope="col" style={{ textAlign: 'right', padding: '8px 14px' }}>Sucursal X</th>
            <th scope="col" style={{ textAlign: 'right', padding: '8px 14px' }}>Total</th>
            <th scope="col" style={{ textAlign: 'right', padding: '8px 20px' }}>Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                Cargando...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                Sin ventas en este período
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.city}
                onClick={() => onSelectCity(row.city)}
                style={{ cursor: 'pointer' }}
              >
                <th
                  scope="row"
                  style={{ textAlign: 'left', padding: '4px 20px', fontWeight: 600, color: 'var(--text-primary)', background: 'transparent' }}
                >
                  <button
                    ref={(el) => registerCityButtonRef(row.city, el)}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCity(row.city);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      minBlockSize: '28px',
                      padding: '2px 0',
                      border: 'none',
                      background: 'transparent',
                      font: 'inherit',
                      fontWeight: 600,
                      color: 'inherit',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{formatCityLabel(row.city)}</span>
                    <ChevronRight size={14} aria-hidden="true" style={{ color: 'var(--text-secondary)', opacity: 0.7 }} />
                  </button>
                </th>
                <td
                  className="tabular-nums"
                  style={{ textAlign: 'right', padding: '7px 14px', color: row.official !== 0 ? 'var(--text-primary)' : 'var(--text-muted, #94a3b8)' }}
                >
                  {row.official !== 0 ? formatPeso(row.official) : '—'}
                </td>
                <td
                  className="tabular-nums"
                  style={{ textAlign: 'right', padding: '7px 14px', color: row.internal !== 0 ? 'var(--text-primary)' : 'var(--text-muted, #94a3b8)' }}
                >
                  {row.internal !== 0 ? formatPeso(row.internal) : '—'}
                </td>
                <td
                  className="tabular-nums"
                  style={{ textAlign: 'right', padding: '7px 14px', fontWeight: 700, color: 'var(--text-primary)' }}
                >
                  {formatPeso(row.total)}
                </td>
                <td
                  className="tabular-nums"
                  style={{ textAlign: 'right', padding: '7px 20px', color: 'var(--text-secondary)' }}
                >
                  {row.count}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', backgroundColor: '#f8fafc' }}>
              <th scope="row" style={{ textAlign: 'left', padding: '9px 20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Total
              </th>
              <td className="tabular-nums" style={{ textAlign: 'right', padding: '9px 14px', fontWeight: 700 }}>
                {formatPeso(officialSales)}
              </td>
              <td className="tabular-nums" style={{ textAlign: 'right', padding: '9px 14px', fontWeight: 700 }}>
                {formatPeso(internalSales)}
              </td>
              <td className="tabular-nums" style={{ textAlign: 'right', padding: '9px 14px', fontWeight: 700 }}>
                {formatPeso(totalSales)}
              </td>
              <td className="tabular-nums" style={{ textAlign: 'right', padding: '9px 20px', fontWeight: 700 }}>
                {totalOrders}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
