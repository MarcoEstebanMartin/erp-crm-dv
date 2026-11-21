import React from 'react';
import {
  type CatalogViewMode,
  type StoreProduct,
  formatApproxWeight,
  formatIntegerMoney,
  resolveProductImageSrc,
} from './portal.types';

interface PortalProductCardProps {
  product: StoreProduct;
  viewMode: CatalogViewMode;
  currentQty: number;
  hasImageError: boolean;
  onImageError: (id: number) => void;
  onPreviewImage: (product: StoreProduct) => void;
  onAddToCart: (product: StoreProduct, qty?: number) => void;
  onUpdateQty: (productId: number, qty: number) => void;
}

function renderStockAlert(stock: number) {
  if (stock <= 0) {
    return <span className="store-stock-alert out">Sin stock</span>;
  }
  if (stock <= 30) {
    return <span className="store-stock-alert low">Últimas unidades</span>;
  }
  return null;
}

function renderOfferLabel(p: StoreProduct): string | null {
  if (!p.isOffer) return null;
  if (p.specialTag) return p.specialTag;
  if (p.offerDiscount > 0) return `-${p.offerDiscount}%`;
  return 'OFERTA';
}

export const PortalProductCard: React.FC<PortalProductCardProps> = ({
  product: p,
  viewMode,
  currentQty,
  hasImageError,
  onImageError,
  onPreviewImage,
  onAddToCart,
  onUpdateQty,
}) => {
  const imageSrc = resolveProductImageSrc(p.imageUrl);
  const showImage = Boolean(imageSrc && !hasImageError);
  const offerLabel = renderOfferLabel(p);
  const isFeaturedBadge = p.storeHighlight === 'DESTACADO' && offerLabel === 'DESTACADO';
  const badgeClass = isFeaturedBadge ? 'store-badge-offer store-badge-featured' : 'store-badge-offer';
  const hasPieceHint = Boolean(
    p.isPesable && p.approximateWeight && p.approximateWeight > 0 && p.estimatedPiecePrice
  );

  const actionsNode =
    currentQty === 0 ? (
      <div className="store-btn-row">
        <button type="button" onClick={() => onAddToCart(p, 1)} className="store-btn-add">
          + Agregar
        </button>
        {p.unitsPerBox > 1 && (
          <button
            type="button"
            onClick={() => onAddToCart(p, p.unitsPerBox)}
            className="store-btn-box"
            title={`Agregar caja de ${p.unitsPerBox} unidades`}
          >
            +Caja ({p.unitsPerBox})
          </button>
        )}
      </div>
    ) : (
      <div className="store-qty-stepper">
        <button
          type="button"
          onClick={() => onUpdateQty(p.id, currentQty - 1)}
          className="store-qty-btn"
          aria-label="Restar unidad"
        >
          −
        </button>
        <span className="store-qty-val">{currentQty} un.</span>
        <button
          type="button"
          onClick={() => onUpdateQty(p.id, currentQty + 1)}
          className="store-qty-btn"
          aria-label="Sumar unidad"
        >
          +
        </button>
        {p.unitsPerBox > 1 && (
          <button
            type="button"
            onClick={() => onUpdateQty(p.id, currentQty + p.unitsPerBox)}
            className="store-qty-box-btn"
          >
            +{p.unitsPerBox}
          </button>
        )}
      </div>
    );

  if (viewMode === 'list') {
    return (
      <article className="store-list-row">
        <button
          type="button"
          className="store-list-thumb-btn"
          onClick={() => onPreviewImage(p)}
          aria-label={`Ampliar foto de ${p.name}`}
        >
          {showImage ? (
            <img
              src={imageSrc!}
              alt={p.name}
              loading="lazy"
              decoding="async"
              onError={() => onImageError(p.id)}
            />
          ) : (
            <span style={{ fontSize: '26px' }}>{p.commercialGroupIcon || '📦'}</span>
          )}
        </button>

        <div className="store-list-info">
          <div className="store-list-top">
            <span className="store-list-sku">#{p.sku}</span>
            {offerLabel && (
              <span
                className={badgeClass}
                style={{ position: 'static', fontSize: '10px', padding: '2px 7px' }}
              >
                {offerLabel}
              </span>
            )}
            {p.unitsPerBox > 1 && <span className="store-meta-hint">Caja x {p.unitsPerBox}</span>}
            {renderStockAlert(p.stock)}
          </div>
          <h3 className="store-list-title">{p.name}</h3>
          {hasPieceHint && (
            <div className="store-meta-hint">
              Pieza ~{formatApproxWeight(p.approximateWeight!)} kg · ~
              {formatIntegerMoney(p.estimatedPiecePrice!)}
            </div>
          )}
        </div>

        <div className="store-list-right">
          <div className="store-list-price">
            <div className="store-price-line" style={{ justifyContent: 'flex-end' }}>
              <span className="store-price-main" style={{ fontSize: '17px' }}>
                {formatIntegerMoney(p.price)}
              </span>
              {p.isPesable && <span className="store-price-unit">/ kg</span>}
            </div>
            {p.previousPrice && p.previousPrice > p.price && (
              <div className="store-price-prev">{formatIntegerMoney(p.previousPrice)}</div>
            )}
          </div>

          <div className="store-list-actions">{actionsNode}</div>
        </div>
      </article>
    );
  }

  return (
    <article className="store-card">
      <button
        type="button"
        className="store-card-media-btn"
        onClick={() => onPreviewImage(p)}
        aria-label={`Ampliar foto de ${p.name}`}
      >
        {offerLabel && <span className={badgeClass}>{offerLabel}</span>}
        <span className="store-badge-sku">#{p.sku}</span>

        {showImage ? (
          <img
            src={imageSrc!}
            alt={p.name}
            className="store-card-img"
            loading="lazy"
            decoding="async"
            onError={() => onImageError(p.id)}
          />
        ) : (
          <div className="store-card-placeholder">
            <span style={{ fontSize: '36px' }}>{p.commercialGroupIcon || '📦'}</span>
          </div>
        )}
      </button>

      <div className="store-card-body">
        <h3 className="store-card-title" title={p.name}>
          {p.name}
        </h3>

        <div className="store-price-block">
          <div className="store-price-line">
            <span className="store-price-main">{formatIntegerMoney(p.price)}</span>
            {p.isPesable && <span className="store-price-unit">/ kg</span>}
            {p.previousPrice && p.previousPrice > p.price && (
              <span className="store-price-prev">{formatIntegerMoney(p.previousPrice)}</span>
            )}
            {p.isOffer && p.offerDiscount > 0 && p.specialTag && (
              <span className="store-price-discount">-{p.offerDiscount}%</span>
            )}
          </div>

          {hasPieceHint && (
            <div className="store-meta-hint">
              Pieza ~{formatApproxWeight(p.approximateWeight!)} kg · ~
              {formatIntegerMoney(p.estimatedPiecePrice!)}
            </div>
          )}

          {!hasPieceHint && p.unitsPerBox > 1 && (
            <div className="store-meta-hint">Caja x {p.unitsPerBox} un.</div>
          )}
        </div>

        {renderStockAlert(p.stock)}

        <div className="store-card-actions">{actionsNode}</div>
      </div>
    </article>
  );
};
