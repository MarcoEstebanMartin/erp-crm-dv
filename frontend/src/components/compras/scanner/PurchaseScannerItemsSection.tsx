import type { FC } from 'react';
import { Search, CornerDownRight } from 'lucide-react';

interface PurchaseScannerItemsSectionProps {
  items: any[];
  activeSearchIndex: number | null;
  setActiveSearchIndex: (idx: number | null) => void;
  productSearchQueries: Record<number, string>;
  productSearchResults: Record<number, any[]>;
  onProductSearch: (idx: number, query: string) => void;
  onSelectProduct: (idx: number, product: any) => void;
  onUpdateItemField: (idx: number, field: 'unitsPerPack' | 'quantity' | 'unitPrice', rawVal: string) => void;
  onToggleNonStock: (idx: number) => void;
  onMarkAllNonStock: (nonStock: boolean) => void;
}

function getMatchBadge(item: any): { label: string; bg: string; color: string } {
  if (item.isNonStock) return { label: 'Gasto (Sin Stock)', bg: 'var(--accent-bg-light)', color: 'var(--text-secondary)' };
  switch (item.matchMethod) {
    case 'PREVIOUS_MAPPING': return { label: 'Mapeo Recordado', bg: 'var(--color-success-bg)', color: 'var(--color-success)' };
    case 'EAN_MATCH': return { label: 'Código EAN', bg: 'var(--color-success-bg)', color: 'var(--color-success)' };
    case 'CODE_MATCH': return { label: 'Código SKU/Barras', bg: 'var(--color-info-bg)', color: 'var(--color-info)' };
    case 'DESCRIPTION_EXACT': return { label: 'Nombre Exacto', bg: 'var(--color-info-bg)', color: 'var(--color-info)' };
    case 'DESCRIPTION_PARTIAL': return { label: 'Nombre Parcial', bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' };
    case 'MANUAL': return { label: 'Vínculo Manual', bg: 'var(--color-info-bg)', color: 'var(--color-info)' };
    default: return { label: 'Sin Vincular', bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' };
  }
}

export const PurchaseScannerItemsSection: FC<PurchaseScannerItemsSectionProps> = ({
  items, activeSearchIndex, setActiveSearchIndex, productSearchQueries,
  productSearchResults, onProductSearch, onSelectProduct, onUpdateItemField, onToggleNonStock, onMarkAllNonStock,
}) => {
  const allNonStock = items.length > 0 && items.every((i) => i.isNonStock);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Artículos</h3>
        {items.length > 0 && (
          <button type="button" className="btn btn-secondary" onClick={() => onMarkAllNonStock(!allNonStock)} style={{ fontSize: '0.74rem', padding: '4px 10px' }}>
            {allNonStock ? 'Desmarcar todos' : 'Marcar todos como Gasto'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((item, idx) => {
          const showSearch = activeSearchIndex === idx;
          const results = productSearchResults[idx] || [];
          const searchQuery = productSearchQueries[idx] || '';
          const hasMatch = !!item.matchedProductId;
          const badge = getMatchBadge(item);

          return (
            <div key={idx} style={{ padding: '14px', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="tabular-nums" style={{ fontSize: '0.7rem', fontFamily: 'monospace', backgroundColor: 'var(--accent-bg-light)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, border: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                      {item.code || 'S/C'}
                    </span>
                    {item.ean && item.ean !== item.code && (
                      <span className="tabular-nums" style={{ fontSize: '0.68rem', fontFamily: 'monospace', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                        EAN {item.ean}
                      </span>
                    )}
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.description}</span>
                  </div>
                  {!item.isNonStock && Number(item.unitsPerPack || 1) > 1 && (
                    <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      {item.billedQuantity ?? item.quantity} {item.unitOfMeasure || 'bultos'} × {item.unitsPerPack} u.
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span className="tabular-nums" style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    ${Number(item.subtotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, backgroundColor: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    {badge.label}
                  </span>
                </div>
              </div>

              {!item.isNonStock && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 82px 1fr', gap: '8px' }}>
                  <div>
                    <label htmlFor={`scanner-qty-${idx}`} style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      Cantidad ({item.unitOfMeasure === 'KG' ? 'kg' : 'u.'})
                    </label>
                    <input
                      id={`scanner-qty-${idx}`}
                      name={`items[${idx}].quantity`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      min="0"
                      className="input tabular-nums"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={item.quantity ?? ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => onUpdateItemField(idx, 'quantity', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`scanner-pack-${idx}`} style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      u/Bulto
                    </label>
                    <input
                      id={`scanner-pack-${idx}`}
                      name={`items[${idx}].unitsPerPack`}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="1"
                      className="input tabular-nums"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={item.unitsPerPack ?? 1}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => onUpdateItemField(idx, 'unitsPerPack', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`scanner-cost-${idx}`} style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      Costo U. ($)
                    </label>
                    <input
                      id={`scanner-cost-${idx}`}
                      name={`items[${idx}].unitPrice`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="input tabular-nums"
                      style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                      value={item.unitPrice ?? ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => onUpdateItemField(idx, 'unitPrice', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                {item.isNonStock ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', border: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                      <CornerDownRight size={14} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                      Gasto / Servicio (Sin Stock)
                    </span>
                    <button type="button" className="btn btn-secondary" onClick={() => onToggleNonStock(idx)} style={{ fontSize: '0.74rem', padding: '3px 8px' }}>
                      Vincular Producto
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CornerDownRight size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <div style={{ flex: 1, position: 'relative' }}>
                      {showSearch ? (
                        <div style={{ position: 'relative' }}>
                          <Search size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', position: 'absolute', left: '10px', top: '10px' }} />
                          <input
                            id={`scanner-item-search-${idx}`} type="text" autoFocus
                            aria-label="Buscar producto local" placeholder="SKU o nombre..."
                            value={searchQuery} onChange={(e) => onProductSearch(idx, e.target.value)}
                            autoCorrect="off" autoCapitalize="none" spellCheck={false}
                            className="input" style={{ paddingLeft: '32px', fontSize: '0.78rem', borderColor: 'var(--color-corp-red)' }}
                          />
                          {results.length > 0 && (
                            <div style={{ position: 'absolute', left: 0, right: 0, top: '38px', backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                              {results.map((pr) => (
                                <button key={pr.id} type="button" onClick={() => onSelectProduct(idx, pr)} style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border-color)', backgroundColor: 'transparent', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)' }}>{pr.name}</div>
                                    <div className="tabular-nums" style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>SKU: {pr.sku} · Barras: {pr.barcode || 'S/B'}</div>
                                  </div>
                                  <span className="tabular-nums" style={{ fontSize: '0.68rem', backgroundColor: 'var(--accent-bg-light)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>#{pr.id}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setActiveSearchIndex(idx); onProductSearch(idx, item.description); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', borderRadius: '8px', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left',
                            border: hasMatch ? '1px dashed var(--color-success)' : '1px dashed var(--color-danger)',
                            backgroundColor: hasMatch ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                            color: hasMatch ? 'var(--text-primary)' : 'var(--color-danger)',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasMatch ? 500 : 400 }}>
                            {hasMatch ? `Vinculado: ${item.matchedProductName} (#${item.matchedProductId})` : 'Vincular producto local'}
                          </span>
                          <Search size={14} aria-hidden="true" style={{ color: 'var(--text-muted)', marginLeft: '8px', flexShrink: 0 }} />
                        </button>
                      )}
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={() => onToggleNonStock(idx)} style={{ padding: '7px 10px', fontSize: '0.74rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Sin Stock
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
