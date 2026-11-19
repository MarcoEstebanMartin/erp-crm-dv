import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, Trash2, Search, CheckCircle, X } from 'lucide-react';
import { NativeModalDialog } from './modals/NativeModalDialog';

interface ArqueoCajaModalProps {
  drawer: any;
  onClose: () => void;
  onSuccess: (realBalance: number, receipts: any[], checks: any[], routeNote?: string, notes?: string) => void;
  defaultRouteNote?: string;
}

export default function ArqueoCajaModal({ drawer, onClose, onSuccess, defaultRouteNote = '' }: ArqueoCajaModalProps) {
  const isCajaVendedores = drawer.branch?.includes('VENDEDOR') || drawer.drawerType === 'VENDEDOR';
  const isCajaReparto = drawer.branch?.includes('REPARTIDOR') || drawer.drawerType === 'REPARTIDOR';

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [checksAmount, setChecksAmount] = useState('');
  const [notesInput, setNotesInput] = useState(drawer.notes || '');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [theoreticalBalance, setTheoreticalBalance] = useState<number>(0);

  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptBilling, setReceiptBilling] = useState('X');
  const [receiptMethod, setReceiptMethod] = useState('CASH');
  const [checkNumberInput, setCheckNumberInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const txs = await api.getTransactions({ cashDrawerId: drawer.id });
        let income = 0, outcome = 0;
        txs.forEach((t: any) => { if (t.type === 'INCOME') income += Number(t.amount); else outcome += Number(t.amount); });
        setTheoreticalBalance(Number(drawer.openingBalance) + income - outcome);
      } catch (err) { console.error('Error fetching transactions for drawer', err); }
    })();
  }, [drawer.id]);

  const handleSearchClient = async () => {
    if (clientSearch.trim().length < 2) return;
    try { setClients(await api.getClients(clientSearch)); } catch { setErrorMsg('Error al buscar clientes.'); }
  };

  const handleAddReceipt = () => {
    if (!selectedClient) return setErrorMsg('Debe seleccionar un cliente.');
    if (!receiptAmount || Number(receiptAmount) <= 0) return setErrorMsg('Monto de recibo inválido.');
    setReceipts([...receipts, {
      clientId: selectedClient.id, clientName: selectedClient.name, amount: Number(receiptAmount),
      billingType: receiptBilling, paymentMethod: receiptMethod, checkNumber: receiptMethod === 'CHECK' ? checkNumberInput.trim() : undefined,
    }]);
    setReceiptAmount(''); setCheckNumberInput(''); setSelectedClient(null); setClientSearch(''); setClients([]); setErrorMsg(null);
  };

  const totalChecks = Number(checksAmount) || 0;
  const totalReceipts = receipts.reduce((acc, r) => acc + r.amount, 0);
  const realBalance = (Number(cashAmount) || 0) + totalChecks;
  const currentTheoretical = theoreticalBalance + totalReceipts;
  const difference = realBalance - currentTheoretical;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (realBalance < 0) return setErrorMsg('El saldo real no puede ser negativo.');
    setLoading(true);
    onSuccess(realBalance, receipts, [], drawer.routeNote || defaultRouteNote || undefined, notesInput);
  };

  return (
    <NativeModalDialog isOpen={true} onClose={onClose} ariaLabelledBy="arqueo-caja-title" closeOnBackdrop={!loading} style={{ maxWidth: '1000px', width: '95vw', padding: '24px' }}>
      <div className="modal-header" style={{ marginBottom: '16px' }}>
        <h3 id="arqueo-caja-title" style={{ margin: 0 }}>Arqueo de Caja: {drawer.branch}</h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} disabled={loading} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
      </div>

      {errorMsg && <div role="alert" style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 500 }}>{errorMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div>
          <div className="card" style={{ padding: '16px', marginBottom: '14px' }}>
            <label htmlFor="arqueo-cash-input" style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '10px', color: 'var(--text-primary)' }}>Efectivo Físico</label>
            <input id="arqueo-cash-input" type="number" className="input tabular-nums" autoFocus step="0.01" min="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="0.00" style={{ fontSize: '1.2rem', fontFamily: 'monospace' }} />
          </div>

          <div className="card" style={{ padding: '16px', marginBottom: '14px' }}>
            <label htmlFor="arqueo-checks-input" style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '10px', color: 'var(--text-primary)' }}>Cheques Declarados</label>
            <input id="arqueo-checks-input" type="number" className="input tabular-nums" step="0.01" min="0" value={checksAmount} onChange={(e) => setChecksAmount(e.target.value)} placeholder="0.00" style={{ fontSize: '1.2rem', fontFamily: 'monospace' }} />
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <label htmlFor="arqueo-notes" style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '10px', color: 'var(--text-primary)' }}>Observaciones</label>
            <textarea id="arqueo-notes" className="input" rows={3} value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder="Opcional" style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', marginBottom: '14px' }}>
            <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Resumen y Conciliación</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Teórico en Sistema</span>
              <span className="tabular-nums">${theoreticalBalance.toLocaleString('es-AR')}</span>
            </div>
            {(isCajaVendedores || isCajaReparto) && receipts.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px', color: '#0284c7' }}>
                <span>Recibos Cargados</span>
                <span className="tabular-nums">+${totalReceipts.toLocaleString('es-AR')}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 600, padding: '8px 0', borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', margin: '8px 0 12px 0' }}>
              <span>Total Esperado</span>
              <span className="tabular-nums">${currentTheoretical.toLocaleString('es-AR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
              <span>Total Declarado</span>
              <span className="tabular-nums" style={{ fontWeight: 600 }}>${realBalance.toLocaleString('es-AR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, marginTop: '10px', padding: '12px', borderRadius: '6px', backgroundColor: difference === 0 ? '#f0fdf4' : difference > 0 ? '#f0fdfa' : '#fef2f2', color: difference === 0 ? '#166534' : difference > 0 ? '#0f766e' : '#b91c1c' }}>
              <span>Diferencia</span>
              <span className="tabular-nums">{difference > 0 ? '+' : ''}{difference.toLocaleString('es-AR')}</span>
            </div>
          </div>

          {(isCajaVendedores || isCajaReparto) && (
            <div className="card" style={{ padding: '16px', flex: 1 }}>
              <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Recibos de Cobranza</h4>
              <search aria-label="Buscar cliente" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <label htmlFor="arqueo-client-search" className="visually-hidden">Buscar cliente</label>
                <input id="arqueo-client-search" type="search" className="input" placeholder="Buscar cliente..." autoCorrect="off" autoCapitalize="none" spellCheck={false} value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchClient()} style={{ flex: 1 }} />
                <button type="button" className="btn btn-secondary" onClick={handleSearchClient} aria-label="Buscar cliente"><Search size={16} aria-hidden="true" /></button>
              </search>

              {clients.length > 0 && !selectedClient && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto', marginBottom: '12px' }}>
                  {clients.map((cli) => (
                    <button key={cli.id} type="button" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: '0.85rem', cursor: 'pointer', border: 'none', borderBottom: '1px solid #f0f0f0', background: 'transparent' }} onClick={() => setSelectedClient(cli)}>
                      {cli.name} (CUIT: {cli.cuit})
                    </button>
                  ))}
                </div>
              )}

              {selectedClient && (
                <div style={{ padding: '8px', backgroundColor: '#e0f2fe', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span><CheckCircle size={14} color="#0284c7" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: '4px' }} /> <strong>{selectedClient.name}</strong></span>
                  <button type="button" onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontSize: '0.75rem' }}>Cambiar</button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <select aria-label="Sucursal del recibo" className="select" value={receiptBilling} onChange={(e) => setReceiptBilling(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }}>
                  <option value="A">Oficial (A)</option>
                  <option value="X">Interno (X)</option>
                </select>
                <select aria-label="Medio de pago del recibo" className="select" value={receiptMethod} onChange={(e) => setReceiptMethod(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }}>
                  <option value="CASH">Efectivo</option>
                  <option value="CHECK">Cheque</option>
                </select>
              </div>

              {receiptMethod === 'CHECK' && (
                <div style={{ marginBottom: '12px' }}>
                  <input type="text" aria-label="Número de cheque y banco" className="input" placeholder="N° cheque / Banco" autoCorrect="off" autoCapitalize="none" spellCheck={false} value={checkNumberInput} onChange={(e) => setCheckNumberInput(e.target.value)} style={{ fontSize: '0.85rem' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <input type="number" aria-label="Monto del recibo" className="input tabular-nums" placeholder="Monto $" value={receiptAmount} onChange={(e) => setReceiptAmount(e.target.value)} style={{ flex: 2 }} />
                <button type="button" className="btn btn-secondary" onClick={handleAddReceipt} style={{ flex: 1 }}><Plus size={16} aria-hidden="true" /> Añadir</button>
              </div>

              {receipts.length > 0 && (
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  <table style={{ fontSize: '0.85rem' }}>
                    <tbody>
                      {receipts.map((r, i) => (
                        <tr key={i}>
                          <td style={{ padding: '4px 0', fontSize: '0.75rem' }}><strong>{r.clientName}</strong><br />{r.billingType === 'A' ? 'A' : 'X'} - {r.paymentMethod === 'CASH' ? 'Efectivo' : `Cheque #${r.checkNumber || 'S/N'}`}</td>
                          <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600 }}>${r.amount.toLocaleString('es-AR')}</td>
                          <td style={{ width: '30px', textAlign: 'right' }}>
                            <button type="button" aria-label="Eliminar recibo" onClick={() => setReceipts(receipts.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} aria-hidden="true" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="tabular-nums" style={{ textAlign: 'right', marginTop: '8px', fontWeight: 700, fontSize: '0.95rem' }}>Total Recibos: ${totalReceipts.toLocaleString('es-AR')}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer" style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }}>{loading ? 'Cerrando...' : 'Cerrar Caja'}</button>
      </div>
    </NativeModalDialog>
  );
}
