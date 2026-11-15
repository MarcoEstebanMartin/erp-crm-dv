import { useCallback, useEffect, useState } from 'react';
import { FileDown, FileText } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import {
  type AfipMonthlyMetrics,
  accumulateAfipMetricsBigInt,
  exportSubdiarioIvaPdfs,
} from '../utils/afipSubdiarioPdf';
import { AfipCorrelationMonitorCard } from '../components/billing/AfipCorrelationMonitorCard';

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
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: '14px',
            marginBottom: '20px',
            backgroundColor: '#F9FAFB',
            padding: '14px 16px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: '150px' }}>
              <label htmlFor="afip-month-select" style={{ fontWeight: 600 }}>
                Mes
              </label>
              <select
                id="afip-month-select"
                name="month"
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
            <div className="form-group" style={{ marginBottom: 0, width: '110px' }}>
              <label htmlFor="afip-year-input" style={{ fontWeight: 600 }}>
                Año
              </label>
              <input
                id="afip-year-input"
                name="year"
                type="number"
                className="input tabular-nums"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2020}
                max={2100}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}
              onClick={handleDownloadTxt}
              disabled={loading}
            >
              <FileText size={16} aria-hidden="true" />
              TXT AFIP (.zip)
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: '#111827' }}
              onClick={handleGeneratePdfs}
              disabled={loading}
            >
              <FileDown size={16} aria-hidden="true" />
              Subdiarios PDF
            </button>
          </div>
        </div>

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

        <AfipCorrelationMonitorCard metrics={metrics} fetchingMetrics={fetchingMetrics} />
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
