import { useEffect, useState, type FC } from 'react';
import { TrendingDown } from 'lucide-react';
import { api } from '../../utils/api';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface FinancialSummaryReportTabProps {
  financialReport: any;
}

export const FinancialSummaryReportTab: FC<FinancialSummaryReportTabProps> = ({ financialReport }) => {
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [localReport, setLocalReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const fetchLocalFinancialReport = async () => {
    setReportLoading(true);
    try {
      const data = await api.getFinancialReports(reportYear, reportMonth);
      setLocalReport(data);
    } catch (e) {
      console.error('Error al cargar reporte financiero consolidado:', e);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchLocalFinancialReport();
  }, [reportYear, reportMonth]);

  const currentReport = localReport || financialReport;
  const totalFacturado = currentReport?.sales ? ((currentReport.sales.official || 0) + (currentReport.sales.internal || 0)) : 0;
  const officialSales = currentReport?.sales?.official || 0;
  const internalSales = currentReport?.sales?.internal || 0;
  const officialCostReal = currentReport?.sales?.officialCost || 0;
  const internalCostReal = currentReport?.sales?.internalCost || 0;
  const totalCostoReal = Math.round(officialCostReal + internalCostReal);
  const totalMargenBruto = Math.round(totalFacturado - totalCostoReal);
  const pctMargenBruto = totalFacturado > 0 ? Math.round((totalMargenBruto / totalFacturado) * 100) : 0;
  const totalGastosReal = currentReport?.expenses?.total || 0;
  const totalMargenNeto = Math.round(totalMargenBruto - totalGastosReal);
  const pctMargenConsolidado = totalFacturado > 0 ? Math.round((totalMargenNeto / totalFacturado) * 100) : 0;

  const years = Array.from(new Set([new Date().getFullYear(), 2026, 2025, 2024])).sort((a, b) => b - a);

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <search aria-label="Período financiero">
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="fin-report-year" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Año</label>
            <select
              id="fin-report-year"
              value={reportYear}
              onChange={e => setReportYear(Number(e.target.value))}
              className="select tabular-nums"
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '0.85rem' }}
              disabled={reportLoading}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="fin-report-month" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mes</label>
            <select
              id="fin-report-month"
              value={reportMonth}
              onChange={e => setReportMonth(Number(e.target.value))}
              className="select"
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '0.85rem' }}
              disabled={reportLoading}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>
          {reportLoading && (
            <span role="status" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cargando...</span>
          )}
        </div>
      </search>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Ventas facturadas</span>
          <span className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700 }}>${totalFacturado.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Costo mercadería (CMV)</span>
          <span className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#5f6368' }}>${totalCostoReal.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Utilidad bruta</span>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: totalMargenBruto >= 0 ? '#137333' : 'var(--color-corp-red)' }}>${totalMargenBruto.toLocaleString('es-AR')}</span>
            <span
              className="badge"
              style={{
                backgroundColor: totalMargenBruto >= 0 ? '#e6f4ea' : 'var(--color-danger-bg)',
                color: totalMargenBruto >= 0 ? '#137333' : 'var(--color-danger)',
                fontSize: '0.75rem',
                padding: '2px 6px'
              }}
            >
              {pctMargenBruto}%
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Gastos operativos</span>
          <span className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-corp-red)' }}>${totalGastosReal.toLocaleString('es-AR')}</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${totalMargenNeto >= 0 ? '#137333' : 'var(--color-corp-red)'}` }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Rentabilidad neta</span>
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-corp-red)' }}>
              ${totalMargenNeto.toLocaleString('es-AR')}
            </span>
            <span
              className="badge"
              style={{
                backgroundColor: totalMargenNeto >= 0 ? '#e6f4ea' : 'var(--color-danger-bg)',
                color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-danger)',
                fontSize: '0.75rem',
                padding: '2px 6px'
              }}
            >
              {pctMargenConsolidado}%
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'stretch' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Margen comercial por sucursal</h4>
          <div className="table-container" role="region" aria-label="Margen comercial por sucursal" tabIndex={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th scope="col" style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sucursal</th>
                  <th scope="col" style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendido</th>
                  <th scope="col" style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo (CMV)</th>
                  <th scope="col" style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Margen bruto</th>
                  <th scope="col" style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>Margen %</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal A (Oficial)</td>
                  <td className="tabular-nums" style={{ padding: '12px' }}>${officialSales.toLocaleString('es-AR')}</td>
                  <td className="tabular-nums" style={{ padding: '12px', color: 'var(--text-secondary)' }}>${officialCostReal.toLocaleString('es-AR')}</td>
                  <td className="tabular-nums" style={{ padding: '12px', fontWeight: 600, color: (officialSales - officialCostReal) >= 0 ? '#137333' : 'var(--color-corp-red)' }}>${Math.round(officialSales - officialCostReal).toLocaleString('es-AR')}</td>
                  <td className="tabular-nums" style={{ padding: '12px', textAlign: 'center' }}>
                    <span className="badge" style={{ backgroundColor: (officialSales - officialCostReal) >= 0 ? '#e8f0fe' : 'var(--color-danger-bg)', color: (officialSales - officialCostReal) >= 0 ? '#1a73e8' : 'var(--color-danger)', fontWeight: 600 }}>
                      {officialSales > 0 ? Math.round(((officialSales - officialCostReal) / officialSales) * 100) : 0}%
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal X (Interno)</td>
                  <td className="tabular-nums" style={{ padding: '12px' }}>${internalSales.toLocaleString('es-AR')}</td>
                  <td className="tabular-nums" style={{ padding: '12px', color: 'var(--text-secondary)' }}>${internalCostReal.toLocaleString('es-AR')}</td>
                  <td className="tabular-nums" style={{ padding: '12px', fontWeight: 600, color: (internalSales - internalCostReal) >= 0 ? '#137333' : 'var(--color-corp-red)' }}>${Math.round(internalSales - internalCostReal).toLocaleString('es-AR')}</td>
                  <td className="tabular-nums" style={{ padding: '12px', textAlign: 'center' }}>
                    <span className="badge" style={{ backgroundColor: (internalSales - internalCostReal) >= 0 ? '#e8f0fe' : 'var(--color-danger-bg)', color: (internalSales - internalCostReal) >= 0 ? '#1a73e8' : 'var(--color-danger)', fontWeight: 600 }}>
                      {internalSales > 0 ? Math.round(((internalSales - internalCostReal) / internalSales) * 100) : 0}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Desglose de egresos</h4>
          {currentReport?.expenses?.byCategory && currentReport.expenses.byCategory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '180px', flex: 1 }}>
              {currentReport.expenses.byCategory.map((cat: any, idx: number) => {
                const pct = totalGastosReal > 0 ? (cat.value / totalGastosReal) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 500 }}>{cat.name}</span>
                      <span style={{ fontWeight: 600 }}>${cat.value.toLocaleString('es-AR')} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          backgroundColor: idx === 0 ? 'var(--color-corp-red)' : 'var(--color-primary)',
                          borderRadius: '2px'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '120px', color: 'var(--text-secondary)', gap: '8px' }}>
              <TrendingDown size={28} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8rem' }}>Sin gastos en el período.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
