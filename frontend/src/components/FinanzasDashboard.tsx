import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DollarSign, RefreshCw, PlusCircle, AlertCircle, Landmark, Upload, Check, CheckSquare, Eye, ChevronRight, FileText, ArrowUpRight, Lock, Building2, Calendar } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';
import FinanceMovementModal from './FinanceMovementModal';
import { formatResponsibleName } from '../utils/formatters';

export default function FinanzasDashboard() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [drawers, setDrawers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cajaGrandeBalance, setCajaGrandeBalance] = useState(0);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [inspectingDrawer, setInspectingDrawer] = useState<any | null>(null);

  // Modals y Operaciones de Caja Grande (Central)
  const [centralTransferModalOpen, setCentralTransferModalOpen] = useState(false);
  const [centralTransferType, setCentralTransferType] = useState<'BANK_DEPOSIT' | 'TREASURY_WITHDRAWAL'>('BANK_DEPOSIT');
  const [centralTransferAmount, setCentralTransferAmount] = useState('');
  const [centralTransferBankId, setCentralTransferBankId] = useState('');
  const [centralTransferDesc, setCentralTransferDesc] = useState('');
  const [submittingCentralTransfer, setSubmittingCentralTransfer] = useState(false);

  const [centralCloseModalOpen, setCentralCloseModalOpen] = useState(false);
  const [centralCloseRealBalance, setCentralCloseRealBalance] = useState('');
  const [centralCloseNewOpening, setCentralCloseNewOpening] = useState('0');
  const [centralCloseBankId, setCentralCloseBankId] = useState('');
  const [centralCloseBankAmount, setCentralCloseBankAmount] = useState('0');
  const [centralCloseWithdrawnAmount, setCentralCloseWithdrawnAmount] = useState('0');
  const [centralCloseNotes, setCentralCloseNotes] = useState('');
  const [submittingCentralClose, setSubmittingCentralClose] = useState(false);

  // Conciliación Bancaria Modal y estados
  const [reconModalOpen, setReconModalOpen] = useState(false);
  const [reconBankId, setReconBankId] = useState('');
  const [reconStartDate, setReconStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reconEndDate, setReconEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reconStartTime, setReconStartTime] = useState('00:00');
  const [reconEndTime, setReconEndTime] = useState('23:59');
  const [reconTransactions, setReconTransactions] = useState<any[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [selectedTxs, setSelectedTxs] = useState<Set<number>>(new Set());
  // NUEVOS ESTADOS DE CONCILIACIÓN MP
  const [clients, setClients] = useState<any[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [reconciledRows, setReconciledRows] = useState<Set<string>>(new Set());
  const [manualMatches, setManualMatches] = useState<{ [rowId: string]: any }>({});
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [csvFilterTab, setCsvFilterTab] = useState<'all' | 'exact' | 'rounding' | 'unregistered' | 'no_match' | 'reconciled'>('all');

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

  // Estado para Modal de Desglose de Movimientos KPI
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<'CASH' | 'CHECK' | 'TRANSFER' | 'EXPENSE' | 'NET'>('CASH');
  const [modalTitle, setModalTitle] = useState('');
  const [modalSubtitle, setModalSubtitle] = useState('');
  const [modalMovements, setModalMovements] = useState<any[]>([]);

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

      // 3. Compute overall Caja Grande Balance with cutoff from latest CENTRAL drawer closure
      const centralClosed = (allDrawers || [])
        .filter((d: any) => d.status === 'CLOSED' && d.drawerType === 'CENTRAL')
        .sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());

      const lastCentral = centralClosed[0] || null;
      const cutoffDate = lastCentral ? new Date(lastCentral.closedAt) : null;
      const baseBalance = lastCentral ? Number(lastCentral.realBalance || 0) : 0;

      const closed = (allDrawers || []).filter((d: any) => {
        if (d.status !== 'CLOSED' || d.drawerType === 'CENTRAL') return false;
        if (cutoffDate) {
          return new Date(d.closedAt) > cutoffDate;
        }
        return true;
      });

      const netDrawersCash = closed.reduce((acc: number, curr: any) => acc + (Number(curr.realBalance || 0) - Number(curr.openingBalance || 0)), 0);
      
      const overallExpenses = (allTxs || []).filter((t: any) => {
        if (t.type !== 'OUTCOME' || t.cashDrawerId !== null || t.bankAccountId !== null) return false;
        if (cutoffDate) {
          return new Date(t.createdAt) > cutoffDate;
        }
        return true;
      });

      const totalExpensesOverall = overallExpenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

      setCajaGrandeBalance(baseBalance + netDrawersCash - totalExpensesOverall);

      // 4. Cargar cuentas bancarias
      const banks = await api.getBankAccounts();
      setBankAccounts(banks || []);
      if (banks && banks.length > 0 && !reconBankId) {
        setReconBankId(banks[0].id.toString());
      }
    } catch (err: any) {
      console.error('Error fetching financial data', err);
    } finally {
      setLoading(false);
    }
  };

  const applyPresetFilter = (preset: 'today' | 'week' | 'month' | 'last_month' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setFilterStartDate(todayStr);
      setFilterEndDate(todayStr);
    } else if (preset === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - (day === 0 ? 6 : day - 1); // Monday
      const monday = new Date(today);
      monday.setDate(diff);
      setFilterStartDate(monday.toISOString().split('T')[0]);
      setFilterEndDate(todayStr);
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilterStartDate(firstDay.toISOString().split('T')[0]);
      setFilterEndDate(todayStr);
    } else if (preset === 'last_month') {
      const firstDayPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0);
      setFilterStartDate(firstDayPrev.toISOString().split('T')[0]);
      setFilterEndDate(lastDayPrev.toISOString().split('T')[0]);
    } else if (preset === 'all') {
      setFilterStartDate('2025-01-01');
      setFilterEndDate(todayStr);
    }
  };

  const handleCentralTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(centralTransferAmount);
    if (isNaN(amt) || amt <= 0) {
      setModalError('Por favor, ingrese un monto válido mayor a 0.');
      return;
    }
    if (centralTransferType === 'BANK_DEPOSIT' && !centralTransferBankId) {
      setModalError('Por favor, seleccione una cuenta bancaria de destino.');
      return;
    }

    setSubmittingCentralTransfer(true);
    setModalError(null);

    try {
      await api.transferCentralFunds({
        amount: amt,
        type: centralTransferType,
        bankAccountId: centralTransferBankId ? Number(centralTransferBankId) : undefined,
        description: centralTransferDesc.trim() || undefined
      });

      setCentralTransferModalOpen(false);
      setCentralTransferAmount('');
      setCentralTransferBankId('');
      setCentralTransferDesc('');
      fetchFinancialData();
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Error al procesar la operación de Caja Grande.');
    } finally {
      setSubmittingCentralTransfer(false);
    }
  };

  const handleCentralClose = async (e: React.FormEvent) => {
    e.preventDefault();
    const realBal = Number(centralCloseRealBalance || cajaGrandeBalance);
    const newOpening = Number(centralCloseNewOpening || 0);
    const bankAmt = Number(centralCloseBankAmount || 0);
    const withdrawnAmt = Number(centralCloseWithdrawnAmount || 0);

    if (isNaN(realBal) || realBal < 0) {
      setModalError('Ingrese un conteo real válido.');
      return;
    }

    if (bankAmt > 0 && !centralCloseBankId) {
      setModalError('Seleccione la cuenta bancaria para el depósito.');
      return;
    }

    const confirmed = await confirm({
      title: '¿Confirmar Cierre de Caja Grande?',
      message: `Se cerrará el ciclo actual de la Caja Grande (Saldo acumulado: $${cajaGrandeBalance.toLocaleString('es-AR')}). El nuevo ciclo iniciará con un saldo inicial de $${newOpening.toLocaleString('es-AR')}. ¿Desea continuar?`,
      confirmText: 'Sí, Cerrar Caja Grande',
      cancelText: 'Cancelar',
      variant: 'warning'
    });

    if (!confirmed) return;

    setSubmittingCentralClose(true);
    setModalError(null);

    try {
      await api.closeCentralDrawer({
        realBalance: realBal,
        newOpeningBalance: newOpening,
        bankAccountId: centralCloseBankId ? Number(centralCloseBankId) : undefined,
        transferToBankAmount: bankAmt,
        withdrawnAmount: withdrawnAmt,
        notes: centralCloseNotes.trim() || undefined
      });

      setCentralCloseModalOpen(false);
      setCentralCloseRealBalance('');
      setCentralCloseNewOpening('0');
      setCentralCloseBankId('');
      setCentralCloseBankAmount('0');
      setCentralCloseWithdrawnAmount('0');
      setCentralCloseNotes('');
      fetchFinancialData();
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Error al cerrar la Caja Grande.');
    } finally {
      setSubmittingCentralClose(false);
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

  // --- CONCILIACIÓN BANCARIA Y CHEQUEO DE TRANSFERENCIAS ---
  const fetchReconciliationData = async (bankId: string, startDt: string, endDt: string, startTm: string, endTm: string) => {
    setReconLoading(true);
    try {
      // 1. Cargar transacciones de transferencia pendientes
      const filters = {
        bankAccountId: Number(bankId),
        paymentMethod: 'BANK_TRANSFER'
      };
      const allTxs = await api.getTransactions(filters);
      
      const startDateTime = new Date(`${startDt}T${startTm}:00`);
      const endDateTime = new Date(`${endDt}T${endTm}:59`);
      
      const filtered = (allTxs || []).filter((t: any) => {
        const txDate = new Date(t.createdAt);
        return txDate >= startDateTime && txDate <= endDateTime;
      });
      
      setReconTransactions(filtered);
      setSelectedTxs(new Set());
      setCsvRows([]);
      setReconciledRows(new Set());
      setManualMatches({});
      
      // 2. Cargar listado de clientes
      const allClients = await api.getPersonas('client');
      setClients(allClients || []);
    } catch (err) {
      console.error(err);
      alert('Error al cargar datos para conciliar.');
    } finally {
      setReconLoading(false);
    }
  };

  // Mantener compatibilidad con llamadas internas si las hay
  const fetchReconTransactions = (bankId: string, startDt: string, endDt: string, startTm: string, endTm: string) => {
    return fetchReconciliationData(bankId, startDt, endDt, startTm, endTm);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length < 2) {
        alert('El archivo no contiene suficientes datos.');
        return;
      }
      
      const firstLine = lines[0];
      const separator = firstLine.includes(';') ? ';' : ',';
      const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      
      let amountIdx = headers.indexOf('transaction_amount');
      if (amountIdx === -1) amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('monto') || h.includes('neto') || h.includes('total') || h.includes('valor'));
      
      let dateIdx = headers.indexOf('transaction_date');
      if (dateIdx === -1) dateIdx = headers.findIndex(h => h.includes('date') || h.includes('fecha') || h.includes('creacion') || h.includes('liberado') || h.includes('hora'));
      
      let idIdx = headers.indexOf('source_id');
      if (idIdx === -1) idIdx = headers.findIndex(h => h.includes('id') || h.includes('operacion') || h.includes('transaccion') || h.includes('referencia') || h.includes('codigo'));
      
      const payerNameIdx = headers.indexOf('payer_name');
      const payerCuitIdx = headers.indexOf('payer_id_number');
      const extRefIdx = headers.indexOf('external_reference');
      
      if (amountIdx === -1) {
        alert('No se pudo identificar la columna de Monto en el archivo CSV.');
        return;
      }
      
      const parsedRows = lines.slice(1).map((line, rowIdx) => {
        let cells: string[] = [];
        if (separator === ',') {
          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
          cells = matches.map(c => c.replace(/^"|"$/g, '').trim());
        } else {
          cells = line.split(';').map(c => c.replace(/^"|"$/g, '').trim());
        }
        
        if (cells.length <= Math.max(amountIdx, dateIdx, idIdx)) return null;

        const rawAmount = cells[amountIdx] ? parseFloat(cells[amountIdx].replace(/[$.]/g, '').replace(',', '.')) : 0;
        
        return {
          id: idIdx !== -1 && cells[idIdx] ? cells[idIdx] : `row-${rowIdx}`,
          amount: Math.abs(rawAmount),
          isIncome: rawAmount > 0,
          date: dateIdx !== -1 && cells[dateIdx] ? new Date(cells[dateIdx]) : new Date(),
          payerName: payerNameIdx !== -1 && cells[payerNameIdx] ? cells[payerNameIdx] : '',
          payerCuit: payerCuitIdx !== -1 && cells[payerCuitIdx] ? cells[payerCuitIdx].replace(/\D/g, '') : '',
          externalReference: extRefIdx !== -1 && cells[extRefIdx] ? cells[extRefIdx] : ''
        };
      }).filter((r): r is any => r !== null && r.amount > 0 && r.isIncome);
      
      setCsvRows(parsedRows);

      // Calcular cruces iniciales para estadísticas
      let matchedCount = 0;
      parsedRows.forEach((row: any) => {
        const matchInfo = getRowMatchStatus(row);
        if (matchInfo.status === 'exact' || matchInfo.status === 'rounding') {
          matchedCount++;
        }
      });
    };
    
    reader.readAsText(file);
  };

  // Motor dinámico de detección de coincidencias
  const getRowMatchStatus = (row: any) => {
    // 1. Si ya se concilió en esta sesión
    if (reconciledRows.has(row.id)) {
      return { status: 'reconciled' };
    }

    // 2. Coincidencia Manual
    if (manualMatches[row.id]) {
      return { status: 'unregistered', client: manualMatches[row.id], manual: true };
    }

    // 3. Buscar coincidencia exacta por transacción del ERP (no verificada)
    const exactMatch = reconTransactions.find((tx: any) => {
      if (tx.verified) return false;
      const txAmount = Math.round(Number(tx.amount));
      const rowAmount = Math.round(row.amount);
      if (txAmount !== rowAmount) return false;

      // Fecha cercana (máximo 3 días de diferencia)
      const timeDiff = Math.abs(new Date(tx.createdAt).getTime() - row.date.getTime());
      return timeDiff < 3 * 24 * 60 * 60 * 1000;
    });

    if (exactMatch) {
      return { status: 'exact', tx: exactMatch };
    }

    // 4. Buscar coincidencia aproximada por redondeo (± $1.500 o 2% de diferencia)
    const roundingMatch = reconTransactions.find((tx: any) => {
      if (tx.verified) return false;
      
      const txAmount = Number(tx.amount);
      const rowAmount = row.amount;
      const diff = Math.abs(txAmount - rowAmount);
      const pctDiff = (diff / rowAmount) * 100;

      if (diff > 1500 && pctDiff > 2) return false;

      // Fecha cercana (máximo 5 días de diferencia)
      const timeDiff = Math.abs(new Date(tx.createdAt).getTime() - row.date.getTime());
      return timeDiff < 5 * 24 * 60 * 60 * 1000;
    });

    if (roundingMatch) {
      const diff = Number(roundingMatch.amount) - row.amount;
      return { status: 'rounding', tx: roundingMatch, diff };
    }

    // 5. Buscar cliente en ERP por CUIT del pagador
    if (row.payerCuit) {
      const clientByCuit = clients.find((c: any) => {
        if (!c.cuit) return false;
        return c.cuit.replace(/\D/g, '') === row.payerCuit;
      });
      if (clientByCuit) {
        return { status: 'unregistered', client: clientByCuit };
      }
    }

    // 6. Buscar cliente en ERP por nombre (búsqueda parcial insensible a mayúsculas/minúsculas)
    if (row.payerName && row.payerName.length > 3) {
      const cleanPayer = row.payerName.toLowerCase();
      const clientByName = clients.find((c: any) => {
        const cleanClientName = c.name.toLowerCase();
        return cleanClientName.includes(cleanPayer) || cleanPayer.includes(cleanClientName);
      });
      if (clientByName) {
        return { status: 'unregistered', client: clientByName };
      }
    }

    return { status: 'no_match' };
  };

  const handleVerifyWithAdjustment = async (txId: number, csvAmount: number) => {
    setReconLoading(true);
    try {
      await api.verifyTransaction(txId, true, csvAmount);
      
      // Actualizar visualización local
      setReconciledRows(prev => {
        const next = new Set(prev);
        // Encontrar qué fila de CSV se asociaba a esta tx y marcarla
        const matchedRow = csvRows.find(row => {
          const match = getRowMatchStatus(row);
          return (match.status === 'rounding' && match.tx?.id === txId) || (match.status === 'exact' && match.tx?.id === txId);
        });
        if (matchedRow) next.add(matchedRow.id);
        return next;
      });

      alert('Cobro conciliado y verificado con ajuste por redondeo en la cuenta corriente.');
      
      fetchFinancialData();
      if (reconBankId) {
        fetchReconTransactions(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al conciliar con ajuste.');
    } finally {
      setReconLoading(false);
    }
  };

  const handleRegisterPaymentFromCsvRow = async (row: any, clientObj: any) => {
    if (!clientObj) return;
    setReconLoading(true);
    try {
      await api.registerPayment(clientObj.id, {
        amount: row.amount,
        paymentMethod: 'BANK_TRANSFER',
        description: `Cobro MP Conciliación - Op ${row.id} - Payer: ${row.payerName}`,
        branch: 'X',
        type: 'INCOME',
        bankAccountId: Number(reconBankId)
      });
      
      setReconciledRows(prev => {
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });

      alert(`Cobro de $${row.amount.toLocaleString('es-AR')} registrado y conciliado para ${clientObj.name}.`);
      
      fetchFinancialData();
      if (reconBankId) {
        fetchReconTransactions(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error al registrar cobro.');
    } finally {
      setReconLoading(false);
    }
  };

  const handleReconcileAllExactMatches = async () => {
    const exactMatches: { txId: number, csvRowId: string }[] = [];
    csvRows.forEach((row: any) => {
      const match = getRowMatchStatus(row);
      if (match.status === 'exact' && match.tx) {
        exactMatches.push({ txId: match.tx.id, csvRowId: row.id });
      }
    });

    if (exactMatches.length === 0) {
      alert('No se encontraron transferencias con coincidencia exacta para conciliar en lote.');
      return;
    }

    if (!await confirm(`¿Desea conciliar las ${exactMatches.length} transferencias con coincidencia exacta de manera masiva?`)) {
      return;
    }

    setReconLoading(true);
    try {
      await Promise.all(
        exactMatches.map(item => api.verifyTransaction(item.txId, true))
      );
      
      setReconciledRows(prev => {
        const next = new Set(prev);
        exactMatches.forEach(item => next.add(item.csvRowId));
        return next;
      });

      alert(`Se conciliaron ${exactMatches.length} transferencias de forma masiva.`);
      
      fetchFinancialData();
      if (reconBankId) {
        fetchReconTransactions(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al conciliar el lote.');
    } finally {
      setReconLoading(false);
    }
  };

  const toggleSelectTx = (id: number) => {
    setSelectedTxs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllTxs = () => {
    setSelectedTxs(prev => {
      if (prev.size === reconTransactions.length) {
        return new Set();
      } else {
        return new Set(reconTransactions.map(t => t.id));
      }
    });
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

    // Transferencias bancarias recibidas en el periodo (verificadas o no)
    const transfersInPeriod = transactions.filter((t: any) => {
      if (t.paymentMethod !== 'BANK_TRANSFER' || t.type !== 'INCOME') return false;
      const txDate = new Date(t.createdAt);
      return txDate >= start && txDate <= end;
    });

    const totalTransfers = transfersInPeriod.reduce((acc, t) => acc + Number(t.amount || 0), 0);

    // Items detallados para modales de desglose
    const detailedCashItems: any[] = [];
    const detailedCheckItems: any[] = [];

    closedInPeriod.forEach((d: any) => {
      const branchLabel = d.branch ? (d.branch.toLowerCase().startsWith('caja:') ? d.branch : `Caja: ${d.branch}`) : `Caja: ${d.user?.username || 'Central'}`;
      if (d.transactions && d.transactions.length > 0) {
        d.transactions.forEach((t: any) => {
          const isInc = t.type === 'INCOME';
          const item = {
            id: `tx-drawer-${t.id || Math.random()}`,
            date: t.createdAt || d.closedAt,
            type: isInc ? 'INGRESO' : 'EGRESO',
            origin: branchLabel,
            description: t.description || (isInc ? 'Cobro en cierre de caja' : 'Salida en cierre de caja'),
            paymentMethod: t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod === 'CHECK' ? 'CHEQUE' : t.paymentMethod,
            reference: t.receiptNumber || undefined,
            amount: Number(t.amount || 0),
            orderId: t.orderId || undefined,
            personaName: t.persona?.name || undefined
          };

          if (t.paymentMethod === 'CASH') detailedCashItems.push(item);
          else if (t.paymentMethod === 'CHECK') detailedCheckItems.push(item);
        });
      } else {
        const netAmount = Number(d.realBalance || 0) - Number(d.openingBalance || 0);
        if (netAmount > 0) {
          detailedCashItems.push({
            id: `drawer-summary-${d.id}`,
            date: d.closedAt,
            type: 'INGRESO',
            origin: branchLabel,
            description: branchLabel,
            paymentMethod: 'EFECTIVO',
            amount: netAmount
          });
        }
      }
    });

    const detailedTransferItems = transfersInPeriod.map((t: any) => ({
      id: `transfer-${t.id}`,
      date: t.createdAt,
      type: 'INGRESO',
      origin: t.bankAccount ? `Banco: ${t.bankAccount.bankName || 'Cta Bancaria'}` : 'Transferencia Bancaria',
      description: t.description || 'Ingreso por transferencia bancaria',
      paymentMethod: 'TRANSFERENCIA',
      reference: t.receiptNumber || undefined,
      amount: Number(t.amount || 0),
      orderId: t.orderId || undefined,
      personaName: t.persona?.name || undefined
    }));

    const detailedExpenseItems = expensesInPeriod.map((t: any) => ({
      id: `expense-${t.id}`,
      date: t.createdAt,
      type: 'EGRESO',
      origin: 'Gastos Generales (Tesorería)',
      description: t.description || 'Gasto registrado',
      paymentMethod: t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod === 'CHECK' ? 'CHEQUE' : 'OTRO',
      reference: t.receiptNumber || undefined,
      amount: Number(t.amount || 0)
    }));

    const detailedNetItems = [
      ...detailedCashItems,
      ...detailedCheckItems,
      ...detailedTransferItems,
      ...detailedExpenseItems
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Ledger: combine Drawer Closures deposits and direct expenses
    const ledgerItems: any[] = [];

    // Closure deposits as entry items
    closedInPeriod.forEach((d: any) => {
      const netAmount = Number(d.realBalance || 0) - Number(d.openingBalance || 0);
      const responsibleName = formatResponsibleName(d);

      // Determinar medio de pago de la caja
      const methodsSet = new Set<string>();
      if (d.transactions && d.transactions.length > 0) {
        d.transactions.forEach((t: any) => {
          if (t.paymentMethod === 'CASH') methodsSet.add('Efectivo');
          else if (t.paymentMethod === 'CHECK') methodsSet.add('Cheque');
          else if (t.paymentMethod === 'BANK_TRANSFER') methodsSet.add('Transferencia');
        });
      }

      const methods = Array.from(methodsSet);
      const paymentMethodLabel = methods.length === 1 ? methods[0] : methods.length > 1 ? 'Varios' : 'Efectivo';

      ledgerItems.push({
        id: `drawer-${d.id}`,
        date: d.closedAt,
        type: 'INGRESO',
        description: responsibleName,
        paymentMethod: paymentMethodLabel,
        amount: netAmount,
        drawer: d,
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
      totalTransfers,
      netIncome: cashIncome + checkIncome + totalTransfers - totalExpenses,
      ledger: ledgerItems,
      transfers: transfersInPeriod,
      detailedCashItems,
      detailedCheckItems,
      detailedTransferItems,
      detailedExpenseItems,
      detailedNetItems
    };
  };

  const ManualClientSearch = ({ row }: { row: any }) => {
    const [searchVal, setSearchVal] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const filteredSuggestions = searchVal.trim().length > 1
      ? clients.filter((c: any) => 
          c.name.toLowerCase().includes(searchVal.toLowerCase()) || 
          (c.cuit && c.cuit.includes(searchVal))
        ).slice(0, 5)
      : [];

    return (
      <div style={{ position: 'relative', width: '100%', marginTop: '6px' }}>
        <input
          type="text"
          className="input"
          placeholder="Buscar cliente por Nombre o CUIT..."
          value={searchVal}
          onChange={e => {
            setSearchVal(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          style={{ padding: '6px 10px', fontSize: '0.78rem', height: '30px', borderRadius: '4px', border: '1px solid var(--border-color)', width: '100%' }}
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="suggestions-list" style={{ 
            position: 'absolute', 
            top: '32px', 
            left: 0, 
            right: 0, 
            zIndex: 100, 
            backgroundColor: '#ffffff', 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px',
            boxShadow: 'var(--shadow-md)',
            maxHeight: '150px',
            overflowY: 'auto'
          }}>
            {filteredSuggestions.map((c: any) => (
              <div
                key={c.id}
                className="suggestion-item"
                style={{ 
                  padding: '6px 10px', 
                  cursor: 'pointer', 
                  fontSize: '0.78rem',
                  borderBottom: '1px solid #f1f5f9',
                  textAlign: 'left'
                }}
                onMouseDown={() => {
                  setManualMatches((prev: any) => ({ ...prev, [row.id]: c }));
                  setShowSuggestions(false);
                }}
              >
                <strong>{c.name}</strong> - CUIT: {c.cuit || 'S/D'} (Saldo: ${Number(c.outstandingBalance).toLocaleString()})
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const {
    cashIncome,
    checkIncome,
    totalExpenses,
    totalTransfers,
    netIncome,
    ledger,
    transfers,
    detailedCashItems,
    detailedCheckItems,
    detailedTransferItems,
    detailedExpenseItems,
    detailedNetItems
  } = getFilteredMetricsAndLedger();

  const openDetailModal = (
    category: 'CASH' | 'CHECK' | 'TRANSFER' | 'EXPENSE' | 'NET',
    title: string,
    subtitle: string,
    movements: any[]
  ) => {
    setModalCategory(category);
    setModalTitle(title);
    setModalSubtitle(subtitle);
    setModalMovements(movements);
    setDetailModalOpen(true);
  };

  const formatDateRangeText = () => {
    try {
      const [sY, sM, sD] = filterStartDate.split('-');
      const [eY, eM, eD] = filterEndDate.split('-');
      return `${sD}/${sM}/${sY} - ${eD}/${eM}/${eY}`;
    } catch {
      return `${filterStartDate} - ${filterEndDate}`;
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando información financiera...</div>;

  return (
    <div style={{ padding: '0px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Caja Grande */}
      <div className="card" style={{ marginBottom: '30px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white', padding: '24px 30px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#e5e7eb' }}>
            <DollarSign size={28} color="#10b981" /> Caja Grande (Central)
          </h2>
          <p style={{ margin: '8px 0 0 0', opacity: 0.8, fontSize: '0.92rem', color: '#e5e7eb' }}>
            Fondo consolidado acumulativo de arqueos y egresos generales de tesorería.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '2px' }}>Saldo Disponible en Bóveda</div>
            <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: '#10b981', fontFamily: 'monospace' }}>
              ${cajaGrandeBalance.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div style={{ borderLeft: '1px solid #334155', paddingLeft: '20px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '2px' }}>Neto del Período Filtrado</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: netIncome >= 0 ? '#38bdf8' : '#f87171', fontFamily: 'monospace' }}>
              {netIncome >= 0 ? '+' : ''}${netIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              style={{ 
                backgroundColor: '#334155', 
                borderColor: '#475569',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '0.88rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => {
                setModalError(null);
                setCentralTransferModalOpen(true);
              }}
              title="Depositar efectivo en banco o registrar extracción de tesorería"
            >
              <ArrowUpRight size={16} color="#38bdf8" /> Depositar / Retirar
            </button>

            <button 
              type="button" 
              className="btn btn-secondary"
              style={{ 
                backgroundColor: '#334155', 
                borderColor: '#475569',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '0.88rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => {
                setModalError(null);
                setCentralCloseRealBalance(cajaGrandeBalance.toString());
                setCentralCloseModalOpen(true);
              }}
              title="Cerrar el período actual de Caja Grande y reiniciar el ciclo"
            >
              <Lock size={16} color="#f59e0b" /> Cerrar Caja Grande
            </button>

            <button 
              type="button" 
              className="btn btn-secondary"
              style={{ 
                backgroundColor: '#334155', 
                borderColor: '#475569',
                color: 'white',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '0.88rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => {
                setReconModalOpen(true);
                if (reconBankId) {
                  fetchReconTransactions(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
                }
              }}
            >
              <CheckSquare size={16} /> Conciliación Bancaria
            </button>

            <button 
              type="button" 
              className="btn btn-primary"
              style={{ 
                backgroundColor: 'var(--color-corp-red)', 
                borderColor: 'var(--color-corp-red)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                fontWeight: 600,
                fontSize: '0.88rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              onClick={() => setExpenseModalOpen(true)}
            >
              <PlusCircle size={18} /> Registrar Gasto
            </button>
          </div>
        </div>
      </div>

      {/* Date Filters & Presets Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Rendimiento & Margen Financiero</h3>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-light)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', fontWeight: 600 }} onClick={() => applyPresetFilter('today')}>Hoy</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', fontWeight: 600 }} onClick={() => applyPresetFilter('week')}>Esta Semana</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', fontWeight: 600 }} onClick={() => applyPresetFilter('month')}>Este Mes</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', fontWeight: 600 }} onClick={() => applyPresetFilter('last_month')}>Mes Pasado</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem', padding: '4px 10px', fontWeight: 600 }} onClick={() => applyPresetFilter('all')}>Histórico</button>
          </div>

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

      {/* KPI Cards Interactivas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '40px' }}>
        {/* Card 1: Efectivo */}
        <div
          onClick={() => openDetailModal(
            'CASH',
            'Desglose de Ingresos en Efectivo',
            'Transacciones y cobros en efectivo registrados en cierres de caja durante el período.',
            detailedCashItems
          )}
          style={{
            padding: '20px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            userSelect: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(16, 185, 129, 0.15)';
            e.currentTarget.style.borderColor = '#10b981';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            e.currentTarget.style.borderColor = '#a7f3d0';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>Ingreso Efectivo</div>
            <Eye size={16} color="#047857" style={{ opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#065f46', fontFamily: 'monospace' }}>
            ${cashIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <span>Ver {detailedCashItems.length} movimientos</span>
            <ChevronRight size={12} />
          </div>
        </div>

        {/* Card 2: Cheques */}
        <div
          onClick={() => openDetailModal(
            'CHECK',
            'Desglose de Ingresos en Cheques',
            'Valores en cheques físicos y eCheqs recibidos en cierres de caja durante el período.',
            detailedCheckItems
          )}
          style={{
            padding: '20px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            userSelect: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.15)';
            e.currentTarget.style.borderColor = '#3b82f6';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            e.currentTarget.style.borderColor = '#bfdbfe';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>Ingreso Cheques</div>
            <Eye size={16} color="#1d4ed8" style={{ opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1e3a8a', fontFamily: 'monospace' }}>
            ${checkIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <span>Ver {detailedCheckItems.length} movimientos</span>
            <ChevronRight size={12} />
          </div>
        </div>

        {/* Card 3: Transferencias */}
        <div
          onClick={() => openDetailModal(
            'TRANSFER',
            'Desglose de Ingresos por Transferencia',
            'Transferencias acreditadas en cuentas bancarias registradas durante el período.',
            detailedTransferItems
          )}
          style={{
            padding: '20px',
            backgroundColor: '#f0fdfa',
            border: '1px solid #99f6e4',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            userSelect: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(13, 148, 136, 0.15)';
            e.currentTarget.style.borderColor = '#14b8a6';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            e.currentTarget.style.borderColor = '#99f6e4';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#0f766e', fontWeight: 600, textTransform: 'uppercase' }}>Ingreso Transferencias</div>
            <Eye size={16} color="#0f766e" style={{ opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#115e59', fontFamily: 'monospace' }}>
            ${totalTransfers.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0d9488', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <span>Ver {detailedTransferItems.length} movimientos</span>
            <ChevronRight size={12} />
          </div>
        </div>

        {/* Card 4: Gastos (Egresos) */}
        <div
          onClick={() => openDetailModal(
            'EXPENSE',
            'Desglose de Gastos y Egresos',
            'Salidas directas y gastos operativos de tesorería imputados en el período.',
            detailedExpenseItems
          )}
          style={{
            padding: '20px',
            backgroundColor: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            userSelect: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(225, 29, 72, 0.15)';
            e.currentTarget.style.borderColor = '#f43f5e';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            e.currentTarget.style.borderColor = '#feb2b2';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#c53030', fontWeight: 600, textTransform: 'uppercase' }}>Gastos (Egresos)</div>
            <Eye size={16} color="#c53030" style={{ opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#9b2c2c', fontFamily: 'monospace' }}>
            ${totalExpenses.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#e11d48', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <span>Ver {detailedExpenseItems.length} movimientos</span>
            <ChevronRight size={12} />
          </div>
        </div>

        {/* Card 5: Recaudación Neta */}
        <div
          onClick={() => openDetailModal(
            'NET',
            'Resumen Consolidado de Recaudación Neta',
            'Integración de todos los ingresos (Efectivo, Cheques, Transferencias) menos Egresos del período.',
            detailedNetItems
          )}
          style={{
            padding: '20px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            userSelect: 'none'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(71, 85, 105, 0.15)';
            e.currentTarget.style.borderColor = '#64748b';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>Recaudación Neta del Periodo</div>
            <Eye size={16} color="#475569" style={{ opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
            ${netIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
            <span>Ver {detailedNetItems.length} movimientos</span>
            <ChevronRight size={12} />
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
                <th style={{ padding: '12px' }}>Responsable</th>
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
                  <tr 
                    key={item.id} 
                    style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      cursor: item.drawer ? 'pointer' : 'default',
                      transition: 'background-color 0.15s'
                    }}
                    onClick={() => {
                      if (item.drawer) {
                        setInspectingDrawer(item.drawer);
                      }
                    }}
                    title={item.drawer ? 'Haz clic para ver los recibos traídos en este cierre' : undefined}
                  >
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
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{item.description}</span>
                        {item.drawer && (
                          <span style={{ 
                            fontSize: '0.72rem', 
                            backgroundColor: '#e0f2fe', 
                            color: '#0369a1', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontWeight: 500,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Eye size={11} /> Ver recibos ({item.drawer.transactions?.length || 0})
                          </span>
                        )}
                      </div>
                    </td>
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

      {/* Secciones de Banco y Transferencias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginTop: '10px' }}>
        
        {/* Cuentas Bancarias */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Landmark size={20} color="var(--text-secondary)" /> Cuentas Bancarias / Bancos
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Saldos actuales en tiempo real de las cuentas bancarias y billeteras virtuales del sistema.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
            {bankAccounts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No se registran cuentas bancarias configuradas.
              </div>
            ) : (
              bankAccounts.map((b: any) => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-light)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{b.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>{b.accountNumber || 'Sin Nro Cuenta'}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10b981', fontFamily: 'monospace' }}>
                    ${Number(b.balance).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transferencias del periodo */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>
            🏦 Cobros por Transferencia (Periodo)
          </h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Historial de cobros por transferencia recibidos en el período seleccionado.
          </p>
          
          <div className="table-responsive" style={{ flex: 1, maxHeight: '280px', overflowY: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Cliente / Ref</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Cuenta Destino</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                      No se registran transferencias en este período.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t: any) => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                        {new Date(t.createdAt).toLocaleDateString('es-AR', { dateStyle: 'short' })}
                      </td>
                      <td style={{ padding: '8px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600 }}>{t.persona?.name || 'Varios'}</div>
                        {t.receiptNumber && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Recibo: {t.receiptNumber}</div>}
                      </td>
                      <td style={{ padding: '8px', verticalAlign: 'middle', color: 'var(--text-secondary)' }}>
                        {t.bankAccount?.name || 'Banco General'}
                      </td>
                      <td style={{ padding: '8px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f766e' }}>
                        +${Number(t.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                    <option value="INTERNAL">Sucursal X</option>
                    <option value="OFFICIAL">Sucursal A</option>
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
                    backgroundColor: 'var(--color-corp-red)', 
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

      {/* MODAL DE CONCILIACIÓN BANCARIA */}
      {reconModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ maxWidth: '1150px', width: '95%', padding: '24px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckSquare size={22} color="#10b981" /> Conciliación de Transferencias (Mercado Pago)
              </h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setReconModalOpen(false)}
                style={{ fontSize: '1.2rem', padding: '4px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Filtros de Conciliación */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 1.8fr 0.7fr', gap: '16px', backgroundColor: 'var(--bg-light)', padding: '16px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--border-color)', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Banco / Cuenta</label>
                <select 
                  className="select" 
                  value={reconBankId} 
                  onChange={e => {
                    setReconBankId(e.target.value);
                    fetchReconciliationData(e.target.value, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
                  }}
                  style={{ width: '100%', fontSize: '0.85rem', height: '36px', padding: '6px 10px', borderRadius: '6px' }}
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Desde (Fecha/Hora)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="date" className="input" value={reconStartDate} onChange={e => setReconStartDate(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem', flex: 1, minWidth: '115px', height: '36px', borderRadius: '6px' }} />
                  <input type="time" className="input" value={reconStartTime} onChange={e => setReconStartTime(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem', width: '110px', height: '36px', borderRadius: '6px' }} />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Hasta (Fecha/Hora)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="date" className="input" value={reconEndDate} onChange={e => setReconEndDate(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem', flex: 1, minWidth: '115px', height: '36px', borderRadius: '6px' }} />
                  <input type="time" className="input" value={reconEndTime} onChange={e => setReconEndTime(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.82rem', width: '110px', height: '36px', borderRadius: '6px' }} />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <button 
                  className="btn btn-secondary" 
                  disabled={reconLoading}
                  onClick={() => fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime)}
                  style={{ width: '100%', height: '36px', padding: '0 12px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', borderRadius: '6px', cursor: 'pointer' }}
                >
                  <RefreshCw size={14} /> {reconLoading ? 'Cargando...' : 'Buscar'}
                </button>
              </div>
            </div>

            {/* Carga del Reporte Mercado Pago */}
            <div style={{ border: '1px dashed #cbd5e1', padding: '16px', borderRadius: '8px', marginBottom: '20px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Cargar Reporte Mercado Pago (.csv)</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Sube el reporte de ventas de Mercado Pago para detectar cobros automáticamente.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 12px', cursor: 'pointer', margin: 0 }}>
                  <Upload size={14} /> Seleccionar Archivo
                  <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {/* Panel de Estadísticas en Vivo si hay CSV cargado */}
            {csvRows.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Movimientos MP</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>{csvRows.length}</div>
                </div>
                <div className="card" style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Total Recibido MP</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-success)', fontFamily: 'monospace' }}>
                    ${csvRows.reduce((acc, r) => acc + r.amount, 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Coincidencias Exactas</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                    {csvRows.filter(r => getRowMatchStatus(r).status === 'exact').length}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Redondeos</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>
                    {csvRows.filter(r => getRowMatchStatus(r).status === 'rounding').length}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Clientes Identificados</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace' }}>
                    {csvRows.filter(r => {
                      const st = getRowMatchStatus(r);
                      return st.status === 'unregistered' && !st.manual;
                    }).length}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px', textAlign: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Conciliados</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                    {reconciledRows.size}
                  </div>
                </div>
              </div>
            )}

            {/* Workspace de conciliación */}
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch', textAlign: 'left' }}>
              {/* PANEL IZQUIERDO: MOVIMIENTOS MP (60%) */}
              <div style={{ flex: '2 1 550px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {csvRows.length > 0 ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Movimientos en el Extracto de Mercado Pago</h4>
                      {/* Batch confirm button */}
                      {csvRows.filter(r => getRowMatchStatus(r).status === 'exact').length > 0 && (
                        <button
                          type="button"
                          className="btn"
                          style={{
                            backgroundColor: '#10b981',
                            borderColor: '#10b981',
                            color: 'white',
                            fontSize: '0.78rem',
                            padding: '6px 12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            cursor: 'pointer'
                          }}
                          onClick={handleReconcileAllExactMatches}
                        >
                          ⚡ Conciliar Exactos en Lote ({csvRows.filter(r => getRowMatchStatus(r).status === 'exact').length})
                        </button>
                      )}
                    </div>

                    {/* Controles de Búsqueda y Pestañas */}
                    <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Filtrar por nombre, CUIT o ID de operación..."
                        value={csvSearchQuery}
                        onChange={e => setCsvSearchQuery(e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '0.82rem', borderRadius: '6px', height: '36px' }}
                      />
                      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
                        {[
                          { id: 'all', label: `Todos (${csvRows.length})` },
                          { id: 'exact', label: `Exacto (${csvRows.filter(r => getRowMatchStatus(r).status === 'exact').length})` },
                          { id: 'rounding', label: `Redondeo (${csvRows.filter(r => getRowMatchStatus(r).status === 'rounding').length})` },
                          { id: 'unregistered', label: `Identificado (${csvRows.filter(r => getRowMatchStatus(r).status === 'unregistered').length})` },
                          { id: 'no_match', label: `Sin Match (${csvRows.filter(r => getRowMatchStatus(r).status === 'no_match').length})` },
                          { id: 'reconciled', label: `Conciliados (${reconciledRows.size})` }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            type="button"
                            className={`btn ${csvFilterTab === tab.id ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setCsvFilterTab(tab.id as any)}
                            style={{
                              fontSize: '0.72rem',
                              padding: '4px 8px',
                              height: '28px',
                              borderRadius: '4px',
                              whiteSpace: 'nowrap',
                              backgroundColor: csvFilterTab === tab.id ? 'var(--accent-color)' : 'transparent',
                              color: csvFilterTab === tab.id ? 'white' : 'var(--text-secondary)',
                              fontWeight: csvFilterTab === tab.id ? 600 : 400
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Listado de Filas MP */}
                    <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
                      {csvRows
                        .filter(row => {
                          const statusInfo = getRowMatchStatus(row);
                          if (csvFilterTab === 'reconciled') return statusInfo.status === 'reconciled';
                          if (csvFilterTab === 'exact') return statusInfo.status === 'exact';
                          if (csvFilterTab === 'rounding') return statusInfo.status === 'rounding';
                          if (csvFilterTab === 'unregistered') return statusInfo.status === 'unregistered';
                          if (csvFilterTab === 'no_match') return statusInfo.status === 'no_match';
                          return true;
                        })
                        .filter(row => {
                          if (!csvSearchQuery.trim()) return true;
                          const q = csvSearchQuery.toLowerCase();
                          return (
                            row.payerName.toLowerCase().includes(q) ||
                            row.payerCuit.includes(q) ||
                            row.id.includes(q) ||
                            row.amount.toString().includes(q)
                          );
                        })
                        .map(row => {
                          const matchInfo = getRowMatchStatus(row);
                          return (
                            <div
                              key={row.id}
                              style={{
                                padding: '14px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                backgroundColor:
                                  matchInfo.status === 'reconciled'
                                    ? '#f8fafc'
                                    : matchInfo.status === 'exact'
                                    ? '#eaf9ee'
                                    : matchInfo.status === 'rounding'
                                    ? '#fff8e1'
                                    : matchInfo.status === 'unregistered'
                                    ? '#e8f0fe'
                                    : '#ffffff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '16px',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                                opacity: matchInfo.status === 'reconciled' ? 0.75 : 1
                              }}
                            >
                              {/* Info de la transferencia MP */}
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                                    {row.payerName || 'PAGADOR DESCONOCIDO'}
                                  </span>
                                  {row.payerCuit && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', backgroundColor: '#e2e8f0', padding: '1px 5px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                      {row.payerCuit}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                                  <span>ID MP: <strong style={{ fontFamily: 'monospace' }}>{row.id}</strong></span>
                                  <span>•</span>
                                  <span>{new Date(row.date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                </div>

                                {/* Matching Info block */}
                                <div style={{ marginTop: '8px', fontSize: '0.75rem' }}>
                                  {matchInfo.status === 'reconciled' && (
                                    <span style={{ color: '#137333', fontWeight: 600 }}>✅ Conciliado correctamente.</span>
                                  )}
                                  
                                  {matchInfo.status === 'exact' && matchInfo.tx && (
                                    <div style={{ color: '#137333' }}>
                                      <span>Coincide con transacción ERP <strong>#{matchInfo.tx.receiptNumber || matchInfo.tx.id}</strong></span>
                                      <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                        Cliente: {matchInfo.tx.persona?.name} | {new Date(matchInfo.tx.createdAt).toLocaleDateString('es-AR')}
                                      </div>
                                    </div>
                                  )}

                                  {matchInfo.status === 'rounding' && matchInfo.tx && (
                                    <div style={{ color: '#b78103' }}>
                                      <span>Difiere por redondeo con transacción ERP <strong>#{matchInfo.tx.receiptNumber || matchInfo.tx.id}</strong> (${Number(matchInfo.tx.amount).toLocaleString('es-AR')} en ERP)</span>
                                      <div style={{ fontWeight: 600, fontSize: '0.72rem', marginTop: '2px' }}>
                                        Diferencia: ${(row.amount - Number(matchInfo.tx.amount)).toLocaleString('es-AR', { signDisplay: 'always' })} (Ajustará la cuenta corriente)
                                      </div>
                                    </div>
                                  )}

                                  {matchInfo.status === 'unregistered' && matchInfo.client && (
                                    <div style={{ color: '#1a73e8' }}>
                                      <span>Cliente ERP Encontrado: <strong>{matchInfo.client.name}</strong></span>
                                      <div style={{ fontSize: '0.7rem' }}>
                                        Saldo Cuenta Corriente: <strong>${Number(matchInfo.client.outstandingBalance).toLocaleString()}</strong>
                                        {matchInfo.manual && <span style={{ marginLeft: '6px', color: '#651fff', fontWeight: 600 }}>(Vinculado manualmente)</span>}
                                      </div>
                                    </div>
                                  )}

                                  {matchInfo.status === 'no_match' && (
                                    <div>
                                      <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>No se encontró cliente. Vincula uno manualmente para registrar el cobro:</span>
                                      <ManualClientSearch row={row} />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Monto y Acciones */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', minWidth: '130px' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                  ${row.amount.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>

                                {/* Botones de acción */}
                                <div>
                                  {matchInfo.status === 'exact' && matchInfo.tx && (
                                    <button
                                      type="button"
                                      className="btn"
                                      onClick={() => handleVerifyWithAdjustment(matchInfo.tx.id, row.amount)}
                                      style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      Conciliar
                                    </button>
                                  )}

                                  {matchInfo.status === 'rounding' && matchInfo.tx && (
                                    <button
                                      type="button"
                                      className="btn"
                                      onClick={() => handleVerifyWithAdjustment(matchInfo.tx.id, row.amount)}
                                      style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      Ajustar y Conciliar
                                    </button>
                                  )}

                                  {matchInfo.status === 'unregistered' && matchInfo.client && (
                                    <button
                                      type="button"
                                      className="btn"
                                      onClick={() => handleRegisterPaymentFromCsvRow(row, matchInfo.client)}
                                      style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      Registrar Cobro
                                    </button>
                                  )}

                                  {matchInfo.status === 'reconciled' && (
                                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <Check size={14} /> Listo
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '24px', color: 'var(--text-secondary)', textAlign: 'center', backgroundColor: '#fafafa' }}>
                    <Upload size={38} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                    <h4 style={{ margin: 0, fontWeight: 600 }}>Carga el reporte de Mercado Pago para empezar</h4>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', maxWidth: '380px' }}>
                      Arrastra o selecciona el archivo CSV diario obtenido desde Mercado Pago. El sistema cruzará cada fila con los registros del ERP de forma inteligente.
                    </p>
                  </div>
                )}
              </div>

              {/* PANEL DERECHO: DETALLE ERP (40%) */}
              <div style={{ flex: '1 1 350px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Transferencias en ERP</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Listado de transferencias registradas en el ERP para este banco y periodo.
                  </p>
                </div>

                {/* Filtro rápido ERP */}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Pendientes de verificar: <strong>{reconTransactions.filter((t: any) => !t.verified).length}</strong></span>
                  {reconTransactions.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={toggleSelectAllTxs}
                      style={{ fontSize: '0.7rem', padding: '2px 6px', height: '24px' }}
                    >
                      {selectedTxs.size === reconTransactions.length ? 'Deseleccionar' : 'Seleccionar Todo'}
                    </button>
                  )}
                </div>

                {/* Grilla de transacciones ERP */}
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reconTransactions.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      No hay transacciones registradas en este periodo.
                    </div>
                  ) : (
                    reconTransactions.map((t: any) => {
                      const isSelected = selectedTxs.has(t.id);
                      const isVerified = t.verified;
                      return (
                        <div
                          key={t.id}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            backgroundColor: isVerified ? '#f8fafc' : '#ffffff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.78rem'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {!isVerified && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectTx(t.id)}
                                style={{ cursor: 'pointer' }}
                              />
                            )}
                            <div>
                              <div style={{ fontWeight: 600 }}>{t.persona?.name || 'Cliente de Mostrador'}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                {t.receiptNumber ? `Recibo: ${t.receiptNumber}` : 'Cobro Directo'} | {new Date(t.createdAt).toLocaleDateString('es-AR')}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                              ${Number(t.amount).toLocaleString('es-AR')}
                            </span>
                            <div>
                              {isVerified ? (
                                <span
                                  style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                  onClick={async () => {
                                    if (await confirm('¿Desea revertir la verificación de esta transferencia?', { type: 'warning' })) {
                                      try {
                                        await api.verifyTransaction(t.id, false);
                                        fetchFinancialData();
                                        fetchReconTransactions(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
                                      } catch {
                                        alert('Error al revertir.');
                                      }
                                    }
                                  }}
                                  title="Haga clic para revertir"
                                >
                                  ✅ VERIFICADA (Revertir)
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  onClick={async () => {
                                    try {
                                      await api.verifyTransaction(t.id, true);
                                      fetchFinancialData();
                                      fetchReconTransactions(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
                                    } catch {
                                      alert('Error al verificar.');
                                    }
                                  }}
                                  style={{ padding: '2px 6px', fontSize: '0.65rem', color: '#10b981', border: '1px solid #10b981', borderRadius: '4px', backgroundColor: 'transparent' }}
                                >
                                  Verificar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Botón de lote para el panel derecho */}
                {selectedTxs.size > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      setReconLoading(true);
                      try {
                        await Promise.all(Array.from(selectedTxs).map(id => api.verifyTransaction(id, true)));
                        alert(`Se verificaron ${selectedTxs.size} transferencias.`);
                        fetchFinancialData();
                        fetchReconTransactions(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
                      } catch {
                        alert('Error en lote.');
                      } finally {
                        setReconLoading(false);
                      }
                    }}
                    style={{ backgroundColor: '#10b981', color: 'white', border: 'none', width: '100%', padding: '10px', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Verificar {selectedTxs.size} Seleccionados ERP
                  </button>
                )}
              </div>
            </div>

            {/* Acciones del Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setReconModalOpen(false)}
                style={{ padding: '10px 20px', borderRadius: '6px' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reutilizable de Desglose de Movimientos */}
      <FinanceMovementModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={modalTitle}
        subtitle={modalSubtitle}
        categoryKey={modalCategory}
        dateRangeText={formatDateRangeText()}
        movements={modalMovements}
      />

      {/* MODAL DE DETALLE Y RECIBOS DEL CIERRE DE CAJA */}
      {inspectingDrawer && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setInspectingDrawer(null)}>
          <div className="modal-content" style={{ maxWidth: '850px', width: '95%', padding: '24px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={22} color="var(--color-corp-red)" /> Cierre de Caja — {formatResponsibleName(inspectingDrawer)}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Cierre del {new Date(inspectingDrawer.closedAt || inspectingDrawer.openedAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setInspectingDrawer(null)} style={{ fontSize: '1.2rem', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* Tarjetas resumen del cierre */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Rendido</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#047857', fontFamily: 'monospace', marginTop: '2px' }}>
                  +${Number(inspectingDrawer.realBalance || inspectingDrawer.closingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Fondo Inicial</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                  ${Number(inspectingDrawer.openingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Comprobantes</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e40af', fontFamily: 'monospace', marginTop: '2px' }}>
                  {inspectingDrawer.transactions?.length || 0} Recibos
                </div>
              </div>
            </div>

            {/* Listado de Recibos / Comprobantes */}
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Recibos Traídos en este Cierre
            </h4>

            {!inspectingDrawer.transactions || inspectingDrawer.transactions.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.88rem' }}>
                No se registran recibos o comprobantes individuales adjuntos a este cierre.
              </div>
            ) : (
              <div className="table-responsive card" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px' }}>Fecha/Hora</th>
                      <th style={{ padding: '10px' }}>N° Recibo / Pedido</th>
                      <th style={{ padding: '10px' }}>Cliente</th>
                      <th style={{ padding: '10px' }}>Medio de Pago</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspectingDrawer.transactions.map((t: any) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(t.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>
                          {t.receiptNumber || `Pedido #${t.orderId || 'S/N'}`}
                        </td>
                        <td style={{ padding: '10px', fontWeight: 500 }}>
                          {t.persona?.name || 'Cliente Varios'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: t.paymentMethod === 'CASH' ? '#ecfdf5' : t.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                            color: t.paymentMethod === 'CASH' ? '#047857' : t.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569'
                          }}>
                            {t.paymentMethod === 'CASH' ? 'Efectivo' : t.paymentMethod === 'CHECK' ? 'Cheque' : t.paymentMethod === 'BANK_TRANSFER' ? 'Transferencia' : t.paymentMethod}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#047857' }}>
                          +${Number(t.amount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          {t.verified ? (
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: '#ecfdf5', color: '#047857' }}>
                              Verificado
                            </span>
                          ) : (
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: '#fefce8', color: '#a16207' }}>
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setInspectingDrawer(null)} style={{ padding: '8px 20px', borderRadius: '6px' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DEPOSITAR / RETIRAR CAJA GRANDE */}
      {centralTransferModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCentralTransferModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '95%', padding: '24px', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpRight size={20} color="#38bdf8" /> Operación de Tesorería — Caja Grande
              </h3>
              <button type="button" className="btn btn-ghost" onClick={() => setCentralTransferModalOpen(false)}>✕</button>
            </div>

            {modalError && (
              <div style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                {modalError}
              </div>
            )}

            <form onSubmit={handleCentralTransfer}>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Actual Disponible en Bóveda</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#047857', fontFamily: 'monospace' }}>
                  ${cajaGrandeBalance.toLocaleString('es-AR')}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Tipo de Operación</label>
                <select
                  className="input"
                  value={centralTransferType}
                  onChange={e => setCentralTransferType(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 12px' }}
                >
                  <option value="BANK_DEPOSIT">Depósito en Banco (Efectivo -&gt; Cuenta Bancaria)</option>
                  <option value="TREASURY_WITHDRAWAL">Retiro de Tesorería (Extracción de Bóveda / Reserva)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Monto ($)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Ej: 500000"
                  value={centralTransferAmount}
                  onChange={e => setCentralTransferAmount(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600 }}
                  required
                />
              </div>

              {centralTransferType === 'BANK_DEPOSIT' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cuenta Bancaria Destino</label>
                  <select
                    className="input"
                    value={centralTransferBankId}
                    onChange={e => setCentralTransferBankId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px' }}
                    required
                  >
                    <option value="">-- Seleccionar Banco --</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.accountNumber || 'S/N'}) - Saldo actual: ${Number(b.balance).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Descripción / Referencia</label>
                <input
                  type="text"
                  className="input"
                  placeholder={centralTransferType === 'BANK_DEPOSIT' ? 'Ej: Depósito semanal recaudo efect.' : 'Ej: Retiro reserva socios'}
                  value={centralTransferDesc}
                  onChange={e => setCentralTransferDesc(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCentralTransferModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }} disabled={submittingCentralTransfer}>
                  {submittingCentralTransfer ? 'Procesando...' : 'Confirmar Operación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ARQUEO Y CIERRE DE CAJA GRANDE */}
      {centralCloseModalOpen && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setCentralCloseModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '95%', padding: '24px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={20} color="#f59e0b" /> Arqueo y Cierre de Ciclo — Caja Grande
              </h3>
              <button type="button" className="btn btn-ghost" onClick={() => setCentralCloseModalOpen(false)}>✕</button>
            </div>

            {modalError && (
              <div style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                {modalError}
              </div>
            )}

            <form onSubmit={handleCentralClose}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Teórico del Ciclo Actual</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                    ${cajaGrandeBalance.toLocaleString('es-AR')}
                  </div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Diferencia Arqueo vs Teórico</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'monospace', color: (Number(centralCloseRealBalance || 0) - cajaGrandeBalance) === 0 ? '#047857' : (Number(centralCloseRealBalance || 0) - cajaGrandeBalance) < 0 ? '#c53030' : '#1d4ed8' }}>
                    {(Number(centralCloseRealBalance || 0) - cajaGrandeBalance) >= 0 ? '+' : ''}${(Number(centralCloseRealBalance || 0) - cajaGrandeBalance).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Conteo Físico Real Declarado en Bóveda ($)</label>
                <input
                  type="number"
                  className="input"
                  value={centralCloseRealBalance}
                  onChange={e => setCentralCloseRealBalance(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}
                  required
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginBottom: '14px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Acciones opcionales al cerrar el período:
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Depositar en Banco ($)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="0"
                      value={centralCloseBankAmount}
                      onChange={e => setCentralCloseBankAmount(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Banco Destino</label>
                    <select
                      className="input"
                      value={centralCloseBankId}
                      onChange={e => setCentralCloseBankId(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px' }}
                    >
                      <option value="">-- Seleccionar --</option>
                      {bankAccounts.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Retiro de Tesorería ($)</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="0"
                      value={centralCloseWithdrawnAmount}
                      onChange={e => setCentralCloseWithdrawnAmount(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Saldo Inicial Nuevo Ciclo ($)</label>
                    <input
                      type="number"
                      className="input"
                      value={centralCloseNewOpening}
                      onChange={e => setCentralCloseNewOpening(e.target.value)}
                      style={{ width: '100%', padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700 }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Observaciones del Cierre</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Ej: Cierre quincenal de bóveda central. Arqueo correcto."
                  value={centralCloseNotes}
                  onChange={e => setCentralCloseNotes(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCentralCloseModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }} disabled={submittingCentralClose}>
                  {submittingCentralClose ? 'Guardando Cierre...' : 'Confirmar Cierre de Caja Grande'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
