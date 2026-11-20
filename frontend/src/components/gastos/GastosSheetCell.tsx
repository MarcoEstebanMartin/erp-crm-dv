import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { type ComparisonRow, type ExpenseCategory, formatPeso } from './gastos.types';

export function guessCategoryId(description: string, categories: ExpenseCategory[]): number {
  const lower = description.toLowerCase();
  const findBy = (kw: string) => categories.find((c) => c.name.toLowerCase().includes(kw))?.id;
  if (lower.includes('sueldo')) return findBy('sueldo') ?? categories[0]?.id ?? 0;
  if (lower.includes('patronal')) return findBy('patronal') ?? categories[0]?.id ?? 0;
  if (lower.includes('luz') || lower.includes('gas') || lower.includes('claro') || lower.includes('flow') || lower.includes('internet')) {
    return findBy('servicio') ?? categories[0]?.id ?? 0;
  }
  if (lower.includes('combustible') || lower.includes('nafta') || lower.includes('gasoil')) {
    return findBy('combustible') ?? categories[0]?.id ?? 0;
  }
  if (lower.includes('seguro') || lower.includes('seg.')) return findBy('seguro') ?? categories[0]?.id ?? 0;
  if (lower.includes('mantenimiento') || lower.includes('arreglo')) return findBy('mantenimiento') ?? categories[0]?.id ?? 0;
  if (lower.includes('banco') || lower.includes('bancario')) return findBy('bancario') ?? categories[0]?.id ?? 0;
  if (lower.includes('contador') || lower.includes('iduo')) return findBy('profesional') ?? categories[0]?.id ?? 0;
  if (lower.includes('facebook') || lower.includes('radio') || lower.includes('publicidad')) {
    return findBy('publicidad') ?? categories[0]?.id ?? 0;
  }
  if (lower.includes('iva') || lower.includes('arba') || lower.includes('patente') || lower.includes('ganancia') || lower.includes('brutos') || lower.includes('personales')) {
    return findBy('impuesto') ?? categories[0]?.id ?? 0;
  }
  return findBy('otros') ?? categories[0]?.id ?? 0;
}

interface SheetAmountCellProps {
  row: ComparisonRow;
  rowIndex: number;
  isSaving: boolean;
  isSaved: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onSave: (row: ComparisonRow, amount: number) => Promise<void>;
  onMoveRow: (nextIndex: number) => void;
}

export function SheetAmountCell({
  row,
  rowIndex,
  isSaving,
  isSaved,
  inputRef,
  onSave,
  onMoveRow,
}: SheetAmountCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.currentAmount !== null ? String(row.currentAmount) : '');

  useEffect(() => {
    if (!editing) {
      setDraft(row.currentAmount !== null ? String(row.currentAmount) : '');
    }
  }, [row.currentAmount, editing]);

  const commit = async () => {
    setEditing(false);
    const cleaned = draft.replace(/[^\d]/g, '');
    if (!cleaned) {
      setDraft(row.currentAmount !== null ? String(row.currentAmount) : '');
      return;
    }
    const num = Number(cleaned);
    if (num > 0 && num !== row.currentAmount) {
      await onSave(row, num);
    } else {
      setDraft(row.currentAmount !== null ? String(row.currentAmount) : '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.currentTarget.blur();
      onMoveRow(rowIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.currentTarget.blur();
      onMoveRow(rowIndex - 1);
    } else if (e.key === 'Escape') {
      setDraft(row.currentAmount !== null ? String(row.currentAmount) : '');
      setEditing(false);
      e.currentTarget.blur();
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        aria-label={`${row.description} monto actual`}
        value={editing ? draft : row.currentAmount !== null ? formatPeso(row.currentAmount) : ''}
        placeholder="—"
        disabled={isSaving}
        onFocus={(e) => {
          setEditing(true);
          setDraft(row.currentAmount !== null ? String(row.currentAmount) : '');
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="tabular-nums"
        style={{
          width: '100%',
          height: '36px',
          padding: '0 24px 0 10px',
          textAlign: 'right',
          border: 'none',
          outline: editing ? '2px solid #2563EB' : 'none',
          outlineOffset: '-2px',
          backgroundColor: editing ? '#EFF6FF' : 'transparent',
          fontWeight: row.currentAmount !== null ? 600 : 400,
          fontSize: '0.88rem',
          color: row.currentAmount !== null ? '#111827' : '#9CA3AF',
        }}
      />
      <span style={{ position: 'absolute', right: '6px', pointerEvents: 'none', display: 'inline-flex' }}>
        {isSaving && <Loader2 size={12} className="spin" style={{ color: '#6B7280' }} aria-hidden="true" />}
        {!isSaving && isSaved && <Check size={13} style={{ color: '#16A34A' }} aria-label="Guardado" />}
      </span>
    </div>
  );
}
