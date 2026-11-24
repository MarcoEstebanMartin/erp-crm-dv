import React, { useEffect, useRef } from 'react';
import {
  type StoreProduct,
  formatApproxWeight,
  formatIntegerMoney,
  resolveProductImageSrc,
} from './portal.types';

interface PortalImageLightboxProps {
  product: StoreProduct | null;
  onClose: () => void;
}

export const PortalImageLightbox: React.FC<PortalImageLightboxProps> = ({ product, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (product) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [product]);

  // Fallback de light-dismiss para navegadores sin soporte nativo de `closedby="any"`
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) dialog.close();
    };

    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('pointerup', onUp);
    return () => {
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('pointerup', onUp);
    };
  }, []);

  const imageSrc = product ? resolveProductImageSrc(product.imageUrl) : null;

  return (
    <dialog
      ref={dialogRef}
      className="store-lightbox"
      aria-labelledby="store-lightbox-title"
      closedby="any"
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = '';
        onClose();
      }}
    >
      {product && (
        <>
          <div className="store-lightbox-head">
            <h2 id="store-lightbox-title" className="store-lightbox-title">
              {product.name}
            </h2>
            <form method="dialog">
              <button
                type="submit"
                className="store-lightbox-close"
                aria-label="Cerrar imagen"
                autoFocus
              >
                ✕
              </button>
            </form>
          </div>

          <div className="store-lightbox-body">
            {imageSrc ? (
              <img src={imageSrc} alt={product.name} className="store-lightbox-img" />
            ) : (
              <div className="store-card-placeholder" style={{ padding: '48px 0' }}>
                <span style={{ fontSize: '48px' }}>{product.commercialGroupIcon || '📦'}</span>
              </div>
            )}

            <div className="store-lightbox-foot">
              <span style={{ color: '#64748b', fontWeight: 600 }}>#{product.sku}</span>
              <div style={{ textAlign: 'right' }}>
                <span className="store-price-main" style={{ fontSize: '20px' }}>
                  {formatIntegerMoney(product.price)}
                </span>
                {product.isPesable && <span className="store-price-unit"> / kg</span>}
                {product.isPesable &&
                  product.approximateWeight &&
                  product.estimatedPiecePrice && (
                    <div className="store-meta-hint">
                      Pieza ~{formatApproxWeight(product.approximateWeight)} kg · ~
                      {formatIntegerMoney(product.estimatedPiecePrice)}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
};
