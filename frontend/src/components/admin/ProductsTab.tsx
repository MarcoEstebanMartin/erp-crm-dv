import React, { useState } from 'react';
import ProductsList from '../ProductsList';
import StockDashboard from '../StockDashboard';
import RubrosList from '../RubrosList';

interface ProductsTabProps {
  products: any[];
  fetchData: () => void;
  setProductModal: (modal: any) => void;
  handleUpdateProductInline: (updatedProduct: any) => void;
}

export default function ProductsTab({
  products,
  fetchData,
  setProductModal,
  handleUpdateProductInline
}: ProductsTabProps) {
  const [catalogTab, setCatalogTab] = useState<'products' | 'rubros' | 'stock'>('products');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
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
          style={{ cursor: 'pointer', fontWeight: catalogTab === 'rubros' ? 600 : 400, color: catalogTab === 'rubros' ? 'var(--color-primary)' : 'var(--text-secondary)', position: 'relative' }}
          onClick={() => setCatalogTab('rubros')}
        >
          Gestión de Rubros
          {catalogTab === 'rubros' && <div style={{ position: 'absolute', bottom: '-13px', left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-primary)' }} />}
        </div>
      </div>

      {catalogTab === 'products' && (
        <ProductsList 
          products={products} 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          setProductModal={setProductModal}
          onUpdateProduct={async (updatedProduct: any) => handleUpdateProductInline(updatedProduct)}
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
    </div>
  );
}
