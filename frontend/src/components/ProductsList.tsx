import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Upload, RotateCcw } from 'lucide-react';
import ProductPhotoLightboxModal from './modals/ProductPhotoLightboxModal';
import {
  INITIAL_PRODUCTS_BATCH,
  PRODUCTS_BATCH_STEP,
  extractProductFilterOptions,
  extractProductLabel,
  filterAndSortProducts,
  getProductCategoryInfo,
  marginPctToMultiplier,
  resolveProductImageUrl,
  resolveProductMarginPct,
  sanitizeProductArray,
} from '../utils/productsListHelpers';

interface ProductsListProps {
  products: any[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  setProductModal: (modal: any) => void;
  onUpdateProduct?: (product: any) => Promise<void>;
  onUploadImage?: (productId: number, file: File) => Promise<void>;
  catalogTab?: 'products' | 'inactive_products';
}

export default function ProductsList({
  products,
  searchQuery,
  setSearchQuery,
  setProductModal,
  onUpdateProduct,
  onUploadImage,
  catalogTab,
}: ProductsListProps) {
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubrubro, setSelectedSubrubro] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_PRODUCTS_BATCH);
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    imageUrl: string;
    name: string;
    sku: string;
    productId: number;
    categoryName: string;
    categoryIcon: string;
  } | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const safeProducts = useMemo(() => sanitizeProductArray(products), [products]);

  const { availableCategories, availableRubros, availableSubrubros } = useMemo(
    () => extractProductFilterOptions(safeProducts, selectedRubro),
    [safeProducts, selectedRubro],
  );

  const filteredProducts = useMemo(
    () =>
      filterAndSortProducts(safeProducts, {
        selectedCategory,
        selectedRubro,
        selectedSubrubro,
        catalogTab,
        activeFilter,
        searchQuery,
      }),
    [safeProducts, selectedCategory, selectedRubro, selectedSubrubro, catalogTab, activeFilter, searchQuery],
  );

  useEffect(() => {
    setVisibleCount(INITIAL_PRODUCTS_BATCH);
  }, [selectedCategory, selectedRubro, selectedSubrubro, catalogTab, activeFilter, searchQuery]);

  const hasMoreRows = visibleCount < filteredProducts.length;
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );
  const showActionsColumn = useMemo(
    () =>
      catalogTab === 'inactive_products' ||
      activeFilter === 'inactive' ||
      visibleProducts.some((p) => p.isActive === false),
    [catalogTab, activeFilter, visibleProducts],
  );

  useEffect(() => {
    const node = loadMoreSentinelRef.current;
    if (!node || !hasMoreRows || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + PRODUCTS_BATCH_STEP, filteredProducts.length));
        }
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreRows, filteredProducts.length]);

  const handleEditStart = (id: number, field: string, value: number) => {
    setEditingCell({ id, field });
    setEditValue(value.toString());
  };

  const handleEditSave = async (p: any, field: string) => {
    if (!onUpdateProduct) return setEditingCell(null);
    const numValue = Number(editValue);
    if (isNaN(numValue)) return setEditingCell(null);

    const updatedProduct = { ...p };
    const margin = marginPctToMultiplier(resolveProductMarginPct(p));

    if (field === 'costPrice') {
      updatedProduct.costPrice = numValue;
      updatedProduct.listPrice = Math.max(0, Math.round(numValue * margin));
    } else if (field === 'listPrice') {
      updatedProduct.listPrice = Math.max(0, Math.round(numValue * 1.21));
      updatedProduct.costPrice = Math.max(0, Math.round((updatedProduct.listPrice / margin) * 100) / 100);
    } else if (field === 'listPriceFinal') {
      updatedProduct.listPrice = Math.max(0, Math.round(numValue));
      updatedProduct.costPrice = Math.max(0, Math.round((updatedProduct.listPrice / margin) * 100) / 100);
    }

    if (Number(p.listPriceB) > 0) {
      const ratioB = Number(p.listPrice) > 0 ? Number(p.listPriceB) / Number(p.listPrice) : 0.95;
      updatedProduct.listPriceB = Math.max(0, Math.round(updatedProduct.listPrice * ratioB));
    } else updatedProduct.listPriceB = 0;

    if (Number(p.listPriceC) > 0) {
      const ratioC = Number(p.listPrice) > 0 ? Number(p.listPriceC) / Number(p.listPrice) : 0.9;
      updatedProduct.listPriceC = Math.max(0, Math.round(updatedProduct.listPrice * ratioC));
    } else updatedProduct.listPriceC = 0;

    await onUpdateProduct(updatedProduct);
    setEditingCell(null);
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <search aria-label="Filtrar productos" className="actions-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
          <label htmlFor="products-search-input" className="visually-hidden">Buscar productos</label>
          <input
            id="products-search-input"
            type="search"
            className="input"
            placeholder="Buscar..."
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: '8px', padding: '10px 14px' }}
          />
        </div>

        <label htmlFor="products-category-filter" className="visually-hidden">Categoría</label>
        <select id="products-category-filter" className="select" style={{ minWidth: '170px', borderRadius: '8px' }} value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="">Categorías</option>
          {availableCategories.map((catName) => (
            <option key={catName} value={catName}>{catName}</option>
          ))}
        </select>

        <label htmlFor="products-rubro-filter" className="visually-hidden">Rubro</label>
        <select id="products-rubro-filter" className="select" style={{ minWidth: '160px', borderRadius: '8px' }} value={selectedRubro} onChange={(e) => { setSelectedRubro(e.target.value); setSelectedSubrubro(''); }}>
          <option value="">Rubros</option>
          {availableRubros.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {!catalogTab && (
          <>
            <label htmlFor="products-status-filter" className="visually-hidden">Estado</label>
            <select id="products-status-filter" className="select" style={{ minWidth: '140px', borderRadius: '8px' }} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </>
        )}

        {selectedRubro && (
          <>
            <label htmlFor="products-subrubro-filter" className="visually-hidden">Subrubro</label>
            <select id="products-subrubro-filter" className="select" style={{ minWidth: '160px', borderRadius: '8px' }} value={selectedSubrubro} onChange={(e) => setSelectedSubrubro(e.target.value)}>
              <option value="">Subrubros</option>
              {availableSubrubros.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </>
        )}

        <button type="button" className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setProductModal({ open: true, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, profitMargin: 25, minStock: 0, isPesable: false, approximateWeight: 0, unitsPerBox: 1, rubroId: '', commercialCategory: '', providerId: '', imageUrl: null } })}>
          <Plus size={16} aria-hidden="true" /><span>Nuevo Producto</span>
        </button>
      </search>

      <div className="table-container table-container--sticky" role="region" aria-label="Lista de productos" tabIndex={0} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
            <tr>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SKU</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Producto</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tienda</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pesable</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sin IVA</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Final</th>
              {showActionsColumn && (
                <th scope="col" style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleProducts.length === 0 ? (
              <tr><td colSpan={showActionsColumn ? 7 : 6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>Sin productos</td></tr>
            ) : (
              visibleProducts.map((p) => {
                const precioFinal = Number(p.listPrice) || 0;
                const precioSinIva = precioFinal / 1.21;
                const catDetails = getProductCategoryInfo(p);

                const handleOpenEdit = () => setProductModal({
                  open: true, mode: 'edit',
                  data: {
                    id: p.id, sku: p.sku, name: p.name, description: p.description || '', barcode: p.barcode || '',
                    costPrice: p.costPrice, listPrice: p.listPrice, listPriceB: p.listPriceB || 0, listPriceC: p.listPriceC || 0,
                    profitMargin: resolveProductMarginPct(p),
                    minStock: p.minStock, isPesable: p.isPesable || false, approximateWeight: p.approximateWeight || 0,
                    unitsPerBox: p.unitsPerBox || 1, rubroId: p.rubroId || '', commercialCategory: p.commercialCategory || '',
                    storeHighlight: p.storeHighlight || null,
                    providerId: p.providerId || '', imageUrl: p.imageUrl || null, isActive: p.isActive !== false,
                  },
                });

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }} className="hover-bg-muted">
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }} onClick={handleOpenEdit} title="Clic para editar producto">{p.sku}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{ position: 'relative', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (p.imageUrl) {
                              const fullUrl = resolveProductImageUrl(p.imageUrl, '3.5');
                              setPreviewModal({ open: true, imageUrl: fullUrl, name: p.name, sku: p.sku, productId: p.id, categoryName: catDetails.name, categoryIcon: catDetails.icon });
                            } else if (onUploadImage) {
                              const input = document.createElement('input');
                              input.type = 'file'; input.accept = 'image/*';
                              input.onchange = (ev: any) => { if (ev.target.files?.[0]) onUploadImage(p.id, ev.target.files[0]); };
                              input.click();
                            }
                          }}
                        >
                          {p.imageUrl ? (
                            <img src={resolveProductImageUrl(p.imageUrl, '3.5')} alt={p.name} width={40} height={40} loading="lazy" decoding="async" style={{ width: '40px', height: '40px', minWidth: '40px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', padding: '2px' }} />
                          ) : (
                            <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: '6px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>S/F</div>
                          )}
                          {onUploadImage && (
                            <div title="Cambiar imagen" onClick={(ev) => { ev.stopPropagation(); const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e: any) => { if (e.target.files?.[0]) onUploadImage(p.id, e.target.files[0]); }; input.click(); }} style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '50%', padding: '2px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, cursor: 'pointer' }}>
                              <Upload size={10} />
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }} onClick={handleOpenEdit}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ backgroundColor: 'var(--bg-muted)', padding: '2px 7px', borderRadius: '5px', border: '1px solid var(--border-color)', fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-primary)' }}>{extractProductLabel(p.rubro)}</span>
                            {p.isActive === false && <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', padding: '2px 7px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: 600 }}>Inactivo</span>}
                            {p.minOrderQuantity && p.minOrderQuantity > 1 && <span style={{ backgroundColor: 'rgba(227, 6, 19, 0.12)', color: '#e30613', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem' }}>Mín. {p.minOrderQuantity} u.</span>}
                            {p.description && <span>{p.description}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        disabled={!onUpdateProduct}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!onUpdateProduct) return;
                          const nextHighlight =
                            p.storeHighlight === 'OFERTON'
                              ? 'DESTACADO'
                              : p.storeHighlight === 'DESTACADO'
                                ? null
                                : 'OFERTON';
                          await onUpdateProduct({ ...p, storeHighlight: nextHighlight });
                        }}
                        title="Clic para alternar: Normal → Ofertón → Destacado"
                        style={{
                          borderRadius: '999px',
                          padding: '4px 10px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: onUpdateProduct ? 'pointer' : 'default',
                          whiteSpace: 'nowrap',
                          border:
                            p.storeHighlight === 'OFERTON'
                              ? '1px solid #E30613'
                              : p.storeHighlight === 'DESTACADO'
                                ? '1px solid #0f172a'
                                : '1px solid var(--border-color)',
                          backgroundColor:
                            p.storeHighlight === 'OFERTON'
                              ? '#E30613'
                              : p.storeHighlight === 'DESTACADO'
                                ? '#0f172a'
                                : 'transparent',
                          color:
                            p.storeHighlight === 'OFERTON' || p.storeHighlight === 'DESTACADO'
                              ? '#ffffff'
                              : 'var(--text-secondary)',
                        }}
                      >
                        {p.storeHighlight === 'OFERTON'
                          ? '🔥 Ofertón'
                          : p.storeHighlight === 'DESTACADO'
                            ? '⭐ Destacado'
                            : 'Normal'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {p.isPesable ? <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '0.7rem' }}>SI (~{p.approximateWeight}kg)</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>NO</span>}
                    </td>
                    <td className="tabular-nums" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {editingCell?.id === p.id && editingCell?.field === 'listPrice' ? (
                        <input type="number" aria-label={`Precio sin IVA de ${p.name}`} autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleEditSave(p, 'listPrice')} onKeyDown={(e) => e.key === 'Enter' && handleEditSave(p, 'listPrice')} style={{ width: '80px', textAlign: 'right', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-primary)' }} />
                      ) : (
                        <div onClick={() => handleEditStart(p.id, 'listPrice', Math.round(precioSinIva))} style={{ cursor: 'pointer', padding: '4px' }}>
                          ${precioSinIva.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {editingCell?.id === p.id && editingCell?.field === 'listPriceFinal' ? (
                        <input type="number" aria-label={`Precio final de ${p.name}`} autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleEditSave(p, 'listPriceFinal')} onKeyDown={(e) => e.key === 'Enter' && handleEditSave(p, 'listPriceFinal')} style={{ width: '80px', textAlign: 'right', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-primary)' }} />
                      ) : (
                        <div onClick={() => handleEditStart(p.id, 'listPriceFinal', Math.round(precioFinal))} style={{ cursor: 'pointer', padding: '4px' }}>
                          ${precioFinal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </td>
                    {showActionsColumn && (
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {(catalogTab === 'inactive_products' || activeFilter === 'inactive' || p.isActive === false) && (
                            <button
                              type="button"
                              className="btn"
                              style={{ borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#15803d', border: '1px solid rgba(34, 197, 94, 0.3)', fontWeight: 600 }}
                              onClick={async (e) => { e.stopPropagation(); if (onUpdateProduct) await onUpdateProduct({ ...p, isActive: true }); }}
                            >
                              <RotateCcw size={13} aria-hidden="true" /><span>Reactivar</span>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filteredProducts.length > 0 && (
        <div ref={loadMoreSentinelRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px 4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <span>Mostrando <strong>{visibleProducts.length}</strong> de <strong>{filteredProducts.length}</strong> productos</span>
          {hasMoreRows && (
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.76rem', padding: '5px 12px', borderRadius: '6px' }} onClick={() => setVisibleCount(filteredProducts.length)}>
              Mostrar todos ({filteredProducts.length})
            </button>
          )}
        </div>
      )}

      <ProductPhotoLightboxModal previewModal={previewModal} onClose={() => setPreviewModal(null)} onUploadImage={onUploadImage} />
    </div>
  );
}
