import React from 'react';
import { X } from 'lucide-react';
import { calculateExactLineSubtotalInt } from '../../../utils/weeklyPromoCartEvaluator';

interface CreditNoteCartSectionProps {
  creditNoteForm: any;
  creditNoteCart: any[];
  setCreditNoteCart: React.Dispatch<React.SetStateAction<any[]>>;
  selectedCNClient: any;
  cnProductSearchQuery: string;
  setCnProductSearchQuery: (q: string) => void;
  filteredCNProducts: any[];
  showCNProductDropdown: boolean;
  setShowCNProductDropdown: (open: boolean) => void;
  activeCNProductSuggestionIdx: number;
  setActiveCNProductSuggestionIdx: React.Dispatch<React.SetStateAction<number>>;
  onSelectCNProduct: (product: any) => void;
  cnProductPrice: string;
  setCnProductPrice: (val: string) => void;
  cnProductQty: string;
  setCnProductQty: (val: string) => void;
  cnProductWeight: string;
  setCnProductWeight: (val: string) => void;
  onAddCNProduct: () => void;
  onRemoveCNProduct: (productId: number) => void;
}

/**
 * Selector de productos y tabla editable de renglones con cálculo entero exacto para Notas de Crédito.
 */
export function CreditNoteCartSection({
  creditNoteForm,
  creditNoteCart,
  setCreditNoteCart,
  selectedCNClient,
  cnProductSearchQuery,
  setCnProductSearchQuery,
  filteredCNProducts,
  showCNProductDropdown,
  setShowCNProductDropdown,
  activeCNProductSuggestionIdx,
  setActiveCNProductSuggestionIdx,
  onSelectCNProduct,
  cnProductPrice,
  setCnProductPrice,
  cnProductQty,
  setCnProductQty,
  cnProductWeight,
  setCnProductWeight,
  onAddCNProduct,
  onRemoveCNProduct,
}: CreditNoteCartSectionProps) {
  const updateCartItemField = (
    idx: number,
    patch: { unitPrice?: number; quantity?: number; weight?: number },
  ) => {
    setCreditNoteCart((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (!current) return prev;
      const updated = { ...current, ...patch };
      updated.subtotal = calculateExactLineSubtotalInt({
        unitPriceInt: updated.unitPrice,
        quantity: updated.quantity,
        isPesable: Boolean(updated.isPesable),
        weight: updated.weight,
        approximateWeight: updated.approximateWeight,
      });
      next[idx] = updated;
      return next;
    });
  };

  return (
    <>
      {selectedCNClient && !creditNoteForm.orderId && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
            gap: '8px',
            alignItems: 'end',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px',
          }}
        >
          <div className="form-group" style={{ margin: 0, position: 'relative' }}>
            <label htmlFor="cn-product-search">Añadir Producto</label>
            <input
              id="cn-product-search"
              type="search"
              className="input"
              placeholder="Escribí para buscar..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={cnProductSearchQuery}
              onChange={(e) => {
                setCnProductSearchQuery(e.target.value);
                setShowCNProductDropdown(true);
              }}
              onFocus={() => setShowCNProductDropdown(true)}
              onBlur={() => setTimeout(() => setShowCNProductDropdown(false), 250)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setShowCNProductDropdown(true);
                  setActiveCNProductSuggestionIdx((prev) =>
                    filteredCNProducts.length > 0 ? (prev + 1) % filteredCNProducts.length : 0,
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setShowCNProductDropdown(true);
                  setActiveCNProductSuggestionIdx((prev) =>
                    filteredCNProducts.length > 0
                      ? (prev - 1 + filteredCNProducts.length) % filteredCNProducts.length
                      : 0,
                  );
                } else if (e.key === 'Enter') {
                  if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;
                  if (showCNProductDropdown && filteredCNProducts.length > 0) {
                    e.preventDefault();
                    onSelectCNProduct(filteredCNProducts[activeCNProductSuggestionIdx]);
                  }
                }
              }}
            />
            {showCNProductDropdown && filteredCNProducts.length > 0 && (
              <div
                className="suggestions-list"
                style={{
                  position: 'absolute',
                  zIndex: 100,
                  width: '100%',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  backgroundColor: '#fff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              >
                {filteredCNProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`suggestion-item ${idx === activeCNProductSuggestionIdx ? 'active' : ''}`}
                    onMouseDown={() => onSelectCNProduct(p)}
                    onMouseEnter={() => setActiveCNProductSuggestionIdx(idx)}
                    style={{
                      padding: '8px',
                      cursor: 'pointer',
                      backgroundColor: idx === activeCNProductSuggestionIdx ? '#e8f0fe' : '#fff',
                    }}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="cn-product-price">Precio</label>
            <input
              id="cn-product-price"
              type="number"
              step="0.01"
              className="input"
              value={cnProductPrice}
              onChange={(e) => setCnProductPrice(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="cn-product-qty">Cantidad</label>
            <input
              id="cn-product-qty"
              type="number"
              className="input"
              value={cnProductQty}
              onChange={(e) => setCnProductQty(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="cn-product-weight">Kilos (Pesables)</label>
            <input
              id="cn-product-weight"
              type="number"
              step="0.001"
              className="input"
              value={cnProductWeight}
              onChange={(e) => setCnProductWeight(e.target.value)}
              placeholder="Kilos"
            />
          </div>

          <button type="button" className="btn btn-primary" onClick={onAddCNProduct}>
            Añadir
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          backgroundColor: '#fff',
        }}
      >
        {creditNoteCart.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No hay productos agregados en el detalle.
          </div>
        ) : (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Producto</th>
                <th>P. Unitario</th>
                <th>Cantidad</th>
                <th>Kilos</th>
                <th>Importe</th>
                <th style={{ width: '40px' }} />
              </tr>
            </thead>
            <tbody>
              {creditNoteCart.map((item, idx) => (
                <tr key={idx}>
                  <td>
                    <strong>{item.name}</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      SKU: {item.sku}
                    </div>
                  </td>
                  <td>
                    {creditNoteForm.orderId ? (
                      <span>${Number(item.unitPrice).toLocaleString('es-AR')}</span>
                    ) : (
                      <input
                        type="number"
                        className="input"
                        style={{ padding: '4px', maxWidth: '100px' }}
                        value={item.unitPrice}
                        onChange={(e) => updateCartItemField(idx, { unitPrice: Number(e.target.value) })}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      style={{ padding: '4px', maxWidth: '80px' }}
                      min="0"
                      max={item.orderQuantity}
                      value={item.quantity}
                      onChange={(e) => updateCartItemField(idx, { quantity: Number(e.target.value) })}
                    />
                    {item.orderQuantity && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                        Máx: {item.orderQuantity}
                      </span>
                    )}
                  </td>
                  <td>
                    {item.isPesable ? (
                      <input
                        type="number"
                        step="0.001"
                        className="input"
                        style={{ padding: '4px', maxWidth: '100px' }}
                        min="0"
                        max={item.orderWeight}
                        value={item.weight || ''}
                        onChange={(e) => updateCartItemField(idx, { weight: Number(e.target.value) })}
                      />
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>N/A</span>
                    )}
                    {item.orderWeight && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block' }}>
                        Máx: {item.orderWeight} kg
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>${Number(item.subtotal).toLocaleString('es-AR')}</td>
                  <td>
                    {!creditNoteForm.orderId && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ color: 'var(--color-danger)', padding: '2px' }}
                        onClick={() => onRemoveCNProduct(item.productId)}
                        aria-label={`Quitar ${item.name}`}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
