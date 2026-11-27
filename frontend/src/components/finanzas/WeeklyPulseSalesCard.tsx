import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  formatPeso,
  type WeeklyPulseSaleRow,
  type WeeklyPulseSummary,
} from './weeklyPulseTypes';

interface WeeklyPulseSalesCardProps {
  weekStart: string;
  sales: WeeklyPulseSaleRow[];
  summary: WeeklyPulseSummary;
  saving: boolean;
  onAddManual: (item: { locality: string; date: string; amountA: number; amountX: number }) => void;
  onRemoveManual: (id: string) => void;
}

export function WeeklyPulseSalesCard({
  weekStart,
  sales,
  summary,
  saving,
  onAddManual,
  onRemoveManual,
}: WeeklyPulseSalesCardProps) {
  const [adding, setAdding] = useState(false);
  const [locality, setLocality] = useState('');
  const [amountARaw, setAmountARaw] = useState('');
  const [amountXRaw, setAmountXRaw] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const a = amountARaw ? Number(amountARaw.replace(/\./g, '').replace(',', '.')) : 0;
    const x = amountXRaw ? Number(amountXRaw.replace(/\./g, '').replace(',', '.')) : 0;
    if (!locality.trim() || !Number.isFinite(a) || !Number.isFinite(x) || (a === 0 && x === 0)) return;
    onAddManual({
      locality: locality.trim().toUpperCase(),
      date: weekStart,
      amountA: Math.round(a),
      amountX: Math.round(x),
    });
    setAdding(false);
    setLocality('');
    setAmountARaw('');
    setAmountXRaw('');
  };

  return (
    <section
      className="card"
      style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Ventas por localidad
        </h3>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={() => setAdding((v) => !v)}
          style={{ padding: '4px 10px', fontSize: '0.76rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <Plus size={13} aria-hidden="true" />
          Ajuste
        </button>
      </div>

      {adding && (
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(120px, 1.3fr) minmax(90px, 1fr) minmax(90px, 1fr) auto',
            gap: '8px',
            alignItems: 'center',
            padding: '10px',
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid var(--border-color)',
          }}
        >
          <input
            type="text"
            className="input"
            aria-label="Localidad"
            placeholder="Localidad"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            autoFocus
            style={{ fontSize: '0.82rem', padding: '6px 8px' }}
          />
          <input
            type="number"
            step="1"
            className="input tabular-nums"
            aria-label="Importe A"
            placeholder="Importe A"
            value={amountARaw}
            onChange={(e) => setAmountARaw(e.target.value)}
            style={{ fontSize: '0.82rem', padding: '6px 8px', textAlign: 'right' }}
          />
          <input
            type="number"
            step="1"
            className="input tabular-nums"
            aria-label="Importe X"
            placeholder="Importe X"
            value={amountXRaw}
            onChange={(e) => setAmountXRaw(e.target.value)}
            style={{ fontSize: '0.82rem', padding: '6px 8px', textAlign: 'right' }}
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '6px 10px', fontSize: '0.78rem', minHeight: 'auto' }}>
              Sumar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)} style={{ padding: '6px 8px', fontSize: '0.78rem', minHeight: 'auto' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla de ventas semanales por localidad"
        style={{ overflowX: 'auto' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.74rem', textTransform: 'uppercase' }}>
              <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600 }}>Localidad</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Importe A</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Importe X</th>
              <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600 }}>Total</th>
              <th style={{ width: '32px', padding: '8px 4px' }} aria-label="Acción" />
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '18px 6px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Sin ventas entregadas esta semana
                </td>
              </tr>
            ) : (
              sales.map((row) => {
                const isManual = row.source === 'MANUAL';
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-light, #f1f5f9)' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      <span>{row.locality}</span>
                      {isManual && (
                        <span
                          style={{
                            marginLeft: '6px',
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: '#f1f5f9',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {row.amountA !== 0 ? formatPeso(row.amountA) : '—'}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {row.amountX !== 0 ? formatPeso(row.amountX) : '—'}
                    </td>
                    <td className="tabular-nums" style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatPeso(row.total)}
                    </td>
                    <td style={{ padding: '4px', textAlign: 'right' }}>
                      {isManual && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={saving}
                          aria-label={`Eliminar ajuste ${row.locality}`}
                          onClick={() => onRemoveManual(row.id)}
                          style={{ padding: '4px', minHeight: 'auto', color: 'var(--text-muted)' }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '9px 6px', fontWeight: 700, color: 'var(--text-primary)' }}>Total</td>
              <td className="tabular-nums" style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPeso(summary.salesA)}
              </td>
              <td className="tabular-nums" style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPeso(summary.salesX)}
              </td>
              <td className="tabular-nums" style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatPeso(summary.salesTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
