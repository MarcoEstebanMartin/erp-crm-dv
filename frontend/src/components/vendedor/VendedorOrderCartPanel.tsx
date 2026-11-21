import React from 'react';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { getVendedorItemPrice } from './vendedorHelpers';
import type { Persona } from '../../types';
import type { FrontendCartPromoEvalResult } from '../../utils/weeklyPromoCartEvaluator';

export interface VendedorCartLine {
  product: any;
  quantity: number;
  isEmergencyOverride?: boolean;
}

interface VendedorOrderCartPanelProps {
  cart: VendedorCartLine[];
  setCart: React.Dispatch<React.SetStateAction<VendedorCartLine[]>>;
  selectedClient: Persona | null;
  promoEval: FrontendCartPromoEvalResult;
  totalUnits: number;
  loading: boolean;
  qtyInputStyle: React.CSSProperties;
  onUpdateCartQty: (productId: number, change: number) => void;
  onDirectQtyChange: (productId: number, rawValue: string) => void;
  onConfirmOrder: () => void;
}

export const VendedorOrderCartPanel: React.FC<VendedorOrderCartPanelProps> = ({
  cart,
  setCart,
  selectedClient,
  promoEval,
  totalUnits,
  loading,
  qtyInputStyle,
  onUpdateCartQty,
  onDirectQtyChange,
  onConfirmOrder,
}) => {
  if (cart.length === 0) return null;
  const cartTotal = promoEval.totalAmount;

  return (
    <div className="card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShoppingCart size={16} aria-hidden="true" />
            Pedido ({totalUnits})
          </span>
          <span className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            ${cartTotal.toLocaleString('es-AR')}
          </span>
        </div>

        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff' }}>
          {cart.map((item, idx) => {
            const basePrice = getVendedorItemPrice(item.product, selectedClient);
            const evaluatedLine = promoEval.byProductId[item.product.id];
            const itemPrice = evaluatedLine ? evaluatedLine.effectiveUnitPrice : basePrice;
            const lineSubtotal = evaluatedLine
              ? evaluatedLine.lineSubtotal
              : Math.round(itemPrice * (item.product.isPesable ? item.quantity * (item.product.approximateWeight || 1) : item.quantity));
            return (
              <div
                key={item.product.id}
                style={{
                  padding: '9px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: idx < cart.length - 1 || promoEval.bonusLines.length > 0 ? '1px solid var(--border-color)' : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 600 }}>{item.product.name}</div>
                  <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    ${lineSubtotal.toLocaleString('es-AR')} (${itemPrice.toLocaleString('es-AR')}{item.product.isPesable ? '/Kg' : ' c/u'})
                  </div>
                  {item.quantity < (item.product.minOrderQuantity || 1) && (
                    <label style={{ marginTop: '3px', fontSize: '0.72rem', color: '#e30613', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(item.isEmergencyOverride)}
                        onChange={(e) => setCart(cart.map((c) => (c.product.id === item.product.id ? { ...c, isEmergencyOverride: e.target.checked } : c)))}
                      />
                      Mín {item.product.minOrderQuantity} · Excepción
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} aria-label={`Restar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, -1)}>-</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={`Cantidad de ${item.product.name}`}
                    className="tabular-nums"
                    style={qtyInputStyle}
                    value={item.quantity}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => onDirectQtyChange(item.product.id, e.target.value)}
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 8px' }} aria-label={`Sumar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, 1)}>+</button>
                  <button type="button" className="btn btn-ghost text-danger" style={{ padding: '4px' }} aria-label={`Quitar ${item.product.name}`} onClick={() => onUpdateCartQty(item.product.id, -item.quantity)}><Trash2 size={14} aria-hidden="true" /></button>
                </div>
              </div>
            );
          })}
          {promoEval.bonusLines.map((bonus) => (
            <div key={`bonus-${bonus.productId}`} style={{ padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0FDF4' }}>
              <span className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065F46' }}>+ {bonus.quantity} u. sin cargo · {bonus.productName}</span>
              <span className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065F46' }}>$0</span>
            </div>
          ))}
        </div>

        <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '12px', fontWeight: 700, fontSize: '0.95rem' }} onClick={onConfirmOrder} disabled={loading}>
          {loading ? 'Procesando...' : 'Confirmar pedido'}
        </button>
    </div>
  );
};
