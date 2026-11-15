import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatIntegerARS } from '../../utils/currency';
import { matchesSmartSearch } from '../../utils/orderSearchAndStatus.helper';
import {
  calculateExactLineSubtotalInt,
  evaluateFrontendCartPromos,
  getProductPromoBadge,
} from '../../utils/weeklyPromoCartEvaluator';
import {
  computeClientUnitPrice,
  fetchPricingDiscountRules,
  getClientPriceListLabel,
} from '../billing/sales/salesBilling.helpers';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import type { WeeklyPromo } from './config/weeklyPromo.helpers';

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
  const [weeklyPromos, setWeeklyPromos] = useState<WeeklyPromo[]>([]);
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [stockNotice, setStockNotice] = useState<string | null>(null);

  const isOpen = Boolean(createOrderModal?.open);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStockNotice(null);
    Promise.all([
      api.getActiveWeeklyPromos().catch(() => []),
      fetchPricingDiscountRules().catch(() => []),
    ]).then(([promosRes, rulesRes]) => {
      if (cancelled) return;
      setWeeklyPromos(Array.isArray(promosRes) ? promosRes : []);
      setDiscountRules(Array.isArray(rulesRes) ? rulesRes : []);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const promoEval = useMemo(() => {
    if (!createOrderModal || !createOrderModal.open) {
      return { byProductId: {}, bonusLines: [], stockRequiredByProduct: {}, totalAmount: 0, appliedPromoIds: [], totalBonusUnits: 0 };
    }
    return evaluateFrontendCartPromos({
      items: createOrderModal.cart.map((curr) => ({
        productId: curr.product.id,
        productName: curr.product.name,
        quantity: curr.quantity,
        isPesable: Boolean(curr.product.isPesable),
        approximateWeight: curr.product.approximateWeight,
        baseUnitPrice: computeClientUnitPrice(curr.product, createOrderModal.client, discountRules),
      })),
      promos: weeklyPromos,
    });
  }, [createOrderModal, weeklyPromos, discountRules]);

  if (!createOrderModal || !createOrderModal.open) return null;

  const handleClose = () => {
    setQuickProductQuery('');
    setStockNotice(null);
    setCreateOrderModal(null);
  };

  const handleAddProductToQuickCart = (product: any) => {
    setStockNotice(null);
    const existing = createOrderModal.cart.find((item) => item.product.id === product.id);
    const minQty = product.minOrderQuantity || 1;
    if (existing) {
      if (product.stock < existing.quantity + 1) {
        setStockNotice(`Stock insuficiente para "${product.name}" (disponible: ${product.stock}).`);
        return;
      }
      setCreateOrderModal({
        ...createOrderModal,
        cart: createOrderModal.cart.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        ),
      });
    } else {
      if (product.stock < minQty) {
        setStockNotice(`Stock insuficiente para "${product.name}" (mínimo ${minQty} u., disponible: ${product.stock}).`);
        return;
      }
      setCreateOrderModal({
        ...createOrderModal,
        cart: [...createOrderModal.cart, { product, quantity: minQty }],
      });
    }
  };

  const handleUpdateQuickCartQty = (productId: number, qty: number) => {
    setStockNotice(null);
    if (qty <= 0) {
      setCreateOrderModal({
        ...createOrderModal,
        cart: createOrderModal.cart.filter((item) => item.product.id !== productId),
      });
      return;
    }
    const item = createOrderModal.cart.find((i) => i.product.id === productId);
    if (item && item.product.stock < qty) {
      setStockNotice(`Stock insuficiente para "${item.product.name}" (disponible: ${item.product.stock}).`);
      return;
    }
    setCreateOrderModal({
      ...createOrderModal,
      cart: createOrderModal.cart.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i)),
    });
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
          isEmergencyOverride: Boolean(
            item.isEmergencyOverride || item.quantity < (item.product.minOrderQuantity || 1),
          ),
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
  const priceListLabel = getClientPriceListLabel(client);
  const balance = Number(client.outstandingBalance || 0);
  const totalAmount = promoEval.totalAmount;
  const filteredProducts = products
    .filter((p) => matchesSmartSearch([p.name, p.sku, p.barcode].filter(Boolean).join(' '), quickProductQuery))
    .slice(0, 50);

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="quick-order-modal-title"
      style={{
        maxWidth: '1320px',
        width: '96vw',
        height: '90vh',
        maxHeight: '92vh',
        padding: '24px 28px',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
          <h3 id="quick-order-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Nuevo Pedido
          </h3>
          <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>· {client.name}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {priceListLabel}
            {Number(client.discount || 0) > 0 ? ` · Desc. ${client.discount}%` : ''}
            {' · '}Saldo CC:{' '}
            <strong style={{ color: balance > 0 ? '#E30613' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {formatIntegerARS(balance)}
            </strong>
          </span>
        </div>
        <button type="button" className="btn btn-ghost" aria-label="Cerrar nuevo pedido" style={{ padding: '6px' }} onClick={handleClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {stockNotice && (
        <div role="alert" style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#E30613', fontSize: '0.8rem', fontWeight: 600 }}>
          {stockNotice}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', gap: '12px' }}>
            <input
              type="text"
              className="input"
              aria-label="Buscar producto por nombre o SKU"
              autoFocus
              placeholder="Buscar producto por nombre o SKU..."
              value={quickProductQuery}
              onChange={(e) => setQuickProductQuery(e.target.value)}
              style={{ height: '42px', fontSize: '0.92rem' }}
            />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#ffffff' }}>
              {filteredProducts.map((p) => {
                const price = computeClientUnitPrice(p, client, discountRules);
                const inCart = createOrderModal.cart.find((i) => i.product.id === p.id);
                const promoBadge = getProductPromoBadge(p.id, weeklyPromos, Boolean(p.isPesable));
                return (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #f0f0f2', backgroundColor: inCart ? '#F9FAFB' : '#ffffff' }}>
                    <div style={{ marginRight: '12px', flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{p.name}</span>
                        {promoBadge && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, backgroundColor: '#F3F4F6', color: '#111827', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '1px 6px' }}>
                            {promoBadge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        SKU: {p.sku} · Stock:{' '}
                        <span style={{ fontWeight: 600, color: p.stock <= 0 ? '#E30613' : 'var(--text-primary)' }}>{p.stock}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.92rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatIntegerARS(price)}</span>
                      <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600 }} disabled={p.stock <= 0} onClick={() => handleAddProductToQuickCart(p)}>
                        {inCart ? `+ Añadir (${inCart.quantity})` : '+ Añadir'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', gap: '12px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Artículos cargados ({createOrderModal.cart.length})
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#F9FAFB', padding: '10px' }}>
              {createOrderModal.cart.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  Seleccioná artículos de la izquierda para armar el pedido.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {createOrderModal.cart.map((item) => {
                    const basePrice = computeClientUnitPrice(item.product, client, discountRules);
                    const evaluatedLine = promoEval.byProductId[item.product.id];
                    const price = evaluatedLine ? evaluatedLine.effectiveUnitPrice : basePrice;
                    const approxKg = item.quantity * (item.product.approximateWeight || 1);
                    const lineTotal = evaluatedLine
                      ? evaluatedLine.lineSubtotal
                      : calculateExactLineSubtotalInt({
                          unitPriceInt: price,
                          quantity: item.quantity,
                          isPesable: Boolean(item.product.isPesable),
                          approximateWeight: item.product.approximateWeight,
                        });
                    return (
                      <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#ffffff', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{item.product.name}</span>
                            {item.product.isPesable && (
                              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>(~{approxKg.toLocaleString('es-AR')} kg)</span>
                            )}
                            {evaluatedLine?.promoApplied && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, backgroundColor: '#F3F4F6', color: '#111827', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '1px 6px' }}>
                                {evaluatedLine.appliedPromoName || 'Oferta'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                            {evaluatedLine?.promoApplied && basePrice > price && (
                              <span style={{ textDecoration: 'line-through', marginRight: '6px', opacity: 0.7 }}>{formatIntegerARS(basePrice)}</span>
                            )}
                            {item.product.isPesable ? `${formatIntegerARS(price)}/kg × ${approxKg.toLocaleString('es-AR')} kg = ` : `${formatIntegerARS(price)} × ${item.quantity} = `}
                            <strong style={{ color: 'var(--text-primary)' }}>{formatIntegerARS(lineTotal)}</strong>
                          </div>
                          {item.quantity < (item.product.minOrderQuantity || 1) && (
                            <div style={{ marginTop: '4px', fontSize: '0.72rem', color: '#E30613', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 700 }}>Mín: {item.product.minOrderQuantity} u.</span>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(item.isEmergencyOverride)}
                                  onChange={(e) =>
                                    setCreateOrderModal({
                                      ...createOrderModal,
                                      cart: createOrderModal.cart.map((c) =>
                                        c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c,
                                      ),
                                    })
                                  }
                                />
                                Excepción
                              </label>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button type="button" className="btn btn-secondary" aria-label={`Restar cantidad de ${item.product.name}`} style={{ padding: '4px 9px', fontSize: '0.82rem', minWidth: '28px' }} onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity - 1)}>-</button>
                          <span style={{ fontSize: '0.88rem', fontWeight: 600, minWidth: '24px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{item.quantity}</span>
                          <button type="button" className="btn btn-secondary" aria-label={`Sumar cantidad de ${item.product.name}`} style={{ padding: '4px 9px', fontSize: '0.82rem', minWidth: '28px' }} onClick={() => handleUpdateQuickCartQty(item.product.id, item.quantity + 1)}>+</button>
                          <button type="button" className="btn btn-secondary" aria-label={`Quitar ${item.product.name}`} style={{ padding: '6px', marginLeft: '4px', color: '#E30613' }} onClick={() => handleUpdateQuickCartQty(item.product.id, 0)}>
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {promoEval.bonusLines.map((bonus) => {
                    const cartProd = createOrderModal.cart.find((c) => c.product.id === bonus.productId)?.product;
                    const reqStock = promoEval.stockRequiredByProduct[bonus.productId] || 0;
                    const lowBonusStock = cartProd && Number(cartProd.stock || 0) < reqStock;
                    return (
                      <div key={`bonus-${bonus.productId}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', border: '1px solid #D1D5DB', borderRadius: '8px', backgroundColor: '#FFFFFF', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#111827' }}>+ {bonus.quantity} u. sin cargo · {bonus.productName}</div>
                          <div style={{ fontSize: '0.73rem', color: lowBonusStock ? '#E30613' : '#4B5563', fontWeight: lowBonusStock ? 700 : 500 }}>
                            {lowBonusStock ? `Stock insuficiente para bonificación (Disponible: ${cartProd.stock}, Req: ${reqStock})` : bonus.promoName}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#111827' }}>$0</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <input
              type="text"
              className="input"
              aria-label="Observaciones del pedido"
              placeholder="Observaciones (opcional)..."
              value={createOrderModal.notes}
              onChange={(e) => setCreateOrderModal({ ...createOrderModal, notes: e.target.value })}
              style={{ height: '40px', fontSize: '0.88rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-secondary)' }}>Total estimado</span>
              <span style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{formatIntegerARS(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '8px 18px' }} onClick={handleClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 22px', fontWeight: 600 }} disabled={createOrderModal.cart.length === 0}>Confirmar Pedido</button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
