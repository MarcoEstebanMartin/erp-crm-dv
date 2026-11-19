import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useWeeklySalesQuery } from '../../../hooks/queries';
import { computeArDatePreset, formatShortArRange } from '../../reports/reportDateHelpers';
import { WeeklySalesByCityModal } from '../../finanzas/WeeklySalesByCityModal';

const formatPeso = (value: number) => `$${Math.round(value || 0).toLocaleString('es-AR')}`;

export function HomeWeeklySalesCard() {
  const weekRange = useMemo(() => computeArDatePreset('this_week'), []);
  const { data: report, isLoading } = useWeeklySalesQuery(weekRange.startDate, weekRange.endDate);
  const [modalOpen, setModalOpen] = useState(false);

  const officialSales = Number(report?.sales?.official || 0);
  const internalSales = Number(report?.sales?.internal || 0);
  const totalSales = Number(report?.summary?.netSales ?? officialSales + internalSales);
  const totalOrders =
    Number(report?.sales?.officialCount || 0) + Number(report?.sales?.internalCount || 0);
  const officialPct = totalSales > 0 ? Math.round((officialSales / totalSales) * 100) : 0;
  const internalPct = totalSales > 0 ? Math.round((internalSales / totalSales) * 100) : 0;
  const citiesCount = Array.isArray(report?.salesByCity) ? report.salesByCity.length : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="home-stat-btn"
        style={{
          width: '100%',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e5e7)',
          padding: '16px 20px',
          textAlign: 'left',
          font: 'inherit',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3
              style={{
                fontSize: '0.96rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                margin: 0,
                letterSpacing: '-0.01em',
              }}
            >
              Ventas
            </h3>
            <span
              className="tabular-nums"
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-color, #e5e7eb)',
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              {formatShortArRange(weekRange.startDate, weekRange.endDate)}
            </span>
          </div>

          <span
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            {citiesCount > 0 ? `${citiesCount} localidades` : 'Localidades'}
            <ChevronRight size={14} aria-hidden="true" />
          </span>
        </div>

        {isLoading ? (
          <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', padding: '6px 0' }}>
            Cargando...
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px' }}>
              <span
                className="tabular-nums"
                style={{
                  fontSize: '1.85rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.1,
                }}
              >
                {formatPeso(totalSales)}
              </span>
              <span className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {totalOrders} {totalOrders === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Sucursal A
                </div>
                <div className="tabular-nums" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatPeso(officialSales)}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{officialPct}%</span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Sucursal X
                </div>
                <div className="tabular-nums" style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
                  <span style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatPeso(internalSales)}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{internalPct}%</span>
                </div>
              </div>
            </div>
          </>
        )}
      </button>

      <WeeklySalesByCityModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialStartDate={weekRange.startDate}
        initialEndDate={weekRange.endDate}
        initialReport={report}
      />
    </>
  );
}
