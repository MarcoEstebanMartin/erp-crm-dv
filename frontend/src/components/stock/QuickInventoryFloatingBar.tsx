import { Check } from 'lucide-react';

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
  onSave,
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
        border: '1px solid var(--border-color)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '24px',
        zIndex: 1000,
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
          Conciliación de Inventario Pendiente
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {pendingCount} {pendingCount === 1 ? 'ítem modificado' : 'ítems modificados'}. Confirmá para registrar los movimientos.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.83rem' }}
          onClick={onDiscard}
          disabled={loading}
        >
          Descartar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: '8px 18px', fontSize: '0.83rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
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
                }}
              />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <Check size={14} />
              <span>Guardar Ajustes</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
