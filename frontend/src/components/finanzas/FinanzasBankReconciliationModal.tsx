import React, { useRef, useState, type KeyboardEvent } from 'react';
import { CheckSquare, RefreshCw, Upload, Check, X, AlertCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { isBankReconcilableTx, isEcheqTx, parseMercadoPagoCsv, resolveMpRowMatchStatus } from './finanzasHelpers';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface FinanzasBankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: any[];
  reconBankId: string;
  setReconBankId: (id: string) => void;
  onRefreshMainData: () => void;
}

type CsvFilterKey = 'all' | 'exact' | 'rounding' | 'unregistered' | 'no_match' | 'reconciled';
const CSV_FILTER_TABS: Array<{ id: CsvFilterKey; label: string }> = [
  { id: 'all', label: 'Todos' }, { id: 'exact', label: 'Exactos' }, { id: 'rounding', label: 'Redondeo' },
  { id: 'unregistered', label: 'Sin Registrar' }, { id: 'no_match', label: 'Sin Cruce' }, { id: 'reconciled', label: 'Conciliados' },
];

export const FinanzasBankReconciliationModal: React.FC<FinanzasBankReconciliationModalProps> = ({
  isOpen, onClose, bankAccounts, reconBankId, setReconBankId, onRefreshMainData,
}) => {
  const confirm = useConfirm();
  const [reconStartDate, setReconStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reconEndDate, setReconEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reconStartTime, setReconStartTime] = useState('00:00');
  const [reconEndTime, setReconEndTime] = useState('23:59');
  const [reconTransactions, setReconTransactions] = useState<any[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  const [reconError, setReconError] = useState<string | null>(null);
  const [selectedTxs, setSelectedTxs] = useState<Set<number>>(new Set());
  const [clients, setClients] = useState<any[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [reconciledRows, setReconciledRows] = useState<Set<string>>(new Set());
  const [ignoredRows, setIgnoredRows] = useState<Set<string>>(new Set());
  const [manualMatches, setManualMatches] = useState<Record<string, any>>({});
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [csvFilterTab, setCsvFilterTab] = useState<CsvFilterKey>('all');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    if (isOpen) {
      setReconError(null);
      if (reconBankId) fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchReconciliationData = async (bankId: string, startDt: string, endDt: string, startTm: string, endTm: string) => {
    setReconLoading(true); setReconError(null);
    try {
      const [allTxs, allClients] = await Promise.all([
        api.getTransactions(),
        api.getPersonas('client'),
      ]);
      const startDT = new Date(`${startDt}T${startTm}:00`), endDT = new Date(`${endDt}T${endTm}:59`);
      setReconTransactions(
        (allTxs || []).filter((t: any) => {
          if (!isBankReconcilableTx(t)) return false;
          const sameOrUnassignedBank = !t.bankAccountId || Number(t.bankAccountId) === Number(bankId);
          const d = new Date(t.createdAt);
          return sameOrUnassignedBank && d >= startDT && d <= endDT;
        }),
      );
      setSelectedTxs(new Set());
      setClients([...(allClients || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))));
    } catch { setReconError('Error al cargar datos para conciliar.'); } finally { setReconLoading(false); }
  };

  const getRowMatchStatus = (row: any) => resolveMpRowMatchStatus(row, reconciledRows, manualMatches, reconTransactions, clients);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReconError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const parsed = parseMercadoPagoCsv(text);
      if (parsed.length === 0) { setReconError('No se encontraron ingresos válidos en el archivo CSV.'); return; }
      setCsvRows(parsed); setReconciledRows(new Set()); setIgnoredRows(new Set()); setManualMatches({});
      const timestamps = parsed.map((r) => new Date(r.date).getTime()).filter((t) => Number.isFinite(t));
      if (timestamps.length > 0) {
        const minDt = new Date(Math.min(...timestamps));
        minDt.setDate(minDt.getDate() - 1);
        const maxDt = new Date(Math.max(...timestamps));
        const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const nextStart = toIsoDate(minDt);
        const nextEnd = toIsoDate(maxDt);
        setReconStartDate(nextStart);
        setReconEndDate(nextEnd);
        if (reconBankId) fetchReconciliationData(reconBankId, nextStart, nextEnd, reconStartTime, reconEndTime);
      }
    };
    reader.readAsText(file);
  };

  const runReconAction = async (fn: () => Promise<void>, fallbackErr: string, rowId?: string) => {
    setReconLoading(true); setReconError(null);
    try {
      await fn();
      if (rowId) setReconciledRows((prev) => new Set(prev).add(rowId));
      onRefreshMainData();
      fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
    } catch (err: any) { setReconError(err?.message || fallbackErr); } finally { setReconLoading(false); }
  };

  const handleReconcileAllExact = async () => {
    const exacts = csvRows.filter((r) => !ignoredRows.has(r.id)).map((r) => ({ row: r, m: getRowMatchStatus(r) })).filter((x) => x.m.status === 'exact' && x.m.tx);
    if (exacts.length === 0 || !(await confirm(`¿Conciliar las ${exacts.length} transferencias exactas en lote?`))) return;
    await runReconAction(async () => {
      const bankIdNum = Number(reconBankId) || undefined;
      await Promise.all(exacts.map((x) => api.verifyTransaction(x.m.tx.id, true, undefined, bankIdNum)));
      setReconciledRows((prev) => { const next = new Set(prev); exacts.forEach((x) => next.add(x.row.id)); return next; });
    }, 'Error al conciliar en lote.');
  };

  const handleVerifySelected = async () => {
    const ids = Array.from(selectedTxs);
    if (ids.length === 0 || !(await confirm(`¿Verificar las ${ids.length} transferencias seleccionadas?`))) return;
    await runReconAction(async () => {
      const bankIdNum = Number(reconBankId) || undefined;
      await Promise.all(ids.map((id) => api.verifyTransaction(id, true, undefined, bankIdNum)));
      setSelectedTxs(new Set());
    }, 'Error al verificar transferencias seleccionadas.');
  };

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    const len = CSV_FILTER_TABS.length;
    const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % len : e.key === 'ArrowLeft' ? (idx - 1 + len) % len : e.key === 'Home' ? 0 : e.key === 'End' ? len - 1 : -1;
    if (nextIdx === -1) return;
    e.preventDefault(); setCsvFilterTab(CSV_FILTER_TABS[nextIdx].id); tabRefs.current[nextIdx]?.focus();
  };

  const reload = () => fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);

  const sortedReconTransactions = [...reconTransactions].sort((a, b) => Number(Boolean(a.verified)) - Number(Boolean(b.verified)));
  const formatShortDate = (iso: string | Date) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <NativeModalDialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="recon-modal-title" style={{ maxWidth: '1440px', width: '96vw', height: '92vh', padding: '20px 24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="modal-header" style={{ marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 id="recon-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckSquare size={18} color="#10b981" aria-hidden="true" /> Conciliación Bancaria
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="recon-csv-file" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px', cursor: 'pointer', margin: 0 }}>
            <Upload size={14} aria-hidden="true" /> Cargar CSV
            <input id="recon-csv-file" type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
          </label>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </div>
      </div>

      {reconError && (
        <div role="alert" style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={15} aria-hidden="true" />{reconError}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setReconError(null)} aria-label="Cerrar error"><X size={14} aria-hidden="true" /></button>
        </div>
      )}

      <search aria-label="Filtrar transferencias" style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 1.3fr) 1.5fr 1.5fr auto', gap: '10px', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', alignItems: 'end', flexShrink: 0 }}>
        <div>
          <label htmlFor="recon-bank" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Cuenta</label>
          <select id="recon-bank" className="select" value={reconBankId} onChange={(e) => { setReconBankId(e.target.value); fetchReconciliationData(e.target.value, reconStartDate, reconEndDate, reconStartTime, reconEndTime); }} style={{ height: '34px', padding: '4px 8px' }}>
            {bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor="recon-start-date" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Desde</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input id="recon-start-date" type="date" className="input" value={reconStartDate} onChange={(e) => setReconStartDate(e.target.value)} style={{ flex: 1, height: '34px' }} />
            <input type="time" aria-label="Hora desde" className="input" value={reconStartTime} onChange={(e) => setReconStartTime(e.target.value)} style={{ width: '112px', height: '34px' }} />
          </div>
        </div>
        <div>
          <label htmlFor="recon-end-date" style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Hasta</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input id="recon-end-date" type="date" className="input" value={reconEndDate} onChange={(e) => setReconEndDate(e.target.value)} style={{ flex: 1, height: '34px' }} />
            <input type="time" aria-label="Hora hasta" className="input" value={reconEndTime} onChange={(e) => setReconEndTime(e.target.value)} style={{ width: '112px', height: '34px' }} />
          </div>
        </div>
        <button type="button" className="btn btn-secondary" disabled={reconLoading} onClick={reload} style={{ height: '34px', padding: '0 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} aria-hidden="true" /> {reconLoading ? '...' : 'Buscar'}
        </button>
      </search>

      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        <div style={{ flex: '1.5 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          {csvRows.length > 0 ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <input type="search" aria-label="Filtrar CSV" className="input" placeholder="Buscar pagador o CUIT..." autoCorrect="off" autoCapitalize="none" spellCheck={false} value={csvSearchQuery} onChange={(e) => setCsvSearchQuery(e.target.value)} style={{ flex: 1, height: '34px', fontSize: '0.8rem' }} />
                {csvRows.some((r) => !ignoredRows.has(r.id) && getRowMatchStatus(r).status === 'exact') && (
                  <button type="button" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }} onClick={handleReconcileAllExact}>Conciliar Exactos</button>
                )}
              </div>
              <div role="tablist" aria-label="Estado de cruce CSV" className="linear-tablist" style={{ flexShrink: 0 }}>
                {CSV_FILTER_TABS.map((t, idx) => {
                  const activeRows = csvRows.filter((r) => !ignoredRows.has(r.id));
                  const count = t.id === 'all' ? activeRows.length : activeRows.filter((r) => getRowMatchStatus(r).status === t.id).length;
                  return (
                    <button key={t.id} ref={(el) => { tabRefs.current[idx] = el; }} type="button" role="tab" aria-selected={csvFilterTab === t.id} tabIndex={csvFilterTab === t.id ? 0 : -1} className="linear-tab" onClick={() => setCsvFilterTab(t.id)} onKeyDown={(e) => handleTabKeyDown(e, idx)}>
                      {t.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                {csvRows
                  .filter((row) => !ignoredRows.has(row.id))
                  .filter((row) => csvFilterTab === 'all' || getRowMatchStatus(row).status === csvFilterTab)
                  .filter((row) => !csvSearchQuery.trim() || row.payerName.toLowerCase().includes(csvSearchQuery.toLowerCase()) || row.payerCuit.includes(csvSearchQuery) || row.id.includes(csvSearchQuery))
                  .map((row) => {
                    const mInfo = getRowMatchStatus(row);
                    const rowBg = mInfo.status === 'exact' ? '#f0fdf4' : mInfo.status === 'rounding' ? '#fffbeb' : '#ffffff';
                    return (
                      <div key={row.id} title={`ID: ${row.id}`} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)', backgroundColor: rowBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{row.payerName || 'Sin nombre'}</span>
                            {row.payerCuit && <span className="tabular-nums" style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{row.payerCuit}</span>}
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>· {formatShortDate(row.date)}</span>
                          </div>
                          {mInfo.status === 'exact' && mInfo.tx && <div style={{ fontSize: '0.74rem', color: '#15803d' }}>ERP #{mInfo.tx.receiptNumber || mInfo.tx.id} · {mInfo.tx.persona?.name}</div>}
                          {mInfo.status === 'rounding' && mInfo.tx && <div style={{ fontSize: '0.74rem', color: '#b45309' }}>ERP #{mInfo.tx.receiptNumber || mInfo.tx.id} · {mInfo.tx.persona?.name}</div>}
                          {mInfo.status === 'unregistered' && mInfo.client && <div style={{ fontSize: '0.74rem', color: '#1d4ed8' }}>{mInfo.client.name}</div>}
                          {mInfo.status === 'no_match' && (
                            <select aria-label={`Vincular cliente para operación ${row.id}`} className="select" style={{ marginTop: '2px', height: '30px', padding: '2px 8px', fontSize: '0.76rem', lineHeight: '1.2', maxWidth: '280px' }} value="" onChange={(e) => { const c = clients.find((cl) => cl.id === Number(e.target.value)); if (c) setManualMatches((prev) => ({ ...prev, [row.id]: c })); }}>
                              <option value="">Vincular cliente...</option>
                              {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                            </select>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                          <span className="tabular-nums" style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.94rem' }}>${Math.round(row.amount).toLocaleString('es-AR')}</span>
                          {mInfo.status === 'exact' && mInfo.tx && <button type="button" className="btn btn-sm" style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '0.74rem', padding: '5px 10px', whiteSpace: 'nowrap' }} onClick={() => runReconAction(() => api.verifyTransaction(mInfo.tx.id, true, row.amount, Number(reconBankId) || undefined), 'Error al conciliar.', row.id)}>Conciliar</button>}
                          {mInfo.status === 'rounding' && mInfo.tx && <button type="button" className="btn btn-sm" style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.74rem', padding: '5px 10px', whiteSpace: 'nowrap' }} onClick={() => runReconAction(() => api.verifyTransaction(mInfo.tx.id, true, row.amount, Number(reconBankId) || undefined), 'Error al conciliar.', row.id)}>Ajustar</button>}
                          {mInfo.status === 'unregistered' && mInfo.client && <button type="button" className="btn btn-sm" style={{ backgroundColor: '#3b82f6', color: '#fff', fontSize: '0.74rem', padding: '5px 10px', whiteSpace: 'nowrap' }} onClick={() => runReconAction(async () => { const res = await api.registerPayment(mInfo.client.id, { amount: row.amount, paymentMethod: 'BANK_TRANSFER', description: `Cobro MP Conciliación - Op ${row.id} - Payer: ${row.payerName}`, branch: 'X', type: 'INCOME', bankAccountId: Number(reconBankId) }); if (res?.transaction?.id) await api.verifyTransaction(res.transaction.id, true, undefined, Number(reconBankId) || undefined); }, 'Error al registrar cobro.', row.id)}>Registrar</button>}
                          {mInfo.status === 'reconciled' && <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={14} aria-hidden="true" /> Listo</span>}
                          {(mInfo.status === 'no_match' || mInfo.status === 'unregistered') && (
                            <button type="button" className="btn btn-ghost" title="Omitir fila" aria-label="Omitir fila" style={{ padding: '4px', color: 'var(--text-muted)' }} onClick={() => setIgnoredRows((prev) => new Set(prev).add(row.id))}>
                              <X size={14} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '0.84rem', gap: '8px' }}>
              <Upload size={28} aria-hidden="true" style={{ opacity: 0.45 }} />
              <span>Cargá un archivo CSV desde el botón superior</span>
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 0', minWidth: '300px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>En ERP ({reconTransactions.length})</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {selectedTxs.size > 0 && (
                <button type="button" className="btn btn-primary" disabled={reconLoading} style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontSize: '0.74rem', padding: '4px 10px' }} onClick={handleVerifySelected}>
                  Verificar ({selectedTxs.size})
                </button>
              )}
              {reconTransactions.some((t) => !t.verified) && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.74rem', padding: '3px 8px' }} onClick={() => {
                  const unverifiedIds = reconTransactions.filter((t) => !t.verified).map((t) => t.id);
                  setSelectedTxs((prev) => prev.size === unverifiedIds.length ? new Set() : new Set(unverifiedIds));
                }}>
                  {selectedTxs.size === reconTransactions.filter((t) => !t.verified).length ? 'Deseleccionar' : 'Todo'}
                </button>
              )}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            {sortedReconTransactions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Sin transferencias en el período</div>
            ) : sortedReconTransactions.map((t: any) => (
              <div key={t.id} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: t.verified ? '#fafafa' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
                  {!t.verified && <input type="checkbox" aria-label={`Seleccionar transferencia ${t.persona?.name || t.id}`} checked={selectedTxs.has(t.id)} onChange={() => setSelectedTxs((prev) => { const n = new Set(prev); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.persona?.name || 'Mostrador'}{isEcheqTx(t) ? ' · eCheq' : ''}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(t.createdAt).toLocaleDateString('es-AR')}{t.verified && t.verifiedBy?.username ? ` · Concilió: ${t.verifiedBy.username}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <span className="tabular-nums" style={{ fontFamily: 'monospace', fontWeight: 700 }}>${Math.round(Number(t.amount)).toLocaleString('es-AR')}</span>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '2px 6px', color: t.verified ? '#64748b' : '#10b981', fontWeight: t.verified ? 400 : 600 }} onClick={async () => { await api.verifyTransaction(t.id, !t.verified, undefined, !t.verified ? (Number(reconBankId) || undefined) : undefined); onRefreshMainData(); reload(); }}>
                    {t.verified ? 'Verificada' : 'Verificar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </NativeModalDialog>
  );
};
