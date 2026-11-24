import React from 'react';
import { X } from 'lucide-react';
import { calculateExactLineSubtotalInt } from '../../../utils/weeklyPromoCartEvaluator';
import type { CreditNoteCartItem } from './creditNoteCart.helpers';

interface CreditNoteCartSectionProps {
  creditNoteForm: any;
  creditNoteCart: CreditNoteCartItem[];
  setCreditNoteCart: React.Dispatch<React.SetStateAction<CreditNoteCartItem[]>>;
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
  const isLinkedOrder = Boolean(creditNoteForm.orderId);
  const canEditLinkedUnitPrice = creditNoteForm.reason !== 'DEVOLUCION';

  const updateCartItemField = (
    idx: number,
    patch: { selected?: boolean; unitPrice?: number; quantity?: number; weight?: number },
  ) => {
    setCreditNoteCart((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (!current) return prev;
      const updated: CreditNoteCartItem = { ...current, ...patch };

      if (patch.quantity !== undefined && patch.quantity > 0 && updated.selected === false) {
        updated.selected = true;
      }
      if (patch.selected === true && updated.quantity <= 0 && (updated.remainingReturnableQuantity ?? 0) > 0) {
        updated.quantity = updated.remainingReturnableQuantity || 1;
        if (updated.isPesable && updated.orderWeight) {
          updated.weight = updated.orderWeight;
        }
      }

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

  const handleToggleAllLinkedItems = (selectAll: boolean) => {
    setCreditNoteCart((prev) =>
      prev.map((item) => {
        const maxQty =
          creditNoteForm.reason === 'DEVOLUCION'
            ? Number(item.remainingReturnableQuantity ?? item.orderQuantity ?? 0)
            : Number(item.orderQuantity ?? item.quantity ?? 1);
        const canSelect = selectAll && maxQty > 0;
        const nextQty = canSelect ? (item.quantity > 0 ? item.quantity : maxQty) : item.quantity;
        const nextWeight =
          canSelect && item.isPesable ? (item.weight && item.weight > 0 ? item.weight : item.orderWeight ?? null) : item.weight;
        return {
          ...item,
          selected: canSelect,
          quantity: nextQty,
          weight: nextWeight,
          subtotal: calculateExactLineSubtotalInt({
            unitPriceInt: item.unitPrice,
            quantity: nextQty,
            isPesable: Boolean(item.isPesable),
            weight: nextWeight,
            approximateWeight: item.approximateWeight,
          }),
        };
      }),
    );
  };

  return (
    <>
      {selectedCNClient && !isLinkedOrder && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 0.8fr 0.9fr auto',
            gap: '8px',
            alignItems: 'end',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '12px',
          }}
        >
          <div className="form-group" style={{ margin: 0, position: 'relative' }}>
            <label htmlFor="cn-product-search" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Producto
            </label>
            <input
              id="cn-product-search"
              type="search"
              className="input"
              placeholder="Buscar producto..."
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
              onBlur={() => setTimeout(() => setShowCNProductDropdown(false), 200)}
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
                  borderRadius: '6px',
                  marginTop: '2px',
                }}
              >
                {filteredCNProducts.map((p, idx) => (
                  <div
                    key={p.id}
                    className={`suggestion-item ${idx === activeCNProductSuggestionIdx ? 'active' : ''}`}
                    onMouseDown={() => onSelectCNProduct(p)}
                    onMouseEnter={() => setActiveCNProductSuggestionIdx(idx)}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      backgroundColor: idx === activeCNProductSuggestionIdx ? '#f3f4f6' : '#fff',
                    }}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="cn-product-price" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Precio
            </label>
            <input
              id="cn-product-price"
              type="number"
              inputMode="decimal"
              step="1"
              className="input tabular-nums"
              value={cnProductPrice}
              onChange={(e) => setCnProductPrice(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="cn-product-qty" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Cant.
            </label>
            <input
              id="cn-product-qty"
              type="number"
              inputMode="numeric"
              className="input tabular-nums"
              value={cnProductQty}
              onChange={(e) => setCnProductQty(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="cn-product-weight" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
              Kilos
            </label>
            <input
              id="cn-product-weight"
              type="number"
              inputMode="decimal"
              step="0.001"
              className="input tabular-nums"
              value={cnProductWeight}
              onChange={(e) => setCnProductWeight(e.target.value)}
              placeholder="kg"
            />
          </div>

          <button type="button" className="btn btn-primary" onClick={onAddCNProduct}>
            Agregar
          </button>
        </div>
      )}

      {isLinkedOrder && creditNoteCart.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>
            Ítems de la factura
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '3px 9px', fontSize: '0.76rem' }}
              onClick={() => handleToggleAllLinkedItems(true)}
            >
              Seleccionar todo
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '3px 9px', fontSize: '0.76rem', color: '#6b7280' }}
              onClick={() => handleToggleAllLinkedItems(false)}
            >
              Limpiar
            </button>
          </div>
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
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            {selectedCNClient ? 'Sin ítems en el detalle' : 'Seleccioná un cliente'}
          </div>
        ) : (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                {isLinkedOrder && <th scope="col" style={{ width: '34px' }} />}
                <th scope="col">Producto</th>
                <th scope="col" style={{ textAlign: 'right' }}>P. Unit</th>
                <th scope="col" style={{ textAlign: 'right' }}>Cant.</th>
                <th scope="col" style={{ textAlign: 'right' }}>Kilos</th>
                <th scope="col" style={{ textAlign: 'right' }}>Importe</th>
                {!isLinkedOrder && <th scope="col" style={{ width: '36px' }} />}
              </tr>
            </thead>
            <tbody>
              {creditNoteCart.map((item, idx) => {
                const isSelected = item.selected !== false;
                const maxQty =
                  creditNoteForm.reason === 'DEVOLUCION'
                    ? item.remainingReturnableQuantity ?? item.orderQuantity
                    : item.orderQuantity;
                const exhausted = isLinkedOrder && creditNoteForm.reason === 'DEVOLUCION' && maxQty === 0;

                return (
                  <tr
                    key={`${item.productId}-${idx}`}
                    style={{ opacity: isSelected ? 1 : 0.45 }}
                  >
                    {isLinkedOrder && (
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={exhausted}
                          aria-label={`Incluir ${item.name}`}
                          onChange={(e) => updateCartItemField(idx, { selected: e.target.checked })}
                        />
                      </td>
                    )}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#111827' }}>{item.name}</div>
                      {isLinkedOrder && (item.alreadyReturnedQuantity ?? 0) > 0 && (
                        <div className="tabular-nums" style={{ fontSize: '0.72rem', color: '#92400e' }}>
                          Devueltos: {item.alreadyReturnedQuantity}/{item.orderQuantity}
                        </div>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      {isLinkedOrder && !canEditLinkedUnitPrice ? (
                        <span>${Math.round(Number(item.unitPrice)).toLocaleString('es-AR')}</span>
                      ) : (
                        <input
                          type="number"
                          inputMode="decimal"
                          className="input tabular-nums"
                          style={{ padding: '4px 6px', maxWidth: '96px', textAlign: 'right', marginLeft: 'auto' }}
                          disabled={!isSelected}
                          value={item.unitPrice}
                          onChange={(e) => updateCartItemField(idx, { unitPrice: Number(e.target.value) })}
                        />
                      )}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="input tabular-nums"
                        style={{ padding: '4px 6px', maxWidth: '72px', textAlign: 'right', marginLeft: 'auto' }}
                        min="0"
                        max={maxQty}
                        disabled={!isSelected || exhausted}
                        value={item.quantity}
                        onChange={(e) => updateCartItemField(idx, { quantity: Number(e.target.value) })}
                      />
                      {maxQty !== undefined && (
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block' }}>
                          Máx {maxQty}
                        </span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      {item.isPesable ? (
                        <>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.001"
                            className="input tabular-nums"
                            style={{ padding: '4px 6px', maxWidth: '86px', textAlign: 'right', marginLeft: 'auto' }}
                            min="0"
                            max={item.orderWeight ?? undefined}
                            disabled={!isSelected || exhausted}
                            value={item.weight ?? ''}
                            onChange={(e) => updateCartItemField(idx, { weight: Number(e.target.value) })}
                          />
                          {item.orderWeight !== null && item.orderWeight !== undefined && (
                            <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block' }}>
                              Máx {item.orderWeight} kg
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ${(isSelected ? Math.round(Number(item.subtotal)) : 0).toLocaleString('es-AR')}
                    </td>
                    {!isLinkedOrder && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ color: 'var(--color-danger)', padding: '2px' }}
                          onClick={() => onRemoveCNProduct(item.productId)}
                          aria-label={`Quitar ${item.name}`}
                        >
                          <X size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
