import { useEffect, useRef, type CSSProperties, type FC } from 'react';
import { Calendar, ChevronDown, DollarSign, Plus, RefreshCw, Trash2, TrendingUp, X } from 'lucide-react';
import { useWeeklyCashController } from './WeeklyCashLogicHook';
import { WeeklyCashSummaryFooter } from './WeeklyCashSummaryFooter';

const CELL: CSSProperties = { padding: '6px 4px' };
const TH: CSSProperties = { padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600 };
const TRASH_BTN: CSSProperties = { background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const CARD_PANEL: CSSProperties = { padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' };
const PANEL_HDR: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' };

const DeleteRowButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={TRASH_BTN}
    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-corp-red)'}
    onMouseLeave={e => e.currentTarget.style.color = '#666'}
    aria-label={label}
  >
    <Trash2 size={14} aria-hidden="true" />
  </button>
);

export const WeeklyCashConsolidatedTab: FC = () => {
  const c = useWeeklyCashController();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!c.weeksDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) c.setWeeksDropdownOpen(false);
    };
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') c.setWeeksDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [c.weeksDropdownOpen]);

  const purchasesTotal = c.purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) + Number(c.credit);
  const salesTotal = c.sales.reduce((sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0), 0);
  const isErrorMsg = c.statusMsg?.type === 'error';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {c.statusMsg && (
        <div
          role={isErrorMsg ? 'alert' : 'status'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
            borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600,
            backgroundColor: isErrorMsg ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${isErrorMsg ? '#fecaca' : '#bbf7d0'}`,
            color: isErrorMsg ? '#991b1b' : '#166534'
          }}
        >
          <span>{c.statusMsg.text}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => c.setStatusMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div ref={dropdownRef} style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Semana</span>
            <button
              type="button"
              aria-expanded={c.weeksDropdownOpen}
              aria-haspopup="true"
              onClick={() => c.setWeeksDropdownOpen(!c.weeksDropdownOpen)}
              className="btn btn-secondary tabular-nums"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }}
            >
              <Calendar size={16} aria-hidden="true" />
              <span>Semana {c.selectedWeekStart || 'Seleccionar'}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            {c.weeksDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px', minWidth: '250px', maxHeight: '280px', overflowY: 'auto', padding: '8px 0' }}>
                <div style={{ padding: '6px 12px 10px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="date"
                    aria-label="Fecha nueva semana"
                    value={c.newWeekDate}
                    onChange={e => c.setNewWeekDate(e.target.value)}
                    className="input tabular-nums"
                    style={{ fontSize: '0.78rem', padding: '4px 6px', flex: 1 }}
                  />
                  <button type="button" className="btn btn-secondary" onClick={() => c.handleCreateNewWeek()} style={{ fontSize: '0.78rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Plus size={13} aria-hidden="true" /> Crear
                  </button>
                </div>
                {c.weeklyReports.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Sin semanas guardadas</div>
                ) : (
                  c.weeklyReports.map((r: any) => (
                    <button
                      key={r.weekStart}
                      type="button"
                      className="tabular-nums"
                      onClick={() => c.handleSelectWeek(r.weekStart)}
                      style={{ display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left', border: 'none', background: r.weekStart === c.selectedWeekStart ? 'var(--bg-light)' : 'transparent', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: r.weekStart === c.selectedWeekStart ? 600 : 400 }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-light)'}
                      onMouseLeave={e => { if (r.weekStart !== c.selectedWeekStart) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      Semana {r.weekStart}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {c.isDirty && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-end', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f2994a' }} />
              <span style={{ fontSize: '0.78rem', color: '#f2994a', fontWeight: 600 }}>Sin guardar</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <label htmlFor="weekly-buffer-input" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Colchón operativo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>$</span>
            <input
              id="weekly-buffer-input"
              type="number"
              value={c.buffer}
              onChange={e => { c.setBuffer(Number(e.target.value) || 0); c.setIsDirty(true); }}
              className="input tabular-nums"
              style={{ width: '130px', padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        <div className="card" style={CARD_PANEL}>
          <div style={PANEL_HDR}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="var(--color-primary)" aria-hidden="true" /> Compra semanal
            </h3>
          </div>

          <div className="table-container" role="region" aria-label="Compra semanal" tabIndex={0} style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                  <th scope="col" style={TH}>Proveedor</th>
                  <th scope="col" style={{ ...TH, width: '110px' }}>Fecha</th>
                  <th scope="col" style={{ ...TH, width: '130px', textAlign: 'right' }}>Monto ($)</th>
                  <th scope="col" style={{ padding: '8px 4px', width: '40px' }}><span className="visually-hidden">Eliminar</span></th>
                </tr>
              </thead>
              <tbody>
                {c.purchases.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={CELL}>
                      <input type="text" aria-label={`Proveedor fila ${idx + 1}`} value={p.company} onChange={e => c.handlePurchaseChange(idx, 'company', e.target.value)} placeholder="Proveedor" className="input-inline-cell" />
                    </td>
                    <td style={CELL}>
                      <input type="text" aria-label={`Fecha compra fila ${idx + 1}`} value={p.date || ''} onChange={e => c.handlePurchaseChange(idx, 'date', e.target.value)} placeholder="DD/MM/AAAA" className="input-inline-cell tabular-nums" />
                    </td>
                    <td style={CELL}>
                      <input type="number" aria-label={`Monto compra fila ${idx + 1}`} value={p.amount || ''} onChange={e => c.handlePurchaseChange(idx, 'amount', Number(e.target.value) || 0)} placeholder="0" className="input-inline-cell tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }} />
                    </td>
                    <td style={{ ...CELL, textAlign: 'center' }}>
                      <DeleteRowButton label={`Eliminar proveedor ${p.company || idx + 1}`} onClick={() => c.removePurchaseRow(idx)} />
                    </td>
                  </tr>
                ))}

                <tr style={{ backgroundColor: 'var(--bg-light)', fontWeight: 600 }}>
                  <td style={{ padding: '10px 8px', color: 'var(--text-primary)' }}>Crédito (Rollover)</td>
                  <td style={{ padding: '10px 4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Automático</td>
                  <td style={CELL}>
                    <input
                      type="number"
                      aria-label="Crédito rollover"
                      value={c.credit}
                      onChange={e => { c.setCredit(Number(e.target.value) || 0); c.setIsDirty(true); }}
                      className="input-inline-cell tabular-nums"
                      style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-corp-red)', backgroundColor: 'transparent' }}
                    />
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    {c.suggestedCredit !== c.credit && (
                      <button type="button" onClick={() => { c.setCredit(c.suggestedCredit); c.setIsDirty(true); }} style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: 0 }} title={`Restaurar: $${c.suggestedCredit.toLocaleString()}`}>
                        Sugerir
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={c.addPurchaseRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}>
              <Plus size={14} aria-hidden="true" /> Agregar fila
            </button>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Total compras + crédito</span>
              <span className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>${purchasesTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card" style={CARD_PANEL}>
          <div style={PANEL_HDR}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#137333" aria-hidden="true" /> Venta semanal
            </h3>
            <button
              type="button"
              onClick={c.handleAutofillSales}
              className="btn btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '4px 10px', fontWeight: 600, color: '#137333', border: '1px solid #137333', borderRadius: '6px', backgroundColor: 'transparent' }}
            >
              <RefreshCw size={12} aria-hidden="true" /> Autocompletar ERP
            </button>
          </div>

          <div className="table-container" role="region" aria-label="Venta semanal por localidad" tabIndex={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                  <th scope="col" style={TH}>Localidad</th>
                  <th scope="col" style={{ ...TH, width: '90px' }}>Fecha</th>
                  <th scope="col" style={{ ...TH, width: '95px', textAlign: 'right' }}>Imp. A (Ofi)</th>
                  <th scope="col" style={{ ...TH, width: '95px', textAlign: 'right' }}>Imp. X (Int)</th>
                  <th scope="col" style={{ ...TH, width: '100px', textAlign: 'right' }}>Total</th>
                  <th scope="col" style={{ padding: '8px 4px', width: '30px' }}><span className="visually-hidden">Eliminar</span></th>
                </tr>
              </thead>
              <tbody>
                {c.sales.map((s, idx) => {
                  const rowTotal = (Number(s.amountA) || 0) + (Number(s.amountX) || 0);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={CELL}><input type="text" aria-label={`Localidad fila ${idx + 1}`} value={s.locality} onChange={e => c.handleSalesChange(idx, 'locality', e.target.value)} placeholder="Localidad" className="input-inline-cell" /></td>
                      <td style={CELL}><input type="text" aria-label={`Fecha venta fila ${idx + 1}`} value={s.date || ''} onChange={e => c.handleSalesChange(idx, 'date', e.target.value)} placeholder="DD/MM" className="input-inline-cell tabular-nums" /></td>
                      <td style={CELL}><input type="number" aria-label={`Importe A fila ${idx + 1}`} value={s.amountA || ''} onChange={e => c.handleSalesChange(idx, 'amountA', Number(e.target.value) || 0)} placeholder="0" className="input-inline-cell tabular-nums" style={{ textAlign: 'right' }} /></td>
                      <td style={CELL}><input type="number" aria-label={`Importe X fila ${idx + 1}`} value={s.amountX || ''} onChange={e => c.handleSalesChange(idx, 'amountX', Number(e.target.value) || 0)} placeholder="0" className="input-inline-cell tabular-nums" style={{ textAlign: 'right' }} /></td>
                      <td className="tabular-nums" style={{ ...CELL, textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>${rowTotal.toLocaleString()}</td>
                      <td style={{ ...CELL, textAlign: 'center' }}><DeleteRowButton label={`Eliminar localidad ${s.locality || idx + 1}`} onClick={() => c.removeSalesRow(idx)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={c.addSalesRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}>
              <Plus size={14} aria-hidden="true" /> Agregar fila
            </button>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Total ventas</span>
              <span className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 700, color: '#137333' }}>${salesTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <WeeklyCashSummaryFooter
        sales={c.sales} purchases={c.purchases} credit={c.credit} buffer={c.buffer}
        weeklyReports={c.weeklyReports} selectedWeekStart={c.selectedWeekStart} saving={c.saving}
        handleDeleteWeekly={c.handleDeleteWeekly} handleSaveWeekly={c.handleSaveWeekly} handleSelectWeek={c.handleSelectWeek}
      />
    </div>
  );
};
