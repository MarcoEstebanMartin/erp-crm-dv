import { Lock, Unlock, Eye } from 'lucide-react';

interface CajaDepositoTabProps {
  activeDrawer: any | undefined;
  onInspect: (drawer: any) => void;
  onOpenCloseModal: (drawerId: number) => void;
  onOpenNewModal: () => void;
}

export default function CajaDepositoTab({
  activeDrawer,
  onInspect,
  onOpenCloseModal,
  onOpenNewModal
}: CajaDepositoTabProps) {
  const isOpen = !!activeDrawer;

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div
        className="card"
        style={{
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--border-color)'
        }}
      >
        {isOpen && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: '#10b981' }}></div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '8px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Caja Depósito</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Ventas de mostrador y depósito
            </p>
          </div>
          <div
            style={{
              backgroundColor: isOpen ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isOpen ? '#10b981' : '#ef4444',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            {isOpen ? <Unlock size={14} /> : <Lock size={14} />}
            {isOpen ? 'Operativa' : 'Cerrada'}
          </div>
        </div>

        <div style={{ flex: 1, margin: '16px 0' }}>
          {isOpen ? (
            <div style={{ padding: '14px', backgroundColor: 'var(--bg-light)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Fondo Inicial:</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>
                  ${Number(activeDrawer.openingBalance).toLocaleString()}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Apertura:</span>
                <span style={{ fontSize: '0.88rem' }}>
                  {new Date(activeDrawer.openedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              La caja se encuentra inactiva. Deberás abrirla con un saldo inicial para operar.
            </div>
          )}
        </div>

        <div>
          {isOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => onInspect(activeDrawer)}
              >
                <Eye size={16} /> Ver Movimientos
              </button>
              <button
                type="button"
                className="btn"
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '8px' }}
                onClick={() => onOpenCloseModal(activeDrawer.id)}
              >
                Arqueo y Cierre de Caja
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem', backgroundColor: '#10b981', borderColor: '#10b981', borderRadius: '8px' }}
              onClick={onOpenNewModal}
            >
              Abrir Caja
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
