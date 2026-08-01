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
  ShieldCheck,
  Lock,
  Unlock,
  Eye,
  MapPin,
  Trash2
} from 'lucide-react';
import ArqueoCajaModal from './ArqueoCajaModal';

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

const getWhatsAppSendLink = (phone: string, clientName: string, receiptNumber: string, amount: number, receiptId: number) => {
  const cleanPhone = phone.replace(/\D/g, '');
  const receiptLink = `${window.location.origin}/recibo/${receiptId}`;
  const text = `Hola ${clientName}! Tu pago por $${amount.toLocaleString('es-AR')} (Comprobante: ${receiptNumber}) ha sido verificado y acreditado formalmente en tu cuenta corriente. Comprobante digital: ${receiptLink}`;
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
};

const getDetectedRoutesAndCities = (transactions: any[]) => {
  if (!transactions || transactions.length === 0) return { primary: '', list: [] };

  const counts: Record<string, number> = {};

  transactions.forEach((tx: any) => {
    const loc = tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name;
    if (loc && loc.trim()) {
      const cleanLoc = loc.trim();
      counts[cleanLoc] = (counts[cleanLoc] || 0) + 1;
    }
  });

  const list = Object.keys(counts).map(key => ({
    name: key,
    count: counts[key]
  })).sort((a, b) => b.count - a.count);

  if (list.length === 0) return { primary: '', list: [] };

  const namesStr = list.map(item => item.name).join(', ');

  return {
    primary: namesStr,
    list
  };
};

const RendicionesDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sellers' | 'routes' | 'diaria'>('sellers');
  const [sellers, setSellers] = useState<SellerGroup[]>([]);
  const [routes, setRoutes] = useState<RouteGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Arqueo Modal State
  const [auditTarget, setAuditTarget] = useState<{ type: 'seller' | 'route'; data: any } | null>(null);
  const [arqueoResult, setArqueoResult] = useState<any | null>(null);
  const [realCash, setRealCash] = useState<string>('');
  const [realChecks, setRealChecks] = useState<string>('');
  const [auditRouteNote, setAuditRouteNote] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState<string>('');
  const [declaredChecksList, setDeclaredChecksList] = useState<Array<{ number: string; bank: string; amount: number }>>([]);
  const [newCheckNumber, setNewCheckNumber] = useState<string>('');
  const [newCheckBank, setNewCheckBank] = useState<string>('');
  const [newCheckAmount, setNewCheckAmount] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showTxs, setShowTxs] = useState(false);
  const [activeDrawers, setActiveDrawers] = useState<any[]>([]);
  const [selectedDrawerId, setSelectedDrawerId] = useState<string>('');

  // Caja Depósito & History states
  const [drawers, setDrawers] = useState<any[]>([]);
  const [historicalDrawers, setHistoricalDrawers] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [amountInput, setAmountInput] = useState('');
  
  // Arqueo/Apertura de Caja Depósito Modal
  const [cajaActionModal, setCajaActionModal] = useState<{ open: boolean; branch: string; mode: 'open' | 'close'; drawerId?: number } | null>(null);

  // Historical drawer inspection states
  const [inspectDrawer, setInspectDrawer] = useState<any | null>(null);
  const [inspectTxs, setInspectTxs] = useState<any[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);

  // Date Filters for History
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

  const fetchDrawers = async () => {
    setLoadingHistory(true);
    try {
      const allDrawers = await api.getCashDrawers();
      const active = await api.getActiveDrawers();
      setDrawers(active || []);

      const closed = (allDrawers || []).filter((d: any) => d.status === 'CLOSED');
      const history = [...closed].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
      setHistoricalDrawers(history);
    } catch (err: any) {
      console.error("Error fetching drawers for history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchRendiciones();
    fetchDrawers();
  }, []);

  const handleOpenAudit = async (type: 'seller' | 'route', data: any) => {
    setAuditTarget({ type, data });
    setRealCash('');
    setRealChecks('');
    if (type === 'route') {
      setAuditRouteNote(data.driverName ? `Ruta de ${data.driverName}` : '');
    } else {
      const detected = getDetectedRoutesAndCities(data.transactions);
      setAuditRouteNote(detected.primary);
    }
    setAuditNotes('');
    setDeclaredChecksList([]);
    setNewCheckNumber('');
    setNewCheckBank('');
    setNewCheckAmount('');
    setShowTxs(false);
    setErrorMsg(null);
    setSelectedDrawerId('');
    setActiveDrawers([]);

    // Cargar cajas operativas abiertas
    try {
      const active = await api.getActiveDrawers();
      setActiveDrawers(active || []);
      if (active && active.length > 0) {
        setSelectedDrawerId(String(active[0].id));
      }
    } catch (err) {
      console.error("Error al cargar cajas activas:", err);
    }
  };

  const handleCloseAudit = () => {
    setAuditTarget(null);
    setRealCash('');
    setRealChecks('');
    setAuditRouteNote('');
    setAuditNotes('');
    setDeclaredChecksList([]);
    setNewCheckNumber('');
    setNewCheckBank('');
    setNewCheckAmount('');
    setShowTxs(false);
    setActiveDrawers([]);
    setSelectedDrawerId('');
  };

  const handleAddDeclaredCheck = () => {
    const amt = Number(newCheckAmount);
    if (isNaN(amt) || amt <= 0) return;
    const updated = [...declaredChecksList, {
      number: newCheckNumber.trim() || 'S/N',
      bank: newCheckBank.trim() || 'Banco',
      amount: amt
    }];
    setDeclaredChecksList(updated);
    const sumChecks = updated.reduce((acc, c) => acc + c.amount, 0);
    setRealChecks(String(sumChecks));
    setNewCheckNumber('');
    setNewCheckBank('');
    setNewCheckAmount('');
  };

  const handleRemoveDeclaredCheck = (index: number) => {
    const updated = declaredChecksList.filter((_, i) => i !== index);
    setDeclaredChecksList(updated);
    const sumChecks = updated.reduce((acc, c) => acc + c.amount, 0);
    setRealChecks(String(sumChecks));
  };

  // Inspect drawer detail handlers
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

  const handleCajaArqueoSubmit = async (realBalance: number, receipts: any[], checks: any[], routeNote?: string, notes?: string) => {
    try {
      if (cajaActionModal?.mode === 'close' && cajaActionModal.drawerId) {
        await api.closeDrawer(cajaActionModal.drawerId, realBalance, receipts, checks, routeNote, notes);
        setCajaActionModal(null);
        fetchDrawers();
      }
    } catch (err: any) {
      alert(err.message || 'Error al cerrar caja.');
    }
  };

  const handleCajaActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaActionModal) return;

    try {
      const amount = Number(amountInput);
      if (isNaN(amount) || amount < 0) {
        throw new Error('Ingrese un monto válido mayor o igual a 0.');
      }

      if (cajaActionModal.mode === 'open') {
        await api.openDrawer(cajaActionModal.branch, amount);
      } else if (cajaActionModal.mode === 'close' && cajaActionModal.drawerId) {
        await api.closeDrawer(cajaActionModal.drawerId, amount);
      }

      setCajaActionModal(null);
      setAmountInput('');
      fetchDrawers();
    } catch (err: any) {
      alert(err.message || 'Ocurrió un error al procesar la caja.');
    }
  };

  const handleDeleteReceipt = async (tx: any) => {
    const receiptName = tx.receiptNumber || `N° ${tx.id}`;
    const clientName = tx.persona?.name || 'Cliente';
    const amountStr = formatCurrency(Number(tx.amount));

    if (!window.confirm(`¿Estás seguro de eliminar el recibo ${receiptName} (${clientName} por ${amountStr})?\n\nEsta acción restablecerá ${amountStr} al saldo pendiente del cliente.`)) {
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.deleteReceipt(tx.id);
      
      if (auditTarget) {
        const remainingTxs = auditTarget.data.transactions.filter((t: any) => t.id !== tx.id);
        const amt = Number(tx.amount);
        const isOfficial = tx.billingType === 'OFFICIAL';
        const method = tx.paymentMethod;

        const updatedData = {
          ...auditTarget.data,
          totalToCollect: auditTarget.data.totalToCollect - amt,
          totalBranchA: isOfficial ? auditTarget.data.totalBranchA - amt : auditTarget.data.totalBranchA,
          totalBranchX: !isOfficial ? auditTarget.data.totalBranchX - amt : auditTarget.data.totalBranchX,
          totalCash: method === 'CASH' ? auditTarget.data.totalCash - amt : auditTarget.data.totalCash,
          totalChecks: method === 'CHECK' ? auditTarget.data.totalChecks - amt : auditTarget.data.totalChecks,
          totalTransfers: method === 'BANK_TRANSFER' ? auditTarget.data.totalTransfers - amt : auditTarget.data.totalTransfers,
          transactions: remainingTxs
        };

        setAuditTarget({
          ...auditTarget,
          data: updatedData
        });
      }

      fetchRendiciones();
      alert(res.message || 'Recibo eliminado correctamente.');
    } catch (err: any) {
      console.error('Error al eliminar recibo:', err);
      setErrorMsg(err.message || 'Error al eliminar recibo');
    } finally {
      setActionLoading(false);
    }
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
        realChecks: checksVal,
        routeNote: auditRouteNote ? auditRouteNote.trim() : undefined,
        notes: auditNotes ? auditNotes.trim() : undefined,
        declaredChecks: declaredChecksList
      };

      if (selectedDrawerId) {
        payload.destinationDrawerId = Number(selectedDrawerId);
      }

      if (auditTarget.type === 'seller') {
        payload.sellerId = auditTarget.data.user.id;
      } else {
        payload.routeId = auditTarget.data.routeId;
      }

      const res = await api.verifyRendicion(payload);
      
      // Guardar el resultado en el state para mostrar el modal de éxito con los envíos de WhatsApp
      if (res.status === 'success' && res.data) {
        setArqueoResult(res.data);
      } else {
        setSuccessMsg(res.message || 'Arqueo procesado y caja cerrada correctamente.');
        setTimeout(() => setSuccessMsg(null), 5000);
      }

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
          <button className="btn btn-ghost" onClick={() => { fetchRendiciones(); fetchDrawers(); }} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Tabs de Vendedores, Repartidores y Caja Diaria */}
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
          <button 
            type="button"
            onClick={() => setActiveTab('diaria')}
            style={{
              padding: '12px 6px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'diaria' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === 'diaria' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'diaria' ? 600 : 400,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Lock size={16} />
            Caja Diaria (Depósito)
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
                      <div style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{item.transactions.length} recibo(s) pendiente(s) de rendir</span>
                        {(() => {
                          const detected = getDetectedRoutesAndCities(item.transactions);
                          if (!detected.primary) return null;
                          return (
                            <span style={{ 
                              backgroundColor: '#f1f5f9', 
                              border: '1px solid #cbd5e1', 
                              padding: '1px 8px', 
                              borderRadius: '10px', 
                              fontSize: '0.74rem', 
                              color: '#334155', 
                              fontWeight: 500,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              📍 {detected.primary}
                            </span>
                          );
                        })()}
                      </div>
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
        ) : activeTab === 'routes' ? (
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
        ) : (() => {
          const activeDrawer = drawers.find(d => d.branch === 'DEPOSITO');
          const isOpen = !!activeDrawer;
          return (
            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
              <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                {isOpen && (
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }}></div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Caja Depósito</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Ventas de mostrador y depósito</p>
                  </div>
                  <div style={{ 
                    backgroundColor: isOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                    color: isOpen ? '#10b981' : '#ef4444', 
                    padding: '6px 12px', 
                    borderRadius: '20px', 
                    fontSize: '0.8rem', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap'
                  }}>
                    {isOpen ? <Unlock size={14} /> : <Lock size={14} />}
                    {isOpen ? 'Operativa' : 'Cerrada'}
                  </div>
                </div>

                <div style={{ flex: 1, margin: '16px 0' }}>
                  {isOpen ? (
                    <div style={{ padding: '14px', backgroundColor: 'var(--bg-light)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Fondo Inicial:</span>
                        <strong style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>${Number(activeDrawer.openingBalance).toLocaleString()}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Apertura:</span>
                        <span style={{ fontSize: '0.88rem' }}>{new Date(activeDrawer.openedAt).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      La caja se encuentra inactiva. Deberás abrirla con un saldo inicial para operar.
                    </div>
                  )}
                </div>

                <div>
                  {isOpen ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <button 
                        type="button"
                        className="btn btn-secondary" 
                        style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => handleInspectDrawer(activeDrawer)}
                      >
                        <Eye size={16} /> Ver Movimientos
                      </button>
                      <button 
                        type="button"
                        className="btn" 
                        style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px' }}
                        onClick={() => {
                          setAmountInput('');
                          setCajaActionModal({ open: true, branch: 'DEPOSITO', mode: 'close', drawerId: activeDrawer.id });
                        }}
                      >
                        Arqueo y Cierre de Caja
                      </button>
                    </div>
                  ) : (
                    <button 
                      type="button"
                      className="btn btn-primary" 
                      style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '8px' }}
                      onClick={() => {
                        setAmountInput('');
                        setCajaActionModal({ open: true, branch: 'DEPOSITO', mode: 'open' });
                      }}
                    >
                      Abrir Caja
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* MODAL DE ARQUEO Y CONCILIACIÓN */}
      {auditTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1380px', width: '96vw', height: '88vh', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: '24px', borderRadius: '12px', overflow: 'hidden' }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  Arqueo y Rendición: {auditTarget.type === 'seller' ? `Vendedor ${auditTarget.data.user.username.toUpperCase()}` : `Repartidor ${auditTarget.data.driverName} (Ruta #${auditTarget.data.routeId})`}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Estás auditando los cobros realizados en calle. Ingresá el conteo físico entregado y la Caja Central donde se guardará el dinero.
                </p>
              </div>
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
                gap: '8px',
                flexShrink: 0
              }}>
                <AlertCircle size={16} color="#ef4444" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              
              {/* Cuerpo del formulario en 2 columnas paralelas (Izquierda: Conteo y Conciliación | Derecha: Recibos siempre visibles) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 440px) 1fr', gap: '20px', flex: 1, overflow: 'hidden', minHeight: 0 }}>

                {/* PANEL IZQUIERDO: Esperado, Conteo y Widget de Conciliación */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '6px' }}>
                  
                  {/* Columna Izquierda: Esperado en Sistema */}
                  <div className="card" style={{ padding: '14px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      1. Sistema (Teórico Esperado)
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Efectivo en Sistema:</span>
                        <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(expectedCash)}</strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Cheques en Sistema:</span>
                        <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(expectedChecks)}</strong>
                      </div>
                      
                      <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Sucursal A (Oficial):</span>
                        <span style={{ fontWeight: 500 }}>{formatCurrency(auditTarget.data.totalBranchA)}</span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Sucursal X (Interna):</span>
                        <span style={{ fontWeight: 500 }}>{formatCurrency(auditTarget.data.totalBranchX)}</span>
                      </div>

                      <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.98rem', fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-primary)' }}>Total Esperado:</span>
                        <span style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{formatCurrency(totalExpected)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Arqueo Físico Recibido */}
                  <div className="card" style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        2. Conteo Físico Recibido
                      </h4>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => { setRealCash(String(expectedCash)); setRealChecks(String(expectedChecks)); }} 
                        style={{ fontSize: '0.75rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}
                        title="Auto-completar los casilleros con los montos esperados si coinciden sin diferencia"
                      >
                        ⚡ Sin Diferencia (Copiar)
                      </button>
                    </div>
                    
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
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
                        style={{ fontSize: '1.1rem', fontFamily: 'monospace', width: '100%', padding: '6px 10px' }}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Cheques Declarados ($)
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Carga por unidad o total</span>
                      </div>
                      <input 
                        type="number"
                        className="input"
                        placeholder="Monto total en cheques 0.00"
                        min="0"
                        step="0.01"
                        value={realChecks}
                        onChange={(e) => setRealChecks(e.target.value)}
                        style={{ fontSize: '1.1rem', fontFamily: 'monospace', width: '100%', marginBottom: '6px', padding: '6px 10px' }}
                      />

                      {/* Desglose Individual de Cheques */}
                      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', marginTop: '6px' }}>
                        <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                          + Registrar Cheque Físico Individual (N° de Cheque):
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="N° Cheque (ej: 00482910)" 
                            value={newCheckNumber} 
                            onChange={e => setNewCheckNumber(e.target.value)} 
                            style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}
                          />
                          <input 
                            type="text" 
                            className="input" 
                            placeholder="Banco" 
                            value={newCheckBank} 
                            onChange={e => setNewCheckBank(e.target.value)} 
                            style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input 
                            type="number" 
                            className="input" 
                            placeholder="Monto $" 
                            value={newCheckAmount} 
                            onChange={e => setNewCheckAmount(e.target.value)} 
                            style={{ flex: 1, fontSize: '0.78rem', padding: '4px 8px' }}
                          />
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={handleAddDeclaredCheck}
                            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                          >
                            + Añadir
                          </button>
                        </div>

                        {declaredChecksList.length > 0 && (
                          <div style={{ marginTop: '6px', maxHeight: '90px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                              <tbody>
                                {declaredChecksList.map((c, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '2px 0' }}><strong>N° {c.number}</strong> ({c.bank})</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>${c.amount.toLocaleString()}</td>
                                    <td style={{ width: '20px', textAlign: 'right' }}>
                                      <button type="button" onClick={() => handleRemoveDeclaredCheck(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Pueblo / Ruta de Cobro (Identificación)
                      </label>
                      <input 
                        type="text"
                        className="input"
                        placeholder="Ej: General Villegas, Bunge, Ruta 33..."
                        value={auditRouteNote}
                        onChange={(e) => setAuditRouteNote(e.target.value)}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                      />
                      {auditTarget?.data?.transactions && (() => {
                        const detected = getDetectedRoutesAndCities(auditTarget.data.transactions);
                        if (detected.list.length === 0) return null;
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>📍 Detectado:</span>
                            {detected.list.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setAuditRouteNote(item.name)}
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  backgroundColor: auditRouteNote === item.name ? '#e0f2fe' : '#f1f5f9',
                                  border: auditRouteNote === item.name ? '1px solid #0284c7' : '1px solid #cbd5e1',
                                  color: auditRouteNote === item.name ? '#0369a1' : '#334155',
                                  cursor: 'pointer',
                                  fontWeight: 500
                                }}
                              >
                                {item.name} ({item.count})
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="form-group" style={{ marginBottom: '0px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Observaciones del Arqueo
                      </label>
                      <input 
                        type="text"
                        className="input"
                        placeholder="Ej: Diferencia justificada por vueltos..."
                        value={auditNotes}
                        onChange={(e) => setAuditNotes(e.target.value)}
                        style={{ width: '100%', fontSize: '0.85rem', padding: '6px 10px' }}
                      />
                    </div>
                  </div>

                  {/* Widget de Conciliación y Diferencias en tiempo real */}
                  <div 
                    style={{ 
                      padding: '12px 16px', 
                      borderRadius: '8px', 
                      backgroundColor: totalDiff === 0 ? '#f0fdf4' : totalDiff > 0 ? '#f0fdfa' : '#fef2f2',
                      border: totalDiff === 0 ? '1px solid #bbf7d0' : totalDiff > 0 ? '1px solid #99f6e4' : '1px solid #fecaca',
                      color: totalDiff === 0 ? '#166534' : totalDiff > 0 ? '#0f766e' : '#991b1b',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: 700 }}>
                        {totalDiff === 0 ? 'Caja Conciliada (Cuadrado)' : totalDiff > 0 ? 'Sobrante Detectado' : 'Faltante de Caja'}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.9 }}>
                        Efectivo: {diffCash >= 0 ? '+' : ''}{formatCurrency(diffCash)} | 
                        Cheques: {diffChecks >= 0 ? '+' : ''}{formatCurrency(diffChecks)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>Diferencia Total</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace' }}>
                        {totalDiff > 0 ? '+' : ''}{formatCurrency(totalDiff)}
                      </div>
                    </div>
                  </div>

                </div>

                {/* PANEL DERECHO: Detalle completo de recibos y cobros asociados (SIEMPRE VISIBLE) */}
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
                  
                  <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="var(--color-primary)" />
                      Recibos y Cobros Incluidos ({auditTarget.data.transactions.length})
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Total Recaudado: <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{formatCurrency(totalExpected)}</strong>
                    </span>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
                    {auditTarget.data.transactions.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        No hay recibos asociados registrados en esta rendición.
                      </div>
                    ) : (
                      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '10px 12px' }}>Recibo / Pedido</th>
                            <th style={{ padding: '10px 12px' }}>Cliente</th>
                            <th style={{ padding: '10px 12px' }}>Sucursal</th>
                            <th style={{ padding: '10px 12px' }}>Medio</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Monto</th>
                            <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditTarget.data.transactions.map((tx: any) => (
                            <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                                {tx.receiptNumber || `Pedido #${tx.orderId || 'S/N'}`}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.persona?.name || 'Desconocido'}</div>
                                {(tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name) && (
                                  <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                    <span>📍 {tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name}</span>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ fontWeight: 600, color: tx.billingType === 'OFFICIAL' ? '#1e40af' : '#b45309' }}>
                                  {tx.billingType === 'OFFICIAL' ? 'A (Oficial)' : 'X (Interna)'}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ 
                                  padding: '3px 8px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.72rem', 
                                  fontWeight: 600,
                                  backgroundColor: tx.paymentMethod === 'CASH' ? '#ecfdf5' : tx.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                                  color: tx.paymentMethod === 'CASH' ? '#047857' : tx.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569'
                                }}>
                                  {tx.paymentMethod === 'CASH' ? 'EFECTIVO' : tx.paymentMethod === 'CHECK' ? 'CHEQUE' : tx.paymentMethod === 'BANK_TRANSFER' ? 'TRANSFERENCIA' : tx.paymentMethod}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                                {formatCurrency(Number(tx.amount))}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={() => handleDeleteReceipt(tx)}
                                  disabled={actionLoading}
                                  style={{ padding: '4px 6px', color: '#ef4444', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Eliminar recibo y restaurar saldo del cliente"
                                >
                                  <Trash2 size={14} color="#ef4444" />
                                  <span>Eliminar</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>

              {/* Botones de acción (Fijos al pie del modal) */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '12px', 
                borderTop: '1px solid var(--border-color)', 
                paddingTop: '16px',
                marginTop: '12px',
                flexShrink: 0
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
                    backgroundColor: 'var(--color-corp-red)', // Rojo corporativo reservado exclusivamente para la acción crítica
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: actionLoading ? 'default' : 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b90510'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--color-corp-red)'}
                >
                  {actionLoading ? 'Verificando Arqueo...' : 'Confirmar y Cerrar Rendición'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* HISTORIAL DE ARQUEOS (CAJAS CERRADAS) */}
      <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Historial de Arqueos (Cajas Cerradas)</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Desde</span>
              <input type="date" className="input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} style={{ padding: '6px 12px', fontSize: '0.85rem' }} />
            </div>
            <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Hasta</span>
              <input type="date" className="input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} style={{ padding: '6px 12px', fontSize: '0.85rem' }} />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Caja / Rama</th>
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
              {loadingHistory ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>Cargando historial de arqueos...</td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>No hay historiales de cajas cerradas en este período.</td>
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
                      <td style={{ padding: '12px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: d.drawerType === 'DEPOSITO' || d.branch === 'DEPOSITO' ? '#f1f5f9' : d.drawerType === 'REPARTIDOR' || d.branch?.startsWith('REPARTIDOR') ? '#ecfdf5' : '#eff6ff',
                            color: d.drawerType === 'DEPOSITO' || d.branch === 'DEPOSITO' ? '#475569' : d.drawerType === 'REPARTIDOR' || d.branch?.startsWith('REPARTIDOR') ? '#047857' : '#1d4ed8'
                          }}>
                            {d.drawerType === 'DEPOSITO' || d.branch === 'DEPOSITO' ? '🏢 Depósito' : d.drawerType === 'REPARTIDOR' || d.branch?.startsWith('REPARTIDOR') ? '🚚 Repartidor' : '💼 Vendedor'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {d.branch === 'DEPOSITO' ? 'Caja Depósito' : d.branch}
                        </div>
                        {d.routeNote && (
                          <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: '3px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={12} color="#0284c7" />
                            <span>{d.routeNote}</span>
                          </div>
                        )}
                        {d.notes && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                            Obs: {d.notes}
                          </div>
                        )}
                      </td>
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
                          type="button"
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
      </div>

      {/* Modal Arqueo / Apertura para Caja Depósito */}
      {cajaActionModal?.open && cajaActionModal.mode === 'open' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Apertura de Caja Depósito</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setCajaActionModal(null)}>✕</button>
            </div>
            <form onSubmit={handleCajaActionSubmit}>
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
                <button type="button" className="btn btn-secondary" onClick={() => setCajaActionModal(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>Abrir Caja</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cajaActionModal?.open && cajaActionModal.mode === 'close' && (
        <ArqueoCajaModal 
          drawer={drawers.find(d => d.id === cajaActionModal.drawerId)}
          onClose={() => setCajaActionModal(null)}
          onSuccess={handleCajaArqueoSubmit}
        />
      )}

      {/* Modal de Inspección de Caja Histórica */}
      {inspectDrawer && (
        <div className="modal-overlay" onClick={handleCloseInspect}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '95%', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                {inspectDrawer.status === 'OPEN' ? 'Detalle de Caja Activa: ' : 'Arqueo Histórico: '}
                {inspectDrawer.branch === 'DEPOSITO' ? 'Caja Depósito' : inspectDrawer.branch}
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
                  {inspectDrawer.routeNote && (
                    <div style={{ color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <MapPin size={14} color="#0284c7" />
                      <span>Pueblo / Ruta: {inspectDrawer.routeNote}</span>
                    </div>
                  )}
                  {inspectDrawer.notes && (
                    <div style={{ marginTop: '2px' }}><strong>Observaciones:</strong> <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{inspectDrawer.notes}</span></div>
                  )}
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

      {/* MODAL DE RESULTADO DE ARQUEO Y NOTIFICACIÓN WHATSAPP */}
      {arqueoResult && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px', width: '95%', padding: '24px', borderRadius: '12px' }}>
            <div className="modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
                <CheckCircle size={24} color="#10b981" />
                Arqueo Procesado Exitosamente
              </h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ padding: '4px' }} 
                onClick={() => setArqueoResult(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem' }}>Caja / Rama:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{arqueoResult.drawer?.branch || 'Caja Operativa'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem' }}>Diferencia de Arqueo:</span>
                  <strong style={{ color: arqueoResult.difference === 0 ? '#166534' : arqueoResult.difference > 0 ? '#0f766e' : '#b91c1c' }}>
                    {arqueoResult.difference > 0 ? '+' : ''}${Number(arqueoResult.difference || 0).toLocaleString('es-AR')}
                  </strong>
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
              Comprobantes validados y notificados por el ERP ({arqueoResult.verifiedReceipts?.length || 0})
            </h4>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', maxHeight: '250px', overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0 }}>
                  <tr style={{ color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '10px' }}>Recibo</th>
                    <th style={{ padding: '10px' }}>Cliente</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>WhatsApp (Respaldo)</th>
                  </tr>
                </thead>
                <tbody>
                  {!arqueoResult.verifiedReceipts || arqueoResult.verifiedReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>No se procesaron recibos individuales en esta rendición.</td>
                    </tr>
                  ) : (
                    arqueoResult.verifiedReceipts.map((r: any) => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{r.receiptNumber}</td>
                        <td style={{ padding: '10px' }}>
                          <div>{r.clientName}</div>
                          {r.clientPhone ? (
                            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 500 }}>
                              📲 Enviado al ERP (+{r.clientPhone.replace(/\D/g, '')})
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 500 }}>
                              ⚠️ Sin teléfono registrado
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                          ${r.amount.toLocaleString('es-AR')}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {r.clientPhone ? (
                            <a 
                              href={getWhatsAppSendLink(r.clientPhone, r.clientName, r.receiptNumber, r.amount, r.id)}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="btn btn-ghost"
                              style={{ 
                                padding: '4px 10px', 
                                fontSize: '0.75rem', 
                                color: '#047857', 
                                backgroundColor: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                borderRadius: '4px',
                                textDecoration: 'none',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Reenviar comprobante por WhatsApp Web"
                            >
                              <span>Reenviar</span>
                            </a>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setArqueoResult(null)}
                style={{ padding: '8px 24px', backgroundColor: 'var(--text-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RendicionesDashboard;
