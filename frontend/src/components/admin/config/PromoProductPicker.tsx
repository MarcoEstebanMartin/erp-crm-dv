import React, { useMemo, useState } from 'react';
import {
  type CatalogProduct,
  formatArsInteger,
  normalizePromoSearch,
} from './weeklyPromo.helpers';

interface PromoProductPickerProps {
  products: CatalogProduct[];
  selectedProductId: number | null;
  searchValue: string;
  excludePesable?: boolean;
  excludeProductIds?: number[];
  placeholder?: string;
  onSearchChange: (value: string) => void;
  onSelect: (product: CatalogProduct) => void;
}

/** Buscador instantáneo sin tildes para seleccionar artículos activos en ofertas semanales. */
export default function PromoProductPicker({
  products,
  selectedProductId,
  searchValue,
  excludePesable = false,
  excludeProductIds = [],
  placeholder = 'Buscar por nombre o SKU...',
  onSearchChange,
  onSelect,
}: PromoProductPickerProps) {
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = normalizePromoSearch(searchValue);
    return products
      .filter((p) => {
        if (p.isActive === false) return false;
        if (excludePesable && p.isPesable) return false;
        if (excludeProductIds.includes(p.id)) return false;
        if (!q) return true;
        return normalizePromoSearch(`${p.name} ${p.sku}`).includes(q);
      })
      .slice(0, 8);
  }, [products, searchValue, excludePesable, excludeProductIds]);

  const selectedProduct = useMemo(
    () => (selectedProductId ? products.find((p) => p.id === selectedProductId) : undefined),
    [products, selectedProductId],
  );

  return (
    <div style={{ position: 'relative' }}>
      <input
        type="search"
        className="input"
        placeholder={placeholder}
        value={searchValue}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 140);
        }}
        onChange={(e) => {
          onSearchChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            marginTop: '4px',
            zIndex: 30,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {matches.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#6B7280', fontSize: '0.82rem' }}>
              Sin coincidencias
            </div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(p);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  background: p.id === selectedProductId ? '#F3F4F6' : 'transparent',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  fontSize: '0.84rem',
                  color: '#111827',
                }}
              >
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span style={{ color: '#6B7280', fontSize: '0.78rem' }}>
                  {formatArsInteger(p.listPrice)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      {selectedProduct && (
        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '4px' }}>
          Lista: {formatArsInteger(selectedProduct.listPrice)}
          {selectedProduct.unitsPerBox && selectedProduct.unitsPerBox > 1
            ? ` · 1 caja = ${selectedProduct.unitsPerBox} u.`
            : ''}
        </div>
      )}
    </div>
  );
}
