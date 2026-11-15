import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
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
    <NativeModalDialog
      isOpen={Boolean(open && product)}
      onClose={onClose}
      ariaLabelledBy="product-kardex-title"
      style={{
        margin: '0 0 0 auto',
        maxWidth: '440px',
        width: '94vw',
        height: '100dvh',
        maxHeight: '100dvh',
        borderRadius: '12px 0 0 12px',
        padding: 0,
      }}
    >
      <div style={{ height: '100%', padding: '24px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h3 id="product-kardex-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Kárdex</h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {product.sku} · {product.name}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Cerrar"
            style={{ padding: '4px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

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
            Stock Actual
          </span>
          <span className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {product.stock} u.
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

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
    </NativeModalDialog>
  );
}
