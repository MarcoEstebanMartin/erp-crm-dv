import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Trash2 } from 'lucide-react';
import {
  type ComparisonRow,
  type ExpenseCategory,
  type ExpensePeriod,
  formatDiffPeso,
  formatPeso,
  getShortMonthName,
  shiftMonth,
} from './gastos.types';
import { SheetAmountCell, guessCategoryId } from './GastosSheetCell';

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

const B = '1px solid #E5E7EB';
const thBase: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '0.76rem',
  fontWeight: 600,
  color: '#475569',
  borderBottom: B,
  borderRight: B,
};
const tdBase: React.CSSProperties = {
  height: '36px',
  borderBottom: B,
  borderRight: B,
  fontSize: '0.86rem',
};
const tfBase: React.CSSProperties = {
  padding: '10px 12px',
  borderTop: '2px solid #CBD5E1',
  borderRight: B,
  fontSize: '0.9rem',
};

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
  const [quickAmount, setQuickAmount] = useState('');
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const quickDescRef = useRef<HTMLInputElement | null>(null);
  const quickAmountRef = useRef<HTMLInputElement | null>(null);

  const compareOptions = useMemo(() => {
    const map = new Map<string, { year: number; month: number }>();
    const prev = shiftMonth(selectedYear, selectedMonth, -1);
    map.set(`${prev.year}-${prev.month}`, prev);
    map.set(`${compareYear}-${compareMonth}`, { year: compareYear, month: compareMonth });
    for (const p of periods) {
      if (p.year === selectedYear && p.month === selectedMonth) continue;
      map.set(`${p.year}-${p.month}`, { year: p.year, month: p.month });
    }
    return Array.from(map.values()).sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
  }, [periods, selectedYear, selectedMonth, compareYear, compareMonth]);

  const handleMoveRow = (nextIndex: number) => {
    if (nextIndex < 0) return;
    if (nextIndex < rows.length) inputRefs.current[nextIndex]?.focus();
    else quickDescRef.current?.focus();
  };

  const submitQuickAdd = async () => {
    const desc = quickDesc.trim();
    const amt = Number(quickAmount.replace(/[^\d]/g, ''));
    if (!desc || !amt || amt <= 0) return;
    const ok = await onQuickAddRow({
      description: desc,
      categoryId: guessCategoryId(desc, categories),
      amount: amt,
    });
    if (ok) {
      setQuickDesc('');
      setQuickAmount('');
      quickDescRef.current?.focus();
    }
  };

  return (
    <div style={{ border: B, borderRadius: '8px', backgroundColor: '#fff', overflow: 'hidden' }}>
      <div role="region" aria-label="Planilla de gastos" tabIndex={0} style={{ overflowY: 'auto', maxHeight: '72vh' }}>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
          <colgroup>
            <col />
            <col style={{ width: '150px' }} />
            <col style={{ width: '160px' }} />
            <col style={{ width: '112px' }} />
          </colgroup>

          <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: '#F8FAFC' }}>
            <tr>
              <th scope="col" style={{ ...thBase, textAlign: 'left', paddingLeft: '14px' }}>Concepto</th>
              <th scope="col" style={{ ...thBase, textAlign: 'right', padding: '5px 8px' }}>
                <select
                  aria-label="Mes comparado"
                  value={`${compareYear}-${compareMonth}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    onChangeComparePeriod(y, m);
                  }}
                  style={{ border: '1px solid #D1D5DB', borderRadius: '4px', backgroundColor: '#fff', padding: '2px 6px', fontSize: '0.76rem', fontWeight: 600, color: '#374151', cursor: 'pointer', maxWidth: '100%' }}
                >
                  {compareOptions.map((opt) => (
                    <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                      {getShortMonthName(opt.month)} {opt.year}
                    </option>
                  ))}
                </select>
              </th>
              <th scope="col" style={{ ...thBase, textAlign: 'right', fontWeight: 700, color: '#111827', backgroundColor: '#F1F5F9', paddingRight: '24px' }}>
                {getShortMonthName(selectedMonth)} {selectedYear}
              </th>
              <th scope="col" style={{ ...thBase, textAlign: 'right', borderRight: 'none' }}>Dif.</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row, idx) => {
              const diff = row.currentAmount !== null && row.compareAmount !== null ? row.currentAmount - row.compareAmount : null;
              const isPending = row.currentExpense === null;

              return (
                <tr key={row.rowKey}>
                  <td style={{ ...tdBase, padding: '0 8px 0 14px', color: isPending ? '#6B7280' : '#111827', fontWeight: isPending ? 400 : 500, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description}</span>
                        {row.currentExpense?.vehicle?.plate && (
                          <span
                            style={{
                              flexShrink: 0,
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: '#F3F4F6',
                              border: '1px solid #E5E7EB',
                              color: '#374151',
                            }}
                          >
                            {row.currentExpense.vehicle.plate}
                          </span>
                        )}
                      </div>
                      {isAdmin && row.currentExpense && (
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(row.currentExpense!.id)}
                          aria-label={`Eliminar ${row.description}`}
                          title="Eliminar"
                          style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '2px', display: 'inline-flex', flexShrink: 0 }}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="tabular-nums" style={{ ...tdBase, padding: '0 8px 0 10px', textAlign: 'right', color: '#6B7280', backgroundColor: '#FAFAFA' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <span>{row.compareAmount !== null ? formatPeso(row.compareAmount) : '—'}</span>
                      {isPending && row.compareAmount !== null && row.compareAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => onQuickCopyRow(row)}
                          disabled={savingRowKey === row.rowKey}
                          title={`Copiar ${formatPeso(row.compareAmount)}`}
                          aria-label={`Copiar ${row.description}`}
                          style={{ background: '#fff', border: '1px solid #D1D5DB', borderRadius: '4px', color: '#4B5563', cursor: 'pointer', padding: '2px 4px', display: 'inline-flex' }}
                        >
                          <ArrowRight size={11} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>

                  <td style={{ ...tdBase, padding: 0 }}>
                    <SheetAmountCell
                      row={row}
                      rowIndex={idx}
                      isSaving={savingRowKey === row.rowKey}
                      isSaved={savedRowKey === row.rowKey}
                      inputRef={(el) => { inputRefs.current[idx] = el; }}
                      onSave={onInlineSave}
                      onMoveRow={handleMoveRow}
                    />
                  </td>

                  <td
                    className="tabular-nums"
                    style={{
                      ...tdBase,
                      borderRight: 'none',
                      padding: '0 12px',
                      textAlign: 'right',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      color: diff === null || diff === 0 ? '#9CA3AF' : diff > 0 ? 'var(--color-corp-red)' : '#15803D',
                    }}
                  >
                    {diff !== null ? formatDiffPeso(diff) : '—'}
                  </td>
                </tr>
              );
            })}

            <tr style={{ backgroundColor: '#FDFDFD' }}>
              <td style={{ ...tdBase, padding: 0, height: '38px' }}>
                <input
                  ref={quickDescRef}
                  type="text"
                  value={quickDesc}
                  onChange={(e) => setQuickDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickDesc.trim()) {
                      e.preventDefault();
                      quickAmountRef.current?.focus();
                    }
                  }}
                  placeholder="+ Agregar concepto..."
                  aria-label="Nuevo concepto"
                  style={{ width: '100%', height: '100%', padding: '0 14px', border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '0.86rem', color: '#111827' }}
                />
              </td>
              <td style={{ ...tdBase, padding: '0 10px', textAlign: 'right', color: '#D1D5DB', backgroundColor: '#FAFAFA' }}>—</td>
              <td style={{ ...tdBase, padding: 0 }}>
                <input
                  ref={quickAmountRef}
                  type="text"
                  inputMode="numeric"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitQuickAdd();
                    }
                  }}
                  onBlur={() => {
                    if (quickDesc.trim() && quickAmount.trim()) submitQuickAdd();
                  }}
                  placeholder="Monto $"
                  aria-label="Monto del nuevo concepto"
                  disabled={savingRowKey === '__quick_add__'}
                  className="tabular-nums"
                  style={{ width: '100%', height: '100%', padding: '0 24px 0 10px', border: 'none', outline: 'none', textAlign: 'right', backgroundColor: 'transparent', fontSize: '0.86rem', color: '#111827' }}
                />
              </td>
              <td style={{ ...tdBase, borderRight: 'none', padding: '0 8px', textAlign: 'right' }}>
                {quickDesc.trim() && quickAmount.trim() && (
                  <button
                    type="button"
                    onClick={submitQuickAdd}
                    disabled={savingRowKey === '__quick_add__'}
                    style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Guardar
                  </button>
                )}
              </td>
            </tr>
          </tbody>

          <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2, backgroundColor: '#F8FAFC' }}>
            <tr>
              <th scope="row" style={{ ...tfBase, textAlign: 'left', paddingLeft: '14px', fontWeight: 700 }}>Total</th>
              <td className="tabular-nums" style={{ ...tfBase, textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                {formatPeso(totalCompare)}
              </td>
              <td className="tabular-nums" style={{ ...tfBase, textAlign: 'right', paddingRight: '24px', fontWeight: 700, fontSize: '0.94rem', color: '#111827', backgroundColor: '#FEF9C3' }}>
                {formatPeso(totalCurrent)}
              </td>
              <td
                className="tabular-nums"
                style={{
                  ...tfBase,
                  borderRight: 'none',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  color: totalDiff === 0 ? '#9CA3AF' : totalDiff > 0 ? 'var(--color-corp-red)' : '#15803D',
                }}
              >
                {formatDiffPeso(totalDiff)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
