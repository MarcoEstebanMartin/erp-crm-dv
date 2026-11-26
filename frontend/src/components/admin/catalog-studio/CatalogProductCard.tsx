import { memo } from 'react';
import { Eye, EyeOff, ImageOff, SlidersHorizontal } from 'lucide-react';
import type {
  CatalogBadgeType,
  CatalogStudioProduct,
} from '../../../utils/api/catalog-studio.api';
import { resolveEffectiveMinQtyLabel } from './catalogMinQty.helper';

export function resolveCatalogImageSrc(imageUrl?: string | null): string {
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
  onOpenPhoto: (product: CatalogStudioProduct) => void;
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
  onOpenPhoto,
}: CatalogProductCardProps) {
  const isOferton = product.badge === 'OFERTON';
  const isDestacado = product.badge === 'DESTACADO';
  const outOfStock = product.stock <= 0;
  const imgSrc = resolveCatalogImageSrc(product.imageUrl);
  const effectiveMinQty = resolveEffectiveMinQtyLabel(product.minQty, product.minOrderQuantity);

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
          {effectiveMinQty && <span className="cs-pill cs-pill-warn">Mín. {effectiveMinQty}</span>}
        </div>
      </div>

      <button
        type="button"
        className="cs-card-media cs-card-media-btn"
        aria-label={`${imgSrc ? 'Ver o cambiar imagen' : 'Subir imagen'} de ${product.name}`}
        title={imgSrc ? 'Ver o cambiar imagen' : 'Subir imagen'}
        onClick={() => onOpenPhoto(product)}
      >
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} loading="lazy" decoding="async" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: '#a1a1aa', fontSize: 11 }}>
            <ImageOff size={18} />
            <span>Sin foto</span>
          </div>
        )}
      </button>

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
