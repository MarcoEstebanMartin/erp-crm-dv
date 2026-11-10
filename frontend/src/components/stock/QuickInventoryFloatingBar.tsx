interface QuickInventoryFloatingBarProps {
  pendingCount: number;
  loading: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export default function QuickInventoryFloatingBar({
  pendingCount,
  loading,
  onDiscard,
  onSave
}: QuickInventoryFloatingBarProps) {
  if (pendingCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#FFFFFF',
        border: '1px solid #D1D5DB',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        padding: '16px 24px',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
        zIndex: 1000,
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
          Conciliación de Inventario Pendiente
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Has modificado {pendingCount} productos/lotes. Presiona guardar para registrar los movimientos.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={onDiscard}
          disabled={loading}
        >
          Descartar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={onSave}
          disabled={loading}
        >
          {loading ? (
            <>
              <span
                className="spin-anim"
                style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  marginRight: '6px'
                }}
              ></span>
              <span>Guardando...</span>
            </>
          ) : (
            <>💾 Guardar Ajustes</>
          )}
        </button>
      </div>
    </div>
  );
}
