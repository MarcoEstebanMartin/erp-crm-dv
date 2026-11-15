import React from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface AdminQuickClientSearchModalProps {
  clientSearchModal: { open: boolean; action: 'ledger' | 'payment' | 'order' } | null;
  clients: any[];
  quickClientQuery: string;
  setQuickClientQuery: (q: string) => void;
  onClose: () => void;
  onSelectClientAction: (action: 'ledger' | 'payment' | 'order', client: any) => void;
}

const MODAL_TITLES: Record<'ledger' | 'payment' | 'order', string> = {
  ledger: 'Cuenta corriente',
  payment: 'Cobrar',
  order: 'Nuevo pedido',
};

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
    <NativeModalDialog
      isOpen={Boolean(clientSearchModal?.open)}
      onClose={onClose}
      ariaLabelledBy="quick-client-modal-title"
      style={{ maxWidth: '640px', width: '94vw', padding: '20px 24px', borderRadius: '12px' }}
    >
      <div className="modal-header" style={{ paddingBottom: '12px', marginBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 id="quick-client-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
          {MODAL_TITLES[clientSearchModal.action]}
        </h3>
        <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <input
        type="text"
        name="quickClientQuery"
        aria-label="Buscar cliente"
        className="input"
        autoFocus
        placeholder="Nombre o CUIT"
        value={quickClientQuery}
        onChange={(e) => setQuickClientQuery(e.target.value)}
        style={{ height: '42px', fontSize: '0.92rem' }}
      />

      <div
        style={{
          maxHeight: '54vh',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          marginTop: '12px',
          backgroundColor: 'var(--bg-card, #ffffff)',
        }}
      >
        {filteredQuickClients.length === 0 ? (
          <div style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>
            Sin resultados
          </div>
        ) : (
          filteredQuickClients.map((c) => {
            const balance = Number(c.outstandingBalance || 0);
            const absBalance = Math.abs(Math.round(balance)).toLocaleString('es-AR');

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  const action = clientSearchModal.action;
                  onClose();
                  onSelectClientAction(action, c);
                }}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{c.name}</div>
                  {c.cuit && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{c.cuit}</div>}
                </div>
                <div
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    textAlign: 'right',
                    color: balance > 0 ? '#E30613' : balance < 0 ? '#059669' : 'var(--text-primary)',
                  }}
                >
                  {balance < 0 ? `$${absBalance} · A favor` : `$${Math.round(balance).toLocaleString('es-AR')}`}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="modal-footer" style={{ marginTop: '16px' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </NativeModalDialog>
  );
};
