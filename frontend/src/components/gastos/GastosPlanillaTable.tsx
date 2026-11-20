import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  type ComparisonRow,
  type ExpenseCategory,
  type ExpensePeriod,
  formatDiffPeso,
  formatPeso,
  getShortMonthName,
  shiftMonth,
} from './gastos.types';

interface GastosPlanillaTableProps {
  rows: ComparisonRow[];
  categories: ExpenseCategory[];
  periods: ExpensePeriod[];
  selectedYear: number;
  selectedMonth: number;
  compareYear: number;
  compareMonth: number;
  onChangeComparePeriod: (year: number, month: number) => void;
  totalCurrent: number;
  totalCompare: number;
  totalDiff: number;
  savingRowKey: string | null;
  savedRowKey: string | null;
  isAdmin: boolean;
  onInlineSave: (row: ComparisonRow, newAmount: number) => Promise<void>;
  onQuickCopyRow: (row: ComparisonRow) => Promise<void>;
  onQuickAddRow: (params: { description: string; categoryId: number; amount: number }) => Promise<boolean | void>;
  onDeleteExpense: (id: number) => void;
}

function InlineAmountCell({
  row,
  isSaving,
  isSaved,
  onSave,
  onQuickCopy,
}: {
  row: ComparisonRow;
  isSaving: boolean;
  isSaved: boolean;
  onSave: (row: ComparisonRow, amount: number) => Promise<void>;
  onQuickCopy: (row: ComparisonRow) => Promise<void>;
}) {
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
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraft(row.currentAmount !== null ? String(row.currentAmount) : '');
      setEditing(false);
      e.currentTarget.blur();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
      {!row.currentExpense && row.compareAmount !== null && row.compareAmount > 0 && !editing && (
        <button
          type="button"
          onClick={() => onQuickCopy(row)}
          disabled={isSaving}
          title={`Copiar ${formatPeso(row.compareAmount)}`}
          aria-label={`Copiar importe de ${row.description}`}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '3px 6px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.72rem',
          }}
        >
          <ArrowRight size={12} aria-hidden="true" />
        </button>
      )}

      <div style={{ position: 'relative', width: '132px' }}>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Monto de ${row.description}`}
          value={editing ? draft : row.currentAmount !== null ? formatPeso(row.currentAmount) : ''}
          placeholder="—"
          disabled={isSaving}
          onFocus={() => {
            setEditing(true);
            setDraft(row.currentAmount !== null ? String(row.currentAmount) : '');
          }}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="tabular-nums"
          style={{
            width: '100%',
            textAlign: 'right',
            padding: '5px 8px',
            borderRadius: '6px',
            border: editing ? '1px solid #111827' : '1px solid transparent',
            backgroundColor: editing ? '#fff' : row.currentAmount === null ? '#F9FAFB' : 'transparent',
            fontWeight: row.currentAmount !== null ? 600 : 400,
            fontSize: '0.9rem',
            color: row.currentAmount !== null ? 'var(--text-primary)' : 'var(--text-muted)',
            outline: 'none',
            transition: 'border-color 0.15s, background-color 0.15s',
          }}
        />
      </div>

      <span style={{ width: '16px', display: 'inline-flex', justifyContent: 'center' }}>
        {isSaving && <Loader2 size={13} className="spin" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />}
        {!isSaving && isSaved && <Check size={14} style={{ color: '#16A34A' }} aria-label="Guardado" />}
      </span>
    </div>
  );
}

export function GastosPlanillaTable({
  rows,
  categories,
  periods,
  selectedYear,
  selectedMonth,
  compareYear,
  compareMonth,
  onChangeComparePeriod,
  totalCurrent,
  totalCompare,
  totalDiff,
  savingRowKey,
  savedRowKey,
  isAdmin,
  onInlineSave,
  onQuickCopyRow,
  onQuickAddRow,
  onDeleteExpense,
}: GastosPlanillaTableProps) {
  const [quickDesc, setQuickDesc] = useState('');
  const [quickCatId, setQuickCatId] = useState<string>('');
  const [quickAmount, setQuickAmount] = useState('');

  useEffect(() => {
    if (!quickCatId && categories.length > 0) {
      const otros = categories.find((c) => c.name.toLowerCase().includes('otros'));
      setQuickCatId(String(otros ? otros.id : categories[0].id));
    }
  }, [categories, quickCatId]);

  const compareOptions = useMemo(() => {
    const map = new Map<string, { year: number; month: number; count: number }>();
    const prev = shiftMonth(selectedYear, selectedMonth, -1);
    map.set(`${prev.year}-${prev.month}`, { year: prev.year, month: prev.month, count: 0 });
    map.set(`${compareYear}-${compareMonth}`, { year: compareYear, month: compareMonth, count: 0 });
    for (const p of periods) {
      if (p.year === selectedYear && p.month === selectedMonth) continue;
      map.set(`${p.year}-${p.month}`, { year: p.year, month: p.month, count: p.count });
    }
    return Array.from(map.values()).sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
  }, [periods, selectedYear, selectedMonth, compareYear, compareMonth]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(quickAmount.replace(/[^\d]/g, ''));
    const ok = await onQuickAddRow({
      description: quickDesc,
      categoryId: Number(quickCatId),
      amount: num,
    });
    if (ok) {
      setQuickDesc('');
      setQuickAmount('');
    }
  };

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label="Planilla comparativa de gastos"
        tabIndex={0}
        style={{ marginTop: 0, maxHeight: '62vh' }}
      >
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left', paddingLeft: '20px' }}>Concepto</th>
              <th scope="col" style={{ textAlign: 'right', width: '190px' }}>
                <select
                  aria-label="Mes de comparación"
                  value={`${compareYear}-${compareMonth}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    onChangeComparePeriod(y, m);
                  }}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '5px',
                    backgroundColor: '#fff',
                    padding: '3px 8px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {compareOptions.map((opt) => (
                    <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                      {getShortMonthName(opt.month)} {opt.year}{opt.count > 0 ? ` (${opt.count})` : ''}
                    </option>
                  ))}
                </select>
              </th>
              <th scope="col" style={{ textAlign: 'right', width: '210px', paddingRight: '26px' }}>
                {getShortMonthName(selectedMonth)} {selectedYear}
              </th>
              <th scope="col" style={{ textAlign: 'right', width: '130px' }}>Diferencia</th>
              <th scope="col" style={{ width: '48px' }} aria-label="Acciones" />
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const diff =
                row.currentAmount !== null && row.compareAmount !== null
                  ? row.currentAmount - row.compareAmount
                  : null;
              const isPending = row.currentExpense === null;

              return (
                <tr
                  key={row.rowKey}
                  style={{
                    backgroundColor: isPending ? '#FAFAFA' : undefined,
                  }}
                >
                  <td style={{ paddingLeft: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: isPending ? 400 : 500, color: isPending ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {row.description}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          backgroundColor: '#F3F4F6',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {row.categoryName}
                      </span>
                    </div>
                  </td>

                  <td
                    className="tabular-nums"
                    style={{
                      textAlign: 'right',
                      color: 'var(--text-secondary)',
                      fontSize: '0.88rem',
                    }}
                  >
                    {row.compareAmount !== null ? formatPeso(row.compareAmount) : '—'}
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <InlineAmountCell
                      row={row}
                      isSaving={savingRowKey === row.rowKey}
                      isSaved={savedRowKey === row.rowKey}
                      onSave={onInlineSave}
                      onQuickCopy={onQuickCopyRow}
                    />
                  </td>

                  <td
                    className="tabular-nums"
                    style={{
                      textAlign: 'right',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      color:
                        diff === null || diff === 0
                          ? 'var(--text-muted)'
                          : diff > 0
                            ? 'var(--color-corp-red)'
                            : '#15803D',
                    }}
                  >
                    {diff !== null ? formatDiffPeso(diff) : '—'}
                  </td>

                  <td style={{ textAlign: 'center' }}>
                    {isAdmin && row.currentExpense && (
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(row.currentExpense!.id)}
                        aria-label={`Eliminar ${row.description}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                        }}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Sin gastos en este período
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr style={{ backgroundColor: '#F9FAFB', borderTop: '1px solid var(--border-color)' }}>
              <th scope="row" style={{ textAlign: 'left', paddingLeft: '20px', fontWeight: 700, fontSize: '0.92rem' }}>
                Total
              </th>
              <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                {formatPeso(totalCompare)}
              </td>
              <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, paddingRight: '26px', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                {formatPeso(totalCurrent)}
              </td>
              <td
                className="tabular-nums"
                style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: totalDiff === 0 ? 'var(--text-muted)' : totalDiff > 0 ? 'var(--color-corp-red)' : '#15803D',
                }}
              >
                {formatDiffPeso(totalDiff)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <form
        onSubmit={handleAddSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#fff',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          value={quickDesc}
          onChange={(e) => setQuickDesc(e.target.value)}
          placeholder="Nuevo concepto (ej. Luz, Flete, Papelería)..."
          aria-label="Nuevo concepto de gasto"
          className="input"
          style={{ flex: '2 1 200px', height: '34px', fontSize: '0.86rem' }}
        />

        <select
          value={quickCatId}
          onChange={(e) => setQuickCatId(e.target.value)}
          aria-label="Categoría del nuevo gasto"
          className="select"
          style={{ flex: '1 1 150px', height: '34px', fontSize: '0.84rem' }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <input
          type="text"
          inputMode="numeric"
          value={quickAmount}
          onChange={(e) => setQuickAmount(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Monto $"
          aria-label="Monto del nuevo gasto"
          className="input tabular-nums"
          style={{ width: '130px', height: '34px', textAlign: 'right', fontSize: '0.86rem' }}
        />

        <button
          type="submit"
          className="btn btn-primary"
          disabled={savingRowKey === '__quick_add__'}
          style={{ height: '34px', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
        >
          <Plus size={14} aria-hidden="true" />
          <span>Agregar</span>
        </button>
      </form>
    </div>
  );
}
