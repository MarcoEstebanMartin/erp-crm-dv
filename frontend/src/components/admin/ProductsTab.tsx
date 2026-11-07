import React, { useState } from 'react';
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
  initialCatalogTab?: 'products' | 'inactive_products' | 'stock' | 'map';
}

export default function ProductsTab({
  products,
  fetchData,
  setProductModal,
  handleUpdateProductInline,
  onOpenImportZip,
  onUploadImage,
  initialCatalogTab = 'products'
}: ProductsTabProps) {
  const [catalogTab, setCatalogTab] = useState<'products' | 'inactive_products' | 'stock' | 'map'>(initialCatalogTab);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <div 
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'products' ? 600 : 400, color: catalogTab === 'products' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('products')}
        >
          Lista de Productos
          {catalogTab === 'products' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
        </div>
        <div 
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'stock' ? 600 : 400, color: catalogTab === 'stock' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('stock')}
        >
          Control y Valorización de Stock
          {catalogTab === 'stock' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
        </div>
        <div 
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'map' ? 600 : 400, color: catalogTab === 'map' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('map')}
        >
          🗺️ Mapa Interactivo Depósito
          {catalogTab === 'map' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
        </div>
        <div 
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'inactive_products' ? 600 : 400, color: catalogTab === 'inactive_products' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('inactive_products')}
        >
          Productos Inactivos
          {catalogTab === 'inactive_products' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
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
        />
      )}

      {catalogTab === 'map' && (
        <WarehouseMap
          products={products}
          onStockUpdated={async () => fetchData()}
        />
      )}

    </div>
  );
}
