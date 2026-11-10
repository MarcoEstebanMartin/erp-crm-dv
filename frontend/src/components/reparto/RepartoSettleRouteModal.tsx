import React from 'react';

interface RepartoSettleRouteModalProps {
  show: boolean;
  settleRoute: any | null;
  settlements: any[];
  setSettlements: React.Dispatch<React.SetStateAction<any[]>>;
  bankAccounts: any[];
  errorMsg: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const RepartoSettleRouteModal: React.FC<RepartoSettleRouteModalProps> = ({
  show,
  settleRoute,
  settlements,
  setSettlements,
  bankAccounts,
  errorMsg,
  onClose,
  onSubmit
}) => {
  if (!show || !settleRoute) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '1000px', width: '90vw', padding: '24px' }}>
        <div className="modal-header">
          <h3>Liquidación y Finalización de Viaje - Viaje #{settleRoute.id}</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>✕</button>
        </div>

        <div style={{ marginBottom: '16px', padding: '10px 14px', backgroundColor: '#f3e8fd', borderRadius: '6px', fontSize: '0.82rem', color: '#681da8' }}>
          🚚 Chofer: <strong>{settleRoute.driverName}</strong>
          {settleRoute.companionName && <> | Acompañante: <strong>{settleRoute.companionName}</strong></>}
          {' '}| Patente: <strong>{settleRoute.vehiclePlate}</strong> | Pedidos a rendir: <strong>{settleRoute.orders?.length || 0}</strong>
        </div>

        <form onSubmit={onSubmit}>
          <div className="card" style={{ padding: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>Listado de Entregas y Cobros</h4>
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 4px' }}>Cliente</th>
                    <th style={{ padding: '8px 4px' }}>Comprobante</th>
                    <th style={{ padding: '8px 4px', width: '160px' }}>Medio de Pago</th>
                    <th style={{ padding: '8px 4px' }}>Detalles Cobro</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((set, idx) => (
                    <tr key={set.orderId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 600 }}>{set.clientName}</td>
                      <td style={{ padding: '8px 4px' }}>{set.invoiceNumber}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <select
                          className="input"
                          style={{ padding: '2px 4px', fontSize: '0.78rem', height: '28px' }}
                          value={set.paymentMethod}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, paymentMethod: val } : s));
                          }}
                        >
                          <option value="CASH">💵 Efectivo</option>
                          <option value="BANK_TRANSFER">🏦 Transferencia</option>
                          <option value="CHECK">✍️ Cheque</option>
                          <option value="CREDITO">💳 A Cuenta (C/C)</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        {set.paymentMethod === 'BANK_TRANSFER' && (
                          <select
                            className="input"
                            style={{ padding: '2px 4px', fontSize: '0.75rem', height: '28px' }}
                            value={set.bankAccountId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, bankAccountId: val } : s));
                            }}
                          >
                            {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        )}
                        {set.paymentMethod === 'CHECK' && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              placeholder="N° Cheque"
                              className="input"
                              style={{ padding: '2px 4px', fontSize: '0.72rem', height: '28px', width: '70px' }}
                              value={set.checkNumber}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, checkNumber: val } : s));
                              }}
                              required
                            />
                            <input
                              type="text"
                              placeholder="Emisor"
                              className="input"
                              style={{ padding: '2px 4px', fontSize: '0.72rem', height: '28px', width: '80px' }}
                              value={set.checkIssuer}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettlements(prev => prev.map((s, i) => i === idx ? { ...s, checkIssuer: val } : s));
                              }}
                              required
                            />
                          </div>
                        )}
                        {set.paymentMethod === 'CASH' && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>En custodia del chofer (A rendir)</span>
                        )}
                        {set.paymentMethod === 'CREDITO' && (
                          <span style={{ fontSize: '0.72rem', color: '#b78103', fontWeight: 600 }}>Deuda en C/C</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: '#FFF2F2', borderLeft: '4px solid var(--color-danger)', color: 'var(--color-danger)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 600 }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }}
            >
              Confirmar y Liquidar Viaje
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
