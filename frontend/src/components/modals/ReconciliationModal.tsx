import React from 'react';

interface ReconciliationModalProps {
  showReconciliationModal: boolean;
  setShowReconciliationModal: (val: boolean) => void;
  reconProcessing: boolean;
  reconType: string;
  setReconType: (val: string) => void;
  reconReceipts: any[];
  reconSellerId: string;
  setReconSellerId: (val: string) => void;
  sellers: any[];
  reconBranch: string;
  setReconBranch: (val: string) => void;
  reconCashDeclared: string;
  setReconCashDeclared: (val: string) => void;
  reconChecksDeclared: string;
  setReconChecksDeclared: (val: string) => void;
  reconTransfersDeclared: string;
  setReconTransfersDeclared: (val: string) => void;
  reconSearchClient: string;
  setReconSearchClient: (val: string) => void;
  showReconClientSuggestions: boolean;
  setShowReconClientSuggestions: (val: boolean) => void;
  reconClientSuggestions: any[];
  reconSelectedClient: any;
  setReconSelectedClient: (val: any) => void;
  reconReceiptNumber: string;
  setReconReceiptNumber: (val: string) => void;
  reconReceiptMethod: string;
  setReconReceiptMethod: (val: any) => void;
  reconReceiptAmount: string;
  setReconReceiptAmount: (val: string) => void;
  handleAddReconReceipt: () => void;
  handleRemoveReconReceipt: (id: string) => void;
  handleProcessReconciliation: () => void;
}

