import React, { useMemo, useState } from 'react';
import {
  type CartItem,
  type CatalogViewMode,
  type StoreCategoryGroup,
  type StoreProduct,
  groupProductsByCategory,
} from './portal.types';
import { PortalProductCard } from './PortalProductCard';
import { PortalImageLightbox } from './PortalImageLightbox';

interface PortalCatalogViewProps {
  products: StoreProduct[];
  filteredProducts: StoreProduct[];
  commercialGroups: StoreCategoryGroup[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
  onlyOffers: boolean;
  setOnlyOffers: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isLoadingCatalog: boolean;
  cart: CartItem[];
  imageErrors: Record<number, boolean>;
  onImageError: (productId: number) => void;
  onAddToCart: (product: StoreProduct, qty?: number) => void;
  onUpdateQty: (productId: number, qty: number) => void;
}

export const PortalCatalogView: React.FC<PortalCatalogViewProps> = ({
  products,
  filteredProducts,
  commercialGroups,
  selectedGroupId,
  onSelectGroup,
  onlyOffers,
  setOnlyOffers,
  searchQuery,
  setSearchQuery,
  isLoadingCatalog,
  cart,
  imageErrors,
  onImageError,
  onAddToCart,
  onUpdateQty,
}) => {
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [previewProduct, setPreviewProduct] = useState<StoreProduct | null>(null);

  const offersCount = useMemo(() => products.filter((p) => p.isOffer).length, [products]);

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    map.set('all', products.length);
    for (const p of products) {
      const gid = p.commercialGroupId || 'otros';
      map.set(gid, (map.get(gid) || 0) + 1);
    }
    return map;
  }, [products]);

  const cartQtyMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of cart) {
      map.set(item.product.id, item.quantity);
    }
    return map;
  }, [cart]);

  const sections = useMemo(() => {
    if (selectedGroupId !== 'all') return null;
    return groupProductsByCategory(filteredProducts, commercialGroups);
  }, [filteredProducts, commercialGroups, selectedGroupId]);

  const renderProductsContainer = (items: StoreProduct[]) => (
    <div className={viewMode === 'grid' ? 'store-product-grid' : 'store-product-list'}>
      {items.map((p) => (
        <PortalProductCard
          key={p.id}
          product={p}
          viewMode={viewMode}
          currentQty={cartQtyMap.get(p.id) || 0}
          hasImageError={Boolean(imageErrors[p.id])}
          onImageError={onImageError}
          onPreviewImage={setPreviewProduct}
          onAddToCart={onAddToCart}
          onUpdateQty={onUpdateQty}
        />
      ))}
    </div>
  );

  return (
    <main className="store-catalog-main">
      <div className="store-sticky-bar">
        <div className="store-toolbar-row">
          <div className="store-search-wrap">
            <span className="store-search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              type="search"
              placeholder="Buscar fiambres, quesos, bebidas, almacén o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="store-search-input"
              aria-label="Buscar productos"
            />
            {searchQuery && (
              <button
                type="button"
                className="store-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOnlyOffers(!onlyOffers)}
            className={`store-offer-toggle ${onlyOffers ? 'active' : ''}`}
          >
            <span>🔥</span>
            <span>Ofertas</span>
            {offersCount > 0 && <span className="store-cat-count">{offersCount}</span>}
          </button>

          <div className="store-view-switcher" role="group" aria-label="Modo de visualización">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`store-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              aria-pressed={viewMode === 'grid'}
            >
              ⊞ Grilla
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`store-view-btn ${viewMode === 'list' ? 'active' : ''}`}
              aria-pressed={viewMode === 'list'}
            >
              ☰ Lista
            </button>
          </div>
        </div>

        <div className="store-categories-bar" role="tablist" aria-label="Categorías">
          {commercialGroups.map((g) => {
            const count = groupCounts.get(g.id) || 0;
            const isActive = selectedGroupId === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectGroup(g.id)}
                className={`store-cat-pill ${isActive ? 'active' : ''}`}
              >
                <span className="store-cat-emoji" aria-hidden="true">
                  {g.icon}
                </span>
                <span>{g.name}</span>
                <span className="store-cat-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {isLoadingCatalog ? (
        <div className="store-state-box">Cargando catálogo...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="store-state-box">
          No se encontraron productos con los filtros aplicados.
        </div>
      ) : sections ? (
        sections.map((section, idx) => (
          <section
            key={section.id}
            className={`store-section ${idx >= 1 ? 'store-section-deferred' : ''}`}
          >
            <div className="store-section-header">
              <h2 className="store-section-title">
                <span aria-hidden="true">{section.icon}</span>
                <span>{section.name}</span>
              </h2>
              <span className="store-section-count">
                {section.products.length}{' '}
                {section.products.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>
            {renderProductsContainer(section.products)}
          </section>
        ))
      ) : (
        renderProductsContainer(filteredProducts)
      )}

      <PortalImageLightbox product={previewProduct} onClose={() => setPreviewProduct(null)} />
    </main>
  );
};
