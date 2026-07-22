import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { Plus, Trash2, Search, CheckCircle } from 'lucide-react';

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

  // States
  const [cashAmount, setCashAmount] = useState<string>('');
  const [checksAmount, setChecksAmount] = useState<string>('');
  const [routeNoteInput, setRouteNoteInput] = useState<string>(drawer.routeNote || defaultRouteNote || '');
  const [notesInput, setNotesInput] = useState<string>(drawer.notes || '');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [theoreticalBalance, setTheoreticalBalance] = useState<number>(0);

  // Receipts form
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptBilling, setReceiptBilling] = useState('X');
  const [receiptMethod, setReceiptMethod] = useState('CASH');
  const [checkNumberInput, setCheckNumberInput] = useState('');

  useEffect(() => {
    fetchDrawerTransactions();
  }, [drawer.id]);

  const fetchDrawerTransactions = async () => {
    try {
      const txs = await api.getTransactions({ cashDrawerId: drawer.id });
      let income = 0;
      let outcome = 0;
      txs.forEach((t: any) => {
        if (t.type === 'INCOME') income += Number(t.amount);
        else outcome += Number(t.amount);
      });
      setTheoreticalBalance(Number(drawer.openingBalance) + income - outcome);
    } catch (err: any) {
      console.error('Error fetching transactions for drawer', err);
    }
  };

  const handleSearchClient = async () => {
    if (clientSearch.trim().length < 2) return;
    try {
      const data = await api.getClients(clientSearch);
      setClients(data);
    } catch (err: any) {
      setErrorMsg('Error al buscar clientes.');
    }
  };


  const handleAddReceipt = () => {
    if (!selectedClient) {
      setErrorMsg('Debe seleccionar un cliente.');
      return;
    }
    if (!receiptAmount || Number(receiptAmount) <= 0) {
      setErrorMsg('Monto de recibo inválido.');
      return;
    }
    setReceipts([...receipts, {
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      amount: Number(receiptAmount),
      billingType: receiptBilling,
      paymentMethod: receiptMethod,
      checkNumber: receiptMethod === 'CHECK' ? checkNumberInput.trim() : undefined
    }]);
    setReceiptAmount('');
    setCheckNumberInput('');
    setSelectedClient(null);
    setClientSearch('');
    setClients([]);
    setErrorMsg(null);
  };

  const handleRemoveReceipt = (index: number) => {
    setReceipts(receipts.filter((_, i) => i !== index));
  };

  const totalChecks = Number(checksAmount) || 0;
  const totalReceipts = receipts.reduce((acc, r) => acc + r.amount, 0);
  const physicalCash = Number(cashAmount) || 0;
  const realBalance = physicalCash + totalChecks; // Total declarado por el usuario

  // Saldo teórico actualizando con los nuevos recibos ingresados
  const currentTheoretical = theoreticalBalance + totalReceipts;
  const difference = realBalance - currentTheoretical;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (realBalance < 0) {
      setErrorMsg('El saldo real no puede ser negativo.');
      return;
    }
    setLoading(true);
    onSuccess(realBalance, receipts, [], routeNoteInput, notesInput);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1000px', width: '95%' }}>
        <div className="modal-header">
          <h3>Arqueo de Caja: {drawer.branch}</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} disabled={loading}>✕</button>
        </div>

        {errorMsg && (
          <div style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {/* Columna Izquierda: Efectivo, Cheques y Notas de Pueblo/Ruta */}
          <div>
            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>1. Efectivo Físico</h4>
              <input 
                type="number" 
                className="input" 
                autoFocus
                step="0.01"
                min="0"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="Monto en efectivo..."
                style={{ fontSize: '1.2rem', fontFamily: 'monospace', width: '100%' }}
              />
            </div>

            <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>2. Cheques Declarados</h4>
              <input 
                type="number" 
                className="input" 
                step="0.01"
                min="0"
                value={checksAmount}
                onChange={(e) => setChecksAmount(e.target.value)}
                placeholder="Monto total en cheques..."
                style={{ fontSize: '1.2rem', fontFamily: 'monospace', width: '100%' }}
              />
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>3. Identificación de Pueblo / Ruta</h4>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Pueblo o Ruta de Cobro:</label>
                <input 
                  type="text" 
                  className="input" 
                  value={routeNoteInput}
                  onChange={(e) => setRouteNoteInput(e.target.value)}
                  placeholder="Ej: General Villegas, Bunge, Ruta 33..."
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Observaciones del Arqueo:</label>
                <textarea 
                  className="input" 
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Ej: Diferencia por vueltos, cobro diferido..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Columna Derecha: Recibos y Conciliación */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            
            <div className="card" style={{ padding: '16px', backgroundColor: '#f8fafc', marginBottom: '16px' }}>
              <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Resumen y Conciliación</h4>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Teórico (Fondo Inicial + Ventas)</span>
                <span>${theoreticalBalance.toLocaleString()}</span>
              </div>
              
              {(isCajaVendedores || isCajaReparto) && receipts.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px', color: '#0284c7' }}>
                  <span>+ Recibos de Cobranza Creados</span>
                  <span>+ ${totalReceipts.toLocaleString()}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 600, padding: '8px 0', borderTop: '1px dashed #cbd5e1', borderBottom: '1px dashed #cbd5e1', marginBottom: '12px', marginTop: '8px' }}>
                <span>Total Sistema (Esperado)</span>
                <span>${currentTheoretical.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                <span>Total Declarado (Ef + Chq)</span>
                <span style={{ fontWeight: 600 }}>${realBalance.toLocaleString()}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 700, marginTop: '12px', padding: '12px', borderRadius: '6px', backgroundColor: difference === 0 ? '#f0fdf4' : difference > 0 ? '#f0fdfa' : '#fef2f2', color: difference === 0 ? '#166534' : difference > 0 ? '#0f766e' : '#b91c1c' }}>
                <span>Diferencia</span>
                <span>{difference > 0 ? '+' : ''}{difference.toLocaleString()}</span>
              </div>
            </div>

            {(isCajaVendedores || isCajaReparto) && (
              <div className="card" style={{ padding: '16px', flex: 1 }}>
                <h4 style={{ margin: '0 0 12px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Carga de Recibos / Cobranzas</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Si el chofer o vendedor trajo dinero cobrado a clientes en la calle, regístralo aquí. Se creará automáticamente un ingreso a favor del cliente.
                </p>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" className="input" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchClient()} style={{ flex: 1 }} />
                  <button type="button" className="btn btn-secondary" onClick={handleSearchClient}><Search size={16} /></button>
                </div>

                {clients.length > 0 && !selectedClient && (
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto', marginBottom: '12px' }}>
                    {clients.map(cli => (
                      <div key={cli.id} style={{ padding: '6px 8px', fontSize: '0.85rem', cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }} onClick={() => setSelectedClient(cli)}>
                        {cli.name} (CUIT: {cli.cuit})
                      </div>
                    ))}
                  </div>
                )}

                {selectedClient && (
                  <div style={{ padding: '8px', backgroundColor: '#e0f2fe', borderRadius: '4px', marginBottom: '12px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><CheckCircle size={14} color="#0284c7" style={{ verticalAlign: 'middle', marginRight: '4px' }} /> <strong>{selectedClient.name}</strong></span>
                    <button type="button" onClick={() => setSelectedClient(null)} style={{ background: 'none', border: 'none', color: '#0369a1', cursor: 'pointer', fontSize: '0.75rem' }}>Cambiar</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <select className="input" value={receiptBilling} onChange={e => setReceiptBilling(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }}>
                    <option value="A">Recibo Oficial (A)</option>
                    <option value="X">Recibo Interno (X)</option>
                  </select>
                  <select className="input" value={receiptMethod} onChange={e => setReceiptMethod(e.target.value)} style={{ flex: 1, fontSize: '0.85rem' }}>
                    <option value="CASH">Efectivo</option>
                    <option value="CHECK">Cheque</option>
                  </select>
                </div>

                {receiptMethod === 'CHECK' && (
                  <div style={{ marginBottom: '12px' }}>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="N° de Cheque / Banco / Vencimiento (ej: 00482910 - Banco Nación)" 
                      value={checkNumberInput} 
                      onChange={e => setCheckNumberInput(e.target.value)} 
                      style={{ width: '100%', fontSize: '0.85rem' }} 
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input type="number" className="input" placeholder="Monto $" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)} style={{ flex: 2 }} />
                  <button type="button" className="btn btn-secondary" onClick={handleAddReceipt} style={{ flex: 1 }}><Plus size={16} /> Añadir</button>
                </div>

                {receipts.length > 0 && (
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <tbody>
                        {receipts.map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '4px 0', fontSize: '0.75rem' }}>
                              <strong>{r.clientName}</strong><br/>
                              {r.billingType === 'A' ? 'A' : 'X'} - {r.paymentMethod === 'CASH' ? 'Efe' : `Chq #${r.checkNumber || 'S/N'}`}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>${r.amount.toLocaleString()}</td>
                            <td style={{ width: '30px', textAlign: 'right' }}>
                              <button type="button" onClick={() => handleRemoveReceipt(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ textAlign: 'right', marginTop: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                      Total Recibos: ${totalReceipts.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 0 0 0', borderTop: '1px solid var(--border-color)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading} style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}>
            {loading ? 'Procesando...' : 'Cerrar y Transferir Caja'}
          </button>
        </div>
      </div>
    </div>
  );
}
