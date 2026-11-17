import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DollarSign, RefreshCw, PlusCircle, CheckSquare, Eye, ChevronRight, Lock } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import FinanceMovementModal from './FinanceMovementModal';
import { computeCajaGrandeBalance, computeFilteredMetricsAndLedger } from './finanzas/finanzasHelpers';
import { FinanzasBankReconciliationModal } from './finanzas/FinanzasBankReconciliationModal';
import { FinanzasExpenseModal, FinanzasDrawerInspectModal, FinanzasCentralCloseAndBankModals } from './finanzas/FinanzasModals';
import { FinanzasBanksCard } from './finanzas/FinanzasBanksCard';

export default function FinanzasDashboard() {
  const confirm = useConfirm();
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';
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

  const [filterStartDate, setFilterStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
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
  const [modalMovements, setModalMovements] = useState<any[]>([]);

  useEffect(() => { fetchFinancialData(); }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const [allDrawers, allTxs, banks] = await Promise.all([api.getCashDrawers(), api.getTransactions(), api.getBankAccounts()]);
      setDrawers(allDrawers || []);
      setTransactions(allTxs || []);
      setCajaGrandeBalance(computeCajaGrandeBalance(allDrawers || [], allTxs || []));
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
    setSubmittingEditBank(true); setModalError(null);
    try {
      await api.updateBankAccount(editingBankId, { name: editingBankName.trim(), accountNumber: editingBankAccountNumber.trim() });
      setEditingBankModalOpen(false);
      setBankAccounts((await api.getBankAccounts()) || []);
    } catch (err: any) { setModalError(err?.message || 'Error al guardar cuenta bancaria.'); } finally { setSubmittingEditBank(false); }
  };

  const handleCentralClose = async (e: React.FormEvent) => {
    e.preventDefault();
    const realBal = Number(centralCloseRealBalance !== '' ? centralCloseRealBalance : 0);
    if (isNaN(realBal) || realBal < 0) return setModalError('El saldo del conteo no puede ser negativo.');
    const ok = await confirm({
      title: '¿Confirmar Cierre de Caja Grande?',
      message: `Se cerrará la Caja Grande ($${cajaGrandeBalance.toLocaleString('es-AR')}). El nuevo ciclo comenzará con $${realBal.toLocaleString('es-AR')}.`,
      confirmText: 'Confirmar Cierre', cancelText: 'Cancelar', type: 'warning',
    });
    if (!ok) return;
    setSubmittingCentralClose(true); setModalError(null);
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
    setSubmittingExpense(true); setModalError(null);
    try {
      await api.createExpense(amount, expenseDescription.trim(), expensePaymentMethod, expenseBillingType);
      setExpenseModalOpen(false); setExpenseAmount(''); setExpenseDescription(''); setExpensePaymentMethod('CASH'); setExpenseBillingType('INTERNAL');
      fetchFinancialData();
    } catch (err: any) { setModalError(err.message || 'Error al guardar el gasto.'); } finally { setSubmittingExpense(false); }
  };

  const m = computeFilteredMetricsAndLedger(drawers, transactions, filterStartDate, filterEndDate);
  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando información financiera...</div>;

  const kpiCards = [
    { key: 'CASH' as const, label: 'Ingresos en Efectivo', val: m.cashIncome, items: m.detailedCashItems, bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' },
    { key: 'CHECK' as const, label: 'Ingresos en Cheques', val: m.checkIncome, items: m.detailedCheckItems, bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
    { key: 'TRANSFER' as const, label: 'Transferencias', val: m.totalTransfers, items: m.detailedTransferItems, bg: '#f0fdfa', border: '#99f6e4', color: '#0f766e' },
    { key: 'EXPENSE' as const, label: 'Gastos y Egresos', val: m.totalExpenses, items: m.detailedExpenseItems, bg: '#fff5f5', border: '#feb2b2', color: '#c53030' },
    { key: 'NET' as const, label: 'Recaudación Neta', val: m.netIncome, items: m.detailedNetItems, bg: '#f8fafc', border: '#cbd5e1', color: '#0f172a' },
  ];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '24px 28px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#e5e7eb' }}>
          <DollarSign size={24} color="#10b981" aria-hidden="true" /> Caja Grande
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.82rem', opacity: 0.8 }}>Saldo</div>
            <div className="tabular-nums" style={{ fontSize: '2.1rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>${Math.round(cajaGrandeBalance).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isAdmin && (
              <button type="button" className="btn btn-secondary" style={{ backgroundColor: '#334155', borderColor: '#475569', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }} onClick={() => { setModalError(null); setCentralCloseRealBalance('0'); setCentralCloseModalOpen(true); }}>
                <Lock size={15} aria-hidden="true" /> Cerrar Caja
              </button>
            )}
            <button type="button" className="btn btn-secondary" style={{ backgroundColor: '#334155', borderColor: '#475569', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }} onClick={() => setReconModalOpen(true)}>
              <CheckSquare size={15} aria-hidden="true" /> Conciliar
            </button>
            <button type="button" className="btn btn-primary" style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 14px' }} onClick={() => { setModalError(null); setExpenseModalOpen(true); }}>
              <PlusCircle size={16} aria-hidden="true" /> Gasto
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Período</h3>
        <search aria-label="Filtrar período financiero" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="fin-start-date" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Desde</label>
          <input id="fin-start-date" type="date" className="input" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} style={{ padding: '6px 10px', width: 'auto' }} />
          <label htmlFor="fin-end-date" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Hasta</label>
          <input id="fin-end-date" type="date" className="input" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} style={{ padding: '6px 10px', width: 'auto' }} />
          <button type="button" className="btn btn-ghost" onClick={fetchFinancialData} aria-label="Actualizar" title="Actualizar"><RefreshCw size={16} aria-hidden="true" /></button>
        </search>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        {kpiCards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => { setModalCategory(card.key); setModalTitle(card.label); setModalMovements(card.items); setDetailModalOpen(true); }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '16px 18px',
              backgroundColor: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
              width: '100%',
              minWidth: 0,
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', width: '100%' }}>
              <span style={{ fontSize: '0.82rem', color: card.color, fontWeight: 600, lineHeight: 1.25 }}>{card.label}</span>
              <Eye size={15} color={card.color} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.8 }} />
            </div>
            <div className="tabular-nums" style={{ fontSize: 'clamp(1.25rem, 1.5vw, 1.55rem)', lineHeight: 1.15, fontWeight: 700, color: card.color, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              ${Math.round(card.val).toLocaleString('es-AR')}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.75rem', color: card.color, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, opacity: 0.9 }}>
              <span>{card.items.length} movimientos</span><ChevronRight size={13} aria-hidden="true" />
            </div>
          </button>
        ))}
      </div>

      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.15rem', fontWeight: 600 }}>Movimientos</h3>
        <div className="table-container table-container--sticky" role="region" aria-label="Movimientos de Caja Grande" tabIndex={0}>
          <table>
            <thead>
              <tr><th scope="col">Fecha / Hora</th><th scope="col">Tipo</th><th scope="col">Responsable</th><th scope="col">Medio</th><th scope="col" style={{ textAlign: 'right' }}>Monto</th></tr>
            </thead>
            <tbody>
              {m.ledger.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>Sin movimientos</td></tr>
              ) : m.ledger.map((item) => (
                <tr key={item.id} style={{ cursor: item.drawer ? 'pointer' : 'default' }} onClick={() => item.drawer && setInspectingDrawer(item.drawer)}>
                  <td style={{ fontSize: '0.82rem' }}>{new Date(item.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td><span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: item.type === 'INGRESO' ? '#ecfdf5' : '#fff5f5', color: item.type === 'INGRESO' ? '#047857' : '#c53030' }}>{item.type}</span></td>
                  <td style={{ fontWeight: 600 }}>
                    {item.description}
                    {item.drawer && <span style={{ marginLeft: '8px', fontSize: '0.72rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px' }}>{item.drawer.transactions?.length || 0} recibos</span>}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{item.paymentMethod}</td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: item.type === 'INGRESO' ? '#047857' : '#c53030' }}>
                    {item.type === 'INGRESO' ? '+' : '-'}${Math.round(item.amount).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        <FinanzasBanksCard
          bankAccounts={bankAccounts}
          onEditBank={(b) => {
            setModalError(null);
            setEditingBankId(b.id);
            setEditingBankName(b.name);
            setEditingBankAccountNumber(b.accountNumber || '');
            setEditingBankModalOpen(true);
          }}
        />

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Transferencias</h3>
            {(() => {
              const pendingCount = m.transfers.filter((t: any) => !t.verified).length;
              return pendingCount > 0 ? (
                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', backgroundColor: '#fef3c7', color: '#b45309' }}>
                  {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}
                </span>
              ) : null;
            })()}
          </div>
          <div className="table-container" role="region" aria-label="Transferencias del período" tabIndex={0} style={{ maxHeight: '260px', marginTop: 0 }}>
            <table style={{ fontSize: '0.82rem' }}>
              <thead><tr><th scope="col">Fecha</th><th scope="col">Cliente</th><th scope="col">Cuenta</th><th scope="col">Estado</th><th scope="col" style={{ textAlign: 'right' }}>Monto</th></tr></thead>
              <tbody>
                {m.transfers.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Sin transferencias</td></tr>
                ) : m.transfers.map((t: any) => (
                  <tr key={t.id}>
                    <td>{new Date(t.createdAt).toLocaleDateString('es-AR')}</td>
                    <td style={{ fontWeight: 600 }}>{t.persona?.name || 'Varios'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.bankAccount?.name || 'Sin cuenta'}</td>
                    <td>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', backgroundColor: t.verified ? '#dcfce7' : '#fef3c7', color: t.verified ? '#15803d' : '#b45309' }}>
                        {t.verified ? 'Conciliada' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f766e' }}>+${Math.round(Number(t.amount)).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <FinanzasExpenseModal
        isOpen={expenseModalOpen} onClose={() => { setModalError(null); setExpenseModalOpen(false); }}
        expenseAmount={expenseAmount} setExpenseAmount={setExpenseAmount} expenseDescription={expenseDescription} setExpenseDescription={setExpenseDescription}
        expensePaymentMethod={expensePaymentMethod} setExpensePaymentMethod={setExpensePaymentMethod} expenseBillingType={expenseBillingType} setExpenseBillingType={setExpenseBillingType}
        modalError={modalError} submitting={submittingExpense} onSubmit={handleCreateExpense}
      />
      <FinanzasBankReconciliationModal isOpen={reconModalOpen} onClose={() => setReconModalOpen(false)} bankAccounts={bankAccounts} reconBankId={reconBankId} setReconBankId={setReconBankId} onRefreshMainData={fetchFinancialData} />
      <FinanceMovementModal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title={modalTitle} categoryKey={modalCategory} dateRangeText={`${filterStartDate} - ${filterEndDate}`} movements={modalMovements} />
      <FinanzasDrawerInspectModal inspectingDrawer={inspectingDrawer} onClose={() => setInspectingDrawer(null)} />
      <FinanzasCentralCloseAndBankModals
        centralCloseOpen={centralCloseModalOpen} onCloseCentral={() => { setModalError(null); setCentralCloseModalOpen(false); }}
        cajaGrandeBalance={cajaGrandeBalance} realBalance={centralCloseRealBalance} setRealBalance={setCentralCloseRealBalance}
        notes={centralCloseNotes} setNotes={setCentralCloseNotes} modalError={modalError} submittingCentral={submittingCentralClose} onSubmitCentral={handleCentralClose}
        editBankOpen={editingBankModalOpen} onCloseEditBank={() => { setModalError(null); setEditingBankModalOpen(false); }}
        bankName={editingBankName} setBankName={setEditingBankName} bankAccountNumber={editingBankAccountNumber} setBankAccountNumber={setEditingBankAccountNumber}
        submittingBank={submittingEditBank} onSubmitBank={handleSaveBank}
      />
    </div>
  );
}
