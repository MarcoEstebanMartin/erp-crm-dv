import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { getQuickItemPrice } from './adminPrintHelpers';

interface QuickOrderModalState {
  open: boolean;
  client: any;
  cart: { product: any; quantity: number; isEmergencyOverride?: boolean }[];
  salesChannel?: string;
  notes: string;
}

interface AdminCreateQuickOrderModalProps {
  createOrderModal: QuickOrderModalState | null;
  setCreateOrderModal: React.Dispatch<React.SetStateAction<QuickOrderModalState | null>>;
  products: any[];
  onSuccess: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const AdminCreateQuickOrderModal: React.FC<AdminCreateQuickOrderModalProps> = ({
  createOrderModal,
  setCreateOrderModal,
  products,
  onSuccess,
  setErrorMsg,
  setSuccessMsg,
}) => {
  const [quickProductQuery, setQuickProductQuery] = useState('');

  if (!createOrderModal || !createOrderModal.open) return null;

  const handleAddProductToQuickCart = (product: any) => {
    const existing = createOrderModal.cart.find((item) => item.product.id === product.id);
    const minQty = product.minOrderQuantity || 1;
    if (existing) {
      if (product.stock < existing.quantity + 1) return alert(`Stock insuficiente para "${product.name}".`);
      setCreateOrderModal({
        ...createOrderModal,
        cart: createOrderModal.cart.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)),
      });
    } else {
      if (product.stock < minQty) return alert(`Stock insuficiente para "${product.name}" (Requiere mínimo ${minQty} u., disponible: ${product.stock}).`);
      setCreateOrderModal({ ...createOrderModal, cart: [...createOrderModal.cart, { product, quantity: minQty }] });
    }
  };

  const handleUpdateQuickCartQty = (productId: number, qty: number) => {
    if (qty <= 0) {
      setCreateOrderModal({ ...createOrderModal, cart: createOrderModal.cart.filter((item) => item.product.id !== productId) });
      return;
    }
    const item = createOrderModal.cart.find((i) => i.product.id === productId);
    if (item && item.product.stock < qty) return alert(`Stock insuficiente para "${item.product.name}" (Disponible: ${item.product.stock}).`);
    setCreateOrderModal({ ...createOrderModal, cart: createOrderModal.cart.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i)) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createOrderModal.cart.length === 0) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createOrder({
        clientId: createOrderModal.client.id,
        salesChannel: createOrderModal.salesChannel || 'MOSTRADOR',
        items: createOrderModal.cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          isEmergencyOverride: Boolean(item.isEmergencyOverride || item.quantity < (item.product.minOrderQuantity || 1)),
        })),
        notes: createOrderModal.notes,
      });
      setSuccessMsg(`Pedido registrado exitosamente para ${createOrderModal.client.name}.`);
      setCreateOrderModal(null);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear el pedido.');
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>🛒 Registrar Nuevo Pedido</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setCreateOrderModal(null)}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', overflowY: 'auto', flex: 1, padding: '10px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Añadir Artículos al Pedido</label>
                <input type="text" className="input" placeholder="Buscar producto por nombre o SKU..." value={quickProductQuery} onChange={(e) => setQuickProductQuery(e.target.value)} />
              </div>

              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', backgroundColor: '#ffffff' }}>
                {products
                  .filter((p) => p.name.toLowerCase().includes(quickProductQuery.toLowerCase()) || p.sku.toLowerCase().includes(quickProductQuery.toLowerCase()))
                  .slice(0, 15)
                  .map((p) => {
                    const price = getQuickItemPrice(p, createOrderModal.client);
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f2' }}>
                        <div style={{ marginRight: '10px', flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            SKU: {p.sku} | Stock: <span style={{ fontWeight: 600, color: p.stock <= 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{p.stock}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>${price.toLocaleString()}</span>
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} disabled={p.stock <= 0} onClick={() => handleAddProductToQuickCart(p)}>
                            + Añadir
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Cliente Seleccionado</div>
                <div><strong>Nombre:</strong> {createOrderModal.client.name}</div>
                <div><strong>Lista:</strong> {createOrderModal.client.priceList === 'C' ? 'Lista Especial 2' : createOrderModal.client.priceList === 'B' ? 'Lista Especial' : 'Lista 4'}</div>
                {Number(createOrderModal.client.discount || 0) > 0 && <div style={{ color: 'var(--color-success)' }}><strong>Desc. Fijo:</strong> {createOrderModal.client.discount}%</div>}
                <div><strong>Saldo CC:</strong> <span style={{ fontWeight: 600, color: (createOrderModal.client.outstandingBalance || 0) > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>${Number(createOrderModal.client.outstandingBalance || 0).toLocaleString()}</span></div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Canal de Venta</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {[
                    { id: 'MOSTRADOR', label: '🏬 Mostrador / Depósito' },
                    { id: 'PREVENTA_RUTA', label: '🚚 Preventa Ruta' },
                    { id: 'TIENDA_WEB', label: '🌐 Tienda Web' },
                    { id: 'TELEFONICO', label: '📞 Telefónico' },
                  ].map((sc) => (
                    <button
                      key={sc.id} type="button" onClick={() => setCreateOrderModal({ ...createOrderModal, salesChannel: sc.id })}
                      style={{
                        padding: '6px 8px', fontSize: '0.75rem', fontWeight: (createOrderModal.salesChannel || 'MOSTRADOR') === sc.id ? 700 : 500,
                        borderRadius: '4px', border: (createOrderModal.salesChannel || 'MOSTRADOR') === sc.id ? '1px solid #E30613' : '1px solid var(--border-color)',
                        backgroundColor: (createOrderModal.salesChannel || 'MOSTRADOR') === sc.id ? 'rgba(227, 6, 19, 0.1)' : 'transparent',
                        color: (createOrderModal.salesChannel || 'MOSTRADOR') === sc.id ? '#E30613' : 'var(--text-primary)', cursor: 'pointer',
                      }}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: '180px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Artículos Cargados ({createOrderModal.cart.length})</div>
                {createOrderModal.cart.length === 0 ? (
                  <div style={{ padding: '24px 0', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No hay artículos en el pedido.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {createOrderModal.cart.map((item) => {
                      const price = getQuickItemPrice(item.product, createOrderModal.client);
                      return (
                        <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#ffffff' }}>
                          <div style={{ flex: 1, marginRight: '8px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {item.product.name}
                              {item.product.isPesable && <span style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginLeft: '6px' }}>({(item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} Kg aprox.)</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {item.product.isPesable
                                ? `$${price.toLocaleString()} / Kg x ${(item.quantity * (item.product.approximateWeight || 1)).toLocaleString()} Kg = $${Math.round(price * item.quantity * (item.product.approximateWeight || 1)).toLocaleString()}`
                                : `$${price.toLocaleString()} x ${item.quantity} = $${(price * item.quantity).toLocaleString()}`}
                            </div>
                            {item.quantity < (item.product.minOrderQuantity || 1) && (
                              <div style={{ marginTop: '3px', fontSize: '0.7rem', color: '#e30613', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700 }}>⚠️ Mín: {item.product.minOrderQuantity} u.</span>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontWeight: 600 }}>
                                  <input type="checkbox" checked={Boolean(item.isEmergencyOverride)} onChange={(e) => setCreateOrderModal({ ...createOrderModal, cart: createOrderModal.cart.map((c) => (c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c)) })} />
                                  Excepción Emergencia
                                </label>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button type="button" className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem', minWidth: '24px' }} onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity - 1)}>-</button>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>{item.quantity}</span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '0.75rem', minWidth: '24px' }} onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity + 1)}>+</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px', marginLeft: '4px', color: 'var(--color-danger)' }} onClick={() => handleUpdateQuickCartQty(item.product.id, 0)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.8rem' }}>Observaciones del Pedido (opcional)</label>
                <input type="text" className="input" placeholder="ej: Entregar por la mañana..." value={createOrderModal.notes} onChange={(e) => setCreateOrderModal({ ...createOrderModal, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-light)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Total del Pedido:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                  ${createOrderModal.cart.reduce((acc, curr) => {
                    const price = getQuickItemPrice(curr.product, createOrderModal.client);
                    const qtyOrWeight = curr.product.isPesable ? curr.quantity * (curr.product.approximateWeight || 1) : curr.quantity;
                    return acc + Math.round(price * qtyOrWeight);
                  }, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCreateOrderModal(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={createOrderModal.cart.length === 0}>Confirmar y Guardar Pedido</button>
          </div>
        </form>
      </div>
    </div>
  );
};
