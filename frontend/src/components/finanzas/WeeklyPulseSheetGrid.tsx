import { useState } from 'react';
import { Eye, EyeOff, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  formatPeso,
  formatShortArDate,
  type WeeklyPulseData,
} from './weeklyPulseTypes';

const CELL_BORDER = '1px solid var(--border-color, #e5e7eb)';
const HEADER_BG = '#f8fafc';

interface WeeklyPulseSheetGridProps {
  data: WeeklyPulseData;
  saving: boolean;
  onSaveCredit: (value: number | null) => void;
  onSaveBuffer: (value: number) => void;
  onAddPurchase: (item: { company: string; date: string; amount: number }) => void;
  onRemovePurchase: (id: string) => void;
  onToggleExcludePurchase: (id: string) => void;
  onAddSale: (item: { locality: string; date: string; amountA: number; amountX: number }) => void;
  onRemoveSale: (id: string) => void;
}

export function WeeklyPulseSheetGrid({
  data,
  saving,
  onSaveCredit,
  onSaveBuffer,
  onAddPurchase,
  onRemovePurchase,
  onToggleExcludePurchase,
  onAddSale,
  onRemoveSale,
}: WeeklyPulseSheetGridProps) {
  const { summary } = data;
  const [editingCredit, setEditingCredit] = useState(false);
  const [creditDraft, setCreditDraft] = useState('');
  const [editingBuffer, setEditingBuffer] = useState(false);
  const [bufferDraft, setBufferDraft] = useState('');

  const [addingPurchase, setAddingPurchase] = useState(false);
  const [pCompany, setPCompany] = useState('');
  const [pDate, setPDate] = useState(data.weekStart);
  const [pAmount, setPAmount] = useState('');

  const [addingSale, setAddingSale] = useState(false);
  const [sLocality, setSLocality] = useState('');
  const [sAmountA, setSAmountA] = useState('');
  const [sAmountX, setSAmountX] = useState('');

  const commitCredit = () => {
    const num = Number(creditDraft.replace(/\./g, '').replace(',', '.'));
    setEditingCredit(false);
    if (!Number.isFinite(num) || Math.round(num) === Math.round(summary.openingCredit)) return;
    onSaveCredit(Math.round(num));
  };

  const commitBuffer = () => {
    const num = Number(bufferDraft.replace(/\./g, '').replace(',', '.'));
    setEditingBuffer(false);
    if (!Number.isFinite(num) || num < 0 || Math.round(num) === Math.round(summary.resultBuffer)) return;
    onSaveBuffer(Math.round(num));
  };

  const submitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(pAmount.replace(/\./g, '').replace(',', '.'));
    if (!pCompany.trim() || !Number.isFinite(num) || num === 0) return;
    onAddPurchase({ company: pCompany.trim().toUpperCase(), date: pDate || data.weekStart, amount: Math.round(num) });
    setAddingPurchase(false);
    setPCompany('');
    setPAmount('');
  };

  const submitSale = (e: React.FormEvent) => {
    e.preventDefault();
    const a = sAmountA ? Number(sAmountA.replace(/\./g, '').replace(',', '.')) : 0;
    const x = sAmountX ? Number(sAmountX.replace(/\./g, '').replace(',', '.')) : 0;
    if (!sLocality.trim() || !Number.isFinite(a) || !Number.isFinite(x) || (a === 0 && x === 0)) return;
    onAddSale({ locality: sLocality.trim().toUpperCase(), date: data.weekStart, amountA: Math.round(a), amountX: Math.round(x) });
    setAddingSale(false);
    setSLocality('');
    setSAmountA('');
    setSAmountX('');
  };

  const maxBodyRows = Math.max(data.purchases.length, data.sales.length, 1);

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Planilla semanal de compras y ventas"
      style={{ backgroundColor: '#fff', border: CELL_BORDER, borderRadius: '8px', overflowX: 'auto' }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '880px' }}>
        <thead>
          <tr style={{ backgroundColor: HEADER_BG, borderBottom: CELL_BORDER }}>
            <th colSpan={3} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.02em', borderRight: '2px solid #cbd5e1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span>COMPRA SEMANAL</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={saving}
                  onClick={() => { setPDate(data.weekStart); setAddingPurchase((v) => !v); }}
                  style={{ padding: '2px 6px', fontSize: '0.73rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  <Plus size={12} aria-hidden="true" />
                  Gasto / Compra
                </button>
              </div>
            </th>
            <th colSpan={5} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.02em' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span>VENTA SEMANAL</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={saving}
                  onClick={() => setAddingSale((v) => !v)}
                  style={{ padding: '2px 6px', fontSize: '0.73rem', minHeight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  <Plus size={12} aria-hidden="true" />
                  Ajuste
                </button>
              </div>
            </th>
          </tr>
          <tr style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #cbd5e1', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
            <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderRight: CELL_BORDER }}>EMPRESAS</th>
            <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600, width: '68px', borderRight: CELL_BORDER }}>FECHA</th>
            <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, width: '130px', borderRight: '2px solid #cbd5e1' }}>$</th>
            <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderRight: CELL_BORDER }}>LOCALIDADES</th>
            <th style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600, width: '68px', borderRight: CELL_BORDER }}>FECHA</th>
            <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, width: '120px', borderRight: CELL_BORDER }}>IMPORTE A</th>
            <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, width: '120px', borderRight: CELL_BORDER }}>IMPORTE X</th>
            <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, width: '125px' }}>TOTAL</th>
          </tr>
        </thead>

        <tbody>
          {(addingPurchase || addingSale) && (
            <tr style={{ backgroundColor: HEADER_BG, borderBottom: CELL_BORDER }}>
              {addingPurchase ? (
                <td colSpan={3} style={{ padding: '6px 8px', borderRight: '2px solid #cbd5e1' }}>
                  <form onSubmit={submitPurchase} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input type="text" className="input" placeholder="Ej. COMISION M.PAGO" value={pCompany} onChange={(e) => setPCompany(e.target.value)} autoFocus style={{ fontSize: '0.78rem', padding: '4px 6px', flex: 1 }} />
                    <input type="date" className="input" value={pDate} onChange={(e) => setPDate(e.target.value)} style={{ fontSize: '0.74rem', padding: '4px', width: '110px' }} />
                    <input type="number" step="1" className="input tabular-nums" placeholder="$" value={pAmount} onChange={(e) => setPAmount(e.target.value)} style={{ fontSize: '0.78rem', padding: '4px 6px', width: '95px', textAlign: 'right' }} />
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '4px 8px', fontSize: '0.74rem', minHeight: 'auto' }}>OK</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setAddingPurchase(false)} style={{ padding: '4px 6px', fontSize: '0.74rem', minHeight: 'auto' }}>×</button>
                  </form>
                </td>
              ) : <td colSpan={3} style={{ borderRight: '2px solid #cbd5e1' }} />}

              {addingSale ? (
                <td colSpan={5} style={{ padding: '6px 8px' }}>
                  <form onSubmit={submitSale} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input type="text" className="input" placeholder="Localidad" value={sLocality} onChange={(e) => setSLocality(e.target.value)} autoFocus style={{ fontSize: '0.78rem', padding: '4px 6px', flex: 1 }} />
                    <input type="number" step="1" className="input tabular-nums" placeholder="Importe A" value={sAmountA} onChange={(e) => setSAmountA(e.target.value)} style={{ fontSize: '0.78rem', padding: '4px 6px', width: '95px', textAlign: 'right' }} />
                    <input type="number" step="1" className="input tabular-nums" placeholder="Importe X" value={sAmountX} onChange={(e) => setSAmountX(e.target.value)} style={{ fontSize: '0.78rem', padding: '4px 6px', width: '95px', textAlign: 'right' }} />
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '4px 8px', fontSize: '0.74rem', minHeight: 'auto' }}>OK</button>
                    <button type="button" className="btn btn-ghost" onClick={() => setAddingSale(false)} style={{ padding: '4px 6px', fontSize: '0.74rem', minHeight: 'auto' }}>×</button>
                  </form>
                </td>
              ) : <td colSpan={5} />}
            </tr>
          )}

          {Array.from({ length: maxBodyRows }).map((_, idx) => {
            const p = data.purchases[idx];
            const s = data.sales[idx];
            const pExcluded = Boolean(p?.excluded);
            const pTooltip = p?.invoiceNumber
              ? `Fact. ${p.invoiceNumber}${p.invoiceDate ? ` (${formatShortArDate(p.invoiceDate)})` : ''}`
              : undefined;

            return (
              <tr key={idx} style={{ borderBottom: CELL_BORDER }}>
                <td title={pTooltip} style={{ padding: '6px 10px', borderRight: CELL_BORDER, opacity: pExcluded ? 0.4 : 1, textDecoration: pExcluded ? 'line-through' : 'none' }}>
                  {p ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontWeight: 500 }}>{p.company}</span>
                      {p.source === 'MANUAL' ? (
                        <button type="button" className="btn btn-ghost" aria-label={`Eliminar ${p.company}`} disabled={saving} onClick={() => onRemovePurchase(p.id)} style={{ padding: '2px', minHeight: 'auto', color: 'var(--text-muted)' }}>
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      ) : (
                        <button type="button" className="btn btn-ghost" aria-label={pExcluded ? `Incluir ${p.company}` : `Ocultar ${p.company}`} title={pExcluded ? 'Incluir' : 'Excluir esta semana'} disabled={saving} onClick={() => onToggleExcludePurchase(p.id)} style={{ padding: '2px', minHeight: 'auto', color: 'var(--text-muted)' }}>
                          {pExcluded ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
                        </button>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className="tabular-nums" style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary)', borderRight: CELL_BORDER, opacity: pExcluded ? 0.4 : 1 }}>
                  {p ? formatShortArDate(p.date) : ''}
                </td>
                <td className="tabular-nums" style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500, borderRight: '2px solid #cbd5e1', opacity: pExcluded ? 0.4 : 1, textDecoration: pExcluded ? 'line-through' : 'none' }}>
                  {p ? formatPeso(p.amount) : ''}
                </td>

                <td style={{ padding: '6px 10px', borderRight: CELL_BORDER }}>
                  {s ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontWeight: 500 }}>{s.locality}</span>
                      {s.source === 'MANUAL' && (
                        <button type="button" className="btn btn-ghost" aria-label={`Eliminar ${s.locality}`} disabled={saving} onClick={() => onRemoveSale(s.id)} style={{ padding: '2px', minHeight: 'auto', color: 'var(--text-muted)' }}>
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className="tabular-nums" style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-secondary)', borderRight: CELL_BORDER }}>
                  {s ? formatShortArDate(s.date) : ''}
                </td>
                <td className="tabular-nums" style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', borderRight: CELL_BORDER }}>
                  {s && s.amountA !== 0 ? formatPeso(s.amountA) : ''}
                </td>
                <td className="tabular-nums" style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)', borderRight: CELL_BORDER }}>
                  {s && s.amountX !== 0 ? formatPeso(s.amountX) : ''}
                </td>
                <td className="tabular-nums" style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                  {s ? formatPeso(s.total) : ''}
                </td>
              </tr>
            );
          })}

          <tr style={{ borderTop: '1px solid #cbd5e1', borderBottom: CELL_BORDER }}>
            <td style={{ padding: '7px 10px', fontWeight: 600, borderRight: CELL_BORDER }}>
              <span>CRÉDITO</span>
              {data.isManualOpeningCredit && (
                <button type="button" className="btn btn-ghost" title="Volver a arrastre automático" onClick={() => onSaveCredit(null)} style={{ padding: '2px 4px', marginLeft: '6px', minHeight: 'auto', color: 'var(--text-muted)' }}>
                  <RotateCcw size={11} aria-hidden="true" />
                </button>
              )}
            </td>
            <td className="tabular-nums" style={{ padding: '7px 8px', textAlign: 'center', color: 'var(--text-secondary)', borderRight: CELL_BORDER }}>
              {formatShortArDate(data.weekStart)}
            </td>
            <td className="tabular-nums" style={{ padding: '5px 10px', textAlign: 'right', borderRight: '2px solid #cbd5e1' }}>
              {editingCredit ? (
                <form onSubmit={(e) => { e.preventDefault(); commitCredit(); }} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <input type="number" step="1" className="input tabular-nums" aria-label="Crédito inicial" value={creditDraft} onChange={(e) => setCreditDraft(e.target.value)} onBlur={commitCredit} onKeyDown={(e) => { if (e.key === 'Escape') setEditingCredit(false); }} autoFocus style={{ width: '105px', padding: '2px 5px', fontSize: '0.8rem', textAlign: 'right' }} />
                </form>
              ) : (
                <button type="button" title="Clic para editar crédito inicial" onClick={() => { setCreditDraft(String(Math.round(summary.openingCredit))); setEditingCredit(true); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: 'inherit', fontFamily: 'inherit', color: summary.openingCredit > 0 ? '#E30613' : summary.openingCredit < 0 ? '#15803d' : 'var(--text-primary)' }}>
                  {formatPeso(summary.openingCredit)}
                </button>
              )}
            </td>
            <td colSpan={5} />
          </tr>

          <tr style={{ borderBottom: CELL_BORDER, backgroundColor: HEADER_BG }}>
            <td colSpan={2} style={{ padding: '7px 10px', fontWeight: 700, borderRight: CELL_BORDER }}>TOTAL</td>
            <td className="tabular-nums" style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, borderRight: '2px solid #cbd5e1' }}>
              {formatPeso(summary.totalPurchasesWithCredit)}
            </td>
            <td colSpan={5} style={{ backgroundColor: '#fff' }} />
          </tr>

          <tr style={{ backgroundColor: HEADER_BG, borderTop: CELL_BORDER }}>
            <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700, borderRight: CELL_BORDER }}>RESULTADO</td>
            <td className="tabular-nums" style={{ padding: '6px 10px', textAlign: 'right', borderRight: '2px solid #cbd5e1' }}>
              {editingBuffer ? (
                <form onSubmit={(e) => { e.preventDefault(); commitBuffer(); }} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <input type="number" step="1" min="0" className="input tabular-nums" aria-label="Resultado fijo" value={bufferDraft} onChange={(e) => setBufferDraft(e.target.value)} onBlur={commitBuffer} onKeyDown={(e) => { if (e.key === 'Escape') setEditingBuffer(false); }} autoFocus style={{ width: '105px', padding: '2px 5px', fontSize: '0.8rem', textAlign: 'right' }} />
                </form>
              ) : (
                <button type="button" title="Clic para editar resultado semanal" onClick={() => { setBufferDraft(String(Math.round(summary.resultBuffer))); setEditingBuffer(true); }} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: 'inherit', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
                  {formatPeso(summary.resultBuffer)}
                </button>
              )}
            </td>
            <td colSpan={2} style={{ padding: '8px 10px', fontWeight: 700, borderRight: CELL_BORDER }}>TOTAL</td>
            <td className="tabular-nums" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, borderRight: CELL_BORDER }}>{formatPeso(summary.salesA)}</td>
            <td className="tabular-nums" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, borderRight: CELL_BORDER }}>{formatPeso(summary.salesX)}</td>
            <td className="tabular-nums" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{formatPeso(summary.salesTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '0.8rem', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          Crédito próxima semana ({summary.status === 'OVERBOUGHT' ? 'sobre-compra' : summary.status === 'AVAILABLE' ? 'a favor' : 'equilibrado'})
        </span>
        <span className="tabular-nums" style={{ fontWeight: 700, color: summary.closingCredit > 0 ? '#E30613' : summary.closingCredit < 0 ? '#15803d' : 'var(--text-primary)' }}>
          {formatPeso(summary.closingCredit)}
        </span>
      </div>
    </div>
  );
}
