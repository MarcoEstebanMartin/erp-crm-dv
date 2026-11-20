import { lazy, Suspense, useMemo, useState } from 'react';
import ProductsList from '../ProductsList';
import StockDashboard from '../StockDashboard';

const WarehouseMap = lazy(() =>
  import('../deposito/WarehouseMap').then((m) => ({ default: m.WarehouseMap })),
);

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
  { id: 'products', label: 'Productos' },
  { id: 'stock', label: 'Stock' },
  { id: 'map', label: 'Mapa WMS' },
  { id: 'inactive_products', label: 'Inactivos' },
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
        aria-label="Catálogo y Stock"
        className="linear-tablist"
        style={{ marginBottom: '20px' }}
      >
        {CATALOG_TABS.map((t) => {
          const isSelected = catalogTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className="linear-tab"
              onClick={() => setCatalogTab(t.id)}
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
        <Suspense fallback={<div style={{ padding: '24px', color: 'var(--text-secondary)' }}>Cargando mapa WMS...</div>}>
          <WarehouseMap
            products={activeProducts}
            onStockUpdated={async () => fetchData()}
            focusLocationCode={focusedMapLocation}
            onClearFocus={() => setFocusedMapLocation(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
