import React, { useState, useEffect } from 'react';
import { TrendingDown } from 'lucide-react';
import { api } from '../../utils/api';

const getMonthName = (m: number): string => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[m - 1];
};

interface FinancialSummaryReportTabProps {
  financialReport: any;
}

export const FinancialSummaryReportTab: React.FC<FinancialSummaryReportTabProps> = ({ financialReport }) => {
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [localReport, setLocalReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetchLocalFinancialReport();
  }, [reportYear, reportMonth]);

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

  const currentReport = localReport || financialReport;
  const totalFacturado = currentReport?.sales ? ((currentReport.sales.official || 0) + (currentReport.sales.internal || 0)) : 0;
  const officialSales = currentReport?.sales?.official || 0;
  const internalSales = currentReport?.sales?.internal || 0;

  // Costos reales obtenidos desde el backend (CMV con unitCostSnapshot inmutable)
  const officialCostReal = currentReport?.sales?.officialCost || 0;
  const internalCostReal = currentReport?.sales?.internalCost || 0;
  const totalCostoReal = Math.round(officialCostReal + internalCostReal);

  const totalMargenBruto = Math.round(totalFacturado - totalCostoReal);
  const pctMargenBruto = totalFacturado > 0 ? Math.round((totalMargenBruto / totalFacturado) * 100) : 0;
  const totalGastosReal = currentReport?.expenses?.total || 0;
  const totalMargenNeto = Math.round(totalMargenBruto - totalGastosReal);
  const pctMargenConsolidado = totalFacturado > 0 ? Math.round((totalMargenNeto / totalFacturado) * 100) : 0;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar período:</span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <select
            value={reportYear}
            onChange={e => setReportYear(Number(e.target.value))}
            className="select"
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '0.85rem' }}
            disabled={reportLoading}
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>
          <select
            value={reportMonth}
            onChange={e => setReportMonth(Number(e.target.value))}
            className="select"
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '0.85rem' }}
            disabled={reportLoading}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <option key={m} value={m}>{getMonthName(m)}</option>
            ))}
          </select>
        </div>
        {reportLoading && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cargando analíticas...</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>VENTAS FACTURADAS</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>${totalFacturado.toLocaleString('es-AR')}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Ventas del mes seleccionado</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>COSTO MERCADERÍA (CMV)</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#5f6368' }}>${totalCostoReal.toLocaleString('es-AR')}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Costo histórico real de productos entregados</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>UTILIDAD BRUTA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#137333' }}>${totalMargenBruto.toLocaleString('es-AR')}</span>
            <span className="badge" style={{ backgroundColor: '#e6f4ea', color: '#137333', fontSize: '0.75rem', padding: '2px 6px' }}>{pctMargenBruto}%</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Margen sobre ventas</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>GASTOS OPERATIVOS</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-corp-red)' }}>${totalGastosReal.toLocaleString('es-AR')}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Egresos y sueldos del período</span>
        </div>

        <div className="card" style={{ padding: '20px', borderRadius: '12px', borderLeft: '4px solid #137333' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>RENTABILIDAD NETA</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-corp-red)' }}>
              ${totalMargenNeto.toLocaleString('es-AR')}
            </span>
            <span className="badge" style={{
              backgroundColor: totalMargenNeto >= 0 ? '#e6f4ea' : 'var(--color-danger-bg)',
              color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-danger)',
              fontSize: '0.75rem',
              padding: '2px 6px'
            }}>{pctMargenConsolidado}%</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Ganancia neta final exacta</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'stretch' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Margen Comercial por Sucursal</h4>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sucursal</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendido</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo Real (CMV)</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Margen Bruto</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>% Margen</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal A (Oficial)</td>
                  <td style={{ padding: '12px' }}>${officialSales.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${officialCostReal.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${Math.round(officialSales - officialCostReal).toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}>
                      {officialSales > 0 ? Math.round(((officialSales - officialCostReal) / officialSales) * 100) : 0}%
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal X (Interno)</td>
                  <td style={{ padding: '12px' }}>${internalSales.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${internalCostReal.toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${Math.round(internalSales - internalCostReal).toLocaleString('es-AR')}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}>
                      {internalSales > 0 ? Math.round(((internalSales - internalCostReal) / internalSales) * 100) : 0}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Desglose de Egresos del Período</h4>
          {currentReport?.expenses?.byCategory && currentReport.expenses.byCategory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '180px', flex: 1 }}>
              {currentReport.expenses.byCategory.map((cat: any, idx: number) => {
                const pct = totalGastosReal > 0 ? (cat.value / totalGastosReal) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 500 }}>{cat.name}</span>
                      <span style={{ fontWeight: 600 }}>${cat.value.toLocaleString('es-AR')} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        backgroundColor: idx === 0 ? 'var(--color-corp-red)' : 'var(--color-primary)',
                        borderRadius: '2px'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '120px', color: 'var(--text-secondary)', gap: '8px' }}>
              <TrendingDown size={28} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.8rem' }}>Sin gastos registrados en este período.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
