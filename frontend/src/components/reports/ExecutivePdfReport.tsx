import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Calendar, Download, FileText, Printer, RefreshCw, Users } from 'lucide-react';
import { api } from '../../utils/api';
import { EmployeePdfSheet } from './pdf/EmployeePdfSheet';
import { ExecutivePdfSheet } from './pdf/ExecutivePdfSheet';
import { computePeriodDates, downloadElementAsA4Pdf, type PeriodType } from './pdf/pdfReportHelpers';
import { computeArDatePreset } from './reportDateHelpers';

interface ExecutivePdfReportProps {
  initialStartDate?: string;
  initialEndDate?: string;
  initialMode?: 'general' | 'employee';
  initialUserId?: number;
  users?: any[];
  onClose?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  FACTURACION: 'Facturación',
  VENDEDOR: 'Vendedor',
  DEPOSITO: 'Depósito',
};

const PERIOD_PRESETS: Array<{ id: PeriodType; label: string }> = [
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
  { id: 'prev_month', label: 'Mes anterior' },
  { id: 'custom', label: 'Personalizado' },
];

const filterActiveEmployees = (list: any[] = []) =>
  (Array.isArray(list) ? list : []).filter(
    (u) => u && u.isActive !== false && String(u.username || '').toLowerCase() !== 'tienda_online',
  );

export default function ExecutivePdfReport({
  initialStartDate,
  initialEndDate,
  initialMode = 'general',
  initialUserId,
  users = [],
  onClose,
}: ExecutivePdfReportProps) {
  const defaultRange = computeArDatePreset('this_month');
  const [employees, setEmployees] = useState<any[]>(() => filterActiveEmployees(users));
  const [usersLoading, setUsersLoading] = useState<boolean>(
    () => initialMode === 'employee' && !initialUserId && filterActiveEmployees(users).length === 0,
  );
  const [selectedUserId, setSelectedUserId] = useState<string>(() => {
    if (initialUserId) return String(initialUserId);
    if (initialMode === 'employee') {
      const first = filterActiveEmployees(users)[0];
      return first ? String(first.id) : '';
    }
    return '';
  });
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

  useEffect(() => {
    const incoming = filterActiveEmployees(users);
    if (incoming.length > 0) {
      setEmployees(incoming);
      setUsersLoading(false);
      if (initialMode === 'employee' && !selectedUserId) {
        setSelectedUserId(String(incoming[0].id));
      }
      return;
    }
    let active = true;
    api
      .getUsers()
      .then((res) => {
        if (!active) return;
        const filtered = filterActiveEmployees(res);
        setEmployees(filtered);
        if (initialMode === 'employee' && !selectedUserId && filtered.length > 0) {
          setSelectedUserId(String(filtered[0].id));
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [users.length]);

  const handleSelectPreset = (nextType: PeriodType) => {
    setPeriodType(nextType);
    const nextDates = computePeriodDates(nextType);
    if (nextDates) {
      setStartDate(nextDates.startDate);
      setEndDate(nextDates.endDate);
    }
  };

  const fetchReportData = async () => {
    if (usersLoading) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const reportData = selectedUserId
        ? await api.getEmployeePdfReport(Number(selectedUserId), startDate, endDate)
        : await api.getExecutivePdfReport(startDate, endDate);
      if (reportData) setData(reportData);
      else setError('No se pudieron obtener los datos del reporte.');
    } catch (e: any) {
      setError(e.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedUserId, startDate, endDate, usersLoading]);

  const isEmployeeMode = Boolean(selectedUserId);
  const selectedEmployee = employees.find((e) => String(e.id) === selectedUserId);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    setError(null);
    const baseName = isEmployeeMode
      ? `Reporte_Empleado_${selectedEmployee?.username || selectedUserId}_${startDate}_a_${endDate}.pdf`
      : `Reporte_Ejecutivo_${startDate}_a_${endDate}.pdf`;
    try {
      await downloadElementAsA4Pdf(reportRef.current, baseName);
    } catch {
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
            position: absolute; left: 0; top: 0; width: 100% !important;
            margin: 0 !important; padding: 0 !important; box-shadow: none !important; background: #fff !important;
          }
          .page-break { page-break-before: always; }
        }
      `}</style>

      <div
        className="no-print"
        style={{
          backgroundColor: '#fff', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
          border: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
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
            {isEmployeeMode ? <Users size={16} color="#0f172a" aria-hidden="true" /> : <FileText size={16} color="var(--color-corp-red)" aria-hidden="true" />}
            {isEmployeeMode ? 'Reporte de Empleado' : 'Reporte Ejecutivo'}
          </span>
        </div>

        <search aria-label="Filtros del reporte PDF" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="exec-pdf-scope" className="visually-hidden">Alcance del reporte</label>
            <select
              id="exec-pdf-scope"
              className="select"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              disabled={loading}
              style={{ fontSize: '0.8rem', fontWeight: 600, padding: '5px 10px', minWidth: '175px', width: 'auto' }}
            >
              <option value="">General (Empresa)</option>
              {employees.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.username} ({ROLE_LABELS[u.role] || u.role})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f8fafc', padding: '3px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodType === p.id}
                onClick={() => handleSelectPreset(p.id)}
                style={{
                  fontSize: '0.78rem', padding: '4px 9px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  backgroundColor: periodType === p.id ? '#0f172a' : 'transparent',
                  fontWeight: periodType === p.id ? 600 : 500,
                  color: periodType === p.id ? '#fff' : '#64748b',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#64748b" aria-hidden="true" />
            <label htmlFor="exec-pdf-start" className="visually-hidden">Desde</label>
            <input id="exec-pdf-start" type="date" className="input tabular-nums" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPeriodType('custom'); }} style={{ fontSize: '0.8rem', padding: '4px 8px' }} />
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>al</span>
            <label htmlFor="exec-pdf-end" className="visually-hidden">Hasta</label>
            <input id="exec-pdf-end" type="date" className="input tabular-nums" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPeriodType('custom'); }} style={{ fontSize: '0.8rem', padding: '4px 8px' }} />
          </div>

          <button type="button" onClick={fetchReportData} disabled={loading} className="btn btn-secondary" aria-label="Actualizar" style={{ padding: '6px 10px', fontSize: '0.8rem' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} aria-hidden="true" />
          </button>
        </search>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={handleDownloadPdf} disabled={loading || generatingPdf || !data} className="btn btn-secondary" style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} aria-hidden="true" />
            <span>{generatingPdf ? 'Generando...' : 'Descargar PDF'}</span>
          </button>
          <button type="button" onClick={() => window.print()} disabled={loading || !data} className="btn" style={{ fontSize: '0.8rem', backgroundColor: '#0f172a', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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

      {isEmployeeMode ? (
        <EmployeePdfSheet ref={reportRef} data={data} />
      ) : (
        <ExecutivePdfSheet ref={reportRef} data={data} />
      )}
    </div>
  );
}
