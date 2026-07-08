import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  CheckCircle, 
  ChevronDown, 
  ChevronUp, 
  Truck, 
  User, 
  RefreshCw, 
  AlertCircle,
  FileText,
  ShieldCheck
} from 'lucide-react';

interface SellerGroup {
  user: {
    id: number;
    username: string;
    role: string;
  };
  totalToCollect: number;
  totalBranchA: number;
  totalBranchX: number;
  totalCash: number;
  totalChecks: number;
  totalTransfers: number;
  transactions: any[];
}

interface RouteGroup {
  routeId: number;
  driverName: string;
  vehiclePlate: string;
  totalToCollect: number;
  totalBranchA: number;
  totalBranchX: number;
  totalCash: number;
  totalChecks: number;
  totalTransfers: number;
  transactions: any[];
}

const RendicionesDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sellers' | 'routes'>('sellers');
  const [sellers, setSellers] = useState<SellerGroup[]>([]);
  const [routes, setRoutes] = useState<RouteGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Arqueo Modal State
  const [auditTarget, setAuditTarget] = useState<{ type: 'seller' | 'route'; data: any } | null>(null);
  const [realCash, setRealCash] = useState<string>('');
  const [realChecks, setRealChecks] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showTxs, setShowTxs] = useState(false);

  const fetchRendiciones = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getPendingRendiciones();
      setSellers(data.sellers || []);
      setRoutes(data.routes || []);
    } catch (err: any) {
      console.error('Error fetching rendiciones', err);
      setErrorMsg(err.message || 'Error al cargar las rendiciones pendientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRendiciones();
  }, []);

  const handleOpenAudit = (type: 'seller' | 'route', data: any) => {
    setAuditTarget({ type, data });
    setRealCash('');
    setRealChecks('');
    setShowTxs(false);
    setErrorMsg(null);
  };

  const handleCloseAudit = () => {
    setAuditTarget(null);
    setRealCash('');
    setRealChecks('');
    setShowTxs(false);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditTarget) return;

    const cashVal = Number(realCash || 0);
    const checksVal = Number(realChecks || 0);

    if (isNaN(cashVal) || cashVal < 0 || isNaN(checksVal) || checksVal < 0) {
      setErrorMsg('Por favor ingrese montos válidos mayores o iguales a cero.');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        realCash: cashVal,
        realChecks: checksVal
      };

      if (auditTarget.type === 'seller') {
        payload.sellerId = auditTarget.data.user.id;
      } else {
        payload.routeId = auditTarget.data.routeId;
      }

      const res = await api.verifyRendicion(payload);
      
      setSuccessMsg(res.message || 'Arqueo procesado y caja cerrada correctamente.');
      setTimeout(() => setSuccessMsg(null), 5000);

      handleCloseAudit();
      fetchRendiciones();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al confirmar el arqueo.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  };

  // Calculations for current audited item
  const expectedCash = auditTarget ? Number(auditTarget.data.totalCash || 0) : 0;
  const expectedChecks = auditTarget ? Number(auditTarget.data.totalChecks || 0) : 0;
  const totalExpected = expectedCash + expectedChecks;

  const inputCash = Number(realCash) || 0;
  const inputChecks = Number(realChecks) || 0;
  const totalInput = inputCash + inputChecks;

  const diffCash = inputCash - expectedCash;
  const diffChecks = inputChecks - expectedChecks;
  const totalDiff = totalInput - totalExpected;

  return (
    <div style={{ padding: '0px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Mensajes de feedback */}
      {successMsg && (
        <div style={{ 
          padding: '14px 20px', 
          backgroundColor: '#ecfdf5', 
          color: '#065f46', 
          borderRadius: '8px', 
          border: '1px solid #a7f3d0',
          fontSize: '0.9rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={18} color="#10b981" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && !auditTarget && (
        <div style={{ 
          padding: '14px 20px', 
          backgroundColor: '#fef2f2', 
          color: '#991b1b', 
          borderRadius: '8px', 
          border: '1px solid #fca5a5',
          fontSize: '0.9rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} color="#ef4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tarjeta Principal */}
      <div className="card" style={{ padding: '24px' }}>
        
        {/* Header del Dashboard */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
              <ShieldCheck size={26} color="var(--color-primary)" />
              Control y Arqueo de Cajas Operativas
            </h2>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Realice el conteo físico de efectivo y cheques traídos de la calle. Al confirmarse el arqueo, los fondos ingresarán directamente a la Caja Grande (Central).
            </p>
          </div>
          <button className="btn btn-ghost" onClick={fetchRendiciones} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Tabs de Vendedores y Repartidores */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)', 
          marginBottom: '24px',
          gap: '24px'
        }}>
          <button 
            type="button"
            onClick={() => setActiveTab('sellers')}
            style={{
              padding: '12px 6px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'sellers' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'sellers' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'sellers' ? 600 : 400,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <User size={16} />
            Cajas de Vendedores
            <span style={{ 
              backgroundColor: sellers.length > 0 ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
              color: sellers.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {sellers.length}
            </span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('routes')}
            style={{
              padding: '12px 6px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'routes' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'routes' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'routes' ? 600 : 400,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Truck size={16} />
            Cajas de Repartidores
            <span style={{ 
              backgroundColor: routes.length > 0 ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
              color: routes.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {routes.length}
            </span>
          </button>
        </div>

        {/* Listado Principal */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
            Cargando cajas pendientes...
          </div>
        ) : activeTab === 'sellers' ? (
          sellers.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
              <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontWeight: 600 }}>Cajas de Vendedores al Día</h3>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>No hay cobranzas móviles pendientes de verificar en la calle.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sellers.map(item => (
                <div 
                  key={item.user.id} 
                  style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#fff',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                    cursor: 'default'
                  }}
                  className="list-card-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '50%', color: 'var(--color-primary)' }}>
                      <User size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{item.user.username.toUpperCase()}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {item.transactions.length} recibo(s) pendiente(s) de rendir
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total a Rendir</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {formatCurrency(item.totalToCollect)}
                      </div>
                    </div>
                    <button 
                      className="btn"
                      onClick={() => handleOpenAudit('seller', item)}
                      style={{ 
                        padding: '8px 16px', 
                        fontSize: '0.85rem', 
                        fontWeight: 600, 
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        backgroundColor: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Realizar Arqueo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          routes.length === 0 ? (
            <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
              <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px 0', color: 'var(--text-primary)', fontWeight: 600 }}>Cajas de Reparto al Día</h3>
              <p style={{ margin: 0, fontSize: '0.88rem' }}>No hay hojas de ruta liquidadas pendientes de arqueo financiero.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {routes.map(item => (
                <div 
                  key={item.routeId} 
                  style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#fff',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                    cursor: 'default'
                  }}
                  className="list-card-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '50%', color: 'var(--color-primary)' }}>
                      <Truck size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>{item.driverName}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Viaje #{item.routeId} | Patente: {item.vehiclePlate}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total a Rendir</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {formatCurrency(item.totalToCollect)}
                      </div>
                    </div>
                    <button 
                      className="btn"
                      onClick={() => handleOpenAudit('route', item)}
                      style={{ 
                        padding: '8px 16px', 
                        fontSize: '0.85rem', 
                        fontWeight: 600, 
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        backgroundColor: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      Realizar Arqueo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* MODAL DE ARQUEO Y CONCILIACIÓN */}
      {auditTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', padding: '24px' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                Arqueo de Caja Operativa: {auditTarget.type === 'seller' ? auditTarget.data.user.username.toUpperCase() : `${auditTarget.data.driverName} (Ruta #${auditTarget.data.routeId})`}
              </h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '4px' }} 
                onClick={handleCloseAudit} 
                disabled={actionLoading}
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: '#fef2f2', 
                color: '#991b1b', 
                borderRadius: '6px', 
                border: '1px solid #fca5a5', 
                marginBottom: '16px', 
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} color="#ef4444" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '20px' }}>
                
                {/* Columna Izquierda: Esperado en Sistema */}
                <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    1. Sistema (Teórico Esperado)
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Efectivo en Sistema:</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(expectedCash)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cheques en Sistema:</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(expectedChecks)}</strong>
                    </div>
                    
                    <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Sucursal A (Oficial):</span>
                      <span style={{ fontWeight: 500 }}>{formatCurrency(auditTarget.data.totalBranchA)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Sucursal X (Interna):</span>
                      <span style={{ fontWeight: 500 }}>{formatCurrency(auditTarget.data.totalBranchX)}</span>
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700 }}>
                      <span style={{ color: 'var(--text-primary)' }}>Total Esperado:</span>
                      <span style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{formatCurrency(totalExpected)}</span>
                    </div>

                  </div>
                </div>

                {/* Columna Derecha: Arqueo Físico Recibido */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      2. Conteo Físico Recibido
                    </h4>
                    
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Efectivo Declarado ($)
                      </label>
                      <input 
                        type="number"
                        className="input"
                        placeholder="0.00"
                        required
                        min="0"
                        step="0.01"
                        autoFocus
                        value={realCash}
                        onChange={(e) => setRealCash(e.target.value)}
                        style={{ fontSize: '1.15rem', fontFamily: 'monospace', width: '100%' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '0px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Cheques Declarados ($)
                      </label>
                      <input 
                        type="number"
                        className="input"
                        placeholder="0.00"
                        required
                        min="0"
                        step="0.01"
                        value={realChecks}
                        onChange={(e) => setRealChecks(e.target.value)}
                        style={{ fontSize: '1.15rem', fontFamily: 'monospace', width: '100%' }}
                      />
                    </div>
                  </div>

                </div>

              </div>

              {/* Widget de Conciliación y Diferencias en tiempo real */}
              <div 
                style={{ 
                  padding: '16px 20px', 
                  borderRadius: '8px', 
                  backgroundColor: totalDiff === 0 ? '#f0fdf4' : totalDiff > 0 ? '#f0fdfa' : '#fef2f2',
                  border: totalDiff === 0 ? '1px solid #bbf7d0' : totalDiff > 0 ? '1px solid #99f6e4' : '1px solid #fecaca',
                  color: totalDiff === 0 ? '#166534' : totalDiff > 0 ? '#0f766e' : '#991b1b',
                  marginBottom: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 700 }}>
                    {totalDiff === 0 ? 'Caja Conciliada (Cuadrado)' : totalDiff > 0 ? 'Sobrante Detectado' : 'Faltante de Caja'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.9 }}>
                    Efectivo: {diffCash >= 0 ? '+' : ''}{formatCurrency(diffCash)} | 
                    Cheques: {diffChecks >= 0 ? '+' : ''}{formatCurrency(diffChecks)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, textTransform: 'uppercase' }}>Diferencia Total</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                    {totalDiff > 0 ? '+' : ''}{formatCurrency(totalDiff)}
                  </div>
                </div>
              </div>

              {/* Detalle de transacciones asociadas (Colapsable) */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                <div 
                  onClick={() => setShowTxs(!showTxs)}
                  style={{ 
                    padding: '12px 16px', 
                    backgroundColor: 'var(--bg-light)', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} />
                    Ver recibos y cobros asociados ({auditTarget.data.transactions.length})
                  </span>
                  {showTxs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {showTxs && (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fff', padding: '8px' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '8px' }}>Recibo/Pedido</th>
                          <th style={{ padding: '8px' }}>Cliente</th>
                          <th style={{ padding: '8px' }}>Sucursal</th>
                          <th style={{ padding: '8px' }}>Medio</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditTarget.data.transactions.map((tx: any) => (
                          <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px', fontWeight: 500 }}>
                              {tx.receiptNumber || `Pedido #${tx.orderId || 'S/N'}`}
                            </td>
                            <td style={{ padding: '8px' }}>{tx.persona?.name || 'Desconocido'}</td>
                            <td style={{ padding: '8px' }}>{tx.billingType === 'OFFICIAL' ? 'A' : 'X'}</td>
                            <td style={{ padding: '8px' }}>
                              <span style={{ 
                                padding: '2px 6px', 
                                borderRadius: '4px', 
                                fontSize: '0.72rem', 
                                fontWeight: 600,
                                backgroundColor: tx.paymentMethod === 'CASH' ? '#ecfdf5' : tx.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                                color: tx.paymentMethod === 'CASH' ? '#047857' : tx.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569'
                              }}>
                                {tx.paymentMethod === 'CASH' ? 'EFECTIVO' : tx.paymentMethod === 'CHECK' ? 'CHEQUE' : tx.paymentMethod}
                              </span>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                              {formatCurrency(Number(tx.amount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px', 
                borderTop: '1px solid var(--border-color)', 
                paddingTop: '20px' 
              }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleCloseAudit}
                  disabled={actionLoading}
                  style={{ padding: '10px 18px', fontSize: '0.88rem' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={actionLoading}
                  style={{ 
                    padding: '10px 22px', 
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    backgroundColor: '#E30613', // Rojo corporativo reservado exclusivamente para la acción crítica
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: actionLoading ? 'default' : 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b90510'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#E30613'}
                >
                  {actionLoading ? 'Verificando Arqueo...' : 'Confirmar Arqueo y Transferir a Caja Grande'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RendicionesDashboard;
