import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Calendar, Download, Printer, RefreshCw, Users } from 'lucide-react';
import { api } from '../../utils/api';
import { SellerMeetingPdfSheet } from './pdf/SellerMeetingPdfSheet';
import { computePeriodDates, downloadElementAsA4Pdf, type PeriodType } from './pdf/pdfReportHelpers';

interface SellerMeetingPdfReportProps {
  sellers: any[];
  initialSellerId?: number;
  onClose?: () => void;
}

const PERIOD_PRESETS: Array<{ id: PeriodType; label: string }> = [
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'prev_month', label: 'Mes anterior' },
];

export default function SellerMeetingPdfReport({ sellers, initialSellerId, onClose }: SellerMeetingPdfReportProps) {
  const [selectedSellerId, setSelectedSellerId] = useState<number>(() => {
    if (initialSellerId) return initialSellerId;
    return sellers && sellers.length > 0 ? sellers[0].id : 0;
  });
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nextDates = computePeriodDates(periodType);
    if (nextDates) {
      setStartDate(nextDates.startDate);
      setEndDate(nextDates.endDate);
    }
  }, [periodType]);

  const fetchReportData = async () => {
    if (!selectedSellerId) return;
    setLoading(true);
    setError(null);
    try {
      const reportData = await api.getSellerMeetingPdfReport(selectedSellerId, startDate, endDate);
      if (reportData) {
        setData(reportData);
      } else {
        setError('No se pudieron obtener los datos del vendedor.');
      }
    } catch (e: any) {
      console.error('Error al cargar reporte de reunión de vendedor:', e);
      setError(e.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedSellerId, startDate, endDate]);

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !data) return;
    setGeneratingPdf(true);
    setError(null);
    try {
      await downloadElementAsA4Pdf(reportRef.current, `Reunion_Vendedor_${data.seller.name}_${startDate}.pdf`);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      setError('No se pudo generar el PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          #seller-meeting-report-container, #seller-meeting-report-container * { visibility: visible; }
          #seller-meeting-report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          padding: '16px 24px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} color="var(--color-corp-red)" aria-hidden="true" />
          Ficha de Vendedor
        </h2>

        <search aria-label="Filtros de ficha de vendedor" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="seller-meeting-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Vendedor</label>
            <select
              id="seller-meeting-select"
              className="input"
              value={selectedSellerId}
              onChange={e => setSelectedSellerId(Number(e.target.value))}
              style={{ fontSize: '0.85rem', fontWeight: 600, padding: '5px 10px', minWidth: '180px' }}
            >
              {sellers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.username || s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodType === p.id}
                onClick={() => setPeriodType(p.id)}
                style={{
                  fontSize: '0.78rem',
                  padding: '5px 10px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: periodType === p.id ? '#fff' : 'transparent',
                  fontWeight: periodType === p.id ? 600 : 400,
                  color: periodType === p.id ? '#0f172a' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="#64748b" aria-hidden="true" />
            <label htmlFor="seller-pdf-start" className="visually-hidden">Desde</label>
            <input
              id="seller-pdf-start"
              type="date"
              className="input tabular-nums"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPeriodType('custom'); }}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            />
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>al</span>
            <label htmlFor="seller-pdf-end" className="visually-hidden">Hasta</label>
            <input
              id="seller-pdf-end"
              type="date"
              className="input tabular-nums"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPeriodType('custom'); }}
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            />
          </div>

          <button
            type="button"
            onClick={fetchReportData}
            disabled={loading}
            className="btn btn-secondary"
            aria-label="Actualizar"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} aria-hidden="true" />
          </button>
        </search>

        <div style={{ display: 'flex', gap: '8px' }}>
          {onClose && (
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
              Volver
            </button>
          )}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={loading || generatingPdf || !data}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} aria-hidden="true" />
            <span>{generatingPdf ? 'Generando...' : 'Descargar PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || !data}
            className="btn"
            style={{ fontSize: '0.82rem', backgroundColor: '#0f172a', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} aria-hidden="true" />
            <span>Imprimir Ficha A4</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: '16px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <SellerMeetingPdfSheet ref={reportRef} data={data} />
    </div>
  );
}
