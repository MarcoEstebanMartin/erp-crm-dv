import { useState } from 'react';
import { Edit2, RotateCcw } from 'lucide-react';
import { formatPeso, type WeeklyPulseSummary } from './weeklyPulseTypes';

interface WeeklyPulseKpiStripProps {
  summary: WeeklyPulseSummary;
  isManualOpeningCredit: boolean;
  saving: boolean;
  onSaveBuffer: (value: number) => void;
  onSaveOpeningCredit: (value: number | null) => void;
}

export function WeeklyPulseKpiStrip({
  summary,
  isManualOpeningCredit,
  saving,
  onSaveBuffer,
  onSaveOpeningCredit,
}: WeeklyPulseKpiStripProps) {
  const [editingBuffer, setEditingBuffer] = useState(false);
  const [bufferDraft, setBufferDraft] = useState('');
  const [editingCredit, setEditingCredit] = useState(false);
  const [creditDraft, setCreditDraft] = useState('');

  const isOverbought = summary.status === 'OVERBOUGHT';
  const isAvailable = summary.status === 'AVAILABLE';

  const handleSubmitBuffer = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(bufferDraft.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(num) || num < 0) return;
    setEditingBuffer(false);
    onSaveBuffer(Math.round(num));
  };

  const handleSubmitCredit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(creditDraft.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(num)) return;
    setEditingCredit(false);
    onSaveOpeningCredit(Math.round(num));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Venta semanal</div>
        <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
          {formatPeso(summary.salesTotal)}
        </div>
        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          A {summary.salesAPct}% · X {summary.salesXPct}%
        </div>
      </div>

      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Compras recibidas</div>
        <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
          {formatPeso(summary.weekPurchasesTotal)}
        </div>
        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <span>Arrastre: {formatPeso(summary.openingCredit)}</span>
          {!editingCredit && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setCreditDraft(String(Math.round(summary.openingCredit)));
                setEditingCredit(true);
              }}
              style={{ padding: '2px 5px', fontSize: '0.72rem', minHeight: 'auto' }}
            >
              {isManualOpeningCredit ? 'Inicial' : 'Fijar'}
            </button>
          )}
        </div>
        {editingCredit && (
          <form onSubmit={handleSubmitCredit} style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
            <input
              type="number"
              step="1"
              className="input tabular-nums"
              aria-label="Crédito inicial"
              value={creditDraft}
              onChange={(e) => setCreditDraft(e.target.value)}
              autoFocus
              style={{ fontSize: '0.78rem', padding: '4px 6px', width: '100%' }}
            />
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '4px 8px', fontSize: '0.72rem', minHeight: 'auto' }}>
              OK
            </button>
            {isManualOpeningCredit && (
              <button
                type="button"
                className="btn btn-ghost"
                title="Volver a cálculo automático"
                onClick={() => {
                  setEditingCredit(false);
                  onSaveOpeningCredit(null);
                }}
                style={{ padding: '4px', minHeight: 'auto' }}
              >
                <RotateCcw size={13} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setEditingCredit(false)} style={{ padding: '4px 6px', fontSize: '0.72rem', minHeight: 'auto' }}>
              ×
            </button>
          </form>
        )}
      </div>

      <div className="card" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Resultado fijo</span>
          {!editingBuffer && (
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="Editar resultado fijo"
              onClick={() => {
                setBufferDraft(String(Math.round(summary.resultBuffer)));
                setEditingBuffer(true);
              }}
              style={{ padding: '2px 4px', minHeight: 'auto', color: 'var(--text-muted)' }}
            >
              <Edit2 size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        {editingBuffer ? (
          <form onSubmit={handleSubmitBuffer} style={{ display: 'flex', gap: '4px', marginTop: '6px', alignItems: 'center' }}>
            <input
              type="number"
              step="1"
              min="0"
              className="input tabular-nums"
              aria-label="Resultado fijo semanal"
              value={bufferDraft}
              onChange={(e) => setBufferDraft(e.target.value)}
              autoFocus
              style={{ fontSize: '0.84rem', padding: '5px 8px', width: '100%' }}
            />
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '5px 9px', fontSize: '0.76rem', minHeight: 'auto' }}>
              OK
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditingBuffer(false)} style={{ padding: '5px 6px', fontSize: '0.76rem', minHeight: 'auto' }}>
              ×
            </button>
          </form>
        ) : (
          <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            {formatPeso(summary.resultBuffer)}
          </div>
        )}
        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Neto semana: {formatPeso(summary.weekNetBalance)}
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: '14px 16px',
          borderColor: isOverbought ? 'rgba(227, 6, 19, 0.35)' : isAvailable ? 'rgba(22, 163, 74, 0.3)' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Crédito cierre</span>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: '999px',
              backgroundColor: isOverbought ? '#fef2f2' : isAvailable ? '#f0fdf4' : '#f1f5f9',
              color: isOverbought ? '#E30613' : isAvailable ? '#15803d' : 'var(--text-secondary)',
            }}
          >
            {isOverbought ? 'Sobre-compra' : isAvailable ? 'Disponible' : 'Equilibrado'}
          </span>
        </div>
        <div
          className="tabular-nums"
          style={{
            fontSize: '1.35rem',
            fontWeight: 700,
            marginTop: '4px',
            color: isOverbought ? '#E30613' : isAvailable ? '#15803d' : 'var(--text-primary)',
          }}
        >
          {formatPeso(Math.abs(summary.closingCredit))}
        </div>
        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Fórmula: {formatPeso(summary.closingCredit)}
        </div>
      </div>
    </div>
  );
}
