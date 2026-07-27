import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../utils/api';

interface EditOrderModalProps {
  editOrderModal: {
    open: boolean;
    orderId: number;
    clientId: number;
    clientName: string;
    items: {
      id: number;
      productId: number;
      name: string;
      sku: string;
      quantity: number;
      listPrice: number;
      weight?: number | null;
      isPesable?: boolean;
      approximateWeight?: number | null;
    }[];
  } | null;
  setEditOrderModal: (val: any) => void;
  products: any[];
  fetchData: () => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({
  editOrderModal,
  setEditOrderModal,
  products,
  fetchData,
  setSuccessMsg,
  setErrorMsg
}) => {
  const [prodSearchQuery, setProdSearchQuery] = useState('');

  if (!editOrderModal || !editOrderModal.open) return null;

  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const itemsPayload = editOrderModal.items.map(item => {
        const prod = products.find(p => p.id === item.productId);
        const minQty = prod?.minOrderQuantity || 1;
        return {
          productId: item.productId,
          quantity: item.quantity,
          weight: item.weight || null,
          isEmergencyOverride: Boolean((item as any).isEmergencyOverride || (item.quantity < minQty))
        };
      });
      
      await api.updateOrder(editOrderModal.orderId, { items: itemsPayload });
      setEditOrderModal(null);
      setSuccessMsg(`Pedido #${editOrderModal.orderId} actualizado con éxito.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar el pedido.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="modal-header">
          <h3>Editar Pedido #{editOrderModal.orderId} - {editOrderModal.clientName}</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setEditOrderModal(null)}>✕</button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px', overflowY: 'auto', flex: 1, padding: '10px 0' }}>
          {/* Catálogo de Productos */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Añadir Artículos</h4>
            <div className="search-input-wrapper" style={{ marginBottom: '10px' }}>
              <input
                type="text"
                className="input"
                placeholder="Buscar producto..."
                value={prodSearchQuery}
                onChange={(e) => setProdSearchQuery(e.target.value)}
              />
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
              {products
                .filter(p => p.name.toLowerCase().includes(prodSearchQuery.toLowerCase()) || p.sku.toLowerCase().includes(prodSearchQuery.toLowerCase()))
                .map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Stock: {p.stock} | ${p.listPrice}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={() => {
                        const existing = editOrderModal.items.find(item => item.productId === p.id);
                        const minQty = p.minOrderQuantity || 1;
                        if (existing) {
                          setEditOrderModal({
                            ...editOrderModal,
                            items: editOrderModal.items.map(item =>
                              item.productId === p.id ? { ...item, quantity: item.quantity + 1 } : item
                            )
                          });
                        } else {
                          setEditOrderModal({
                            ...editOrderModal,
                            items: [...editOrderModal.items, {
                              id: Date.now(),
                              productId: p.id,
                              name: p.name,
                              sku: p.sku,
                              quantity: minQty,
                              isPesable: p.isPesable,
                              approximateWeight: p.approximateWeight != null ? Number(p.approximateWeight) : undefined,
                              listPrice: Number(p.listPrice)
                            }]
                          });
                        }
                      }}
                    >
                      + Agregar
                    </button>
                  </div>
                ))}
            </div>
          </div>
          
          {/* Artículos del pedido */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Detalle Actual del Pedido</h4>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '10px' }}>
              {editOrderModal.items.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No hay artículos en el pedido.</p>
              ) : (
                editOrderModal.items.map(item => (
                  <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${item.listPrice} c/u {item.isPesable && '(Por Kg)'}</div>
                      {item.isPesable && (
                        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Peso Exacto (Kg):</span>
                          <input 
                            type="number" 
                            step="0.01"
                            className="input" 
                            style={{ width: '80px', padding: '2px 6px', fontSize: '0.8rem' }}
                            value={item.weight || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setEditOrderModal({
                                ...editOrderModal,
                                items: editOrderModal.items.map(i => 
                                  i.productId === item.productId ? { ...i, weight: isNaN(val) ? null : val } : i
                                )
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 6px' }}
                        onClick={() => {
                          const newQty = item.quantity - 1;
                          if (newQty <= 0) {
                            setEditOrderModal({
                              ...editOrderModal,
                              items: editOrderModal.items.filter(i => i.productId !== item.productId)
                            });
                          } else {
                            setEditOrderModal({
                              ...editOrderModal,
                              items: editOrderModal.items.map(i =>
                                i.productId === item.productId ? { ...i, quantity: newQty } : i
                              )
                            });
                          }
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.quantity}</span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '2px 6px' }}
                        onClick={() => {
                          setEditOrderModal({
                            ...editOrderModal,
                            items: editOrderModal.items.map(i =>
                              i.productId === item.productId ? { ...i, quantity: i.quantity + 1 } : i
                            )
                          });
                        }}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost text-danger"
                        style={{ padding: '4px' }}
                        onClick={() => {
                          setEditOrderModal({
                            ...editOrderModal,
                            items: editOrderModal.items.filter(i => i.productId !== item.productId)
                          });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '12px' }}>
                <span>Nuevo Total:</span>
                <span>${editOrderModal.items.reduce((acc, i) => acc + (i.listPrice * (i.isPesable ? (i.weight || (i.quantity * (i.approximateWeight || 1))) : i.quantity)), 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setEditOrderModal(null)}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={handleEditOrderSubmit}>Guardar Cambios</button>
        </div>
      </div>
    </div>
  );
};

export default EditOrderModal;
