import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DollarSign, RefreshCw, PlusCircle, Landmark, CheckSquare, Eye, ChevronRight, Lock, Edit2 } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import FinanceMovementModal from './FinanceMovementModal';
import { computeFilteredMetricsAndLedger } from './finanzas/finanzasHelpers';
import { FinanzasBankReconciliationModal } from './finanzas/FinanzasBankReconciliationModal';
import { FinanzasExpenseModal, FinanzasDrawerInspectModal, FinanzasCentralCloseAndBankModals } from './finanzas/FinanzasModals';

export default function FinanzasDashboard() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [drawers, setDrawers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cajaGrandeBalance, setCajaGrandeBalance] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [inspectingDrawer, setInspectingDrawer] = useState<any | null>(null);

  const [editingBankModalOpen, setEditingBankModalOpen] = useState(false);
  const [editingBankId, setEditingBankId] = useState<number | null>(null);
  const [editingBankName, setEditingBankName] = useState('');
  const [editingBankAccountNumber, setEditingBankAccountNumber] = useState('');
  const [submittingEditBank, setSubmittingEditBank] = useState(false);

  const [centralCloseModalOpen, setCentralCloseModalOpen] = useState(false);
  const [centralCloseRealBalance, setCentralCloseRealBalance] = useState('0');
  const [centralCloseNotes, setCentralCloseNotes] = useState('');
  const [submittingCentralClose, setSubmittingCentralClose] = useState(false);

  const [reconModalOpen, setReconModalOpen] = useState(false);
  const [reconBankId, setReconBankId] = useState('');

  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('CASH');
  const [expenseBillingType, setExpenseBillingType] = useState('INTERNAL');
  const [modalError, setModalError] = useState<string | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<'CASH' | 'CHECK' | 'TRANSFER' | 'EXPENSE' | 'NET'>('CASH');
  const [modalTitle, setModalTitle] = useState('');
  const [modalSubtitle, setModalSubtitle] = useState('');
  const [modalMovements, setModalMovements] = useState<any[]>([]);

  useEffect(() => { fetchFinancialData(); }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [allDrawers, allTxs, banks] = await Promise.all([api.getCashDrawers(), api.getTransactions(), api.getBankAccounts()]);
      setDrawers(allDrawers || []);
      setTransactions(allTxs || []);

      const centralClosed = (allDrawers || [])
        .filter((d: any) => d.status === 'CLOSED' && d.drawerType === 'CENTRAL')
        .sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
      const lastCentral = centralClosed[0] || null;
      const cutoffDate = lastCentral ? new Date(lastCentral.closedAt) : null;
      const baseBalance = lastCentral ? Number(lastCentral.realBalance || 0) : 0;

      const closed = (allDrawers || []).filter((d: any) => d.status === 'CLOSED' && d.drawerType !== 'CENTRAL' && (!cutoffDate || new Date(d.closedAt) > cutoffDate));
      const netDrawersCash = closed.reduce((acc: number, curr: any) => acc + (Number(curr.realBalance || 0) - Number(curr.openingBalance || 0)), 0);
      const overallExpenses = (allTxs || []).filter((t: any) => t.type === 'OUTCOME' && t.cashDrawerId === null && t.bankAccountId === null && (!cutoffDate || new Date(t.createdAt) > cutoffDate));
      const totalExpensesOverall = overallExpenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

      setCajaGrandeBalance(baseBalance + netDrawersCash - totalExpensesOverall);
      setBankAccounts(banks || []);
      if (banks?.length > 0 && !reconBankId) setReconBankId(banks[0].id.toString());
    } catch (err) {
      console.error('Error fetching financial data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBankId || !editingBankName.trim()) return;
    setSubmittingEditBank(true);
    try {
      await api.updateBankAccount(editingBankId, { name: editingBankName.trim(), accountNumber: editingBankAccountNumber.trim() });
      setEditingBankModalOpen(false);
      setBankAccounts((await api.getBankAccounts()) || []);
    } catch (err: any) { alert(err?.message || 'Error al guardar cuenta bancaria'); } finally { setSubmittingEditBank(false); }
  };

  const handleCentralClose = async (e: React.FormEvent) => {
    e.preventDefault();
    const realBal = Number(centralCloseRealBalance !== '' ? centralCloseRealBalance : 0);
    if (isNaN(realBal) || realBal < 0) return setModalError('El saldo del conteo no puede ser negativo.');

    const ok = await confirm({
      title: '¿Confirmar Cierre de Caja Grande?',
      message: `Se cerrará la Caja Grande (Saldo acumulado actual: $${cajaGrandeBalance.toLocaleString('es-AR')}). El nuevo ciclo recomenzará con $${realBal.toLocaleString('es-AR')}.`,
      confirmText: 'Sí, Cerrar Caja Grande',
      cancelText: 'Cancelar',
      type: 'warning',
    });
    if (!ok) return;

    setSubmittingCentralClose(true);
    setModalError(null);
    try {
      await api.closeCentralDrawer(realBal, centralCloseNotes.trim() || undefined);
      setCentralCloseModalOpen(false); setCentralCloseRealBalance('0'); setCentralCloseNotes('');
      fetchFinancialData();
    } catch (err: any) { setModalError(err.message || 'Error al cerrar la Caja Grande.'); } finally { setSubmittingCentralClose(false); }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseAmount);
    if (isNaN(amount) || amount <= 0) return setModalError('Ingrese un monto válido mayor a 0.');
    if (!expenseDescription.trim()) return setModalError('La descripción del gasto es obligatoria.');

    setSubmittingExpense(true);
    setModalError(null);
    try {
      await api.createExpense(amount, expenseDescription.trim(), expensePaymentMethod, expenseBillingType);
      setExpenseModalOpen(false); setExpenseAmount(''); setExpenseDescription(''); setExpensePaymentMethod('CASH'); setExpenseBillingType('INTERNAL');
      fetchFinancialData();
    } catch (err: any) { setModalError(err.message || 'Error al guardar el gasto.'); } finally { setSubmittingExpense(false); }
  };

  const m = computeFilteredMetricsAndLedger(drawers, transactions, filterStartDate, filterEndDate);

  const openDetailModal = (category: 'CASH' | 'CHECK' | 'TRANSFER' | 'EXPENSE' | 'NET', title: string, subtitle: string, movements: any[]) => {
    setModalCategory(category); setModalTitle(title); setModalSubtitle(subtitle); setModalMovements(movements); setDetailModalOpen(true);
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando información financiera...</div>;

  const kpiCards = [
    { key: 'CASH' as const, label: 'Ingreso Efectivo', val: m.cashIncome, items: m.detailedCashItems, bg: '#ecfdf5', border: '#a7f3d0', color: '#047857', title: 'Desglose de Ingresos en Efectivo', sub: 'Cobros en efectivo registrados en cierres de caja.' },
    { key: 'CHECK' as const, label: 'Ingreso Cheques', val: m.checkIncome, items: m.detailedCheckItems, bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', title: 'Desglose de Ingresos en Cheques', sub: 'Valores en cheques físicos y eCheqs recibidos.' },
    { key: 'TRANSFER' as const, label: 'Ingreso Transferencias', val: m.totalTransfers, items: m.detailedTransferItems, bg: '#f0fdfa', border: '#99f6e4', color: '#0f766e', title: 'Desglose de Transferencias', sub: 'Transferencias acreditadas en cuentas bancarias.' },
    { key: 'EXPENSE' as const, label: 'Gastos (Egresos)', val: m.totalExpenses, items: m.detailedExpenseItems, bg: '#fff5f5', border: '#feb2b2', color: '#c53030', title: 'Desglose de Gastos y Egresos', sub: 'Salidas directas y gastos operativos de tesorería.' },
    { key: 'NET' as const, label: 'Recaudación Neta', val: m.netIncome, items: m.detailedNetItems, bg: '#f8fafc', border: '#cbd5e1', color: '#0f172a', title: 'Resumen Consolidado de Recaudación Neta', sub: 'Ingresos menos egresos del período.' },
  ];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '28px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#e5e7eb' }}>
            <DollarSign size={26} color="#10b981" /> Caja Grande (Central)
          </h2>
          <p style={{ margin: '6px 0 0 0', opacity: 0.8, fontSize: '0.9rem', color: '#e5e7eb' }}>Fondo consolidado acumulativo de arqueos y egresos generales de tesorería.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Saldo Disponible</div>
            <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#10b981', fontFamily: 'monospace' }}>${Math.round(cajaGrandeBalance).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" style={{ backgroundColor: '#334155', borderColor: '#475569', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }} onClick={() => { setModalError(null); setCentralCloseRealBalance('0'); setCentralCloseModalOpen(true); }}>
              <Lock size={15} /> Cerrar Caja Grande
            </button>
            <button type="button" className="btn btn-secondary" style={{ backgroundColor: '#334155', borderColor: '#475569', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }} onClick={() => setReconModalOpen(true)}>
              <CheckSquare size={15} /> Conciliación Bancaria
            </button>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }} onClick={() => setExpenseModalOpen(true)}>
              <PlusCircle size={16} /> Registrar Gasto
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Rendimiento & Margen Financiero</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Desde</span>
          <input type="date" className="input" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} style={{ padding: '6px 10px' }} />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Hasta</span>
          <input type="date" className="input" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} style={{ padding: '6px 10px' }} />
          <button className="btn btn-ghost" onClick={fetchFinancialData} title="Refrescar"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '14px' }}>
        {kpiCards.map((card) => (
          <div key={card.key} onClick={() => openDetailModal(card.key, card.title, card.sub, card.items)} style={{ padding: '18px', backgroundColor: card.bg, border: `1px solid ${card.border}`, borderRadius: '12px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: card.color, fontWeight: 700, textTransform: 'uppercase' }}>{card.label}</div>
              <Eye size={15} color={card.color} />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>${Math.round(card.val).toLocaleString('es-AR')}</div>
            <div style={{ fontSize: '0.74rem', color: card.color, marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <span>Ver {card.items.length} movimientos</span><ChevronRight size={12} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '1.15rem', fontWeight: 600 }}>Movimientos de Caja Grande</h3>
        <div className="table-responsive card">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px' }}>Fecha/Hora</th>
                <th style={{ padding: '10px' }}>Tipo</th>
                <th style={{ padding: '10px' }}>Responsable</th>
                <th style={{ padding: '10px' }}>Medio</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {m.ledger.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>No se registran movimientos en el período seleccionado.</td></tr>
              ) : (
                m.ledger.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', cursor: item.drawer ? 'pointer' : 'default' }} onClick={() => item.drawer && setInspectingDrawer(item.drawer)}>
                    <td style={{ padding: '10px', fontSize: '0.82rem' }}>{new Date(item.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: item.type === 'INGRESO' ? '#ecfdf5' : '#fff5f5', color: item.type === 'INGRESO' ? '#047857' : '#c53030' }}>{item.type}</span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>
                      {item.description}
                      {item.drawer && <span style={{ marginLeft: '8px', fontSize: '0.72rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px' }}>Ver recibos ({item.drawer.transactions?.length || 0})</span>}
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: item.type === 'INGRESO' ? '#047857' : '#c53030' }}>
                      {item.type === 'INGRESO' ? '+' : '-'}${Math.round(item.amount).toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><Landmark size={18} /> Cuentas Bancarias / Billeteras</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bankAccounts.map((b: any) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-light)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {b.name}
                    <button onClick={() => { setEditingBankId(b.id); setEditingBankName(b.name); setEditingBankAccountNumber(b.accountNumber || ''); setEditingBankModalOpen(true); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}><Edit2 size={13} /></button>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{b.accountNumber || 'Sin Nro Cuenta'}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#10b981', fontFamily: 'monospace' }}>${Math.round(Number(b.balance)).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', fontWeight: 600 }}>🏦 Cobros por Transferencia (Período)</h3>
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <tbody>
                {m.transfers.length === 0 ? (
                  <tr><td style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Sin transferencias en el período.</td></tr>
                ) : (
                  m.transfers.map((t: any) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>{new Date(t.createdAt).toLocaleDateString('es-AR')}</td>
                      <td style={{ padding: '8px', fontWeight: 600 }}>{t.persona?.name || 'Varios'}</td>
                      <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{t.bankAccount?.name || 'Banco'}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f766e' }}>+${Math.round(Number(t.amount)).toLocaleString('es-AR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <FinanzasExpenseModal
        isOpen={expenseModalOpen} onClose={() => setExpenseModalOpen(false)}
        expenseAmount={expenseAmount} setExpenseAmount={setExpenseAmount}
        expenseDescription={expenseDescription} setExpenseDescription={setExpenseDescription}
        expensePaymentMethod={expensePaymentMethod} setExpensePaymentMethod={setExpensePaymentMethod}
        expenseBillingType={expenseBillingType} setExpenseBillingType={setExpenseBillingType}
        modalError={modalError} submitting={submittingExpense} onSubmit={handleCreateExpense}
      />

      <FinanzasBankReconciliationModal
        isOpen={reconModalOpen} onClose={() => setReconModalOpen(false)}
        bankAccounts={bankAccounts} reconBankId={reconBankId} setReconBankId={setReconBankId}
        onRefreshMainData={fetchFinancialData}
      />

      <FinanceMovementModal
        isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)}
        title={modalTitle} subtitle={modalSubtitle} categoryKey={modalCategory}
        dateRangeText={`${filterStartDate} - ${filterEndDate}`} movements={modalMovements}
      />

      <FinanzasDrawerInspectModal inspectingDrawer={inspectingDrawer} onClose={() => setInspectingDrawer(null)} />

      <FinanzasCentralCloseAndBankModals
        centralCloseOpen={centralCloseModalOpen} onCloseCentral={() => setCentralCloseModalOpen(false)}
        cajaGrandeBalance={cajaGrandeBalance} realBalance={centralCloseRealBalance} setRealBalance={setCentralCloseRealBalance}
        notes={centralCloseNotes} setNotes={setCentralCloseNotes} modalError={modalError}
        submittingCentral={submittingCentralClose} onSubmitCentral={handleCentralClose}
        editBankOpen={editingBankModalOpen} onCloseEditBank={() => setEditingBankModalOpen(false)}
        bankName={editingBankName} setBankName={setEditingBankName}
        bankAccountNumber={editingBankAccountNumber} setBankAccountNumber={setEditingBankAccountNumber}
        submittingBank={submittingEditBank} onSubmitBank={handleSaveBank}
      />
    </div>
  );
}
