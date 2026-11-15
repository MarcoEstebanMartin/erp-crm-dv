import { TrendingDown, TrendingUp } from 'lucide-react';
import { type AfipMonthlyMetrics, formatCentsARS } from '../../utils/afipSubdiarioPdf';

export function resolveRatioPercentages(ventasCents: bigint, comprasCents: bigint): {
  ventasPctLabel: string;
  comprasPctLabel: string;
  ventasWidthPct: number;
  comprasWidthPct: number;
} {
  const vAbs = ventasCents > 0n ? ventasCents : 0n;
  const cAbs = comprasCents > 0n ? comprasCents : 0n;
  const total = vAbs + cAbs;
  if (total === 0n) {
    return { ventasPctLabel: '0.0', comprasPctLabel: '0.0', ventasWidthPct: 0, comprasWidthPct: 0 };
  }
  const comprasDeciPct = (cAbs * 1000n) / total;
  const ventasDeciPct = 1000n - comprasDeciPct;
  const comprasWidth = Number(comprasDeciPct) / 10;
  const ventasWidth = Number(ventasDeciPct) / 10;
  return {
    comprasPctLabel: comprasWidth.toFixed(1),
    ventasPctLabel: ventasWidth.toFixed(1),
    comprasWidthPct: comprasWidth,
    ventasWidthPct: ventasWidth,
  };
}

interface AfipCorrelationMonitorCardProps {
  metrics: AfipMonthlyMetrics;
  fetchingMetrics: boolean;
}

export function AfipCorrelationMonitorCard({
  metrics,
  fetchingMetrics,
}: AfipCorrelationMonitorCardProps) {
  const ratios = resolveRatioPercentages(metrics.ventasTotalCents, metrics.comprasTotalCents);
  const ivaBalanceCents = metrics.ventasIvaCents - metrics.comprasIvaCents;
  const isEmptyPeriod = metrics.ventasTotalCents === 0n && metrics.comprasTotalCents === 0n;
  const isVentasTooHigh = metrics.ventasTotalCents * 10n > metrics.comprasTotalCents * 15n;
  const isComprasTooHigh = metrics.comprasTotalCents * 10n > metrics.ventasTotalCents * 12n;

  const showAlert = !isEmptyPeriod && (isComprasTooHigh || isVentasTooHigh);

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '20px',
        backgroundColor: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {fetchingMetrics && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            backgroundColor: '#F3F4F6',
          }}
        >
          <div
            style={{
              width: '35%',
              height: '100%',
              backgroundColor: '#111827',
              animation: 'slide 1.3s infinite linear',
            }}
          />
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            padding: '14px',
            borderRadius: '8px',
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            Compras
          </span>
          <span
            className="tabular-nums"
            style={{
              display: 'block',
              fontSize: '1.35rem',
              fontWeight: 700,
              marginTop: '4px',
              color: '#111827',
            }}
          >
            {formatCentsARS(metrics.comprasTotalCents)}
          </span>
          <span className="tabular-nums" style={{ fontSize: '0.75rem', color: '#6B7280' }}>
            Neto: {formatCentsARS(metrics.comprasNetoCents)}
          </span>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '8px',
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            Ventas CAE
          </span>
          <span
            className="tabular-nums"
            style={{
              display: 'block',
              fontSize: '1.35rem',
              fontWeight: 700,
              marginTop: '4px',
              color: '#111827',
            }}
          >
            {formatCentsARS(metrics.ventasTotalCents)}
          </span>
          <span className="tabular-nums" style={{ fontSize: '0.75rem', color: '#6B7280' }}>
            Neto: {formatCentsARS(metrics.ventasNetoCents)}
          </span>
        </div>

        <div
          style={{
            padding: '14px',
            borderRadius: '8px',
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
          }}
        >
          <span
            style={{
              display: 'block',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
            }}
          >
            Saldo IVA
          </span>
          <span
            className="tabular-nums"
            style={{
              display: 'block',
              fontSize: '1.35rem',
              fontWeight: 700,
              marginTop: '4px',
              color: '#111827',
            }}
          >
            {formatCentsARS(ivaBalanceCents)}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
            {ivaBalanceCents > 0n ? 'A pagar' : ivaBalanceCents < 0n ? 'A favor' : 'Saldado'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: showAlert ? '16px' : 0 }}>
        <div
          className="tabular-nums"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
          }}
        >
          <span>Compras ({ratios.comprasPctLabel}%)</span>
          <span>Ventas ({ratios.ventasPctLabel}%)</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#F3F4F6',
            borderRadius: '999px',
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${ratios.comprasWidthPct}%`,
              backgroundColor: '#94A3B8',
              transition: 'width 0.4s ease',
            }}
          />
          <div
            style={{
              width: `${ratios.ventasWidthPct}%`,
              backgroundColor: '#111827',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {showAlert && (
        <div
          style={{
            backgroundColor: isComprasTooHigh ? '#FEF2F2' : '#FFFBEB',
            border: isComprasTooHigh ? '1px solid rgba(227, 6, 19, 0.28)' : '1px solid #FDE68A',
            color: isComprasTooHigh ? '#E30613' : '#B45309',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          {isComprasTooHigh ? (
            <>
              <TrendingDown size={16} aria-hidden="true" />
              <span>Compras superan ventas CAE</span>
            </>
          ) : (
            <>
              <TrendingUp size={16} aria-hidden="true" />
              <span>Ventas superan compras registradas</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
