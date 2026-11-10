import React from 'react';
import type { CartItem, StoreProduct } from './portal.types';
import { portalCatalogFilterStyles as styles } from './portalCatalogFilter.styles';
import { PortalProductCard } from './PortalProductCard';

interface PortalCatalogViewProps {
  products: StoreProduct[];
  filteredProducts: StoreProduct[];
  commercialGroups: any[];
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
  onUpdateQty
}) => {
  return (
    <div style={styles.tabContent}>
      <div style={styles.filterSection}>
        <input
          type="text"
          placeholder="Buscar producto por nombre, SKU o marca..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.catalogSearchInput}
        />

        <button
          onClick={() => setOnlyOffers(!onlyOffers)}
          style={{
            ...styles.btnFilterOffer,
            ...(onlyOffers ? styles.btnFilterOfferActive : {})
          }}
        >
          🔥 Solo Ofertas Destacadas
        </button>
      </div>

      <div style={styles.commercialGroupTabsContainer}>
        {commercialGroups.map((g) => {
          const count =
            g.id === 'all'
              ? products.length
              : g.id === 'bultos'
                ? products.filter((p) => (p.unitsPerBox || 1) > 1).length
                : products.filter((p) => p.commercialGroupId === g.id).length;

          return (
            <button
              key={g.id}
              onClick={() => onSelectGroup(g.id)}
              style={{
                ...styles.commercialGroupTab,
                ...(selectedGroupId === g.id ? styles.commercialGroupTabActive : {})
              }}
            >
              <span style={{ fontSize: '18px' }}>{g.icon}</span>
              <span style={{ fontWeight: 600 }}>{g.name}</span>
              <span style={styles.groupCountBadge}>{count}</span>
            </button>
          );
        })}
      </div>

      {isLoadingCatalog ? (
        <div style={styles.loadingBox}>Cargando catálogo de productos...</div>
      ) : filteredProducts.length === 0 ? (
        <div style={styles.emptyBox}>
          No se encontraron productos en este grupo comercial con los filtros aplicados.
        </div>
      ) : (
        <div style={styles.productGrid}>
          {filteredProducts.map((p) => {
            const itemInCart = cart.find((c) => c.product.id === p.id);
            const currentQty = itemInCart ? itemInCart.quantity : 0;

            return (
              <PortalProductCard
                key={p.id}
                product={p}
                currentQty={currentQty}
                hasImageError={Boolean(imageErrors[p.id])}
                onImageError={onImageError}
                onAddToCart={onAddToCart}
                onUpdateQty={onUpdateQty}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
