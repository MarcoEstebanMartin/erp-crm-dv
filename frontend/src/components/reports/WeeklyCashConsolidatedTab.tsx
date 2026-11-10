import React from 'react';
import { Calendar, Plus, DollarSign, Trash2, TrendingUp, RefreshCw } from 'lucide-react';
import { useWeeklyCashController } from './WeeklyCashLogicHook';
import { WeeklyCashSummaryFooter } from './WeeklyCashSummaryFooter';

export const WeeklyCashConsolidatedTab: React.FC = () => {
  const c = useWeeklyCashController();

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>SEMANA ACTIVA</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => c.setWeeksDropdownOpen(!c.weeksDropdownOpen)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }}
              >
                <Calendar size={16} />
                Semana del {c.selectedWeekStart || 'Seleccionar'}
                <span style={{ fontSize: '0.6rem' }}>▼</span>
              </button>

              {c.weeksDropdownOpen && (
                <>
                  <div onClick={() => c.setWeeksDropdownOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} />
                  <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px', minWidth: '220px', maxHeight: '250px', overflowY: 'auto', padding: '6px 0' }}>
                    <div style={{ padding: '4px 12px 8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                      <button className="btn btn-ghost" onClick={c.handleCreateNewWeek} style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '6px' }}>
                        <Plus size={14} /> Nueva Semana
                      </button>
                    </div>
                    {c.weeklyReports.length === 0 ? (
                      <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No hay semanas guardadas</div>
                    ) : (
                      c.weeklyReports.map((r: any) => (
                        <button
                          key={r.weekStart}
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
                </>
              )}
            </div>
          </div>

          {c.isDirty && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-end', marginBottom: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f2994a', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '0.78rem', color: '#f2994a', fontWeight: 600 }}>Planilla con cambios sin guardar</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>COLCHÓN OPERATIVO (RESULTADO)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>$</span>
              <input
                type="number"
                value={c.buffer}
                onChange={e => { c.setBuffer(Number(e.target.value) || 0); c.setIsDirty(true); }}
                className="input"
                style={{ width: '130px', padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} color="var(--color-primary)" /> COMPRA SEMANAL
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>EGRESOS Y CRÉDITO</span>
          </div>

          <div className="table-container" style={{ overflow: 'visible' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600 }}>EMPRESAS</th>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '110px' }}>Fecha</th>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '130px', textAlign: 'right' }}>$ Monto</th>
                  <th style={{ padding: '8px 4px', width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {c.purchases.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '6px 4px' }}>
                      <input type="text" value={p.company} onChange={e => c.handlePurchaseChange(idx, 'company', e.target.value)} placeholder="Nombre del proveedor" className="input-inline-cell" />
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <input type="text" value={p.date || ''} onChange={e => c.handlePurchaseChange(idx, 'date', e.target.value)} placeholder="DD/MM/AAAA" className="input-inline-cell" />
                    </td>
                    <td style={{ padding: '6px 4px' }}>
                      <input type="number" value={p.amount || ''} onChange={e => c.handlePurchaseChange(idx, 'amount', Number(e.target.value) || 0)} placeholder="0" className="input-inline-cell" style={{ textAlign: 'right', fontWeight: 600 }} />
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      <button
                        onClick={() => c.removePurchaseRow(idx)}
                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-corp-red)'}
                        onMouseLeave={e => e.currentTarget.style.color = '#666'}
                        title="Eliminar fila"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}

                <tr style={{ backgroundColor: 'var(--bg-light)', fontWeight: 600 }}>
                  <td style={{ padding: '10px 8px', color: 'var(--text-primary)' }}>CRÉDITO (Rollover)</td>
                  <td style={{ padding: '10px 4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Automático</td>
                  <td style={{ padding: '6px 4px' }}>
                    <input
                      type="number"
                      value={c.credit}
                      onChange={e => { c.setCredit(Number(e.target.value) || 0); c.setIsDirty(true); }}
                      className="input-inline-cell"
                      style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-corp-red)', backgroundColor: 'transparent' }}
                    />
                  </td>
                  <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                    {c.suggestedCredit !== c.credit && (
                      <button
                        onClick={() => { c.setCredit(c.suggestedCredit); c.setIsDirty(true); }}
                        style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, padding: 0 }}
                        title={`Restaurar sugerencia: $${c.suggestedCredit.toLocaleString()}`}
                      >
                        Sugerir
                      </button>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <button className="btn btn-ghost" onClick={c.addPurchaseRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}>
              <Plus size={14} /> Agregar Fila
            </button>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>TOTAL COMPRA (CON CRÉDITO)</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                ${(c.purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) + Number(c.credit)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#137333" /> VENTA SEMANAL
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={c.handleAutofillSales}
                className="btn btn-ghost"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', padding: '4px 10px', fontWeight: 600, color: '#137333', border: '1px solid #137333', borderRadius: '6px', backgroundColor: 'transparent' }}
              >
                <RefreshCw size={12} /> Autocompletar desde ERP
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>INGRESOS POR LOCALIDAD</span>
            </div>
          </div>

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600 }}>LOCALIDADES</th>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '90px' }}>Fecha</th>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '95px', textAlign: 'right' }}>Imp. A (Ofi)</th>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '95px', textAlign: 'right' }}>Imp. X (Int)</th>
                  <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '100px', textAlign: 'right' }}>Total</th>
                  <th style={{ padding: '8px 4px', width: '30px' }}></th>
                </tr>
              </thead>
              <tbody>
                {c.sales.map((s, idx) => {
                  const rowTotal = (Number(s.amountA) || 0) + (Number(s.amountX) || 0);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <input type="text" value={s.locality} onChange={e => c.handleSalesChange(idx, 'locality', e.target.value)} placeholder="Nombre de localidad" className="input-inline-cell" />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input type="text" value={s.date || ''} onChange={e => c.handleSalesChange(idx, 'date', e.target.value)} placeholder="DD/MM" className="input-inline-cell" />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input type="number" value={s.amountA || ''} onChange={e => c.handleSalesChange(idx, 'amountA', Number(e.target.value) || 0)} placeholder="0" className="input-inline-cell" style={{ textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input type="number" value={s.amountX || ''} onChange={e => c.handleSalesChange(idx, 'amountX', Number(e.target.value) || 0)} placeholder="0" className="input-inline-cell" style={{ textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                        ${rowTotal.toLocaleString()}
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <button
                          onClick={() => c.removeSalesRow(idx)}
                          style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-corp-red)'}
                          onMouseLeave={e => e.currentTarget.style.color = '#666'}
                          title="Eliminar fila"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <button className="btn btn-ghost" onClick={c.addSalesRow} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}>
              <Plus size={14} /> Agregar Fila
            </button>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>TOTAL VENTAS</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#137333' }}>
                ${c.sales.reduce((sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <WeeklyCashSummaryFooter
        sales={c.sales}
        purchases={c.purchases}
        credit={c.credit}
        buffer={c.buffer}
        weeklyReports={c.weeklyReports}
        selectedWeekStart={c.selectedWeekStart}
        saving={c.saving}
        handleDeleteWeekly={c.handleDeleteWeekly}
        handleSaveWeekly={c.handleSaveWeekly}
        handleSelectWeek={c.handleSelectWeek}
      />
    </div>
  );
};
