import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';
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

  const handleClose = () => {
    setQuickProductQuery('');
    setCreateOrderModal(null);
  };

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
        salesChannel: 'MOSTRADOR',
        items: createOrderModal.cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          isEmergencyOverride: Boolean(item.isEmergencyOverride || item.quantity < (item.product.minOrderQuantity || 1)),
        })),
        notes: createOrderModal.notes,
      });
      setSuccessMsg(`Pedido registrado para ${createOrderModal.client.name}.`);
      handleClose();
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear el pedido.');
    }
  };

  const client = createOrderModal.client;
  const priceListLabel = client.priceList === 'C' ? 'Lista Especial 2' : client.priceList === 'B' ? 'Lista Especial' : 'Lista 4';
  const balance = Number(client.outstandingBalance || 0);
  const totalAmount = createOrderModal.cart.reduce((acc, curr) => {
    const price = getQuickItemPrice(curr.product, client);
    const qtyOrWeight = curr.product.isPesable ? curr.quantity * (curr.product.approximateWeight || 1) : curr.quantity;
    return acc + Math.round(price * qtyOrWeight);
  }, 0);

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '1320px', width: '96vw', height: '90vh', maxHeight: '92vh', padding: '24px 28px', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nuevo Pedido</h3>
            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>· {client.name}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {priceListLabel}
              {Number(client.discount || 0) > 0 ? ` · Desc. ${client.discount}%` : ''}
              {' · '}Saldo CC:{' '}
              <strong style={{ color: balance > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>${balance.toLocaleString('es-AR')}</strong>
            </span>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: '6px' }} onClick={handleClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Columna Izquierda: Catálogo */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', gap: '12px' }}>
              <input
                type="text" className="input" autoFocus placeholder="Buscar producto por nombre o SKU..."
                value={quickProductQuery} onChange={(e) => setQuickProductQuery(e.target.value)}
                style={{ height: '42px', fontSize: '0.92rem' }}
              />
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                {products
                  .filter((p) => p.name.toLowerCase().includes(quickProductQuery.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(quickProductQuery.toLowerCase())))
                  .slice(0, 50)
                  .map((p) => {
                    const price = getQuickItemPrice(p, client);
                    const inCart = createOrderModal.cart.find((i) => i.product.id === p.id);
                    return (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #f0f0f2', backgroundColor: inCart ? 'rgba(16, 185, 129, 0.04)' : '#ffffff' }}>
                        <div style={{ marginRight: '12px', flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            SKU: {p.sku} · Stock: <span style={{ fontWeight: 600, color: p.stock <= 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{p.stock}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.92rem', fontWeight: 600 }}>${price.toLocaleString('es-AR')}</span>
                          <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600 }} disabled={p.stock <= 0} onClick={() => handleAddProductToQuickCart(p)}>
                            {inCart ? `+ Añadir (${inCart.quantity})` : '+ Añadir'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Columna Derecha: Artículos Cargados y Cierre */}
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', gap: '12px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Artículos cargados ({createOrderModal.cart.length})
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-light, #fafafa)', padding: '10px' }}>
                {createOrderModal.cart.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                    Seleccioná artículos de la izquierda para armar el pedido.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {createOrderModal.cart.map((item) => {
                      const price = getQuickItemPrice(item.product, client);
                      const approxKg = item.quantity * (item.product.approximateWeight || 1);
                      const lineTotal = item.product.isPesable ? Math.round(price * approxKg) : price * item.quantity;
                      return (
                        <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#ffffff', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {item.product.name}
                              {item.product.isPesable && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>(~{approxKg.toLocaleString('es-AR')} kg)</span>}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {item.product.isPesable ? `$${price.toLocaleString('es-AR')}/kg × ${approxKg.toLocaleString('es-AR')} kg = ` : `$${price.toLocaleString('es-AR')} × ${item.quantity} = `}
                              <strong style={{ color: 'var(--text-primary)' }}>${lineTotal.toLocaleString('es-AR')}</strong>
                            </div>
                            {item.quantity < (item.product.minOrderQuantity || 1) && (
                              <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#e30613', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700 }}>Mín: {item.product.minOrderQuantity} u.</span>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                                  <input type="checkbox" checked={Boolean(item.isEmergencyOverride)} onChange={(e) => setCreateOrderModal({ ...createOrderModal, cart: createOrderModal.cart.map((c) => (c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c)) })} />
                                  Excepción
                                </label>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', fontSize: '0.82rem', minWidth: '28px' }} onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity - 1)}>-</button>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', fontSize: '0.82rem', minWidth: '28px' }} onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity + 1)}>+</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '6px', marginLeft: '4px', color: 'var(--color-danger)' }} onClick={() => handleUpdateQuickCartQty(item.product.id, 0)}><Trash2 size={14} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <input
                type="text" className="input" placeholder="Observaciones (opcional)..."
                value={createOrderModal.notes} onChange={(e) => setCreateOrderModal({ ...createOrderModal, notes: e.target.value })}
                style={{ height: '40px', fontSize: '0.88rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>Total estimado</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>${totalAmount.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" style={{ padding: '8px 18px' }} onClick={handleClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 22px', fontWeight: 600 }} disabled={createOrderModal.cart.length === 0}>Confirmar Pedido</button>
          </div>
        </form>
      </div>
    </div>
  );
};
