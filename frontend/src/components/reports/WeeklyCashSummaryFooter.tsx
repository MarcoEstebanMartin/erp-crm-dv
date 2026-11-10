import React from 'react';
import { Trash2, Save } from 'lucide-react';

interface WeeklyCashSummaryFooterProps {
  sales: any[];
  purchases: any[];
  credit: number;
  buffer: number;
  weeklyReports: any[];
  selectedWeekStart: string;
  saving: boolean;
  handleDeleteWeekly: () => void;
  handleSaveWeekly: () => void;
  handleSelectWeek: (weekStart: string) => void;
}

export const WeeklyCashSummaryFooter: React.FC<WeeklyCashSummaryFooterProps> = ({
  sales,
  purchases,
  credit,
  buffer,
  weeklyReports,
  selectedWeekStart,
  saving,
  handleDeleteWeekly,
  handleSaveWeekly,
  handleSelectWeek
}) => {
  const sTot = sales.reduce((sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0), 0);
  const pTot = purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const netWeekly = sTot - pTot;
  const finalCredit = (pTot + credit + buffer) - sTot;

  return (
    <>
      <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '24px', backgroundColor: 'var(--bg-light)', border: '1px solid var(--border-color)' }}>
        <div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>Resumen Financiero de la Semana</h4>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '12px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>VENTAS TOTALES (A + X)</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#137333' }}>+${sTot.toLocaleString()}</span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>COMPRAS (PROVEEDORES)</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-secondary)' }}>-${pTot.toLocaleString()}</span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>CRÉDITO INICIAL</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: credit < 0 ? 'var(--color-corp-red)' : 'var(--text-primary)' }}>
                ${credit.toLocaleString()}
              </span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>FLUJO NETO OPERATIVO</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: netWeekly >= 0 ? '#137333' : 'var(--color-corp-red)' }}>
                {netWeekly >= 0 ? '+' : ''}${netWeekly.toLocaleString()}
              </span>
            </div>
            <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', backgroundColor: '#e6f4ea', padding: '6px 14px', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#137333', display: 'block', fontWeight: 600 }}>PROYECTAR CRÉDITO SEMANA SIGUIENTE</span>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#137333' }}>${Math.round(finalCredit).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {weeklyReports.some(r => r.weekStart === selectedWeekStart) && (
            <button
              className="btn btn-secondary"
              onClick={handleDeleteWeekly}
              disabled={saving}
              style={{ borderColor: 'var(--color-corp-red)', color: 'var(--color-corp-red)', padding: '10px 16px' }}
            >
              <Trash2 size={16} /> Eliminar Cierre
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSaveWeekly}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 600 }}
          >
            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Cierre Semanal'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700 }}>Evolución Financiera Histórica Semanal</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>
          Evolución de la deuda (Crédito) de las últimas semanas cargadas en el sistema.
        </p>

        {weeklyReports.length < 2 ? (
          <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Se necesitan al menos 2 semanas cerradas para visualizar los gráficos de evolución histórica.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TENDENCIA DE DEUDA (CRÉDITO SEMANAL)</span>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', gap: '12px' }}>
                {(() => {
                  const maxAbs = Math.max(...weeklyReports.map(x => Math.abs(Number(x.credit) || 0)), 1);
                  return weeklyReports.map((r) => {
                    const crVal = Number(r.credit) || 0;
                    const absCr = Math.abs(crVal);
                    const heightPct = Math.max((absCr / maxAbs) * 100, 4);
                    const isCurrent = r.weekStart === selectedWeekStart;
                    return (
                      <div
                        key={r.weekStart}
                        onClick={() => handleSelectWeek(r.weekStart)}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', height: '100%', justifyContent: 'flex-end' }}
                      >
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isCurrent ? 'var(--color-primary)' : 'var(--text-secondary)', marginBottom: '4px' }}>
                          -${Math.round(absCr / 1000000)}M
                        </span>
                        <div style={{ width: '100%', maxWidth: '40px', height: `${heightPct}%`, backgroundColor: isCurrent ? 'var(--color-corp-red)' : 'var(--text-secondary)', borderRadius: '4px 4px 0 0', transition: 'all 0.2s', opacity: isCurrent ? 1 : 0.6 }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: isCurrent ? 700 : 400 }}>
                          {r.weekStart.substring(5)}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .input-inline-cell {
          width: 100%;
          border: 1px solid transparent;
          background-color: transparent;
          padding: 6px 8px;
          font-size: 0.85rem;
          color: var(--text-primary);
          border-radius: 4px;
          transition: all 0.15s;
          outline: none;
        }
        .input-inline-cell:focus {
          border-color: var(--border-color);
          background-color: var(--bg-card);
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .input-inline-cell:hover {
          background-color: var(--bg-light);
        }
      `}</style>
    </>
  );
};
