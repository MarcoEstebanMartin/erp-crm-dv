import React, { useState } from 'react';
import { CheckSquare, RefreshCw, Upload, Check } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { parseMercadoPagoCsv, resolveMpRowMatchStatus } from './finanzasHelpers';

interface FinanzasBankReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  bankAccounts: any[];
  reconBankId: string;
  setReconBankId: (id: string) => void;
  onRefreshMainData: () => void;
}

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
  const [selectedTxs, setSelectedTxs] = useState<Set<number>>(new Set());
  const [clients, setClients] = useState<any[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [reconciledRows, setReconciledRows] = useState<Set<string>>(new Set());
  const [manualMatches, setManualMatches] = useState<Record<string, any>>({});
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [csvFilterTab, setCsvFilterTab] = useState<'all' | 'exact' | 'rounding' | 'unregistered' | 'no_match' | 'reconciled'>('all');

  React.useEffect(() => {
    if (isOpen && reconBankId) fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchReconciliationData = async (bankId: string, startDt: string, endDt: string, startTm: string, endTm: string) => {
    setReconLoading(true);
    try {
      const [allTxs, allClients] = await Promise.all([
        api.getTransactions({ bankAccountId: Number(bankId), paymentMethod: 'BANK_TRANSFER' }),
        api.getPersonas('client'),
      ]);
      const startDateTime = new Date(`${startDt}T${startTm}:00`);
      const endDateTime = new Date(`${endDt}T${endTm}:59`);
      setReconTransactions((allTxs || []).filter((t: any) => { const d = new Date(t.createdAt); return d >= startDateTime && d <= endDateTime; }));
      setSelectedTxs(new Set());
      setClients(allClients || []);
    } catch { alert('Error al cargar datos para conciliar.'); } finally { setReconLoading(false); }
  };

  const getRowMatchStatus = (row: any) => resolveMpRowMatchStatus(row, reconciledRows, manualMatches, reconTransactions, clients);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const parsed = parseMercadoPagoCsv(text);
      if (parsed.length === 0) return alert('No se encontraron filas de ingresos válidas en el CSV.');
      setCsvRows(parsed);
      setReconciledRows(new Set());
      setManualMatches({});
    };
    reader.readAsText(file);
  };

  const handleVerifyWithAdjustment = async (txId: number, csvAmount: number, rowId: string) => {
    setReconLoading(true);
    try {
      await api.verifyTransaction(txId, true, csvAmount);
      setReconciledRows((prev) => new Set(prev).add(rowId));
      onRefreshMainData();
      fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
    } catch { alert('Error al conciliar.'); } finally { setReconLoading(false); }
  };

  const handleRegisterPaymentFromCsvRow = async (row: any, clientObj: any) => {
    if (!clientObj) return;
    setReconLoading(true);
    try {
      await api.registerPayment(clientObj.id, {
        amount: row.amount, paymentMethod: 'BANK_TRANSFER',
        description: `Cobro MP Conciliación - Op ${row.id} - Payer: ${row.payerName}`,
        branch: 'X', type: 'INCOME', bankAccountId: Number(reconBankId),
      });
      setReconciledRows((prev) => new Set(prev).add(row.id));
      onRefreshMainData();
      fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
    } catch (err: any) { alert(err.message || 'Error al registrar cobro.'); } finally { setReconLoading(false); }
  };

  const handleReconcileAllExact = async () => {
    const exacts = csvRows.map((r) => ({ row: r, m: getRowMatchStatus(r) })).filter((x) => x.m.status === 'exact' && x.m.tx);
    if (exacts.length === 0) return;
    if (!(await confirm(`¿Conciliar las ${exacts.length} transferencias exactas en lote?`))) return;
    setReconLoading(true);
    try {
      await Promise.all(exacts.map((x) => api.verifyTransaction(x.m.tx.id, true)));
      setReconciledRows((prev) => { const next = new Set(prev); exacts.forEach((x) => next.add(x.row.id)); return next; });
      onRefreshMainData();
      fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime);
    } catch { alert('Error en lote.'); } finally { setReconLoading(false); }
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ maxWidth: '1150px', width: '95%', padding: '24px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={20} color="#10b981" /> Conciliación de Transferencias (Mercado Pago / Bancos)
          </h3>
          <button type="button" className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 1.8fr 0.7fr', gap: '12px', backgroundColor: 'var(--bg-light)', padding: '14px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-color)', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Banco / Cuenta</label>
            <select className="select" value={reconBankId} onChange={(e) => { setReconBankId(e.target.value); fetchReconciliationData(e.target.value, reconStartDate, reconEndDate, reconStartTime, reconEndTime); }} style={{ width: '100%', height: '36px' }}>
              {bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Desde</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="date" className="input" value={reconStartDate} onChange={(e) => setReconStartDate(e.target.value)} style={{ flex: 1, height: '36px' }} />
              <input type="time" className="input" value={reconStartTime} onChange={(e) => setReconStartTime(e.target.value)} style={{ width: '100px', height: '36px' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Hasta</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input type="date" className="input" value={reconEndDate} onChange={(e) => setReconEndDate(e.target.value)} style={{ flex: 1, height: '36px' }} />
              <input type="time" className="input" value={reconEndTime} onChange={(e) => setReconEndTime(e.target.value)} style={{ width: '100px', height: '36px' }} />
            </div>
          </div>
          <button className="btn btn-secondary" disabled={reconLoading} onClick={() => fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime)} style={{ height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> {reconLoading ? '...' : 'Buscar'}
          </button>
        </div>

        <div style={{ border: '1px dashed #cbd5e1', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>Cargar Reporte Mercado Pago (.csv)</h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cruza transferencias exactas, redondeos y clientes por CUIT/Nombre.</p>
          </div>
          <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '7px 12px', cursor: 'pointer', margin: 0 }}>
            <Upload size={14} /> Seleccionar Archivo CSV
            <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: '2 1 520px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {csvRows.length > 0 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <input type="text" className="input" placeholder="Filtrar CSV..." value={csvSearchQuery} onChange={(e) => setCsvSearchQuery(e.target.value)} style={{ flex: 1, height: '34px', fontSize: '0.8rem' }} />
                  {csvRows.some((r) => getRowMatchStatus(r).status === 'exact') && (
                    <button type="button" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontSize: '0.76rem', padding: '6px 10px' }} onClick={handleReconcileAllExact}>
                      ⚡ Conciliar Exactos
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                  {(['all', 'exact', 'rounding', 'unregistered', 'no_match', 'reconciled'] as const).map((t) => (
                    <button key={t} type="button" className={`btn ${csvFilterTab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCsvFilterTab(t)} style={{ fontSize: '0.72rem', padding: '4px 8px', height: '26px' }}>{t.toUpperCase()}</button>
                  ))}
                </div>
                <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {csvRows
                    .filter((row) => csvFilterTab === 'all' || getRowMatchStatus(row).status === csvFilterTab)
                    .filter((row) => !csvSearchQuery.trim() || row.payerName.toLowerCase().includes(csvSearchQuery.toLowerCase()) || row.payerCuit.includes(csvSearchQuery) || row.id.includes(csvSearchQuery))
                    .map((row) => {
                      const matchInfo = getRowMatchStatus(row);
                      return (
                        <div key={row.id} style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: matchInfo.status === 'exact' ? '#eaf9ee' : matchInfo.status === 'rounding' ? '#fff8e1' : '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700 }}>{row.payerName || 'PAGADOR DESCONOCIDO'} {row.payerCuit && <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>({row.payerCuit})</span>}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>ID: {row.id} • {new Date(row.date).toLocaleString('es-AR')}</div>
                            {matchInfo.status === 'exact' && matchInfo.tx && <div style={{ fontSize: '0.74rem', color: '#137333', marginTop: '4px' }}>Coincide con ERP #{matchInfo.tx.receiptNumber || matchInfo.tx.id} ({matchInfo.tx.persona?.name})</div>}
                            {matchInfo.status === 'unregistered' && matchInfo.client && <div style={{ fontSize: '0.74rem', color: '#1a73e8', marginTop: '4px' }}>Cliente: <strong>{matchInfo.client.name}</strong></div>}
                            {matchInfo.status === 'no_match' && (
                              <select className="select" style={{ marginTop: '6px', height: '28px', fontSize: '0.74rem', maxWidth: '280px' }} value="" onChange={(e) => { const c = clients.find((cl) => cl.id === Number(e.target.value)); if (c) setManualMatches((prev) => ({ ...prev, [row.id]: c })); }}>
                                <option value="">-- Vincular cliente manualmente --</option>
                                {clients.slice(0, 80).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                              </select>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem' }}>${Math.round(row.amount).toLocaleString('es-AR')}</div>
                            {matchInfo.status === 'exact' && matchInfo.tx && <button type="button" className="btn btn-sm" style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '0.72rem', padding: '4px 8px', marginTop: '4px' }} onClick={() => handleVerifyWithAdjustment(matchInfo.tx.id, row.amount, row.id)}>Conciliar</button>}
                            {matchInfo.status === 'rounding' && matchInfo.tx && <button type="button" className="btn btn-sm" style={{ backgroundColor: '#f59e0b', color: '#fff', fontSize: '0.72rem', padding: '4px 8px', marginTop: '4px' }} onClick={() => handleVerifyWithAdjustment(matchInfo.tx.id, row.amount, row.id)}>Ajustar y Conciliar</button>}
                            {matchInfo.status === 'unregistered' && matchInfo.client && <button type="button" className="btn btn-sm" style={{ backgroundColor: '#3b82f6', color: '#fff', fontSize: '0.72rem', padding: '4px 8px', marginTop: '4px' }} onClick={() => handleRegisterPaymentFromCsvRow(row, matchInfo.client)}>Registrar Cobro</button>}
                            {matchInfo.status === 'reconciled' && <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={13} /> Listo</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <div style={{ height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                <Upload size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                <span>Subí un archivo CSV de Mercado Pago para iniciar el cruce automático.</span>
              </div>
            )}
          </div>

          <div style={{ flex: '1 1 320px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Transferencias en ERP ({reconTransactions.length})</h4>
              {reconTransactions.length > 0 && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '2px 6px' }} onClick={() => setSelectedTxs((prev) => prev.size === reconTransactions.length ? new Set() : new Set(reconTransactions.map((t) => t.id)))}>
                  {selectedTxs.size === reconTransactions.length ? 'Deseleccionar' : 'Todo'}
                </button>
              )}
            </div>
            <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {reconTransactions.map((t: any) => (
                <div key={t.id} style={{ padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: t.verified ? '#f8fafc' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {!t.verified && <input type="checkbox" checked={selectedTxs.has(t.id)} onChange={() => setSelectedTxs((prev) => { const n = new Set(prev); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />}
                    <div>
                      <div style={{ fontWeight: 600 }}>{t.persona?.name || 'Mostrador'}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{new Date(t.createdAt).toLocaleDateString('es-AR')}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>${Math.round(Number(t.amount)).toLocaleString('es-AR')}</div>
                    <button
                      type="button" className="btn btn-ghost" style={{ fontSize: '0.68rem', padding: '1px 6px', color: t.verified ? '#64748b' : '#10b981' }}
                      onClick={async () => { await api.verifyTransaction(t.id, !t.verified); onRefreshMainData(); fetchReconciliationData(reconBankId, reconStartDate, reconEndDate, reconStartTime, reconEndTime); }}
                    >
                      {t.verified ? '✅ Verificada' : 'Verificar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
