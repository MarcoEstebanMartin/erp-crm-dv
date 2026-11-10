import {
  type AuditTarget,
  type DeclaredCheckItem,
  formatCurrency,
  getDetectedRoutesAndCities
} from './types';
import DeclaredChecksWidget from './DeclaredChecksWidget';

interface AuditLeftPanelProps {
  auditTarget: AuditTarget;
  realCash: string;
  onRealCashChange: (val: string) => void;
  realChecks: string;
  onRealChecksChange: (val: string) => void;
  declaredChecksList: DeclaredCheckItem[];
  newCheckNumber: string;
  onNewCheckNumberChange: (val: string) => void;
  newCheckBank: string;
  onNewCheckBankChange: (val: string) => void;
  newCheckAmount: string;
  onNewCheckAmountChange: (val: string) => void;
  onAddCheck: () => void;
  onRemoveCheck: (index: number) => void;
  auditRouteNote: string;
  onAuditRouteNoteChange: (val: string) => void;
  auditNotes: string;
  onAuditNotesChange: (val: string) => void;
}

export default function AuditLeftPanel({
  auditTarget,
  realCash,
  onRealCashChange,
  realChecks,
  onRealChecksChange,
  declaredChecksList,
  newCheckNumber,
  onNewCheckNumberChange,
  newCheckBank,
  onNewCheckBankChange,
  newCheckAmount,
  onNewCheckAmountChange,
  onAddCheck,
  onRemoveCheck,
  auditRouteNote,
  onAuditRouteNoteChange,
  auditNotes,
  onAuditNotesChange
}: AuditLeftPanelProps) {
  const expectedCash = Number(auditTarget.data.totalCash || 0);
  const expectedChecks = Number(auditTarget.data.totalChecks || 0);
  const totalExpected = expectedCash + expectedChecks;

  const inputCash = Number(realCash) || 0;
  const inputChecks = Number(realChecks) || 0;
  const totalInput = inputCash + inputChecks;

  const diffCash = inputCash - expectedCash;
  const diffChecks = inputChecks - expectedChecks;
  const totalDiff = totalInput - totalExpected;

  const detected = getDetectedRoutesAndCities(auditTarget.data?.transactions || []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '6px' }}>
      {/* 1. Sistema (Teórico Esperado) */}
      <div className="card" style={{ padding: '14px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          1. Sistema (Teórico Esperado)
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Efectivo en Sistema:</span>
            <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(expectedCash)}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Cheques en Sistema:</span>
            <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(expectedChecks)}</strong>
          </div>

          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sucursal A (Oficial):</span>
            <span style={{ fontWeight: 500 }}>{formatCurrency(auditTarget.data.totalBranchA)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sucursal X (Interna):</span>
            <span style={{ fontWeight: 500 }}>{formatCurrency(auditTarget.data.totalBranchX)}</span>
          </div>

          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.98rem', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-primary)' }}>Total Esperado:</span>
            <span style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{formatCurrency(totalExpected)}</span>
          </div>
        </div>
      </div>

      {/* 2. Conteo Físico Recibido */}
      <div className="card" style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            2. Conteo Físico Recibido
          </h4>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              onRealCashChange(String(expectedCash));
              onRealChecksChange(String(expectedChecks));
            }}
            style={{ fontSize: '0.75rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
            title="Auto-completar los casilleros con los montos esperados si coinciden sin diferencia"
          >
            ⚡ Sin Diferencia (Copiar)
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Efectivo Declarado ($)
          </label>
          <input
            type="number"
            className="input"
            placeholder="0.00"
            required
            min="0"
            step="0.01"
            autoFocus
            value={realCash}
            onChange={(e) => onRealCashChange(e.target.value)}
            style={{ fontSize: '1.1rem', fontFamily: 'monospace', width: '100%', padding: '6px 10px' }}
          />
        </div>

        <DeclaredChecksWidget
          realChecks={realChecks}
          onRealChecksChange={onRealChecksChange}
          declaredChecksList={declaredChecksList}
          newCheckNumber={newCheckNumber}
          onNewCheckNumberChange={onNewCheckNumberChange}
          newCheckBank={newCheckBank}
          onNewCheckBankChange={onNewCheckBankChange}
          newCheckAmount={newCheckAmount}
          onNewCheckAmountChange={onNewCheckAmountChange}
          onAddCheck={onAddCheck}
          onRemoveCheck={onRemoveCheck}
        />

        <div className="form-group" style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Pueblo / Ruta de Cobro (Identificación)
          </label>
          <input
            type="text"
            className="input"
            placeholder="Ej: General Villegas, Bunge, Ruta 33..."
            value={auditRouteNote}
            onChange={(e) => onAuditRouteNoteChange(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
          />
          {detected.list.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>📍 Detectado:</span>
              {detected.list.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onAuditRouteNoteChange(item.name)}
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: auditRouteNote === item.name ? '#e0f2fe' : '#f1f5f9',
                    border: auditRouteNote === item.name ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    color: auditRouteNote === item.name ? '#0369a1' : '#334155',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {item.name} ({item.count})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginBottom: '0px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
            Observaciones del Arqueo
          </label>
          <input
            type="text"
            className="input"
            placeholder="Ej: Diferencia justificada por vueltos..."
            value={auditNotes}
            onChange={(e) => onAuditNotesChange(e.target.value)}
            style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
          />
        </div>
      </div>

      {/* Widget de Conciliación y Diferencias en tiempo real */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: totalDiff === 0 ? '#f0fdf4' : totalDiff > 0 ? '#f0fdfa' : '#fef2f2',
          border: totalDiff === 0 ? '1px solid #bbf7d0' : totalDiff > 0 ? '1px solid #99f6e4' : '1px solid #fecaca',
          color: totalDiff === 0 ? '#166534' : totalDiff > 0 ? '#0f766e' : '#991b1b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <h4 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 700 }}>
            {totalDiff === 0 ? 'Caja Conciliada (Cuadrado)' : totalDiff > 0 ? 'Sobrante Detectado' : 'Faltante de Caja'}
          </h4>
          <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.9 }}>
            Efectivo: {diffCash >= 0 ? '+' : ''}
            {formatCurrency(diffCash)} | Cheques: {diffChecks >= 0 ? '+' : ''}
            {formatCurrency(diffChecks)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>Diferencia Total</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace' }}>
            {totalDiff > 0 ? '+' : ''}
            {formatCurrency(totalDiff)}
          </div>
        </div>
      </div>
    </div>
  );
}
