import React from 'react';
import { type StoreProduct, formatMoney } from './portal.types';
import { portalProductCardStyles as styles } from './portalProductCard.styles';

interface PortalProductCardProps {
  product: StoreProduct;
  currentQty: number;
  hasImageError: boolean;
  onImageError: (id: number) => void;
  onAddToCart: (product: StoreProduct, qty?: number) => void;
  onUpdateQty: (productId: number, qty: number) => void;
}

function renderStockBadge(stock: number) {
  if (stock <= 0) {
    return <span style={styles.stockTagRed}>🔴 Sin Stock Inmediato</span>;
  }
  if (stock <= 30) {
    return <span style={styles.stockTagAmber}>⚠️ Pocas Unidades</span>;
  }
  return <span style={styles.stockTagGreen}>🟢 Disponible</span>;
}

export const PortalProductCard: React.FC<PortalProductCardProps> = ({
  product: p,
  currentQty,
  hasImageError,
  onImageError,
  onAddToCart,
  onUpdateQty
}) => {
  const resolvedImageSrc =
    p.imageUrl && p.imageUrl.startsWith('http')
      ? p.imageUrl
      : p.imageUrl && p.imageUrl.startsWith('/')
        ? `${p.imageUrl}?v=1.2`
        : `/uploads/products/${p.imageUrl}?v=1.2`;

  return (
    <div style={styles.productCard}>
      <div style={styles.productImageArea}>
        {p.imageUrl && !hasImageError ? (
          <img
            src={resolvedImageSrc}
            alt={p.name}
            style={styles.productImg}
            onError={() => onImageError(p.id)}
          />
        ) : (
          <div style={styles.productPlaceholder}>
            <span style={{ fontSize: '36px' }}>{p.commercialGroupIcon || '📦'}</span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>SKU {p.sku}</span>
          </div>
        )}

        {p.isOffer && (
          <>
            {p.specialTag ? (
              <div style={styles.specialTagBadge}>🔥 {p.specialTag}</div>
            ) : (
              <div style={styles.offerBadge}>🔥 {p.offerName || 'OFERTA ESPECIAL'}</div>
            )}

            {p.offerDiscount > 0 && <div style={styles.discountBadge}>-{p.offerDiscount}% OFF</div>}
          </>
        )}
      </div>

      <div style={styles.productCardBody}>
        <div style={styles.productHeaderRow}>
          <span style={styles.productSku}>SKU: {p.sku}</span>
          <span style={styles.productCommercialTag}>
            {p.commercialGroupIcon || '📦'} {p.commercialGroupName || 'Almacén'}
          </span>
        </div>

        <h3 style={styles.productTitle}>{p.name}</h3>

        <div style={styles.productPriceRow}>
          <div>
            <div style={styles.productPriceLabel}>Precio Final - IVA Inc.</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <div style={styles.productPriceValue}>{formatMoney(p.price)}</div>
              {p.previousPrice && p.previousPrice > p.price && (
                <div style={styles.previousPriceValue}>{formatMoney(p.previousPrice)}</div>
              )}
            </div>
          </div>
          {p.unitsPerBox > 1 && <div style={styles.unitsBoxTag}>📦 Caja x {p.unitsPerBox} un.</div>}
        </div>

        <div style={styles.stockStatusRow}>{renderStockBadge(p.stock)}</div>

        <div style={styles.cardActions}>
          {currentQty === 0 ? (
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <button onClick={() => onAddToCart(p, 1)} style={styles.btnAddCart}>
                + Agregar 1 Un.
              </button>
              {p.unitsPerBox > 1 && (
                <button onClick={() => onAddToCart(p, p.unitsPerBox)} style={styles.btnAddBox}>
                  + 1 Caja ({p.unitsPerBox})
                </button>
              )}
            </div>
          ) : (
            <div style={styles.qtyControllerRow}>
              <button onClick={() => onUpdateQty(p.id, currentQty - 1)} style={styles.btnQty}>
                -
              </button>
              <span style={styles.qtyDisplay}>{currentQty} un.</span>
              <button onClick={() => onUpdateQty(p.id, currentQty + 1)} style={styles.btnQty}>
                +
              </button>
              {p.unitsPerBox > 1 && (
                <button onClick={() => onUpdateQty(p.id, currentQty + p.unitsPerBox)} style={styles.btnQtyBox}>
                  +Caja
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