export const ReconciliationModal: React.FC<ReconciliationModalProps> = ({
  showReconciliationModal,
  setShowReconciliationModal,
  reconProcessing,
  reconType,
  setReconType,
  reconReceipts,
  reconSellerId,
  setReconSellerId,
  sellers,
  reconBranch,
  setReconBranch,
  reconCashDeclared,
  setReconCashDeclared,
  reconChecksDeclared,
  setReconChecksDeclared,
  reconTransfersDeclared,
  setReconTransfersDeclared,
  reconSearchClient,
  setReconSearchClient,
  showReconClientSuggestions,
  setShowReconClientSuggestions,
  reconClientSuggestions,
  reconSelectedClient,
  setReconSelectedClient,
  reconReceiptNumber,
  setReconReceiptNumber,
  reconReceiptMethod,
  setReconReceiptMethod,
  reconReceiptAmount,
  setReconReceiptAmount,
  handleAddReconReceipt,
  handleRemoveReconReceipt,
  handleProcessReconciliation
}) => {
  if (!showReconciliationModal) return null;

  const totalCashLoaded = reconReceipts.filter(r => r.paymentMethod === 'CASH').reduce((sum, r) => sum + r.amount, 0);
  const totalChecksLoaded = reconReceipts.filter(r => r.paymentMethod === 'CHECK').reduce((sum, r) => sum + r.amount, 0);
  const totalTransfersLoaded = reconReceipts.filter(r => r.paymentMethod === 'BANK_TRANSFER').reduce((sum, r) => sum + r.amount, 0);
  
  const cashDiff = Number(reconCashDeclared || 0) - totalCashLoaded;
  const checkDiff = Number(reconChecksDeclared || 0) - totalChecksLoaded;
  const transDiff = Number(reconTransfersDeclared || 0) - totalTransfersLoaded;
  
  const totalDeclared = Number(reconCashDeclared || 0) + Number(reconChecksDeclared || 0) + Number(reconTransfersDeclared || 0);
  const totalLoaded = totalCashLoaded + totalChecksLoaded + totalTransfersLoaded;
  const totalDiff = totalDeclared - totalLoaded;

  const getDiffStyle = (diff: number) => {
    if (diff === 0) return { color: 'var(--color-success)', fontWeight: 600 };
    if (diff < 0) return { color: '#1a73e8', fontWeight: 600 };
    return { color: 'var(--accent-color)', fontWeight: 600 };
  };

  const getStatusBadge = () => {
    if (totalDiff === 0) {
      return <span className="badge" style={{ backgroundColor: '#eaf9ee', color: '#137333', fontWeight: 700 }}>✅ Exacto ($0 diff)</span>;
    }
    if (totalDiff < 0) {
      return <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 700 }}>📈 Sobrante (+$${Math.abs(totalDiff).toLocaleString()})</span>;
    }
    return <span className="badge" style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', fontWeight: 700 }}>⚠️ Faltante (-$${totalDiff.toLocaleString()})</span>;
  };

  return (
    <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '1200px', width: '95vw', padding: '24px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Planilla de Rendición de Cobros de Vendedores</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Carga rápida de recibos de calle y consolidación de valores entregados</p>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px' }} onClick={() => setShowReconciliationModal(false)} disabled={reconProcessing}>✕</button>
        </div>

        {/* Form Body - Split Column layout */}
        <div style={{ display: 'flex', gap: '24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
          
          {/* Left Column: Form & Add Receipts (60%) */}
          <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* Seller & Branch config card */}
            <div className="card" style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', border: '1px solid var(--border-color)' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Origen / Canal</label>
                <select
                  className="input"
                  value={reconType}
                  onChange={(e) => setReconType(e.target.value)}
                  disabled={reconReceipts.length > 0}
                >
                  <option value="VENDEDOR">Venta Vendedores (Calle)</option>
                  <option value="REPARTO">Rendición Reparto (Choferes)</option>
                  <option value="DEPOSITO">Venta Depósito (Local)</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Responsable</label>
                <select 
                  className="input" 
                  value={reconSellerId} 
                  onChange={(e) => setReconSellerId(e.target.value)}
                  disabled={reconReceipts.length > 0 || reconType === 'DEPOSITO'}
                >
                  {reconType === 'DEPOSITO' ? (
                    <option value="">Depósito Local (No requerido)</option>
                  ) : (
                    sellers.map((u: any) => (
                      <option key={u.id} value={u.id.toString()}>{u.username.replace('_', ' ').toUpperCase()} ({u.role})</option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Caja Destino (Efectivo)</label>
                <select 
                  className="input" 
                  value={reconBranch} 
                  onChange={(e) => setReconBranch(e.target.value)}
                  disabled={reconReceipts.length > 0}
                >
                  <option value="X">Sucursal X (Interno / Depósito)</option>
                  <option value="A">Sucursal A (Oficial)</option>
                </select>
              </div>
            </div>

            {/* Declared values (What vendor physically entregó) */}
            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>1. Conteo de Valores Entregados por Vendedor</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Efectivo / Contado Físico ($)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="ej: 45000"
                    value={reconCashDeclared}
                    onChange={(e) => setReconCashDeclared(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Cheques Físicos ($)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="ej: 30000"
                    value={reconChecksDeclared}
                    onChange={(e) => setReconChecksDeclared(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Transferencias Declaradas ($)</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="ej: 15000"
                    value={reconTransfersDeclared}
                    onChange={(e) => setReconTransfersDeclared(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Receipts Loader Form */}
            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', position: 'relative' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>2. Carga Rápida de Recibos de Papel</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '12px' }}>
                {/* Client Autocomplete Search */}
                <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                  <label style={{ fontSize: '0.78rem' }}>Cliente (Buscar por Nombre/CUIT)</label>
                  <input
                    type="text"
                    id="reconClientSearchInput"
                    className="input"
                    placeholder="Escribí nombre o CUIT..."
                    value={reconSearchClient}
                    onChange={(e) => {
                      setReconSearchClient(e.target.value);
                      setShowReconClientSuggestions(true);
                    }}
                    onFocus={() => setShowReconClientSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowReconClientSuggestions(false), 250)}
                  />
                  {showReconClientSuggestions && reconClientSuggestions.length > 0 && (
                    <div className="suggestions-list" style={{ width: '100%' }}>
                      {reconClientSuggestions.map(c => (
                        <div
                          key={c.id}
                          className="suggestion-item"
                          onMouseDown={() => {
                            setReconSelectedClient(c);
                            setReconSearchClient(c.name);
                            setShowReconClientSuggestions(false);
                            setTimeout(() => document.getElementById('reconReceiptNoInput')?.focus(), 50);
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            CUIT: {c.cuit || 'S/D'} | Saldo CC: ${Number(c.outstandingBalance || 0).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>N° de Recibo</label>
                  <input
                    type="text"
                    id="reconReceiptNoInput"
                    className="input"
                    placeholder="ej: 0002-00001234"
                    value={reconReceiptNumber}
                    onChange={(e) => setReconReceiptNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        document.getElementById('reconReceiptAmountInput')?.focus();
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Medio de Pago</label>
                  <select
                    className="input"
                    value={reconReceiptMethod}
                    onChange={(e) => setReconReceiptMethod(e.target.value)}
                  >
                    <option value="CASH">Efectivo (Contado)</option>
                    <option value="CHECK">Cheque de Terceros</option>
                    <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.78rem' }}>Monto Cobrado ($)</label>
                  <input
                    type="number"
                    id="reconReceiptAmountInput"
                    className="input"
                    placeholder="ej: 15000"
                    value={reconReceiptAmount}
                    onChange={(e) => setReconReceiptAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddReconReceipt();
                      }
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', height: '40px', justifyContent: 'center' }}
                  onClick={() => handleAddReconReceipt()}
                >
                  Agregar Recibo
                </button>
              </div>

              {/* Client Info badge if selected */}
              {reconSelectedClient && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.78rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>Cliente: <strong>{reconSelectedClient.name}</strong> (CUIT: {reconSelectedClient.cuit || 'S/D'})</span>
                  <span style={{ color: Number(reconSelectedClient.outstandingBalance) > 0 ? 'var(--accent-color)' : 'var(--color-success)' }}>
                    Saldo CC: <strong>${Number(reconSelectedClient.outstandingBalance).toLocaleString()}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Consolidation & Loaded List (40%) */}
          <div style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* Consolidation Dashboard */}
            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>3. Consolidador de Valores (Control en Vivo)</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                  <span style={{ fontWeight: 600 }}>Tipo de Valor</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Físico vs Cargado</span>
                  <span style={{ fontWeight: 600 }}>Diferencia</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>💵 Efectivo:</span>
                  <span style={{ fontFamily: 'monospace' }}>${Number(reconCashDeclared || 0).toLocaleString()} vs ${totalCashLoaded.toLocaleString()}</span>
                  <span style={getDiffStyle(cashDiff)}>${cashDiff.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>✍️ Cheques:</span>
                  <span style={{ fontFamily: 'monospace' }}>${Number(reconChecksDeclared || 0).toLocaleString()} vs ${totalChecksLoaded.toLocaleString()}</span>
                  <span style={getDiffStyle(checkDiff)}>${checkDiff.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>📱 Transferencias:</span>
                  <span style={{ fontFamily: 'monospace' }}>${Number(reconTransfersDeclared || 0).toLocaleString()} vs ${totalTransfersLoaded.toLocaleString()}</span>
                  <span style={getDiffStyle(transDiff)}>${transDiff.toLocaleString()}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Consolidado Total:</span>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>${totalDeclared.toLocaleString()} vs ${totalLoaded.toLocaleString()}</span>
                  {getStatusBadge()}
                </div>
              </div>
            </div>

            {/* Receipts List */}
            <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '220px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Recibos Cargados en la Planilla ({reconReceipts.length})</h4>
              
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '280px' }}>
                {reconReceipts.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.78rem', textAlign: 'center', padding: '20px' }}>
                    Aún no cargaste recibos.<br />Usá el cargador de la izquierda para sumar valores.
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '6px' }}>Cliente</th>
                        <th style={{ padding: '6px' }}>Recibo</th>
                        <th style={{ padding: '6px' }}>Pago</th>
                        <th style={{ padding: '6px', textAlign: 'right' }}>Monto</th>
                        <th style={{ padding: '6px', width: '28px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconReceipts.map((rec) => (
                        <tr key={rec.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '6px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={rec.personaName}>{rec.personaName}</td>
                          <td style={{ padding: '6px', fontWeight: 600 }}>{rec.receiptNumber}</td>
                          <td style={{ padding: '6px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              backgroundColor: rec.paymentMethod === 'CASH' ? '#eaf9ee' : rec.paymentMethod === 'CHECK' ? '#fff8e1' : '#e8f0fe',
                              color: rec.paymentMethod === 'CASH' ? '#137333' : rec.paymentMethod === 'CHECK' ? '#b78103' : '#1a73e8',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              {rec.paymentMethod === 'CASH' ? 'Efectivo' : rec.paymentMethod === 'CHECK' ? 'Cheque' : 'Transf.'}
                            </span>
                          </td>
                          <td style={{ padding: '6px', fontWeight: 700, textAlign: 'right' }}>${rec.amount.toLocaleString()}</td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveReconReceipt(rec.id)}
                              style={{ border: 'none', background: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px' }}
                            >
                              ✕
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
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setShowReconciliationModal(false)} disabled={reconProcessing}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)', color: '#ffffff' }}
            disabled={reconProcessing || reconReceipts.length === 0}
            onClick={() => handleProcessReconciliation()}
          >
            {reconProcessing ? 'Procesando Rendición...' : 'Procesar y Confirmar Rendición'}
          </button>
        </div>
      </div>
    </div>
  );
};
