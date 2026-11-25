import { useState, useEffect } from 'react';
import { X, Printer, Calendar } from 'lucide-react';
import { api } from '../../utils/api';
import { billingApi, type EligibleOrderForCreditNote } from '../../api/billing.api';
import { NativeModalDialog } from './NativeModalDialog';
import { ResumenCuentaDetailModals } from './ResumenCuentaDetailModals';
import { VoidReceiptModal } from './VoidReceiptModal';
import { StandaloneCreditNoteModal } from '../billing/credit-notes/StandaloneCreditNoteModal';
import {
  buildResumenRows,
  formatMovementLabel,
  formatSignedCurrency,
  type ResumenBranchFilter,
  type ResumenDateRange,
  type ResumenLedgerRow,
} from './resumenCuenta.utils';

export { formatMovementLabel };

interface ResumenCuentaModalProps {
  client: any;
  onClose: () => void;
}

export default function ResumenCuentaModal({ client, onClose }: ResumenCuentaModalProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<ResumenLedgerRow[]>([]);
  const [priorBalance, setPriorBalance] = useState(0);
  const [hasPriorEntries, setHasPriorEntries] = useState(false);
  const [filteredFinalBalance, setFilteredFinalBalance] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<ResumenDateRange>('30days');
  const [branchFilter, setBranchFilter] = useState<ResumenBranchFilter>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const userRole = localStorage.getItem('user_role') || '';
  const isAdmin = userRole === 'ADMIN';
  const isAdminOrFacturacion = isAdmin || userRole === 'FACTURACION';

  const [showVoided, setShowVoided] = useState(false);
  const [hasVoidedEntries, setHasVoidedEntries] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ txId: number; label: string; amount: number } | null>(null);
  const [voidSubmitting, setVoidSubmitting] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedCreditNote, setSelectedCreditNote] = useState<any | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [selectedWithholding, setSelectedWithholding] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [creditNoteOrder, setCreditNoteOrder] = useState<EligibleOrderForCreditNote | null>(null);
  const [startingCreditNote, setStartingCreditNote] = useState(false);
  const [liveTotalBalance, setLiveTotalBalance] = useState<number | null>(null);
  const [actionBanner, setActionBanner] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    fetchTransactions();
  }, [dateRange, branchFilter, customStart, customEnd, showVoided]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.getPersonaLedger(client.id);
      const ledger = res.ledger || [];
      const fullSummary = buildResumenRows(ledger, { branchFilter: 'ALL', dateRange: 'all' });
      setLiveTotalBalance(fullSummary.finalBalance);
      setHasVoidedEntries(fullSummary.hasVoidedEntries);
      const result = buildResumenRows(ledger, {
        branchFilter,
        dateRange,
        customStart,
        customEnd,
        includeVoided: isAdmin && showVoided,
      });
      setTransactions(result.rows);
      setPriorBalance(result.priorBalance);
      setHasPriorEntries(result.hasPriorEntries);
      setFilteredFinalBalance(result.finalBalance);
    } catch {
      setActionBanner({ type: 'error', text: 'Error al cargar movimientos.' });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (fullId: string) => {
    if (viewLoading) return;
    if (fullId.startsWith('withholding-')) {
      const tx = transactions.find((t) => t.id === fullId);
      if (tx?.metadata) setSelectedWithholding(tx.metadata);
      return;
    }
    setViewLoading(true);
    try {
      if (fullId.startsWith('order-')) setSelectedOrder(await api.getOrderById(Number(fullId.split('-').pop())));
      else if (fullId.startsWith('credit-note-')) setSelectedCreditNote(await api.getCreditNoteById(Number(fullId.split('-').pop())));
      else if (fullId.startsWith('transaction-')) setSelectedTransaction(await api.getTransactionById(Number(fullId.split('-').pop())));
    } catch {
      setActionBanner({ type: 'error', text: 'No se pudo cargar el detalle.' });
    } finally {
      setViewLoading(false);
    }
  };

  const handleDeleteReceipt = (txId: number, receiptDesc: string, creditAmount: number) => {
    setVoidError(null);
    setVoidTarget({ txId, label: receiptDesc, amount: creditAmount });
  };

  const handleConfirmVoidReceipt = async (reason: string) => {
    if (!voidTarget) return;
    setVoidSubmitting(true);
    setVoidError(null);
    try {
      const res = await api.voidReceipt(voidTarget.txId, reason);
      setActionBanner({ type: 'success', text: res.message || 'Recibo anulado.' });
      setVoidTarget(null);
      setSelectedTransaction(null);
      fetchTransactions();
    } catch (err: any) {
      setVoidError(err?.response?.data?.error || err?.message || 'Error al anular recibo.');
    } finally {
      setVoidSubmitting(false);
    }
  };

  const handleStartCreditNote = async (order: any) => {
    if (startingCreditNote) return;
    setStartingCreditNote(true);
    setActionBanner(null);
    try {
      const eligible = await billingApi.getEligibleOrdersForCreditNote(Number(client.id));
      const matched = eligible.find((o) => o.id === Number(order.id));
      if (!matched) {
        setActionBanner({
          type: 'error',
          text: 'Esta factura ya fue acreditada al 100% o no admite nuevas Notas de Crédito.',
        });
        setSelectedOrder(null);
        return;
      }
      setSelectedOrder(null);
      setCreditNoteOrder(matched);
    } catch (err: any) {
      setActionBanner({
        type: 'error',
        text: err?.message || 'No se pudo preparar la Nota de Crédito.',
      });
    } finally {
      setStartingCreditNote(false);
    }
  };

  const outstandingBalance =
    branchFilter === 'ALL'
      ? Math.round(Number(liveTotalBalance ?? client.outstandingBalance ?? 0))
      : Math.round(Number(filteredFinalBalance ?? client.outstandingBalance ?? 0));

  const showOpeningRow = hasPriorEntries && Math.round(priorBalance) !== 0;

  return (
    <NativeModalDialog
      isOpen={Boolean(client)}
      onClose={onClose}
      ariaLabelledBy="resumen-cuenta-title"
      className="print-modal resumen-modal-shell"
      style={{ maxWidth: '940px', width: '95vw', maxHeight: '92vh', padding: '18px 20px', borderRadius: '12px' }}
    >
      <div className="print-content-box" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          className="no-print"
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
            paddingBottom: '12px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#6b7280" />
            <select
              aria-label="Rango de fechas"
              className="input"
              style={{ width: 'auto', padding: '5px 10px', fontSize: '0.82rem', height: '32px' }}
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as ResumenDateRange)}
            >
              <option value="7days">7 días</option>
              <option value="30days">30 días</option>
              <option value="90days">90 días</option>
              <option value="all">Histórico</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <select
            aria-label="Sucursal"
            className="input"
            style={{ width: 'auto', padding: '5px 10px', fontSize: '0.82rem', height: '32px' }}
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value as ResumenBranchFilter)}
          >
            <option value="ALL">Todas (A + X)</option>
            <option value="OFFICIAL">Sucursal A</option>
            <option value="INTERNAL">Sucursal X</option>
          </select>

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input aria-label="Desde" type="date" className="input" style={{ padding: '4px 8px', fontSize: '0.8rem', height: '32px' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span style={{ color: '#9ca3af' }}>-</span>
              <input aria-label="Hasta" type="date" className="input" style={{ padding: '4px 8px', fontSize: '0.8rem', height: '32px' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}

          <div style={{ flex: 1 }} />

          {isAdmin && hasVoidedEntries && (
            <label className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#4b5563', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
              Ver anulados
            </label>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px', height: '32px' }}
          >
            <Printer size={14} /> Imprimir
          </button>

          <div style={{ width: '1px', height: '22px', backgroundColor: '#e5e7eb', margin: '0 2px' }} />

          <button type="button" className="btn btn-ghost" aria-label="Cerrar" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {actionBanner && (
          <div
            className="no-print"
            role={actionBanner.type === 'error' ? 'alert' : 'status'}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              backgroundColor: actionBanner.type === 'error' ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${actionBanner.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
              color: actionBanner.type === 'error' ? '#991b1b' : '#166534',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{actionBanner.text}</span>
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => setActionBanner(null)}>Cerrar</button>
          </div>
        )}

        <div className="print-modal-scroll resumen-scroll-frame" tabIndex={0} role="region" aria-label="Movimientos de cuenta">
          <div id="print-area" className="print-only-container resumen-sheet">
            <div className="resumen-doc-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '2px solid #111827', paddingBottom: '12px' }}>
                <img src="/logo.png" alt="Distribuidora Don Venancio" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
                <div style={{ textAlign: 'right', lineHeight: '1.3' }}>
                  <h2 id="resumen-cuenta-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.01em' }}>
                    RESUMEN DE CUENTA
                  </h2>
                  <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
                    {new Date().toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px', gap: '16px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', fontWeight: 600 }}>Cliente</div>
                  <strong style={{ fontSize: '1.02rem', color: '#111827' }}>{client.name}</strong>
                  {(client.cuit || client.phone) && (
                    <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '2px' }}>
                      {client.cuit && <span>CUIT: {client.cuit}</span>}
                      {client.cuit && client.phone && <span style={{ margin: '0 6px' }}>·</span>}
                      {client.phone && <span>{client.phone}</span>}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', fontWeight: 600 }}>Saldo</div>
                  <strong
                    className="tabular-nums"
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: outstandingBalance > 0 ? 'var(--color-corp-red)' : outstandingBalance < 0 ? '#059669' : '#111827',
                    }}
                  >
                    {formatSignedCurrency(outstandingBalance)}
                  </strong>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#6b7280', fontSize: '0.86rem' }}>Cargando...</div>
            ) : (
              <table className="resumen-ledger-table">
                <thead>
                  <tr>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'left', width: '98px' }}>Fecha</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'left' }}>Comprobante</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'right', width: '112px' }}>Debe</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'right', width: '112px' }}>Haber</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'right', width: '118px' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {showOpeningRow && (
                    <tr className="resumen-row-opening">
                      <td style={{ padding: '8px 10px' }} />
                      <td style={{ padding: '8px 10px', color: '#6b7280', fontStyle: 'italic' }}>Saldo anterior</td>
                      <td style={{ padding: '8px 10px' }} />
                      <td style={{ padding: '8px 10px' }} />
                      <td
                        className="tabular-nums"
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          color: Math.round(priorBalance) < 0 ? '#059669' : '#374151',
                        }}
                      >
                        {formatSignedCurrency(priorBalance)}
                      </td>
                    </tr>
                  )}
                  {transactions.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)' }}>Sin movimientos</td></tr>
                  ) : (
                    transactions.map((t, idx) => {
                      const isClickable = t.id && (t.id.startsWith('order-') || t.id.startsWith('credit-note-') || t.id.startsWith('transaction-') || t.id.startsWith('withholding-'));
                      const label = formatMovementLabel(t);
                      const isHaber = t.credit > 0 && t.debit === 0;
                      const roundedRowBalance = Math.round(t.balance);
                      const balanceColor =
                        roundedRowBalance < 0 ? '#059669' : roundedRowBalance === 0 ? '#6b7280' : '#111827';
                      return (
                        <tr
                          key={t.id || idx}
                          className={isClickable ? 'resumen-row-clickable' : undefined}
                          onClick={isClickable && !viewLoading ? () => handleViewDetail(t.id) : undefined}
                        >
                          <td className="tabular-nums" style={{ padding: '9px 10px', color: '#4b5563', fontSize: '0.82rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {t.isPureDate ? t.date.toLocaleDateString('es-AR', { timeZone: 'UTC' }) : t.date.toLocaleDateString('es-AR')}
                          </td>
                          <td className={isHaber ? 'resumen-cell-haber' : 'resumen-cell-debe'} style={{ verticalAlign: 'middle' }}>
                            {isClickable ? (
                              <>
                                <button
                                  type="button"
                                  className="no-print resumen-desc-btn"
                                  disabled={viewLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetail(t.id);
                                  }}
                                >
                                  <span className="resumen-desc-title">{label}</span>
                                </button>
                                <span className="resumen-print-inline">{label}</span>
                              </>
                            ) : (
                              <span style={{ color: '#111827', fontWeight: 500 }}>{label}</span>
                            )}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px 10px', textAlign: 'right', color: t.debit > 0 ? '#dc2626' : 'inherit', fontWeight: t.debit > 0 ? 500 : 400, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {t.debit > 0 ? `$${Math.round(t.debit).toLocaleString('es-AR')}` : ''}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px 10px', textAlign: 'right', color: t.credit > 0 ? '#059669' : 'inherit', fontWeight: t.credit > 0 ? 600 : 400, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {t.credit > 0 ? `$${Math.round(t.credit).toLocaleString('es-AR')}` : ''}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px 10px', textAlign: 'right', color: balanceColor, fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {formatSignedCurrency(t.balance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <ResumenCuentaDetailModals
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        selectedCreditNote={selectedCreditNote}
        setSelectedCreditNote={setSelectedCreditNote}
        selectedTransaction={selectedTransaction}
        setSelectedTransaction={setSelectedTransaction}
        selectedWithholding={selectedWithholding}
        setSelectedWithholding={setSelectedWithholding}
        isAdminOrFacturacion={isAdminOrFacturacion}
        onDeleteReceipt={handleDeleteReceipt}
        onStartCreditNote={handleStartCreditNote}
        startingCreditNote={startingCreditNote}
      />

      <StandaloneCreditNoteModal
        isOpen={Boolean(creditNoteOrder)}
        onClose={() => setCreditNoteOrder(null)}
        client={{ ...client, outstandingBalance }}
        initialOrder={creditNoteOrder}
        onSuccess={(note) => {
          setCreditNoteOrder(null);
          setActionBanner({
            type: 'success',
            text: `Nota de Crédito #${note?.creditNoteNumber || note?.id} emitida.`,
          });
          fetchTransactions();
        }}
        onError={(msg) => setActionBanner({ type: 'error', text: msg })}
      />
      <VoidReceiptModal
        isOpen={Boolean(voidTarget)}
        receiptLabel={voidTarget?.label || ''}
        clientName={client?.name || 'Cliente'}
        amount={voidTarget?.amount || 0}
        submitting={voidSubmitting}
        error={voidError}
        onClose={() => { setVoidTarget(null); setVoidError(null); }}
        onConfirm={handleConfirmVoidReceipt}
      />
    </NativeModalDialog>
  );
}
