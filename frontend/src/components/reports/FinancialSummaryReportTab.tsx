import { useEffect, useState, type FC } from 'react';
import { Calendar, FileText, Store, TrendingDown, Users } from 'lucide-react';
import { api } from '../../utils/api';
import ExecutivePdfReport from './ExecutivePdfReport';
import { computeArDatePreset } from './reportDateHelpers';

type SummaryPreset = 'this_month' | 'last_month' | 'this_week' | 'custom';
type PdfReportMode = 'general' | 'employee' | null;

const PRESETS: Array<{ id: SummaryPreset; label: string }> = [
  { id: 'this_month', label: 'Este mes' },
  { id: 'last_month', label: 'Mes anterior' },
  { id: 'this_week', label: 'Esta semana' },
  { id: 'custom', label: 'Personalizado' },
];

interface FinancialSummaryReportTabProps {
  financialReport: any;
  users?: any[];
}

export const FinancialSummaryReportTab: FC<FinancialSummaryReportTabProps> = ({
  financialReport,
  users = [],
}) => {
  const initialRange = computeArDatePreset('this_month');
  const [preset, setPreset] = useState<SummaryPreset>('this_month');
  const [startDate, setStartDate] = useState<string>(initialRange.startDate);
  const [endDate, setEndDate] = useState<string>(initialRange.endDate);
  const [localReport, setLocalReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfReportMode>(null);

  const handlePresetChange = (nextPreset: SummaryPreset) => {
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      const range = computeArDatePreset(nextPreset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  };

  useEffect(() => {
    if (!startDate || !endDate) return;
    let active = true;
    setReportLoading(true);
    api
      .getFinancialReports({ startDate, endDate })
      .then((data) => { if (active) setLocalReport(data); })
      .catch((e) => { console.error('Error al cargar reporte financiero consolidado:', e); })
      .finally(() => { if (active) setReportLoading(false); });
    return () => { active = false; };
  }, [startDate, endDate]);

  if (pdfMode) {
    return (
      <ExecutivePdfReport
        initialStartDate={startDate}
        initialEndDate={endDate}
        initialMode={pdfMode}
        users={users}
        onClose={() => setPdfMode(null)}
      />
    );
  }

  const currentReport = localReport || financialReport;
  const officialSales = currentReport?.sales?.official || 0;
  const internalSales = currentReport?.sales?.internal || 0;
  const officialCostReal = currentReport?.sales?.officialCost || 0;
  const internalCostReal = currentReport?.sales?.internalCost || 0;
  const totalFacturado = currentReport?.summary?.netSales ?? officialSales + internalSales;
  const totalCostoReal = currentReport?.summary?.totalCost ?? Math.round(officialCostReal + internalCostReal);
  const totalMargenBruto = currentReport?.summary?.grossProfit ?? Math.round(totalFacturado - totalCostoReal);
  const pctMargenBruto =
    currentReport?.summary?.grossMarginPct ??
    (totalFacturado > 0 ? Math.round((totalMargenBruto / totalFacturado) * 100) : 0);
  const totalGastosReal = currentReport?.expenses?.total || 0;
  const totalMargenNeto = currentReport?.summary?.netProfit ?? Math.round(totalMargenBruto - totalGastosReal);
  const pctMargenConsolidado =
    currentReport?.summary?.netMarginPct ??
    (totalFacturado > 0 ? Math.round((totalMargenNeto / totalFacturado) * 100) : 0);

  const localSales = currentReport?.modalityBreakdown?.local?.sales || 0;
  const localCount = currentReport?.modalityBreakdown?.local?.count || 0;
  const localSharePct = currentReport?.modalityBreakdown?.local?.sharePct || 0;

  const branches = [
    { label: 'Sucursal A (Oficial)', sales: officialSales, cost: officialCostReal },
    { label: 'Sucursal X (Interno)', sales: internalSales, cost: internalCostReal },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <search aria-label="Período financiero">
        <div
          className="card"
          style={{
            padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f8fafc', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={preset === p.id}
                  onClick={() => handlePresetChange(p.id)}
                  style={{
                    padding: '4px 10px', fontSize: '0.78rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    fontWeight: preset === p.id ? 600 : 500,
                    backgroundColor: preset === p.id ? '#0f172a' : 'transparent',
                    color: preset === p.id ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="var(--text-secondary)" aria-hidden="true" />
              <label htmlFor="fin-start-date" className="visually-hidden">Desde</label>
              <input
                id="fin-start-date"
                type="date"
                value={startDate}
                onChange={(e) => { setPreset('custom'); setStartDate(e.target.value); }}
                className="input tabular-nums"
                style={{ padding: '5px 8px', fontSize: '0.8rem', width: 'auto' }}
                disabled={reportLoading}
              />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>al</span>
              <label htmlFor="fin-end-date" className="visually-hidden">Hasta</label>
              <input
                id="fin-end-date"
                type="date"
                value={endDate}
                onChange={(e) => { setPreset('custom'); setEndDate(e.target.value); }}
                className="input tabular-nums"
                style={{ padding: '5px 8px', fontSize: '0.8rem', width: 'auto' }}
                disabled={reportLoading}
              />
            </div>

            {reportLoading && <span role="status" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cargando...</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPdfMode('employee')}
              style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Users size={14} aria-hidden="true" />
              Empleado PDF
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPdfMode('general')}
              style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={14} aria-hidden="true" />
              Reporte PDF
            </button>
          </div>
        </div>
      </search>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Ventas facturadas</span>
          <span className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>${totalFacturado.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mostrador</span>
            <Store size={15} color="#475569" aria-hidden="true" />
          </div>
          <div className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>${localSales.toLocaleString('es-AR')}</div>
          <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            <span>{localCount} {localCount === 1 ? 'venta' : 'ventas'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{localSharePct}%</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Costo mercadería (CMV)</span>
          <span className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 700, color: '#475569' }}>${totalCostoReal.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Utilidad bruta</span>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 700, color: totalMargenBruto >= 0 ? '#137333' : 'var(--color-corp-red)' }}>${totalMargenBruto.toLocaleString('es-AR')}</span>
            <span className="badge" style={{ backgroundColor: totalMargenBruto >= 0 ? '#e6f4ea' : 'var(--color-danger-bg)', color: totalMargenBruto >= 0 ? '#137333' : 'var(--color-danger)', fontSize: '0.72rem', padding: '2px 6px' }}>
              {pctMargenBruto}%
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Gastos operativos</span>
          <span className="tabular-nums" style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>${totalGastosReal.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '16px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: `3px solid ${totalMargenNeto >= 0 ? '#137333' : 'var(--color-corp-red)'}` }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Rentabilidad neta</span>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 700, color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-corp-red)' }}>${totalMargenNeto.toLocaleString('es-AR')}</span>
            <span className="badge" style={{ backgroundColor: totalMargenNeto >= 0 ? '#e6f4ea' : 'var(--color-danger-bg)', color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-danger)', fontSize: '0.72rem', padding: '2px 6px' }}>
              {pctMargenConsolidado}%
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 0, marginBottom: '14px' }}>Margen comercial por sucursal</h4>
          <div className="table-container" role="region" aria-label="Margen comercial por sucursal" tabIndex={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th scope="col" style={{ padding: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sucursal</th>
                  <th scope="col" style={{ padding: '10px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Vendido</th>
                  <th scope="col" style={{ padding: '10px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Costo (CMV)</th>
                  <th scope="col" style={{ padding: '10px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Margen bruto</th>
                  <th scope="col" style={{ padding: '10px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>Margen %</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b, i) => {
                  const gross = Math.round(b.sales - b.cost);
                  const pct = b.sales > 0 ? Math.round((gross / b.sales) * 100) : 0;
                  return (
                    <tr key={b.label} style={i === 0 ? { borderBottom: '1px solid var(--border-color)' } : undefined}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{b.label}</td>
                      <td className="tabular-nums" style={{ padding: '10px', textAlign: 'right' }}>${b.sales.toLocaleString('es-AR')}</td>
                      <td className="tabular-nums" style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>${b.cost.toLocaleString('es-AR')}</td>
                      <td className="tabular-nums" style={{ padding: '10px', textAlign: 'right', fontWeight: 600, color: gross >= 0 ? '#137333' : 'var(--color-corp-red)' }}>${gross.toLocaleString('es-AR')}</td>
                      <td className="tabular-nums" style={{ padding: '10px', textAlign: 'center' }}>
                        <span className="badge" style={{ backgroundColor: gross >= 0 ? '#f1f5f9' : 'var(--color-danger-bg)', color: gross >= 0 ? '#0f172a' : 'var(--color-danger)', fontWeight: 600 }}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: 0, marginBottom: '14px' }}>Desglose de egresos</h4>
          {currentReport?.expenses?.byCategory && currentReport.expenses.byCategory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '190px', flex: 1 }}>
              {currentReport.expenses.byCategory.map((cat: any, idx: number) => {
                const pct = totalGastosReal > 0 ? (cat.value / totalGastosReal) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 500 }}>{cat.name}</span>
                      <span style={{ fontWeight: 600 }}>${cat.value.toLocaleString('es-AR')} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: idx === 0 ? '#0f172a' : '#64748b', borderRadius: '2px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '110px', color: 'var(--text-secondary)', gap: '8px' }}>
              <TrendingDown size={24} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8rem' }}>Sin gastos en el período.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
