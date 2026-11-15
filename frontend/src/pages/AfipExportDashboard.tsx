import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileDown, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import {
  type AfipMonthlyMetrics,
  accumulateAfipMetricsBigInt,
  exportSubdiarioIvaPdfs,
  formatCentsARS,
} from '../utils/afipSubdiarioPdf';

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const INITIAL_METRICS: AfipMonthlyMetrics = {
  ventasNetoCents: 0n,
  ventasIvaCents: 0n,
  ventasTotalCents: 0n,
  comprasNetoCents: 0n,
  comprasIvaCents: 0n,
  comprasTotalCents: 0n,
};

function resolveRatioPercentages(ventasCents: bigint, comprasCents: bigint): {
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

export default function AfipExportDashboard() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [fetchingMetrics, setFetchingMetrics] = useState(false);
  const [metrics, setMetrics] = useState<AfipMonthlyMetrics>(INITIAL_METRICS);

  const fetchMetrics = useCallback(async () => {
    try {
      setFetchingMetrics(true);
      setErrorMsg(null);
      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener datos fiscales del período.');
      const { data } = await res.json();
      setMetrics(accumulateAfipMetricsBigInt(data?.ventasData || [], data?.comprasData || []));
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo cargar el monitor fiscal.');
    } finally {
      setFetchingMetrics(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  const handleDownloadTxt = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setProgressMsg('Conectando con el servidor para exportar registros AFIP...');

      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al generar los archivos AFIP.');
      const { data } = await res.json();

      setProgressMsg('Comprimiendo y empaquetando archivos oficiales TXT...');
      const { txt } = data;
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      Object.keys(txt || {}).forEach((filename) => {
        if (txt[filename]) {
          zip.file(filename, txt[filename]);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AFIP_Export_${year}_${String(month).padStart(2, '0')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setProgressMsg('Descarga completada.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al descargar el paquete AFIP.');
    } finally {
      setLoading(false);
      setProgressMsg(null);
    }
  };

  const handleGeneratePdfs = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setProgressMsg('Obteniendo datos fiscales para Subdiarios PDF...');

      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener datos para Subdiarios PDF.');
      const { data } = await res.json();

      await exportSubdiarioIvaPdfs({
        month,
        year,
        ventasData: data?.ventasData || [],
        comprasData: data?.comprasData || [],
        onProgress: (msg) => setProgressMsg(msg),
      });

      setProgressMsg('Subdiarios PDF descargados.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al generar Subdiarios PDF.');
    } finally {
      setLoading(false);
      setProgressMsg(null);
    }
  };

  const ratios = resolveRatioPercentages(metrics.ventasTotalCents, metrics.comprasTotalCents);
  const ivaBalanceCents = metrics.ventasIvaCents - metrics.comprasIvaCents;
  const isEmptyPeriod = metrics.ventasTotalCents === 0n && metrics.comprasTotalCents === 0n;
  const isVentasTooHigh = metrics.ventasTotalCents * 10n > metrics.comprasTotalCents * 15n;
  const isComprasTooHigh = metrics.comprasTotalCents * 10n > metrics.ventasTotalCents * 12n;

  let statusIcon = <CheckCircle2 size={18} aria-hidden="true" />;
  let statusText = 'Correlación balanceada';
  let statusDesc = 'La proporción entre compras registradas y ventas oficiales se mantiene equilibrada.';
  let alertBoxStyle = {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    color: '#111827',
    accent: '#111827',
  };

  if (isEmptyPeriod) {
    statusText = 'Sin movimientos oficiales';
    statusDesc = 'No hay compras ni ventas autorizadas con CAE en el período seleccionado.';
    alertBoxStyle = { backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB', color: '#4B5563', accent: '#6B7280' };
  } else if (isComprasTooHigh) {
    statusIcon = <TrendingDown size={18} aria-hidden="true" />;
    statusText = 'Alerta fiscal: Compras superan Ventas';
    statusDesc = 'Los comprobantes de compra registrados superan las ventas oficiales. Revisá la facturación oficial del período.';
    alertBoxStyle = {
      backgroundColor: '#FEF2F2',
      border: '1px solid rgba(227, 6, 19, 0.28)',
      color: '#111827',
      accent: '#E30613',
    };
  } else if (isVentasTooHigh) {
    statusIcon = <TrendingUp size={18} aria-hidden="true" />;
    statusText = 'Atención: Ventas elevadas';
    statusDesc = 'La facturación oficial supera significativamente a las compras cargadas. Verificá si faltan facturas de proveedores.';
  }

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto' }}>
      {errorMsg && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            color: '#111827',
            padding: '12px 14px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid rgba(227, 6, 19, 0.3)',
            borderLeft: '3px solid #E30613',
            fontSize: '0.86rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '4px' }}>
          Libro IVA Digital AFIP &amp; Correlación Fiscal
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginBottom: '20px' }}>
          Exportación oficial de registros TXT (Libro IVA Digital AFIP / ARCA) y subdiarios PDF para comprobantes autorizados con CAE.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px',
            backgroundColor: '#F9FAFB',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
          }}
        >
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="afip-month-select" style={{ fontWeight: 600 }}>
              Mes a liquidar
            </label>
            <select
              id="afip-month-select"
              className="select"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="afip-year-input" style={{ fontWeight: 600 }}>
              Año fiscal
            </label>
            <input
              id="afip-year-input"
              type="number"
              className="input tabular-nums"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2020}
              max={2100}
            />
          </div>
        </div>

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
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: '#F3F4F6' }}>
              <div style={{ width: '35%', height: '100%', backgroundColor: '#111827', animation: 'slide 1.3s infinite linear' }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Compras Oficiales
              </span>
              <span className="tabular-nums" style={{ display: 'block', fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
                {formatCentsARS(metrics.comprasTotalCents)}
              </span>
              <span className="tabular-nums" style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                Neto Gravado: {formatCentsARS(metrics.comprasNetoCents)}
              </span>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Ventas Oficiales (con CAE)
              </span>
              <span className="tabular-nums" style={{ display: 'block', fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
                {formatCentsARS(metrics.ventasTotalCents)}
              </span>
              <span className="tabular-nums" style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                Neto Gravado: {formatCentsARS(metrics.ventasNetoCents)}
              </span>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Saldo Técnico IVA
              </span>
              <span className="tabular-nums" style={{ display: 'block', fontSize: '1.35rem', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
                {formatCentsARS(ivaBalanceCents)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                {ivaBalanceCents > 0n ? 'Saldo a Pagar (Débito > Crédito)' : 'Saldo Técnico a Favor'}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span>Compras ({ratios.comprasPctLabel}%)</span>
              <span>Ventas ({ratios.ventasPctLabel}%)</span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#F3F4F6', borderRadius: '999px', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${ratios.comprasWidthPct}%`, backgroundColor: '#94A3B8', transition: 'width 0.4s ease' }} />
              <div style={{ width: `${ratios.ventasWidthPct}%`, backgroundColor: '#111827', transition: 'width 0.4s ease' }} />
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
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px', color: alertBoxStyle.accent }}>
                {statusText}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#4B5563', lineHeight: 1.4 }}>{statusDesc}</span>
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: '0.96rem', fontWeight: 600, marginBottom: '14px' }}>Exportación Legal AFIP / ARCA</h3>

        {loading && progressMsg && (
          <div
            role="status"
            style={{
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '0.84rem',
              color: '#374151',
              fontWeight: 500,
            }}
          >
            {progressMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '16px', flexDirection: 'column', gap: '8px', height: 'auto' }}
            onClick={handleDownloadTxt}
            disabled={loading}
          >
            <FileText size={24} aria-hidden="true" />
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem' }}>
                Descargar Archivos AFIP (.zip)
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 400 }}>
                Reg. Ventas, Compras, Alícuotas y Percepciones IVA
              </span>
            </div>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '16px', flexDirection: 'column', gap: '8px', height: 'auto', color: '#111827' }}
            onClick={handleGeneratePdfs}
            disabled={loading}
          >
            <FileDown size={24} aria-hidden="true" />
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem' }}>
                Descargar Subdiarios (PDF)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                Libro IVA Ventas y Compras formato oficial
              </span>
            </div>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
