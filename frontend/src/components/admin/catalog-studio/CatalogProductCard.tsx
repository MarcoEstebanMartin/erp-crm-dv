import { memo } from 'react';
import { Eye, EyeOff, ImageOff, SlidersHorizontal } from 'lucide-react';
import type {
  CatalogBadgeType,
  CatalogStudioProduct,
} from '../../../utils/api/catalog-studio.api';

function resolveImageSrc(imageUrl?: string | null): string {
  if (!imageUrl) return '';
  const trimmed = imageUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) return trimmed;
  return `/uploads/products/${trimmed}`;
}

interface CatalogProductCardProps {
  product: CatalogStudioProduct;
  saving: boolean;
  onToggleBadge: (product: CatalogStudioProduct, badge: CatalogBadgeType) => void;
  onToggleVisible: (product: CatalogStudioProduct) => void;
  onOpenEdit: (product: CatalogStudioProduct) => void;
}

function formatArs(value: number): string {
  return `$${Math.round(value).toLocaleString('es-AR')}`;
}

export const CatalogProductCard = memo(function CatalogProductCard({
  product,
  saving,
  onToggleBadge,
  onToggleVisible,
  onOpenEdit,
}: CatalogProductCardProps) {
  const isOferton = product.badge === 'OFERTON';
  const isDestacado = product.badge === 'DESTACADO';
  const outOfStock = product.stock <= 0;
  const lowMargin = product.marginPct !== null && product.marginPct <= 0;
  const imgSrc = resolveImageSrc(product.imageUrl);

  const cardClasses = [
    'cs-card',
    isOferton ? 'is-oferton' : '',
    isDestacado ? 'is-destacado' : '',
    !product.catalogVisible ? 'is-hidden-pdf' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={cardClasses}>
      <div className="cs-card-top">
        <span className="cs-pill">{product.sku}</span>
        <div className="cs-meta-pills">
          {outOfStock && <span className="cs-pill cs-pill-danger">Sin stock</span>}
          {product.marginPct !== null && (
            <span className={`cs-pill ${lowMargin ? 'cs-pill-danger' : ''}`}>
              {product.marginPct > 0 ? `+${product.marginPct}%` : `${product.marginPct}%`}
            </span>
          )}
          {product.minQty && <span className="cs-pill cs-pill-warn">Mín. {product.minQty}</span>}
        </div>
      </div>

      <div className="cs-card-media">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} loading="lazy" decoding="async" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#a1a1aa', fontSize: 11 }}>
            <ImageOff size={18} />
            <span>Sin foto</span>
          </div>
        )}
      </div>

      <div className="cs-card-name">{product.name}</div>

      {product.varieties && (
        <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
          {product.varieties}
        </div>
      )}

      <div className="cs-price-row">
        <div>
          <span className="cs-price">{formatArs(product.price)}</span>
          {product.showOldPrice && product.oldPrice && product.oldPrice > product.price && (
            <span className="cs-old-price">{formatArs(product.oldPrice)}</span>
          )}
        </div>
      </div>

      <div className="cs-card-actions">
        <button
          type="button"
          className={`cs-chip-btn ${isOferton ? 'active-oferton' : ''}`}
          disabled={saving}
          onClick={() => onToggleBadge(product, isOferton ? null : 'OFERTON')}
        >
          Ofertón
        </button>
        <button
          type="button"
          className={`cs-chip-btn ${isDestacado ? 'active-destacado' : ''}`}
          disabled={saving}
          onClick={() => onToggleBadge(product, isDestacado ? null : 'DESTACADO')}
        >
          Destacado
        </button>
        <button
          type="button"
          className="cs-icon-btn"
          title={product.catalogVisible ? 'Ocultar del PDF' : 'Mostrar en PDF'}
          aria-label={product.catalogVisible ? 'Ocultar del PDF' : 'Mostrar en PDF'}
          disabled={saving}
          onClick={() => onToggleVisible(product)}
        >
          {product.catalogVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          type="button"
          className="cs-icon-btn"
          title="Editar ficha"
          aria-label="Editar ficha"
          disabled={saving}
          onClick={() => onOpenEdit(product)}
        >
          <SlidersHorizontal size={14} />
        </button>
      </div>
    </article>
  );
});
