import { CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
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

  let statusIcon = <CheckCircle2 size={18} aria-hidden="true" />;
  let statusText = 'Correlación balanceada';
  let statusDesc =
    'La proporción entre compras registradas y ventas oficiales se mantiene equilibrada.';
  let alertBoxStyle = {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    color: '#111827',
    accent: '#111827',
  };

  if (isEmptyPeriod) {
    statusText = 'Sin movimientos oficiales';
    statusDesc = 'No hay compras ni ventas autorizadas con CAE en el período seleccionado.';
    alertBoxStyle = {
      backgroundColor: '#F9FAFB',
      border: '1px solid #E5E7EB',
      color: '#4B5563',
      accent: '#6B7280',
    };
  } else if (isComprasTooHigh) {
    statusIcon = <TrendingDown size={18} aria-hidden="true" />;
    statusText = 'Alerta fiscal: Compras superan Ventas';
    statusDesc =
      'Los comprobantes de compra registrados superan las ventas oficiales. Revisá la facturación oficial del período.';
    alertBoxStyle = {
      backgroundColor: '#FEF2F2',
      border: '1px solid rgba(227, 6, 19, 0.28)',
      color: '#111827',
      accent: '#E30613',
    };
  } else if (isVentasTooHigh) {
    statusIcon = <TrendingUp size={18} aria-hidden="true" />;
    statusText = 'Atención: Ventas elevadas';
    statusDesc =
      'La facturación oficial supera significativamente a las compras cargadas. Verificá si faltan facturas de proveedores.';
  }

  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '24px',
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
            Compras Oficiales
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
            Neto Gravado: {formatCentsARS(metrics.comprasNetoCents)}
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
            Ventas Oficiales (con CAE)
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
            Neto Gravado: {formatCentsARS(metrics.ventasNetoCents)}
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
            Saldo Técnico IVA
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
            {ivaBalanceCents > 0n
              ? 'Saldo a Pagar (Débito > Crédito)'
              : 'Saldo Técnico a Favor'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
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

      <div
        style={{
          backgroundColor: alertBoxStyle.backgroundColor,
          border: alertBoxStyle.border,
          color: alertBoxStyle.color,
          padding: '14px',
          borderRadius: '8px',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ color: alertBoxStyle.accent, marginTop: '2px' }}>{statusIcon}</div>
        <div>
          <span
            style={{
              display: 'block',
              fontWeight: 600,
              fontSize: '0.88rem',
              marginBottom: '2px',
              color: alertBoxStyle.accent,
            }}
          >
            {statusText}
          </span>
          <span style={{ fontSize: '0.82rem', color: '#4B5563', lineHeight: 1.4 }}>{statusDesc}</span>
        </div>
      </div>
    </div>
  );
}
