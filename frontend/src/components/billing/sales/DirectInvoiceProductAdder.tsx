import React from 'react';
import { formatIntegerARS } from '../../../utils/currency';

interface DirectInvoiceProductAdderProps {
  products: any[];
  selectedDirectProduct: string;
  productSearchInputRef: React.RefObject<HTMLInputElement | null>;
  productQtyInputRef: React.RefObject<HTMLInputElement | null>;
  productSearchQuery: string;
  setProductSearchQuery: (q: string) => void;
  showProductDropdown: boolean;
  setShowProductDropdown: (show: boolean) => void;
  activeProductSuggestionIdx: number;
  setActiveProductSuggestionIdx: React.Dispatch<React.SetStateAction<number>>;
  filteredProducts: any[];
  directProductQty: string;
  setDirectProductQty: (qty: string) => void;
  handleSelectProduct: (prod: any) => void;
  handleAddDirectProduct: () => void;
}

export function DirectInvoiceProductAdder({
  products,
  selectedDirectProduct,
  productSearchInputRef,
  productQtyInputRef,
  productSearchQuery,
  setProductSearchQuery,
  showProductDropdown,
  setShowProductDropdown,
  activeProductSuggestionIdx,
  setActiveProductSuggestionIdx,
  filteredProducts,
  directProductQty,
  setDirectProductQty,
  handleSelectProduct,
  handleAddDirectProduct
}: DirectInvoiceProductAdderProps) {
  const currentSelectedProd = selectedDirectProduct
    ? products.find((p) => p.id === Number(selectedDirectProduct))
    : null;

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <label
          htmlFor="direct-invoice-product-search"
          style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}
        >
          Añadir Producto (Nombre, SKU o Barcode)
        </label>
        {currentSelectedProd && (
          <span style={{ fontSize: '0.78rem', color: '#111827', fontWeight: 600 }}>
            Seleccionado: {currentSelectedProd.name} (Stock: {currentSelectedProd.stock})
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            id="direct-invoice-product-search"
            ref={productSearchInputRef}
            type="text"
            className="input"
            placeholder="Escribí para buscar producto o escaneá código..."
            value={productSearchQuery}
            onChange={(e) => {
              setProductSearchQuery(e.target.value);
              setShowProductDropdown(true);
            }}
            onFocus={() => setShowProductDropdown(true)}
            onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setShowProductDropdown(true);
                setActiveProductSuggestionIdx((prev) =>
                  filteredProducts.length > 0 ? (prev + 1) % filteredProducts.length : 0
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setShowProductDropdown(true);
                setActiveProductSuggestionIdx((prev) =>
                  filteredProducts.length > 0
                    ? (prev - 1 + filteredProducts.length) % filteredProducts.length
                    : 0
                );
              } else if (e.key === 'Enter') {
                if (showProductDropdown && filteredProducts.length > 0) {
                  e.preventDefault();
                  handleSelectProduct(filteredProducts[activeProductSuggestionIdx]);
                  setTimeout(() => productQtyInputRef.current?.focus(), 50);
                }
              }
            }}
            style={{ fontSize: '0.9rem' }}
          />
          {showProductDropdown && filteredProducts.length > 0 && (
            <div
              className="suggestions-list"
              style={{
                position: 'absolute',
                zIndex: 100,
                width: '100%',
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              {filteredProducts.map((p, idx) => {
                const isActive = idx === activeProductSuggestionIdx;
                return (
                  <div
                    key={p.id}
                    className={`suggestion-item ${isActive ? 'active' : ''}`}
                    onMouseDown={() => {
                      handleSelectProduct(p);
                      setTimeout(() => productQtyInputRef.current?.focus(), 50);
                    }}
                    onMouseEnter={() => setActiveProductSuggestionIdx(idx)}
                    style={{
                      backgroundColor: isActive ? '#F3F4F6' : 'inherit',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{p.name}</strong>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {p.minOrderQuantity && p.minOrderQuantity > 1 && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#374151',
                              backgroundColor: '#F3F4F6',
                              border: '1px solid #D1D5DB',
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}
                          >
                            Mín: {p.minOrderQuantity} u.
                          </span>
                        )}
                        <span
                          className="tabular-nums"
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: p.stock > 0 ? '#111827' : '#E30613'
                          }}
                        >
                          Stock: {p.stock}
                        </span>
                      </div>
                    </div>
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginTop: '2px',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center'
                      }}
                    >
                      <span>SKU: {p.sku || 'S/D'}</span>
                      <span>| Precio Lista: {formatIntegerARS(p.listPrice)}</span>
                      {p.isPesable && <span style={{ color: '#4B5563', fontWeight: 600 }}>(Pesable)</span>}
                      {p.unitsPerBox && p.unitsPerBox > 1 && (
                        <span
                          style={{
                            color: '#374151',
                            fontWeight: 600,
                            backgroundColor: '#F9FAFB',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            border: '1px solid #D1D5DB'
                          }}
                        >
                          Caja x{p.unitsPerBox}u
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ width: '100px' }}>
          <input
            ref={productQtyInputRef}
            type="number"
            className="input tabular-nums"
            aria-label="Cantidad a añadir"
            min="1"
            placeholder="Cant"
            value={directProductQty}
            onChange={(e) => setDirectProductQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddDirectProduct();
                setTimeout(() => productSearchInputRef.current?.focus(), 50);
              }
            }}
          />
        </div>

        {currentSelectedProd && currentSelectedProd.unitsPerBox && currentSelectedProd.unitsPerBox > 1 && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '6px 10px',
                whiteSpace: 'nowrap',
                backgroundColor: '#F9FAFB',
                color: '#111827',
                border: '1px solid #D1D5DB'
              }}
              onClick={() => setDirectProductQty(currentSelectedProd.unitsPerBox.toString())}
            >
              1 Caja ({currentSelectedProd.unitsPerBox}u)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '6px 10px',
                whiteSpace: 'nowrap',
                backgroundColor: '#F9FAFB',
                color: '#111827',
                border: '1px solid #D1D5DB'
              }}
              onClick={() => setDirectProductQty((currentSelectedProd.unitsPerBox * 2).toString())}
            >
              2 Cajas ({currentSelectedProd.unitsPerBox * 2}u)
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            handleAddDirectProduct();
            setTimeout(() => productSearchInputRef.current?.focus(), 50);
          }}
        >
          Añadir
        </button>
      </div>
    </div>
  );
}
