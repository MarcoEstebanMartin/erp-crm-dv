import { X } from 'lucide-react';
import type { DeclaredCheckItem } from './types';

interface DeclaredChecksWidgetProps {
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
}

export default function DeclaredChecksWidget({
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
}: DeclaredChecksWidgetProps) {
  return (
    <div className="form-group" style={{ marginBottom: '12px' }}>
      <label htmlFor="audit-real-checks" style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
        Cheques Declarados ($)
      </label>
      <input
        id="audit-real-checks"
        type="number"
        className="input tabular-nums"
        placeholder="0.00"
        min="0"
        step="0.01"
        value={realChecks}
        onChange={(e) => onRealChecksChange(e.target.value)}
        style={{ fontSize: '1.1rem', fontFamily: 'monospace', marginBottom: '6px', padding: '6px 10px' }}
      />

      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', marginTop: '6px' }}>
        <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
          Desglose de Cheques
        </div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
          <input
            type="text"
            aria-label="Número de cheque"
            className="input"
            placeholder="N° Cheque"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={newCheckNumber}
            onChange={(e) => onNewCheckNumberChange(e.target.value)}
            style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}
          />
          <input
            type="text"
            aria-label="Banco del cheque"
            className="input"
            placeholder="Banco"
            value={newCheckBank}
            onChange={(e) => onNewCheckBankChange(e.target.value)}
            style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="number"
            aria-label="Monto del cheque"
            className="input tabular-nums"
            placeholder="Monto $"
            value={newCheckAmount}
            onChange={(e) => onNewCheckAmountChange(e.target.value)}
            style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onAddCheck}
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
          >
            + Añadir
          </button>
        </div>

        {declaredChecksList.length > 0 && (
          <div style={{ marginTop: '6px', maxHeight: '90px', overflowY: 'auto' }}>
            <table style={{ fontSize: '0.73rem' }}>
              <tbody>
                {declaredChecksList.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '2px 0' }}>
                      <strong>N° {c.number}</strong> ({c.bank})
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>${c.amount.toLocaleString('es-AR')}</td>
                    <td style={{ width: '24px', textAlign: 'right', padding: '2px 0' }}>
                      <button
                        type="button"
                        aria-label="Quitar cheque"
                        onClick={() => onRemoveCheck(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
