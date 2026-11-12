import { X } from 'lucide-react';
import { extractCleanLotNumber } from './lotLabel';

interface ProductKardexDrawerProps {
  open: boolean;
  product: any | null;
  loading: boolean;
  movements: any[];
  onClose: () => void;
}

export default function ProductKardexDrawer({
  open,
  product,
  loading,
  movements,
  onClose
}: ProductKardexDrawerProps) {
  if (!open || !product) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '420px',
        backgroundColor: 'var(--bg-card)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        borderLeft: '1px solid var(--border-color)',
        zIndex: 1000,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Historial de Stock (Kárdex)</h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
            {product.sku} • {product.name}
          </p>
        </div>
        <button
          className="btn btn-ghost"
          style={{ padding: '4px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {/* Físico Actual */}
      <div
        style={{
          backgroundColor: 'var(--bg-app)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Inventario Físico Actual:
        </span>
        <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {product.stock} u.
        </span>
      </div>

      {/* Timeline Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        <h4 style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
          Timeline de Movimientos
        </h4>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Cargando movimientos...
          </div>
        ) : movements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
            Sin movimientos registrados para este producto.
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '1px solid var(--border-color)', marginLeft: '8px' }}>
            {movements.map((m) => {
              const isPositive = m.quantity > 0;
              return (
                <div key={m.id} style={{ position: 'relative', marginBottom: '24px' }}>
                  {/* Nodo timeline */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-25px',
                      top: '4px',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      backgroundColor: isPositive ? 'var(--color-success)' : 'var(--text-muted)',
                      border: '2px solid var(--bg-card)'
                    }}
                  />

                  {/* Cabecera movimiento */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isPositive ? 'var(--color-success)' : 'var(--text-primary)' }}>
                      {isPositive ? `+${m.quantity}` : m.quantity} u.
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(m.createdAt).toLocaleDateString('es-AR')}{' '}
                      {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Detalles */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        #{m.movementId ? `MOV-${String(m.movementId).padStart(4, '0')}` : m.id}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>{m.type}</strong>: {m.reason}
                      </span>
                    </div>
                    {m.order && (
                      <div style={{ margin: '3px 0' }}>
                        <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', fontSize: '0.72rem', fontWeight: 600 }}>
                          Pedido #{m.order.id} {m.order.persona?.name ? `(${m.order.persona.name})` : ''}
                        </span>
                      </div>
                    )}
                    {m.purchaseOrder && (
                      <div style={{ margin: '3px 0' }}>
                        <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#059669', fontSize: '0.72rem', fontWeight: 600 }}>
                          OC #{m.purchaseOrder.id} {m.purchaseOrder.persona?.name ? `(${m.purchaseOrder.persona.name})` : ''}
                        </span>
                      </div>
                    )}
                    {m.creditNote && (
                      <div style={{ margin: '3px 0' }}>
                        <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', fontSize: '0.72rem', fontWeight: 600 }}>
                          NC #{m.creditNote.creditNoteNumber || m.creditNote.id}
                        </span>
                      </div>
                    )}
                    {m.productLot && (
                      <div>
                        <strong>Lote:</strong> {extractCleanLotNumber(m.productLot.lotNumber)}
                      </div>
                    )}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                      Operado por: {m.user?.username} ({m.user?.role})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
