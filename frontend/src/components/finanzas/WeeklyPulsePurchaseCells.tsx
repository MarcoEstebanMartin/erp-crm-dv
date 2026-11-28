import { useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  formatPeso,
  formatShortArDate,
  parseArIntegerInput,
  type WeeklyPulsePurchaseItem,
} from './weeklyPulseTypes';

const CELL_BORDER = '1px solid var(--border-color, #e5e7eb)';

interface WeeklyPulsePurchaseCellsProps {
  purchase?: WeeklyPulsePurchaseItem;
  saving: boolean;
  onUpdatePurchase: (id: string, patch: { date?: string; amount?: number }) => void;
  onRemovePurchase: (id: string) => void;
  onToggleExcludePurchase: (id: string) => void;
}

export function WeeklyPulsePurchaseCells({
  purchase: p,
  saving,
  onUpdatePurchase,
  onRemovePurchase,
  onToggleExcludePurchase,
}: WeeklyPulsePurchaseCellsProps) {
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountDraft, setAmountDraft] = useState('');

  if (!p) {
    return (
      <>
        <td style={{ padding: '6px 10px', borderRight: CELL_BORDER }} />
        <td style={{ padding: '6px 8px', borderRight: CELL_BORDER }} />
        <td style={{ padding: '6px 10px', borderRight: '2px solid #cbd5e1' }} />
      </>
    );
  }

  const isManual = p.source === 'MANUAL';
  const isExcluded = Boolean(p.excluded);
  const tooltip = p.invoiceNumber
    ? `Fact. ${p.invoiceNumber}${p.invoiceDate ? ` (${formatShortArDate(p.invoiceDate)})` : ''}`
    : undefined;

  const commitDate = (nextVal?: string) => {
    const target = (nextVal ?? dateDraft).trim();
    setEditingDate(false);
    if (!target || target === p.date) return;
    onUpdatePurchase(p.id, { date: target });
  };

  const commitAmount = () => {
    const parsed = parseArIntegerInput(amountDraft);
    setEditingAmount(false);
    if (parsed === null || parsed === Math.round(p.amount)) return;
    onUpdatePurchase(p.id, { amount: parsed });
  };

  return (
    <>
      <td
        title={tooltip}
        style={{
          padding: '6px 10px',
          borderRight: CELL_BORDER,
          opacity: isExcluded ? 0.4 : 1,
          textDecoration: isExcluded ? 'line-through' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
          <span style={{ fontWeight: 500 }}>{p.company}</span>
          {isManual ? (
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={`Eliminar ${p.company}`}
              disabled={saving}
              onClick={() => onRemovePurchase(p.id)}
              style={{ padding: '2px', minHeight: 'auto', color: 'var(--text-muted)' }}
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              aria-label={isExcluded ? `Incluir ${p.company}` : `Ocultar ${p.company}`}
              title={isExcluded ? 'Incluir' : 'Excluir esta semana'}
              disabled={saving}
              onClick={() => onToggleExcludePurchase(p.id)}
              style={{ padding: '2px', minHeight: 'auto', color: 'var(--text-muted)' }}
            >
              {isExcluded ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
            </button>
          )}
        </div>
      </td>

      <td
        className="tabular-nums"
        style={{
          padding: editingDate ? '3px 4px' : '6px 8px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          borderRight: CELL_BORDER,
          opacity: isExcluded ? 0.4 : 1,
        }}
      >
        {isManual && editingDate ? (
          <input
            type="date"
            aria-label={`Fecha de ${p.company}`}
            className="input"
            value={dateDraft}
            onChange={(e) => {
              setDateDraft(e.target.value);
              commitDate(e.target.value);
            }}
            onBlur={() => commitDate()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setEditingDate(false);
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitDate();
            }}
            autoFocus
            style={{ width: '104px', padding: '2px 4px', fontSize: '0.73rem' }}
          />
        ) : isManual ? (
          <button
            type="button"
            disabled={saving}
            title="Editar fecha"
            onClick={() => {
              setDateDraft(p.date);
              setEditingDate(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 2px',
              cursor: 'pointer',
              color: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
            }}
          >
            {formatShortArDate(p.date)}
          </button>
        ) : (
          formatShortArDate(p.date)
        )}
      </td>

      <td
        className="tabular-nums"
        style={{
          padding: editingAmount ? '3px 6px' : '6px 10px',
          textAlign: 'right',
          fontWeight: 500,
          borderRight: '2px solid #cbd5e1',
          opacity: isExcluded ? 0.4 : 1,
          textDecoration: isExcluded ? 'line-through' : 'none',
        }}
      >
        {isManual && editingAmount ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commitAmount();
            }}
            style={{ display: 'flex', justifyContent: 'flex-end' }}
          >
            <input
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              aria-label={`Importe de ${p.company}`}
              className="input tabular-nums"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              onBlur={commitAmount}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setEditingAmount(false);
              }}
              autoFocus
              style={{ width: '98px', padding: '2px 5px', fontSize: '0.8rem', textAlign: 'right' }}
            />
          </form>
        ) : isManual ? (
          <button
            type="button"
            disabled={saving}
            title="Editar importe"
            onClick={() => {
              setAmountDraft(p.amount === 0 ? '' : String(Math.round(p.amount)));
              setEditingAmount(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 'inherit',
              fontFamily: 'inherit',
              color: p.amount === 0 ? 'var(--text-muted, #94a3b8)' : 'var(--text-primary)',
            }}
          >
            {formatPeso(p.amount)}
          </button>
        ) : (
          formatPeso(p.amount)
        )}
      </td>
    </>
  );
}
