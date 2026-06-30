import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Lock, Unlock, DollarSign, RefreshCw } from 'lucide-react';
import ArqueoCajaModal from './ArqueoCajaModal';

export default function CajasDashboard() {
  const [loading, setLoading] = useState(true);
  const [drawers, setDrawers] = useState<any[]>([]);
  const [cajaGrandeBalance, setCajaGrandeBalance] = useState(0);
  const [historicalDrawers, setHistoricalDrawers] = useState<any[]>([]);

  const [actionModal, setActionModal] = useState<{ open: boolean; branch: string; mode: 'open' | 'close'; drawerId?: number } | null>(null);
  const [amountInput, setAmountInput] = useState('');

  // Date Filters
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const filteredHistory = historicalDrawers.filter((d: any) => {
    const closedDate = new Date(d.closedAt);
    const start = new Date(filterStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filterEndDate);
    end.setHours(23, 59, 59, 999);
    return closedDate >= start && closedDate <= end;
  });

  const CAJAS = [
    { id: 'DEPOSITO', name: 'Caja Depósito', desc: 'Ventas diarias en sucursal y depósito' },
    { id: 'REPARTO', name: 'Caja Reparto', desc: 'Rendiciones de choferes en Villegas' },
    { id: 'VENDEDORES', name: 'Caja Vendedores', desc: 'Cobranzas y ventas de los pueblos' }
  ];

  useEffect(() => {
    fetchDrawers();
  }, []);

  const fetchDrawers = async () => {
    setLoading(true);
    try {
      // Get all drawers
      const allDrawers = await api.getCashDrawers(); // We need this in api.ts to return all, or just use getActiveDrawers
      const active = await api.getActiveDrawers(); 
      setDrawers(active);
      
      // Calculate Caja Grande balance from all closed drawers' real balances, minus whatever exits from Caja Grande (if any)
      // For simplicity, sum of realBalance of all CLOSED drawers
      const closed = allDrawers.filter((d: any) => d.status === 'CLOSED');
      const totalCajaGrande = closed.reduce((acc: number, curr: any) => acc + (Number(curr.realBalance || 0) - Number(curr.openingBalance || 0)), 0);
      setCajaGrandeBalance(totalCajaGrande);
      const history = [...closed].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
      setHistoricalDrawers(history);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  
  const handleArqueoSubmit = async (realBalance: number, receipts: any[], checks: any[]) => {
    try {
      if (actionModal?.mode === 'close' && actionModal.drawerId) {
        await api.closeDrawer(actionModal.drawerId, realBalance, receipts, checks);
        setActionModal(null);
        fetchDrawers();
      }
    } catch (err: any) {
      alert(err.message || 'Error al cerrar caja.');
    }
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal) return;

    try {
      const amount = Number(amountInput);
      if (isNaN(amount) || amount < 0) {
        throw new Error('Ingrese un monto válido mayor o igual a 0.');
      }

      if (actionModal.mode === 'open') {
        await api.openDrawer(actionModal.branch, amount);
      } else if (actionModal.mode === 'close' && actionModal.drawerId) {
        await api.closeDrawer(actionModal.drawerId, amount);
      }

      setActionModal(null);
      setAmountInput('');
      fetchDrawers();
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar la caja.');
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando cajas...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Caja Grande */}
      <div className="card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '30px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#e5e7eb' }}>
            <DollarSign size={28} color="#10b981" /> Caja Grande (Central)
          </h2>
          <p style={{ margin: '8px 0 0 0', opacity: 0.8, fontSize: '0.95rem', color: '#e5e7eb' }}>
            Fondo consolidado de todos los arqueos y cierres operativos.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '4px' }}>Saldo Disponible</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>
            ${cajaGrandeBalance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Cajas Operativas</h3>
        <button className="btn btn-ghost" onClick={fetchDrawers}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {/* Grid de 3 Cajas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {CAJAS.map(cajaDef => {
          const activeDrawer = drawers.find(d => d.branch === cajaDef.id);
          const isOpen = !!activeDrawer;

          return (
            <div key={cajaDef.id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
              
              {isOpen && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }}></div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{cajaDef.name}</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{cajaDef.desc}</p>
                </div>
                <div style={{ 
                  backgroundColor: isOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  color: isOpen ? '#10b981' : '#ef4444', 
                  padding: '6px 12px', 
                  borderRadius: '20px', 
                  fontSize: '0.85rem', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  {isOpen ? <Unlock size={14} /> : <Lock size={14} />}
                  {isOpen ? 'Operativa' : 'Cerrada'}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                {isOpen ? (
                  <div style={{ padding: '15px', backgroundColor: 'var(--bg-light)', borderRadius: '8px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Fondo Inicial:</span>
                      <strong style={{ fontFamily: 'monospace' }}>${Number(activeDrawer.openingBalance).toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Apertura:</span>
                      <span style={{ fontSize: '0.9rem' }}>{new Date(activeDrawer.openedAt).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                    La caja se encuentra inactiva. Deberás abrirla con un saldo inicial para operar.
                  </div>
                )}
              </div>

              <div>
                {isOpen ? (
                  <button 
                    className="btn" 
                    style={{ width: '100%', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px' }}
                    onClick={() => {
                      setAmountInput('');
                      setActionModal({ open: true, branch: cajaDef.id, mode: 'close', drawerId: activeDrawer.id });
                    }}
                  >
                    Arqueo y Cierre de Caja
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '8px' }}
                    onClick={() => {
                      setAmountInput('');
                      setActionModal({ open: true, branch: cajaDef.id, mode: 'open' });
                    }}
                  >
                    Abrir Caja
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Arqueo / Apertura */}
      {actionModal?.open && actionModal.mode === 'open' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Apertura de Caja</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setActionModal(null)}>✕</button>
            </div>
            <form onSubmit={handleActionSubmit}>
              <div className="form-group">
                <label>Efectivo Inicial en Caja ($)</label>
                <input 
                  type="number" 
                  className="input" 
                  autoFocus
                  required
                  step="0.01"
                  min="0"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}
                />
              </div>
              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>Abrir Caja</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {actionModal?.open && actionModal.mode === 'close' && (
        <ArqueoCajaModal 
          drawer={drawers.find(d => d.id === actionModal.drawerId)}
          onClose={() => setActionModal(null)}
          onSuccess={handleArqueoSubmit}
        />
      )}


      {/* Resumen Semanal */}
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Balance Consolidado</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px' }}>Desde</span>
            <input type="date" className="input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} style={{ padding: '6px 12px' }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px' }}>Hasta</span>
            <input type="date" className="input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} style={{ padding: '6px 12px' }} />
          </div>
        </div>
      </div>
      <div style={{ marginTop: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          {(() => {
            let cashTotal = 0;
            let checkTotal = 0;
            
            filteredHistory.forEach((d: any) => {
              d.transactions?.forEach((t: any) => {
                if(t.type === 'INCOME') {
                  if(t.paymentMethod === 'CASH') cashTotal += Number(t.amount);
                  if(t.paymentMethod === 'CHECK') checkTotal += Number(t.amount);
                } else if(t.type === 'OUTCOME') {
                  if(t.paymentMethod === 'CASH') cashTotal -= Number(t.amount);
                  if(t.paymentMethod === 'CHECK') checkTotal -= Number(t.amount);
                }
              });
            });

            return (
              <>
                <div className="card" style={{ padding: '20px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Ingreso Efectivo</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#065f46' }}>${cashTotal.toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
                </div>
                <div className="card" style={{ padding: '20px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Ingreso Cheques</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e3a8a' }}>${checkTotal.toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
                </div>
                <div className="card" style={{ padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Recaudación Total Periodo</div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>${(cashTotal + checkTotal).toLocaleString('es-AR', {minimumFractionDigits:2})}</div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Historial */}
      <div style={{ marginTop: '40px' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: 600 }}>Historial de Arqueos (Cajas Cerradas)</h3>
        <div className="table-responsive card">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Caja</th>
                <th style={{ padding: '12px' }}>Apertura</th>
                <th style={{ padding: '12px' }}>Cierre</th>
                <th style={{ padding: '12px' }}>Fondo Inicial</th>
                <th style={{ padding: '12px' }}>Saldo Teórico</th>
                <th style={{ padding: '12px' }}>Arqueo Real</th>
                <th style={{ padding: '12px' }}>Ingreso Efectivo</th>
                <th style={{ padding: '12px' }}>Ingreso Cheques</th>
                <th style={{ padding: '12px' }}>Recaudación Total</th>
                <th style={{ padding: '12px' }}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No hay historiales de cajas cerradas en este período.</td>
                </tr>
              ) : (
                filteredHistory.map((d: any) => {
                  const dif = Number(d.realBalance) - Number(d.closingBalance);
                  const netIncome = Number(d.realBalance) - Number(d.openingBalance);
                  
                  let rowCash = 0;
                  let rowCheck = 0;
                  d.transactions?.forEach((t: any) => {
                    if(t.type === 'INCOME') {
                      if(t.paymentMethod === 'CASH') rowCash += Number(t.amount);
                      if(t.paymentMethod === 'CHECK') rowCheck += Number(t.amount);
                    } else if(t.type === 'OUTCOME') {
                      if(t.paymentMethod === 'CASH') rowCash -= Number(t.amount);
                      if(t.paymentMethod === 'CHECK') rowCheck -= Number(t.amount);
                    }
                  });

                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{CAJAS.find(c => c.id === d.branch)?.name || d.branch}</td>
                      <td style={{ padding: '12px', fontSize: '0.8rem' }}>{new Date(d.openedAt).toLocaleString('es-AR', {dateStyle:'short', timeStyle:'short'})}</td>
                      <td style={{ padding: '12px', fontSize: '0.8rem' }}>{new Date(d.closedAt).toLocaleString('es-AR', {dateStyle:'short', timeStyle:'short'})}</td>
                      <td style={{ padding: '12px' }}>${Number(d.openingBalance).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${Number(d.closingBalance).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>${Number(d.realBalance).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#047857' }}>${rowCash.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#1d4ed8' }}>${rowCheck.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>${netIncome.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: dif >= 0 ? '#10b981' : '#ef4444' }}>
                        {dif > 0 ? '+' : ''}${dif.toLocaleString('es-AR', {minimumFractionDigits:2})}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
  
    </div>
  );
}
