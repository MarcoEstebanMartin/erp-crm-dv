import React, { useState } from 'react';
import ProductsList from '../ProductsList';
import StockDashboard from '../StockDashboard';
import RubrosList from '../RubrosList';
import OffersCatalogGenerator from './OffersCatalogGenerator';

interface ProductsTabProps {
  products: any[];
  fetchData: () => void;
  setProductModal: (modal: any) => void;
  handleUpdateProductInline: (updatedProduct: any) => void;
  onOpenImportZip?: () => void;
  onUploadImage?: (productId: number, file: File) => Promise<void>;
}

export default function ProductsTab({
  products,
  fetchData,
  setProductModal,
  handleUpdateProductInline,
  onOpenImportZip,
  onUploadImage
}: ProductsTabProps) {
  const [catalogTab, setCatalogTab] = useState<'products' | 'inactive_products' | 'rubros' | 'stock' | 'offers'>('products');
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
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'inactive_products' ? 600 : 400, color: catalogTab === 'inactive_products' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('inactive_products')}
        >
          Productos Inactivos
          {catalogTab === 'inactive_products' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
        </div>
        <div 
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'stock' ? 600 : 400, color: catalogTab === 'stock' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('stock')}
        >
          Control y Valorización de Stock
          {catalogTab === 'stock' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
        </div>
        <div 
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'rubros' ? 600 : 400, color: catalogTab === 'rubros' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('rubros')}
        >
          Gestión de Rubros
          {catalogTab === 'rubros' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
        </div>
        <div 
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'offers' ? 600 : 400, color: catalogTab === 'offers' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('offers')}
        >
          Diseño de Ofertas PDF
          {catalogTab === 'offers' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
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

      {catalogTab === 'rubros' && (
        <RubrosList 
          onRubroUpdated={fetchData} 
        />
      )}

      {catalogTab === 'offers' && (
        <OffersCatalogGenerator 
          products={products}
        />
      )}
    </div>
  );
}
