import { useMemo, useState } from 'react';
import ProductsList from '../ProductsList';
import StockDashboard from '../StockDashboard';
import { WarehouseMap } from '../deposito/WarehouseMap';

type CatalogTabId = 'products' | 'inactive_products' | 'stock' | 'map';

interface ProductsTabProps {
  products: any[];
  fetchData: () => void;
  setProductModal: (modal: any) => void;
  handleUpdateProductInline: (updatedProduct: any) => void;
  onUploadImage?: (productId: number, file: File) => Promise<void>;
  initialCatalogTab?: CatalogTabId;
}

const CATALOG_TABS: { id: CatalogTabId; label: string }[] = [
  { id: 'products', label: 'Lista de Productos' },
  { id: 'stock', label: 'Control y Valorización de Stock' },
  { id: 'map', label: 'Mapa de Depósito' },
  { id: 'inactive_products', label: 'Productos Inactivos' },
];

export default function ProductsTab({
  products,
  fetchData,
  setProductModal,
  handleUpdateProductInline,
  onUploadImage,
  initialCatalogTab = 'products',
}: ProductsTabProps) {
  const [catalogTab, setCatalogTab] = useState<CatalogTabId>(initialCatalogTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedMapLocation, setFocusedMapLocation] = useState<string | null>(null);

  const activeProducts = useMemo(
    () => (Array.isArray(products) ? products.filter((p) => p && p.isActive !== false) : []),
    [products],
  );

  return (
    <div style={{ width: '100%' }}>
      <div
        role="tablist"
        aria-label="Secciones de Productos y Stock"
        style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
        }}
      >
        {CATALOG_TABS.map((t) => {
          const isSelected = catalogTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setCatalogTab(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isSelected ? '2px solid var(--color-primary)' : '2px solid transparent',
                borderRadius: 0,
                boxShadow: 'none',
                padding: '8px 2px 12px',
                marginBottom: '-1px',
                fontSize: '0.88rem',
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'color 0.15s ease, border-color 0.15s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {(catalogTab === 'products' || catalogTab === 'inactive_products') && (
        <ProductsList
          products={products}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setProductModal={setProductModal}
          onUpdateProduct={async (updatedProduct: any) => handleUpdateProductInline(updatedProduct)}
          onUploadImage={onUploadImage}
          catalogTab={catalogTab}
        />
      )}

      {catalogTab === 'stock' && (
        <StockDashboard
          products={activeProducts}
          onRefresh={async () => fetchData()}
          onJumpToMapLocation={(loc) => {
            setFocusedMapLocation(loc);
            setCatalogTab('map');
          }}
        />
      )}

      {catalogTab === 'map' && (
        <WarehouseMap
          products={activeProducts}
          onStockUpdated={async () => fetchData()}
          focusLocationCode={focusedMapLocation}
          onClearFocus={() => setFocusedMapLocation(null)}
        />
      )}
    </div>
  );
}
