import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { useWeeklySalesQuery } from '../../hooks/queries';
import {
  computeArDatePreset,
  formatCityLabel,
  formatShortArRange,
  shiftArWeekRange,
} from '../reports/reportDateHelpers';

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

interface WeeklySalesByCityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStartDate: string;
  initialEndDate: string;
  initialReport?: any;
}

const formatPeso = (value: number) => `$${Math.round(value || 0).toLocaleString('es-AR')}`;

export function WeeklySalesByCityModal({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  initialReport,
}: WeeklySalesByCityModalProps) {
  const [range, setRange] = useState({ startDate: initialStartDate, endDate: initialEndDate });

  useEffect(() => {
    if (isOpen) {
      setRange({ startDate: initialStartDate, endDate: initialEndDate });
    }
  }, [isOpen, initialStartDate, initialEndDate]);

  const currentWeek = computeArDatePreset('this_week');
  const isCurrentWeek =
    range.startDate === currentWeek.startDate && range.endDate === currentWeek.endDate;
  const isInitialRange =
    range.startDate === initialStartDate && range.endDate === initialEndDate;

  const { data: queriedReport, isFetching } = useWeeklySalesQuery(
    range.startDate,
    range.endDate,
    isOpen,
  );

  const report = queriedReport ?? (isInitialRange ? initialReport : undefined);
  const officialSales = Number(report?.sales?.official || 0);
  const internalSales = Number(report?.sales?.internal || 0);
  const totalSales = Number(report?.summary?.netSales ?? officialSales + internalSales);
  const totalOrders =
    Number(report?.sales?.officialCount || 0) + Number(report?.sales?.internalCount || 0);
  const officialPct = totalSales > 0 ? Math.round((officialSales / totalSales) * 100) : 0;
  const internalPct = totalSales > 0 ? Math.round((internalSales / totalSales) * 100) : 0;
  const rows: SalesByCityRow[] = Array.isArray(report?.salesByCity) ? report.salesByCity : [];

  const handleShiftWeek = (delta: number) => {
    setRange((prev) => shiftArWeekRange(prev.startDate, delta));
  };

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="weekly-sales-modal-title"
      style={{
        width: 'min(760px, calc(100vw - 24px))',
        maxHeight: 'min(86vh, 760px)',
        padding: 0,
        borderRadius: '14px',
        border: '1px solid var(--border-color, #e5e7eb)',
        backgroundColor: 'var(--bg-card, #ffffff)',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.16)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'min(86vh, 760px)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
          }}
        >
          <h2
            id="weekly-sales-modal-title"
            style={{
              margin: 0,
              fontSize: '1.05rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.015em',
            }}
          >
            Ventas por localidad
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color, #e5e7eb)',
                borderRadius: '8px',
                padding: '3px',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Semana anterior"
                onClick={() => handleShiftWeek(-1)}
                style={{ padding: '4px 6px', minHeight: 'auto', lineHeight: 1 }}
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  padding: '0 6px',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatShortArRange(range.startDate, range.endDate)}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Semana siguiente"
                onClick={() => handleShiftWeek(1)}
                style={{ padding: '4px 6px', minHeight: 'auto', lineHeight: 1 }}
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>

            {!isCurrentWeek && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRange(currentWeek)}
                style={{ padding: '5px 10px', fontSize: '0.76rem', minHeight: 'auto' }}
              >
                Esta semana
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Cerrar"
              onClick={onClose}
              style={{ padding: '6px', minHeight: 'auto', color: 'var(--text-secondary)' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '10px',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-color, #e5e7eb)',
            backgroundColor: '#fafafa',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Total
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '4px',
                letterSpacing: '-0.02em',
              }}
            >
              {formatPeso(totalSales)}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Sucursal A
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '4px',
                letterSpacing: '-0.02em',
              }}
            >
              {formatPeso(officialSales)}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {officialPct}%
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: '10px',
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Sucursal X
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginTop: '4px',
                letterSpacing: '-0.02em',
              }}
            >
              {formatPeso(internalSales)}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {internalPct}%
            </div>
          </div>
        </div>

        <div
          className="table-container table-container--sticky"
          role="region"
          aria-label="Ventas por localidad y sucursal"
          tabIndex={0}
          style={{
            flex: 1,
            overflowY: 'auto',
            border: 'none',
            borderRadius: 0,
            opacity: isFetching && !report ? 0.6 : 1,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '10px 20px' }}>Localidad</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 14px' }}>Sucursal A</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 14px' }}>Sucursal X</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 14px' }}>Total</th>
                <th scope="col" style={{ textAlign: 'right', padding: '10px 20px' }}>Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {!report && isFetching ? (
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
                  <tr key={row.city}>
                    <th
                      scope="row"
                      style={{
                        textAlign: 'left',
                        padding: '10px 20px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        background: 'transparent',
                      }}
                    >
                      {formatCityLabel(row.city)}
                    </th>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        padding: '10px 14px',
                        color: row.official !== 0 ? 'var(--text-primary)' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      {row.official !== 0 ? formatPeso(row.official) : '—'}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        padding: '10px 14px',
                        color: row.internal !== 0 ? 'var(--text-primary)' : 'var(--text-muted, #94a3b8)',
                      }}
                    >
                      {row.internal !== 0 ? formatPeso(row.internal) : '—'}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        padding: '10px 14px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {formatPeso(row.total)}
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        padding: '10px 20px',
                        color: 'var(--text-secondary)',
                      }}
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
                  <th
                    scope="row"
                    style={{ textAlign: 'left', padding: '11px 20px', fontWeight: 700, color: 'var(--text-primary)' }}
                  >
                    Total
                  </th>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '11px 14px', fontWeight: 700 }}>
                    {formatPeso(officialSales)}
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '11px 14px', fontWeight: 700 }}>
                    {formatPeso(internalSales)}
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '11px 14px', fontWeight: 700 }}>
                    {formatPeso(totalSales)}
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', padding: '11px 20px', fontWeight: 700 }}>
                    {totalOrders}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </NativeModalDialog>
  );
}
