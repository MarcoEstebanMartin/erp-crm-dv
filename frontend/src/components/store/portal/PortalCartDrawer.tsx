import React from 'react';
import { type CartItem, formatMoney } from './portal.types';
import { portalCartStyles as styles } from './portalCart.styles';

interface PortalCartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  cart: CartItem[];
  onUpdateQty: (productId: number, qty: number) => void;
  orderNotes: string;
  setOrderNotes: (notes: string) => void;
  cartTotalNeto: number;
  cartTotalIva: number;
  cartTotalFinal: number;
  isSubmittingOrder: boolean;
  onSubmitOrder: () => void;
}

export const PortalCartDrawer: React.FC<PortalCartDrawerProps> = ({
  isOpen,
  onClose,
  clientName,
  cart,
  onUpdateQty,
  orderNotes,
  setOrderNotes,
  cartTotalNeto,
  cartTotalIva,
  cartTotalFinal,
  isSubmittingOrder,
  onSubmitOrder
}) => {
  if (!isOpen) return null;

  return (
    <div style={styles.drawerOverlay} onClick={onClose}>
      <div style={styles.drawerCard} onClick={(e) => e.stopPropagation()}>
        <div style={styles.drawerHeader}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>🛒 Resumen del Pedido</h2>
          <button onClick={onClose} style={styles.btnCloseDrawer}>
            ✕
          </button>
        </div>

        <div style={styles.drawerBody}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              El carrito está vacío. Explorá el catálogo y agregá productos.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cart.map((item) => (
                <div key={item.product.id} style={styles.cartItemRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{item.product.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{formatMoney(item.unitPrice)} c/u</div>
                  </div>

                  <div style={styles.qtyControllerSmall}>
                    <button onClick={() => onUpdateQty(item.product.id, item.quantity - 1)} style={styles.btnQtySmall}>
                      -
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', width: '28px', textAlign: 'center' }}>
                      {item.quantity}
                    </span>
                    <button onClick={() => onUpdateQty(item.product.id, item.quantity + 1)} style={styles.btnQtySmall}>
                      +
                    </button>
                  </div>

                  <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                    {formatMoney(item.unitPrice * item.quantity)}
                  </div>
                </div>
              ))}

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#475569', marginBottom: '6px', fontWeight: 500 }}>
                  📝 Observaciones para la entrega (Opcional):
                </label>
                <textarea
                  placeholder="Ej: Entregar por la mañana, o comentarios del pedido..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  rows={3}
                  style={styles.notesTextarea}
                />
              </div>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div style={styles.drawerFooter}>
            <div style={styles.summaryRow}>
              <span>Subtotal Neto:</span>
              <span>{formatMoney(cartTotalNeto)}</span>
            </div>
            <div style={styles.summaryRow}>
              <span>IVA Estimado (21%):</span>
              <span>{formatMoney(cartTotalIva)}</span>
            </div>
            <div
              style={{
                ...styles.summaryRow,
                fontSize: '18px',
                fontWeight: 700,
                color: '#0f172a',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '10px'
              }}
            >
              <span>Total Estimado:</span>
              <span style={{ color: '#059669' }}>{formatMoney(cartTotalFinal)}</span>
            </div>

            <button onClick={onSubmitOrder} disabled={isSubmittingOrder} style={styles.btnSubmitOrder}>
              {isSubmittingOrder ? 'Procesando Pedido...' : '🚀 CONFIRMAR Y ENVIAR PEDIDO'}
            </button>

            <a
              href={`https://wa.me/?text=Hola%20tengo%20una%20consulta%20sobre%20mi%20pedido%20de%20tienda%20B2B%20(Cliente:%20${encodeURIComponent(clientName)})`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.whatsappLink}
            >
              💬 Consulta Urgente por WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

interface PortalFloatingCartBarProps {
  cartTotalItemsCount: number;
  cartTotalFinal: number;
  isCartOpen: boolean;
  onOpenCart: () => void;
}

export const PortalFloatingCartBar: React.FC<PortalFloatingCartBarProps> = ({
  cartTotalItemsCount,
  cartTotalFinal,
  isCartOpen,
  onOpenCart
}) => {
  if (cartTotalItemsCount <= 0 || isCartOpen) return null;

  return (
    <div style={styles.floatingCartBar} onClick={onOpenCart}>
      <div style={styles.floatingCartInfo}>
        <div style={styles.floatingCartBadge}>
          🛒 {cartTotalItemsCount}{' '}
          {cartTotalItemsCount === 1 ? 'producto seleccionado' : 'productos en tu carrito'}
        </div>
        <div style={styles.floatingCartTotal}>Total est: {formatMoney(cartTotalFinal)}</div>
      </div>
      <button style={styles.btnFloatingCartAction}>Ver Carrito / Finalizar →</button>
    </div>
  );
};
