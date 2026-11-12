import { useState } from 'react';
import { Printer, Search } from 'lucide-react';
import ProductsList from '../ProductsList';
import StockDashboard from '../StockDashboard';
import { WarehouseMap } from '../deposito/WarehouseMap';

interface ProductsTabProps {
  products: any[];
  fetchData: () => void;
  setProductModal: (modal: any) => void;
  handleUpdateProductInline: (updatedProduct: any) => void;
  onOpenImportZip?: () => void;
  onUploadImage?: (productId: number, file: File) => Promise<void>;
  onOpenPriceListModal?: () => void;
  onOpenQuickSearchModal?: () => void;
  initialCatalogTab?: 'products' | 'inactive_products' | 'stock' | 'map';
}

export default function ProductsTab({
  products,
  fetchData,
  setProductModal,
  handleUpdateProductInline,
  onOpenImportZip,
  onUploadImage,
  onOpenPriceListModal,
  onOpenQuickSearchModal,
  initialCatalogTab = 'products',
}: ProductsTabProps) {
  const [catalogTab, setCatalogTab] = useState<'products' | 'inactive_products' | 'stock' | 'map'>(initialCatalogTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedMapLocation, setFocusedMapLocation] = useState<string | null>(null);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { id: 'products', label: 'Lista de Productos' },
            { id: 'stock', label: 'Control y Valorización de Stock' },
            { id: 'map', label: '🗺️ Mapa Interactivo Depósito' },
            { id: 'inactive_products', label: 'Productos Inactivos' },
          ].map((t) => (
            <div
              key={t.id}
              style={{ cursor: 'pointer', fontWeight: catalogTab === t.id ? 600 : 400, color: catalogTab === t.id ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
              onClick={() => setCatalogTab(t.id as any)}
            >
              {t.label}
              {catalogTab === t.id && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onOpenQuickSearchModal && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onOpenQuickSearchModal}>
              <Search size={14} />
              <span>Consulta Rápida (Ctrl+Q)</span>
            </button>
          )}
          {onOpenPriceListModal && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={onOpenPriceListModal}>
              <Printer size={14} />
              <span>Imprimir Lista 4 Oficial</span>
            </button>
          )}
        </div>
      </div>

      {(catalogTab === 'products' || catalogTab === 'inactive_products') && (
        <ProductsList
          products={products}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setProductModal={setProductModal}
          onUpdateProduct={async (updatedProduct: any) => handleUpdateProductInline(updatedProduct)}
          onOpenImportZip={onOpenImportZip}
          onUploadImage={onUploadImage}
          catalogTab={catalogTab}
        />
      )}

      {catalogTab === 'stock' && (
        <StockDashboard
          products={products}
          onRefresh={async () => fetchData()}
          onJumpToMapLocation={(loc) => {
            setFocusedMapLocation(loc);
            setCatalogTab('map');
          }}
        />
      )}
      {catalogTab === 'map' && (
        <WarehouseMap
          products={products}
          onStockUpdated={async () => fetchData()}
          focusLocationCode={focusedMapLocation}
          onClearFocus={() => setFocusedMapLocation(null)}
        />
      )}
    </div>
  );
}
