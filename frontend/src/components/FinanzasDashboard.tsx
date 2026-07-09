import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DollarSign, RefreshCw, PlusCircle, AlertCircle } from 'lucide-react';

export default function FinanzasDashboard() {
  const [loading, setLoading] = useState(true);
  const [drawers, setDrawers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cajaGrandeBalance, setCajaGrandeBalance] = useState(0);

  // Date Filters
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Expense Modal state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('CASH');
  const [expenseBillingType, setExpenseBillingType] = useState('INTERNAL');
  const [modalError, setModalError] = useState<string | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // 1. Get closed cash drawers to compute Caja Grande central balance
      const allDrawers = await api.getCashDrawers();
      setDrawers(allDrawers || []);

      // 2. Get all transactions to identify expenses
      const allTxs = await api.getTransactions();
      setTransactions(allTxs || []);

      // 3. Compute overall Caja Grande Balance
      const closed = (allDrawers || []).filter((d: any) => d.status === 'CLOSED');
      const netDrawersCash = closed.reduce((acc: number, curr: any) => acc + (Number(curr.realBalance || 0) - Number(curr.openingBalance || 0)), 0);
      
      const overallExpenses = (allTxs || []).filter(
        (t: any) => t.type === 'OUTCOME' && t.cashDrawerId === null && t.bankAccountId === null
      );
      const totalExpensesOverall = overallExpenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

      setCajaGrandeBalance(netDrawersCash - totalExpensesOverall);
    } catch (err: any) {
      console.error('Error fetching financial data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(expenseAmount);

    if (isNaN(amount) || amount <= 0) {
      setModalError('Por favor, ingrese un monto válido mayor a 0.');
      return;
    }
    if (!expenseDescription.trim()) {
      setModalError('La descripción del gasto es obligatoria.');
      return;
    }

    setSubmittingExpense(true);
    setModalError(null);

    try {
      await api.createExpense(amount, expenseDescription.trim(), expensePaymentMethod, expenseBillingType);
      
      // Reset form and refresh
      setExpenseModalOpen(false);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpensePaymentMethod('CASH');
      setExpenseBillingType('INTERNAL');
      
      fetchFinancialData();
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Error al guardar el gasto.');
    } finally {
      setSubmittingExpense(false);
    }
  };

  // 4. Calculate metrics for the filtered date range
  const getFilteredMetricsAndLedger = () => {
    const [sYear, sMonth, sDay] = filterStartDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
    const [eYear, eMonth, eDay] = filterEndDate.split('-').map(Number);
    const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    // Closed drawers closed in the period
    const closedInPeriod = drawers.filter((d: any) => {
      if (d.status !== 'CLOSED') return false;
      const closedDate = new Date(d.closedAt);
      return closedDate >= start && closedDate <= end;
    });

    // Sum expected/counted Cash and Checks inside those closed drawers
    let cashIncome = 0;
    let checkIncome = 0;

    closedInPeriod.forEach((d: any) => {
      d.transactions?.forEach((t: any) => {
        if (t.type === 'INCOME') {
          if (t.paymentMethod === 'CASH') cashIncome += Number(t.amount);
          else if (t.paymentMethod === 'CHECK') checkIncome += Number(t.amount);
        } else if (t.type === 'OUTCOME') {
          if (t.paymentMethod === 'CASH') cashIncome -= Number(t.amount);
          else if (t.paymentMethod === 'CHECK') checkIncome -= Number(t.amount);
        }
      });
    });

    // Expenses in period
    const expensesInPeriod = transactions.filter((t: any) => {
      if (t.type !== 'OUTCOME' || t.cashDrawerId !== null || t.bankAccountId !== null) return false;
      const txDate = new Date(t.createdAt);
      return txDate >= start && txDate <= end;
    });

    const totalExpenses = expensesInPeriod.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    // Ledger: combine Drawer Closures deposits and direct expenses
    const ledgerItems: any[] = [];

    // Closure deposits as entry items
    closedInPeriod.forEach((d: any) => {
      const netAmount = Number(d.realBalance || 0) - Number(d.openingBalance || 0);
      ledgerItems.push({
        id: `drawer-${d.id}`,
        date: d.closedAt,
        type: 'INGRESO',
        description: `Depósito por cierre de caja: ${d.branch}`,
        paymentMethod: 'Varios',
        amount: netAmount,
      });
    });

    // Expenses as exit items
    expensesInPeriod.forEach((t: any) => {
      ledgerItems.push({
        id: `tx-${t.id}`,
        date: t.createdAt,
        type: 'EGRESO',
        description: `Gasto: ${t.description}`,
        paymentMethod: t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod === 'CHECK' ? 'CHEQUE' : 'OTRO',
        amount: Number(t.amount),
      });
    });

    // Sort ledger items by date descending
    ledgerItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      cashIncome,
      checkIncome,
      totalExpenses,
      netIncome: cashIncome + checkIncome - totalExpenses,
      ledger: ledgerItems,
    };
  };

  const { cashIncome, checkIncome, totalExpenses, netIncome, ledger } = getFilteredMetricsAndLedger();

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando información financiera...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Caja Grande */}
      <div className="card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '30px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#e5e7eb' }}>
            <DollarSign size={28} color="#10b981" /> Caja Grande (Central)
          </h2>
          <p style={{ margin: '8px 0 0 0', opacity: 0.8, fontSize: '0.95rem', color: '#e5e7eb' }}>
            Fondo consolidado acumulativo de arqueos y egresos generales de tesorería.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.8, marginBottom: '4px' }}>Saldo Disponible</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981', fontFamily: 'monospace' }}>
              ${cajaGrandeBalance.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <button 
            type="button" 
            className="btn btn-primary"
            style={{ 
              backgroundColor: '#E30613', 
              borderColor: '#E30613',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 18px',
              fontWeight: 600,
              fontSize: '0.88rem'
            }}
            onClick={() => setExpenseModalOpen(true)}
          >
            <PlusCircle size={18} /> Registrar Gasto
          </button>
        </div>
      </div>

      {/* Date Filters & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Rendimiento & Margen Financiero</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px' }}>Desde</span>
            <input type="date" className="input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} style={{ padding: '6px 12px' }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '8px' }}>Hasta</span>
            <input type="date" className="input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} style={{ padding: '6px 12px' }} />
          </div>
          <button className="btn btn-ghost" onClick={fetchFinancialData} title="Refrescar">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="card" style={{ padding: '20px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Ingreso Efectivo</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#065f46', fontFamily: 'monospace' }}>
            ${cashIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card" style={{ padding: '20px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Ingreso Cheques</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e3a8a', fontFamily: 'monospace' }}>
            ${checkIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card" style={{ padding: '20px', backgroundColor: '#fff5f5', border: '1px solid #feb2b2' }}>
          <div style={{ fontSize: '0.85rem', color: '#c53030', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Gastos (Egresos)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#9b2c2c', fontFamily: 'monospace' }}>
            ${totalExpenses.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="card" style={{ padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Recaudación Neta del Periodo</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
            ${netIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: 600 }}>Movimientos de Caja Grande</h3>
        <div className="table-responsive card">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px' }}>Fecha/Hora</th>
                <th style={{ padding: '12px' }}>Tipo</th>
                <th style={{ padding: '12px' }}>Concepto</th>
                <th style={{ padding: '12px' }}>Medio de Pago</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                    No se registran movimientos en el período seleccionado.
                  </td>
                </tr>
              ) : (
                ledger.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontSize: '0.82rem' }}>
                      {new Date(item.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        padding: '3px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.72rem', 
                        fontWeight: 600, 
                        backgroundColor: item.type === 'INGRESO' ? '#ecfdf5' : '#fff5f5',
                        color: item.type === 'INGRESO' ? '#047857' : '#c53030'
                      }}>
                        {item.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 500 }}>{item.description}</td>
                    <td style={{ padding: '12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {item.paymentMethod}
                    </td>
                    <td style={{ 
                      padding: '12px', 
                      textAlign: 'right', 
                      fontWeight: 700, 
                      fontFamily: 'monospace',
                      color: item.type === 'INGRESO' ? '#047857' : '#c53030'
                    }}>
                      {item.type === 'INGRESO' ? '+' : '-'}${item.amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTRO DE GASTO MODAL */}
      {expenseModalOpen && (
        <div className="modal-overlay" onClick={() => !submittingExpense && setExpenseModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Registrar Gasto / Egreso</h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setExpenseModalOpen(false)} 
                disabled={submittingExpense}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#fff5f5', 
                color: '#c53030', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateExpense}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Monto del Gasto ($)</label>
                <input 
                  type="number"
                  className="input"
                  required
                  min="0.01"
                  step="0.01"
                  autoFocus
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={e => setExpenseAmount(e.target.value)}
                  style={{ fontSize: '1.2rem', fontFamily: 'monospace', width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Concepto / Descripción</label>
                <input 
                  type="text"
                  className="input"
                  required
                  placeholder="Ej: Flete Villegas, Artículos de oficina..."
                  value={expenseDescription}
                  onChange={e => setExpenseDescription(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Medio de Pago</label>
                  <select 
                    className="input" 
                    value={expensePaymentMethod} 
                    onChange={e => setExpensePaymentMethod(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', fontSize: '0.9rem', color: 'var(--text-primary)', height: 'auto', lineHeight: 'normal' }}
                  >
                    <option value="CASH">Efectivo</option>
                    <option value="CHECK">Cheque</option>
                    <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Sucursal / Impuestos</label>
                  <select 
                    className="input" 
                    value={expenseBillingType} 
                    onChange={e => setExpenseBillingType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', fontSize: '0.9rem', color: 'var(--text-primary)', height: 'auto', lineHeight: 'normal' }}
                  >
                    <option value="INTERNAL">Interno (Sucursal X)</option>
                    <option value="OFFICIAL">Oficial (Sucursal A)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setExpenseModalOpen(false)}
                  disabled={submittingExpense}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={submittingExpense}
                  style={{ 
                    backgroundColor: '#E30613', 
                    color: '#fff', 
                    border: 'none', 
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: submittingExpense ? 'default' : 'pointer'
                  }}
                >
                  {submittingExpense ? 'Guardando...' : 'Confirmar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
