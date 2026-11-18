import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Calendar, Download, FileText, Printer, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { ExecutivePdfSheet } from './pdf/ExecutivePdfSheet';
import { computePeriodDates, downloadElementAsA4Pdf, type PeriodType } from './pdf/pdfReportHelpers';
import { computeArDatePreset } from './reportDateHelpers';

interface ExecutivePdfReportProps {
  initialStartDate?: string;
  initialEndDate?: string;
  onClose?: () => void;
}

const PERIOD_PRESETS: Array<{ id: PeriodType; label: string }> = [
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'prev_month', label: 'Mes anterior' },
  { id: 'custom', label: 'Personalizado' },
];

export default function ExecutivePdfReport({
  initialStartDate,
  initialEndDate,
  onClose,
}: ExecutivePdfReportProps) {
  const defaultRange = computeArDatePreset('this_month');
  const [periodType, setPeriodType] = useState<PeriodType>(() =>
    initialStartDate && initialEndDate ? 'custom' : 'month',
  );
  const [startDate, setStartDate] = useState<string>(() => initialStartDate || defaultRange.startDate);
  const [endDate, setEndDate] = useState<string>(() => initialEndDate || defaultRange.endDate);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleSelectPreset = (nextType: PeriodType) => {
    setPeriodType(nextType);
    const nextDates = computePeriodDates(nextType);
    if (nextDates) {
      setStartDate(nextDates.startDate);
      setEndDate(nextDates.endDate);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const reportData = await api.getExecutivePdfReport(startDate, endDate);
      if (reportData) {
        setData(reportData);
      } else {
        setError('No se pudieron obtener los datos del reporte.');
      }
    } catch (e: any) {
      console.error('Error al cargar reporte ejecutivo:', e);
      setError(e.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate]);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    setError(null);
    try {
      await downloadElementAsA4Pdf(reportRef.current, `Reporte_Ejecutivo_${startDate}_a_${endDate}.pdf`);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      setError('No se pudo generar el PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div style={{ padding: '4px 0' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #executive-report-container, #executive-report-container * { visibility: visible; }
          #executive-report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '16px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {onClose && (
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <ArrowLeft size={14} aria-hidden="true" />
              Volver
            </button>
          )}
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={16} color="var(--color-corp-red)" aria-hidden="true" />
            Reporte Ejecutivo
          </span>
        </div>

        <search aria-label="Período del reporte ejecutivo" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f8fafc', padding: '3px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodType === p.id}
                onClick={() => handleSelectPreset(p.id)}
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 9px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: periodType === p.id ? '#0f172a' : 'transparent',
                  fontWeight: periodType === p.id ? 600 : 500,
                  color: periodType === p.id ? '#fff' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#64748b" aria-hidden="true" />
            <label htmlFor="exec-pdf-start" className="visually-hidden">Desde</label>
            <input
              id="exec-pdf-start"
              type="date"
              className="input tabular-nums"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPeriodType('custom'); }}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            />
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>al</span>
            <label htmlFor="exec-pdf-end" className="visually-hidden">Hasta</label>
            <input
              id="exec-pdf-end"
              type="date"
              className="input tabular-nums"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPeriodType('custom'); }}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            />
          </div>

          <button
            type="button"
            onClick={fetchReportData}
            disabled={loading}
            className="btn btn-secondary"
            aria-label="Actualizar"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} aria-hidden="true" />
          </button>
        </search>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading || generatingPdf || !data}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} aria-hidden="true" />
            <span>{generatingPdf ? 'Generando...' : 'Descargar PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || !data}
            className="btn"
            style={{ fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={14} aria-hidden="true" />
            <span>Imprimir A4</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: '14px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <ExecutivePdfSheet ref={reportRef} data={data} />
    </div>
  );
}
