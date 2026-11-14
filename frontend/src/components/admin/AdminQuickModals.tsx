import React from 'react';

interface AdminQuickClientSearchModalProps {
  clientSearchModal: { open: boolean; action: 'ledger' | 'payment' | 'order' } | null;
  clients: any[];
  quickClientQuery: string;
  setQuickClientQuery: (q: string) => void;
  onClose: () => void;
  onSelectClientAction: (action: 'ledger' | 'payment' | 'order', client: any) => void;
}

export const AdminQuickClientSearchModal: React.FC<AdminQuickClientSearchModalProps> = ({
  clientSearchModal,
  clients,
  quickClientQuery,
  setQuickClientQuery,
  onClose,
  onSelectClientAction,
}) => {
  if (!clientSearchModal || !clientSearchModal.open) return null;

  const filteredQuickClients = clients.filter((c) => {
    if (!c.isClient || c.isActive === false) return false;
    const query = quickClientQuery.toLowerCase();
    return c.name.toLowerCase().includes(query) || (c.cuit && c.cuit.includes(query));
  });

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '680px', width: '94vw', padding: '24px 26px', borderRadius: '12px' }}>
        <div className="modal-header" style={{ paddingBottom: '12px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            {clientSearchModal.action === 'ledger' && 'Cuenta Corriente'}
            {clientSearchModal.action === 'payment' && 'Cargar Recibo'}
            {clientSearchModal.action === 'order' && 'Seleccionar Cliente'}
          </h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>✕</button>
        </div>
        <input
          type="text"
          className="input"
          autoFocus
          placeholder="Buscar cliente por nombre o CUIT..."
          value={quickClientQuery}
          onChange={(e) => setQuickClientQuery(e.target.value)}
          style={{ height: '42px', fontSize: '0.92rem' }}
        />
        <div style={{ maxHeight: '54vh', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '12px', backgroundColor: '#ffffff' }}>
          {filteredQuickClients.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>No se encontraron clientes.</div>
          ) : (
            filteredQuickClients.map((c) => (
              <button
                key={c.id}
                onClick={() => { const action = clientSearchModal.action; onClose(); onSelectClientAction(action, c); }}
                style={{ width: '100%', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', borderBottom: '1px solid #f0f0f2', background: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                  {c.cuit && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>CUIT: {c.cuit}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: Number(c.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : Number(c.outstandingBalance || 0) < 0 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                    {Number(c.outstandingBalance || 0) < 0 ? `$${Math.abs(Math.round(Number(c.outstandingBalance))).toLocaleString('es-AR')} (A Favor)` : `$${Math.round(Number(c.outstandingBalance || 0)).toLocaleString('es-AR')}`}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Saldo CC</div>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="modal-footer" style={{ marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};
