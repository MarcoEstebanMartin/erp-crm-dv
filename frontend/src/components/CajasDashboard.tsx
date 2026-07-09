import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Lock, Unlock, RefreshCw, Eye } from 'lucide-react';
import ArqueoCajaModal from './ArqueoCajaModal';

export default function CajasDashboard() {
  const [loading, setLoading] = useState(true);
  const [drawers, setDrawers] = useState<any[]>([]);
  const [historicalDrawers, setHistoricalDrawers] = useState<any[]>([]);

  const [actionModal, setActionModal] = useState<{ open: boolean; branch: string; mode: 'open' | 'close'; drawerId?: number } | null>(null);
  const [amountInput, setAmountInput] = useState('');

  // Historical drawer inspection states
  const [inspectDrawer, setInspectDrawer] = useState<any | null>(null);
  const [inspectTxs, setInspectTxs] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);

  const handleInspectDrawer = async (drawer: any) => {
    setInspectDrawer(drawer);
    setLoadingTxs(true);
    try {
      const txs = await api.getTransactions({ cashDrawerId: drawer.id });
      setInspectTxs(txs || []);
    } catch (err: any) {
      console.error('Error fetching transactions for historical drawer', err);
      alert('Error al cargar los comprobantes de la caja.');
    } finally {
      setLoadingTxs(false);
    }
  };

  const handleCloseInspect = () => {
    setInspectDrawer(null);
    setInspectTxs([]);
  };

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
    const [sYear, sMonth, sDay] = filterStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = filterEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    return closedDate >= start && closedDate <= end;
  });

  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await api.getUsers();
        setUsers(allUsers || []);
      } catch (err) {
        console.error('Error fetching users for cash drawers:', err);
      }
    };
    fetchUsers();
  }, []);

  const dynamicCajas = React.useMemo(() => {
    const list = [
      { id: 'DEPOSITO', name: 'Caja Depósito', desc: 'Ventas de mostrador y depósito', userId: undefined }
    ];

    users.forEach((u: any) => {
      const usernameLower = u.username.toLowerCase();
      if (usernameLower === 'rocio' || usernameLower === 'thiago' || usernameLower === 'oficina') {
        return;
      }
      if (u.role === 'VENDEDOR' || u.role === 'DEPOSITO') {
        const label = u.role === 'VENDEDOR' ? 'Vendedor' : 'Repartidor';
        list.push({
          id: `CAJA_${u.username.toUpperCase()}`,
          name: `Caja ${label} - ${u.username}`,
          desc: `Caja operativa de ${u.username}`,
          userId: u.id
        });
      }
    });

    return list;
  }, [users]);

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
        const cajaDef = dynamicCajas.find(c => c.id === actionModal.branch);
        await api.openDrawer(actionModal.branch, amount, cajaDef?.userId);
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
    <div style={{ padding: '20px', maxWidth: '100%', margin: '0 auto' }}>
      


      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Cajas Operativas</h3>
        <button className="btn btn-ghost" onClick={fetchDrawers}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {/* Grid de 3 Cajas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {dynamicCajas.map(cajaDef => {
          const activeDrawer = drawers.find(d => 
            d.branch === cajaDef.id || (cajaDef.userId && d.userId === cajaDef.userId)
          );
          const isOpen = !!activeDrawer;

          return (
            <div key={cajaDef.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
              
              {isOpen && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }}></div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }} title={cajaDef.name}>{cajaDef.name}</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }} title={cajaDef.desc}>{cajaDef.desc}</p>
                </div>
                <div style={{ 
                  backgroundColor: isOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                  color: isOpen ? '#10b981' : '#ef4444', 
                  padding: '4px 8px', 
                  borderRadius: '20px', 
                  fontSize: '0.75rem', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}>
                  {isOpen ? <Unlock size={12} /> : <Lock size={12} />}
                  {isOpen ? 'Operativa' : 'Cerrada'}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                {isOpen ? (
                  <div style={{ padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Fondo Inicial:</span>
                      <strong style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>${Number(activeDrawer.openingBalance).toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Apertura:</span>
                      <span style={{ fontSize: '0.82rem' }}>{new Date(activeDrawer.openedAt).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '12px' }}>
                    La caja se encuentra inactiva. Deberás abrirla con un saldo inicial para operar.
                  </div>
                )}
              </div>

              <div>
                {isOpen ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      onClick={() => handleInspectDrawer(activeDrawer)}
                    >
                      <Eye size={14} /> Ver Movimientos
                    </button>
                    <button 
                      className="btn" 
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px' }}
                      onClick={() => {
                        setAmountInput('');
                        setActionModal({ open: true, branch: cajaDef.id, mode: 'close', drawerId: activeDrawer.id });
                      }}
                    >
                      Arqueo y Cierre de Caja
                    </button>
                  </div>
                ) : (
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '8px 12px', fontSize: '0.85rem', backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '8px' }}
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




      {/* Historial */}
      <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Historial de Arqueos (Cajas Cerradas)</h3>
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
                <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
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
                    <tr 
                      key={d.id} 
                      onClick={() => handleInspectDrawer(d)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        backgroundColor: hoveredRowId === d.id ? 'var(--bg-light)' : 'transparent',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={() => setHoveredRowId(d.id)}
                      onMouseLeave={() => setHoveredRowId(null)}
                    >
                      <td style={{ padding: '12px', fontWeight: 600 }}>{dynamicCajas.find(c => c.id === d.branch)?.name || d.branch}</td>
                      <td style={{ padding: '12px', fontSize: '0.8rem' }}>{new Date(d.openedAt).toLocaleString('es-AR', {dateStyle:'short', timeStyle:'short'})}</td>
                      <td style={{ padding: '12px', fontSize: '0.8rem' }}>{new Date(d.closedAt).toLocaleString('es-AR', {dateStyle:'short', timeStyle:'short'})}</td>
                      <td style={{ padding: '12px' }}>${Number(d.openingBalance).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${Number(d.closingBalance).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>${Number(d.realBalance).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#047857' }}>${rowCash.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#1d4ed8' }}>${rowCheck.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
                      <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>${netIncome.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: dif >= 0 ? '#10b981' : '#ef4444' }}>
                        {dif > 0 ? '+' : ''}${dif.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button 
                          className="btn btn-ghost" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectDrawer(d);
                          }}
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                          title="Ver detalle de recibos"
                        >
                          <Eye size={14} /> Ver
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      {/* Modal de Inspección de Caja Histórica o Activa */}
      {inspectDrawer && (
        <div className="modal-overlay" onClick={handleCloseInspect}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                {inspectDrawer.status === 'OPEN' ? 'Detalle de Caja Activa: ' : 'Arqueo Histórico: '}
                {dynamicCajas.find(c => c.id === inspectDrawer.branch)?.name || inspectDrawer.branch}
              </h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '4px' }} 
                onClick={handleCloseInspect}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
              {/* Información General */}
              <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Información de la Caja</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  <div>
                    <strong>Estado:</strong>{' '}
                    <span style={{ color: inspectDrawer.status === 'OPEN' ? '#3b82f6' : '#10b981', fontWeight: 600 }}>
                      {inspectDrawer.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
                    </span>
                  </div>
                  <div><strong>Apertura:</strong> {new Date(inspectDrawer.openedAt).toLocaleString('es-AR')}</div>
                  {inspectDrawer.status === 'CLOSED' ? (
                    <div><strong>Cierre:</strong> {new Date(inspectDrawer.closedAt).toLocaleString('es-AR')}</div>
                  ) : (
                    <div><strong>Cierre:</strong> <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Caja en operación</span></div>
                  )}
                  <div><strong>Procesado por:</strong> {inspectDrawer.user?.username || 'Desconocido'}</div>
                </div>
              </div>

              {/* Conciliación Financiera */}
              <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {inspectDrawer.status === 'OPEN' ? 'Caja Activa (Estado Actual)' : 'Cierre y Conciliación'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Fondo Inicial:</span>
                    <strong style={{ fontFamily: 'monospace' }}>${Number(inspectDrawer.openingBalance).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</strong>
                  </div>
                  {(() => {
                    const isClosed = inspectDrawer.status === 'CLOSED';
                    const currentExpected = isClosed 
                      ? Number(inspectDrawer.closingBalance) 
                      : Number(inspectDrawer.openingBalance) + inspectTxs.reduce((sum, t) => sum + (t.type === 'INCOME' ? Number(t.amount) : -Number(t.amount)), 0);
                    
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Esperado (Sistema):</span>
                          <strong style={{ fontFamily: 'monospace' }}>${currentExpected.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</strong>
                        </div>
                        {isClosed && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Declarado (Arqueo):</span>
                              <strong style={{ fontFamily: 'monospace' }}>${Number(inspectDrawer.realBalance).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</strong>
                            </div>
                            <div style={{ height: '1px', backgroundColor: '#cbd5e1', margin: '4px 0' }} />
                            {(() => {
                              const diff = Number(inspectDrawer.realBalance) - Number(inspectDrawer.closingBalance);
                              return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: diff === 0 ? '#166534' : diff > 0 ? '#0f766e' : '#b91c1c' }}>
                                  <span>Diferencia:</span>
                                  <span style={{ fontFamily: 'monospace' }}>{diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}</span>
                                </div>
                              )
                            })()}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Listado de Transacciones */}
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', backgroundColor: 'var(--bg-light)', fontWeight: 600, fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)' }}>
                {inspectDrawer.status === 'OPEN' ? 'Movimientos Registrados (Caja Activa)' : 'Comprobantes y Cobros Conciliados en este Cierre'}
              </div>
              
              {loadingTxs ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Cargando transacciones conciliadas...
                </div>
              ) : inspectTxs.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No hay transacciones individuales registradas en esta caja (ej: arqueo de solo fondos iniciales).
                </div>
              ) : (
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', borderBottom: '1px solid var(--border-color)', zIndex: 1 }}>
                      <tr style={{ color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '10px' }}>Fecha/Hora</th>
                        <th style={{ padding: '10px' }}>Recibo/Pedido</th>
                        <th style={{ padding: '10px' }}>Cliente</th>
                        <th style={{ padding: '10px' }}>Suc.</th>
                        <th style={{ padding: '10px' }}>Medio</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspectTxs.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px' }}>
                            {new Date(t.createdAt).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td style={{ padding: '10px', fontWeight: 600 }}>
                            {t.receiptNumber || `Pedido #${t.orderId || 'S/N'}`}
                          </td>
                          <td style={{ padding: '10px' }}>{t.persona?.name || 'Varios/General'}</td>
                          <td style={{ padding: '10px' }}>{t.billingType === 'OFFICIAL' ? 'A' : 'X'}</td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '0.7rem', 
                              fontWeight: 600,
                              backgroundColor: t.paymentMethod === 'CASH' ? '#ecfdf5' : t.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                              color: t.paymentMethod === 'CASH' ? '#047857' : t.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569'
                            }}>
                              {t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod === 'CHECK' ? 'CHEQUE' : t.paymentMethod === 'BANK_TRANSFER' ? 'TRANSFERENCIA' : t.paymentMethod}
                            </span>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                            ${Number(t.amount).toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:0})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={handleCloseInspect} style={{ padding: '8px 20px' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
  
    </div>
  );
}
