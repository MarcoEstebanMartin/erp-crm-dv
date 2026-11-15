import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatIntegerARS } from '../../utils/currency';

export interface EditOrderItemDraft {
  id: number;
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  listPrice: number;
  weight?: number | null;
  isPesable?: boolean;
  approximateWeight?: number | null;
}

export interface EditOrderModalState {
  open: boolean;
  orderId: number;
  clientId: number;
  clientName: string;
  client?: any;
  items: EditOrderItemDraft[];
}

interface EditOrderItemsPanelProps {
  editOrderModal: EditOrderModalState;
  setEditOrderModal: (val: EditOrderModalState | null) => void;
  estimatedTotal: number;
}

export const EditOrderItemsPanel: React.FC<EditOrderItemsPanelProps> = ({
  editOrderModal,
  setEditOrderModal,
  estimatedTotal,
}) => {
  const handleWeightChange = (productId: number, raw: string) => {
    const val = parseFloat(raw);
    setEditOrderModal({
      ...editOrderModal,
      items: editOrderModal.items.map((i) =>
        i.productId === productId ? { ...i, weight: isNaN(val) ? null : val } : i,
      ),
    });
  };

  const handleDecrement = (productId: number, currentQty: number) => {
    const newQty = currentQty - 1;
    setEditOrderModal({
      ...editOrderModal,
      items:
        newQty <= 0
          ? editOrderModal.items.filter((i) => i.productId !== productId)
          : editOrderModal.items.map((i) =>
              i.productId === productId ? { ...i, quantity: newQty } : i,
            ),
    });
  };

  const handleIncrement = (productId: number) => {
    setEditOrderModal({
      ...editOrderModal,
      items: editOrderModal.items.map((i) =>
        i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i,
      ),
    });
  };

  const handleRemove = (productId: number) => {
    setEditOrderModal({
      ...editOrderModal,
      items: editOrderModal.items.filter((i) => i.productId !== productId),
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Detalle Actual del Pedido</h4>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '350px',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          padding: '10px',
        }}
      >
        {editOrderModal.items.length === 0 ? (
          <p
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              marginTop: '20px',
            }}
          >
            No hay artículos en el pedido.
          </p>
        ) : (
          editOrderModal.items.map((item) => (
            <div
              key={item.productId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ flex: 1, marginRight: '10px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</div>
                <div
                  className="tabular-nums"
                  style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                >
                  {formatIntegerARS(item.listPrice)} c/u {item.isPesable && '(Por Kg)'}
                </div>
                {item.isPesable && (
                  <div
                    style={{
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <label
                      htmlFor={`edit-order-weight-${item.productId}`}
                      style={{ fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Peso Exacto (Kg):
                    </label>
                    <input
                      id={`edit-order-weight-${item.productId}`}
                      type="number"
                      step="0.01"
                      className="input tabular-nums"
                      aria-label={`Peso exacto en kg para ${item.name}`}
                      style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem' }}
                      value={item.weight || ''}
                      onChange={(e) => handleWeightChange(item.productId, e.target.value)}
                    />
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label={`Restar una unidad de ${item.name}`}
                  style={{ padding: '2px 6px' }}
                  onClick={() => handleDecrement(item.productId, item.quantity)}
                >
                  -
                </button>
                <span className="tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {item.quantity}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label={`Sumar una unidad de ${item.name}`}
                  style={{ padding: '2px 6px' }}
                  onClick={() => handleIncrement(item.productId)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-danger"
                  aria-label={`Quitar ${item.name} del pedido`}
                  style={{ padding: '4px', color: '#E30613' }}
                  onClick={() => handleRemove(item.productId)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 'bold',
            fontSize: '1.05rem',
            marginBottom: '12px',
          }}
        >
          <span>Nuevo Total Estimado:</span>
          <span className="tabular-nums">{formatIntegerARS(estimatedTotal)}</span>
        </div>
      </div>
    </div>
  );
};
