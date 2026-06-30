import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Lock, Unlock, RefreshCw, AlertCircle, CheckCircle, } from 'lucide-react';

export default function CierreCajaDashboard() {
  const [activeDrawers, setActiveDrawers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Modals
  const [openDrawerModal, setOpenDrawerModal] = useState<{ open: boolean; branch: string } | null>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  
  const [closeDrawerModal, setCloseDrawerModal] = useState<{ open: boolean; drawer: any } | null>(null);
  const [realBalance, setRealBalance] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const active = await api.getActiveDrawers();
      setActiveDrawers(active || []);

      const allHistory = await api.getCashDrawers();
      // Filtrar solo las cerradas para el historial, ordenadas por más reciente
      const closed = (allHistory || []).filter((d: any) => d.status === 'CLOSED').sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
      setHistory(closed);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Error al cargar la información de cajas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showAlert = (type: 'success' | 'error', msg: string) => {
    setAlerts({ type, msg });
    setTimeout(() => setAlerts(null), 5000);
  };

  const handleOpenDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openDrawerModal || isNaN(Number(openingBalance)) || Number(openingBalance) < 0) return;
    
    setIsSubmitting(true);
    try {
      await api.openDrawer(openDrawerModal.branch, Number(openingBalance));
      showAlert('success', `Caja ${openDrawerModal.branch} abierta exitosamente.`);
      setOpenDrawerModal(null);
      setOpeningBalance('');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Error al abrir la caja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDrawer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeDrawerModal || isNaN(Number(realBalance)) || Number(realBalance) < 0) return;
    
    setIsSubmitting(true);
    try {
      await api.closeDrawer(closeDrawerModal.drawer.id, Number(realBalance));
      showAlert('success', `Caja ${closeDrawerModal.drawer.branch} cerrada exitosamente.`);
      setCloseDrawerModal(null);
      setRealBalance('');
      fetchData();
    } catch (err: any) {
      showAlert('error', err.message || 'Error al cerrar la caja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const branches = ['A', 'X'];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      {alerts && (
        <div style={{ 
          padding: '16px', 
          marginBottom: '24px', 
          borderRadius: '8px', 
          backgroundColor: alerts.type === 'success' ? '#def7ec' : '#fde8e8',
          color: alerts.type === 'success' ? '#03543f' : '#9b1c1c',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 500
        }}>
          {alerts.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {alerts.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Gestión de Cajas y Tesorería</h2>
        <button className="btn btn-secondary" onClick={fetchData} title="Refrescar">
          <RefreshCw size={18} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando información de cajas...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            {branches.map(branch => {
              const active = activeDrawers.find(d => d.branch === branch);
              
              return (
                <div key={branch} className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                  {/* Etiqueta de Sucursal Elegante */}
                  <div style={{ position: 'absolute', top: 0, right: 0, padding: '6px 16px', backgroundColor: branch === 'A' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(107, 114, 128, 0.1)', color: branch === 'A' ? '#3b82f6' : '#6b7280', borderBottomLeftRadius: '8px', fontWeight: 600, fontSize: '0.8rem' }}>
                    Sucursal {branch === 'A' ? 'Oficial' : 'Interna'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '50%', 
                      backgroundColor: active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      color: active ? '#10b981' : '#ef4444' 
                    }}>
                      {active ? <Unlock size={24} /> : <Lock size={24} />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Caja {branch}</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: active ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                        {active ? 'Abierta (Operativa)' : 'Cerrada'}
                      </p>
                    </div>
                  </div>

                  {active ? (
                    <div>
                      <div style={{ backgroundColor: 'var(--bg-muted)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Apertura:</span>
                          <span style={{ fontWeight: 500 }}>{new Date(active.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Saldo Inicial Declarado:</span>
                          <span style={{ fontWeight: 600 }}>${Number(active.openingBalance).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                      <button 
                        className="btn btn-primary" 
                        style={{ width: '100%', backgroundColor: '#111827', color: 'white' }}
                        onClick={() => setCloseDrawerModal({ open: true, drawer: active })}
                      >
                        <Lock size={16} style={{ marginRight: '8px' }} /> Proceder al Arqueo y Cierre
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                        La caja se encuentra inactiva. Deberás abrirla con un saldo inicial para poder operar ventas.
                      </p>
                      <button 
                        className="btn btn-primary" 
                        style={{ width: '100%', backgroundColor: '#10b981', color: 'white', border: 'none' }}
                        onClick={() => setOpenDrawerModal({ open: true, branch })}
                      >
                        <Unlock size={16} style={{ marginRight: '8px' }} /> Abrir Caja {branch}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Historial de Arqueos (Cajas Cerradas)</h3>
          <div className="card table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.85rem' }}>SUC.</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.85rem' }}>APERTURA</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.85rem' }}>CIERRE</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem' }}>ESPERADO (SISTEMA)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem' }}>REAL (ARQUEO)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem' }}>DIFERENCIA</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No hay cierres de caja recientes registrados.</td>
                  </tr>
                ) : (
                  history.map(d => {
                    const diff = Number(d.realBalance) - Number(d.closingBalance);
                    return (
                      <tr key={d.id} className="hover-bg-muted" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.branch}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          {new Date(d.openedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                          {new Date(d.closedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500 }}>
                          ${Number(d.closingBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                          ${Number(d.realBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: diff === 0 ? '#10b981' : (diff > 0 ? '#3b82f6' : '#ef4444') }}>
                          {diff > 0 ? '+' : ''}${diff.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal Apertura de Caja */}
      {openDrawerModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setOpenDrawerModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem' }}>Apertura de Caja {openDrawerModal.branch}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>Declarar efectivo inicial para dar vuelto.</p>
            
            <form onSubmit={handleOpenDrawer}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Saldo Inicial Físico ($)</label>
                <input
                  type="number"
                  className="input"
                  required
                  min="0"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  autoFocus
                  placeholder="Ej: 5000"
                  style={{ fontSize: '1.2rem', padding: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setOpenDrawerModal(null)} disabled={isSubmitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', color: 'white', border: 'none' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Abriendo...' : 'Abrir Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cierre de Caja (Arqueo) */}
      {closeDrawerModal && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setCloseDrawerModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#ef4444' }}>Cierre y Arqueo (Caja {closeDrawerModal.drawer.branch})</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Para cerrar la caja de forma segura, realizá el conteo físico del efectivo en la caja registradora e ingresalo a continuación. El sistema calculará la diferencia.
            </p>
            
            <form onSubmit={handleCloseDrawer}>
              <div className="form-group" style={{ marginBottom: '24px', backgroundColor: 'rgba(239, 68, 68, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <label className="form-label" style={{ color: '#ef4444', fontWeight: 600 }}>Efectivo Real Contado ($)</label>
                <input
                  type="number"
                  className="input"
                  required
                  min="0"
                  step="0.01"
                  value={realBalance}
                  onChange={(e) => setRealBalance(e.target.value)}
                  autoFocus
                  placeholder="Monto exacto..."
                  style={{ fontSize: '1.5rem', padding: '16px', textAlign: 'right', fontWeight: 'bold' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCloseDrawerModal(null)} disabled={isSubmitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#111827', color: 'white' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Procesando...' : 'Confirmar Cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
