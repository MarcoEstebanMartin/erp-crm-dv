import { Layers, X } from 'lucide-react';
import { extractCleanLotNumber } from './lotLabel';

interface GlobalMovementsPanelProps {
  open: boolean;
  loading: boolean;
  movements: any[];
  onClose: () => void;
}

export default function GlobalMovementsPanel({
  open,
  loading,
  movements,
  onClose
}: GlobalMovementsPanelProps) {
  if (!open) return null;

  return (
    <div
      className="card"
      style={{
        padding: '20px',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '24px',
        animation: 'slideDown 0.25s ease-out'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} />
          Registro de Auditoría Global de Stock (Últimos 50 movimientos)
        </h4>
        <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Cargando auditoría...</div>
      ) : movements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No hay movimientos registrados.
        </div>
      ) : (
        <div className="table-container" style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead style={{ backgroundColor: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Mov #</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Fecha</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Producto</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Cantidad</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Lote</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Origen / Comprobante</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Operador</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Detalle/Motivo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const isQtyPositive = m.quantity > 0;
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      #{m.movementId ? `MOV-${String(m.movementId).padStart(4, '0')}` : m.id}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(m.createdAt).toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{m.product?.sku}</span>
                      <span style={{ marginLeft: '8px', color: 'var(--text-primary)' }}>{m.product?.name}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          backgroundColor: isQtyPositive ? 'var(--color-success-bg)' : 'rgba(0,0,0,0.04)',
                          color: isQtyPositive ? 'var(--color-success)' : 'var(--text-secondary)'
                        }}
                      >
                        {isQtyPositive ? `+${m.quantity}` : m.quantity} u.
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {m.productLot ? extractCleanLotNumber(m.productLot.lotNumber) : 'General'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {m.order ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600 }}>
                          Pedido #{m.order.id} {m.order.persona?.name ? `(${m.order.persona.name})` : ''}
                        </span>
                      ) : m.purchaseOrder ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.08)', color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
                          OC #{m.purchaseOrder.id} {m.purchaseOrder.persona?.name ? `(${m.purchaseOrder.persona.name})` : ''}
                        </span>
                      ) : m.creditNote ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>
                          NC #{m.creditNote.creditNoteNumber || m.creditNote.id}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          {m.referenceId || 'Interno'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                      {m.user?.username}{' '}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                        ({m.user?.role})
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{m.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
