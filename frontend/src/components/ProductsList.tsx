import { useState } from 'react';
import { Plus, Edit, Download, Upload } from 'lucide-react';

interface ProductsListProps {
  products: any[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  setProductModal: (modal: any) => void;
  onUpdateProduct?: (product: any) => Promise<void>;
  onOpenImportZip?: () => void;
  onUploadImage?: (productId: number, file: File) => Promise<void>;
  catalogTab?: 'products' | 'inactive_products';
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'Fiambres': '🥓',
  'Refrigerados': '❄️',
  'Bebidas': '🥤',
  'Bebidas Alcoholicas': '🍺',
  'Bebidas Alcohólicas': '🍺',
  'Vinos': '🍷',
  'Aderezos y Aceites': '🌻',
  'Pastas Secas': '🍝',
  'Almacén': '🛒',
  'Almacen': '🛒',
  'Yerbas': '🌿',
  'Conservas': '🥫',
  'Pescadería': '🐟',
  'Pescaderia': '🐟',
  'Papeles': '🧻',
  'No comestibles': '📦',
  'Estucheria y Regalerìa': '🎁',
  'Estuchería y Regalería': '🎁',
  'Varios': '🏷️',
};

export default function ProductsList({ products, searchQuery, setSearchQuery, setProductModal, onUpdateProduct, onOpenImportZip, onUploadImage, catalogTab }: ProductsListProps) {
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubrubro, setSelectedSubrubro] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all'); // all, active, inactive
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [previewModal, setPreviewModal] = useState<{ open: boolean; imageUrl: string; name: string; sku: string; productId: number; categoryName: string; categoryIcon: string } | null>(null);

  const getCategoryInfo = (p: any) => {
    const catName = p.commercialCategory || extractLabel(p.rubro) || 'Varios';
    let icon = CATEGORY_EMOJIS[catName];
    if (!icon) {
      const upper = catName.toUpperCase();
      if (upper.includes('QUESO') || upper.includes('REMOTTI')) icon = '🧀';
      else if (upper.includes('FIAMBRE') || upper.includes('SODECAR')) icon = '🥓';
      else if (upper.includes('BEBIDA')) icon = '🥤';
      else icon = '🏷️';
    }
    return { name: catName, icon };
  };

  const handleEditStart = (id: number, field: string, value: number) => {
    setEditingCell({ id, field });
    setEditValue(value.toString());
  };

  const handleEditSave = async (p: any, field: string) => {
    if (!onUpdateProduct) {
      setEditingCell(null);
      return;
    }
    const numValue = Number(editValue);
    if (isNaN(numValue)) {
      setEditingCell(null);
      return;
    }

    const updatedProduct = { ...p };
    const margin = p.profitMargin !== null && p.profitMargin !== undefined
      ? Number(p.profitMargin) 
      : (p.rubro && p.rubro.profitMargin !== null && p.rubro.profitMargin !== undefined ? Number(p.rubro.profitMargin) : 1.25);

    if (field === 'costPrice') {
      updatedProduct.costPrice = numValue;
      const precioFinal = numValue * margin;
      updatedProduct.listPrice = Math.max(0, Math.round(precioFinal * 100) / 100);
    } else if (field === 'listPrice') {
      // Edición de precio sin IVA
      const precioFinal = numValue * 1.21;
      updatedProduct.listPrice = Math.max(0, Math.round(precioFinal * 100) / 100);
      updatedProduct.costPrice = Math.max(0, Math.round((updatedProduct.listPrice / margin) * 100) / 100);
    } else if (field === 'listPriceFinal') {
      // Edición de precio final con IVA
      updatedProduct.listPrice = Math.max(0, Math.round(numValue * 100) / 100);
      updatedProduct.costPrice = Math.max(0, Math.round((updatedProduct.listPrice / margin) * 100) / 100);
    } else if (field === 'rentabilidad') {
      const costo = Number(p.costPrice) || 0;
      const factor = 1 + (numValue / 100);
      const precioFinal = costo * factor;
      updatedProduct.profitMargin = factor;
      updatedProduct.listPrice = Math.max(0, Math.round(precioFinal * 100) / 100);
    }

    // Recalcular lista B y C proporcionalmente si tenían precio cargado, o aplicar los defaults correspondientes
    if (Number(p.listPriceB) > 0) {
      const ratioB = (Number(p.listPrice) > 0) ? (Number(p.listPriceB) / Number(p.listPrice)) : 0.95;
      updatedProduct.listPriceB = Math.max(0, Math.round(updatedProduct.listPrice * ratioB * 100) / 100);
    } else {
      updatedProduct.listPriceB = 0;
    }

    if (Number(p.listPriceC) > 0) {
      const ratioC = (Number(p.listPrice) > 0) ? (Number(p.listPriceC) / Number(p.listPrice)) : 0.90;
      updatedProduct.listPriceC = Math.max(0, Math.round(updatedProduct.listPrice * ratioC * 100) / 100);
    } else {
      updatedProduct.listPriceC = 0;
    }

    await onUpdateProduct(updatedProduct);
    setEditingCell(null);
  };


  const extractLabel = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
      if (val.name) return String(val.name).trim();
      if (val.nombre) return String(val.nombre).trim();
    }
    return '';
  };

  const filteredProducts = products
    .filter((p: any) => {
      if (!selectedCategory) return true;
      const cat = getCategoryInfo(p).name;
      return cat.toLowerCase() === selectedCategory.toLowerCase();
    })
    .filter((p: any) => !selectedRubro || extractLabel(p.rubro) === selectedRubro)
    .filter((p: any) => !selectedSubrubro || extractLabel(p.description) === selectedSubrubro)
    .filter((p: any) => {
      if (catalogTab === 'products') return p.isActive !== false;
      if (catalogTab === 'inactive_products') return p.isActive === false;

      if (activeFilter === 'active') return p.isActive !== false;
      if (activeFilter === 'inactive') return p.isActive === false;
      return true;
    })
    .filter((p: any) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase().trim();
      const name = (p.name || '').toLowerCase();
      const sku = (p.sku || '').toLowerCase();
      const barcode = (p.barcode || '').toLowerCase();
      return name.includes(query) || sku.includes(query) || barcode.includes(query);
    });

  const availableCategories = Array.from(new Set(products.map((p: any) => getCategoryInfo(p).name).filter(Boolean))).sort();

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="actions-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            className="input"
            placeholder="Buscar SKU, nombre o código de barra..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: '8px', padding: '10px 14px' }}
          />
        </div>
        
        <select 
          className="select" 
          style={{ minWidth: '170px', borderRadius: '8px' }}
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">Todas las Categorías</option>
          {availableCategories.map(catName => {
            const icon = getCategoryInfo({ commercialCategory: catName }).icon;
            return (
              <option key={catName} value={catName}>{icon} {catName}</option>
            );
          })}
        </select>

        <select 
          className="select" 
          style={{ minWidth: '160px', borderRadius: '8px' }}
          value={selectedRubro} 
          onChange={(e) => { setSelectedRubro(e.target.value); setSelectedSubrubro(''); }}
        >
          <option value="">Todos los Rubros</option>
          {Array.from(new Set(products.map((p: any) => extractLabel(p.rubro)).filter(Boolean))).sort().map(r => (
            <option key={String(r)} value={String(r)}>{String(r)}</option>
          ))}
        </select>

        {!catalogTab && (
          <select 
            className="select" 
            style={{ minWidth: '140px', borderRadius: '8px' }}
            value={activeFilter} 
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">Todos (Estado)</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        )}

        {selectedRubro && (
          <select 
            className="select" 
            style={{ minWidth: '160px', borderRadius: '8px' }}
            value={selectedSubrubro} 
            onChange={(e) => setSelectedSubrubro(e.target.value)}
          >
            <option value="">Todos los Subrubros</option>
            {Array.from(new Set(
              products
                .filter((p: any) => extractLabel(p.rubro) === selectedRubro)
                .map((p: any) => extractLabel(p.description))
                .filter(Boolean)
            )).sort().map(s => (
              <option key={String(s)} value={String(s)}>{String(s)}</option>
            ))}
          </select>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setProductModal({ open: true, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, profitMargin: 25, minStock: 0, isPesable: false, approximateWeight: 0, unitsPerBox: 1, rubroId: '', commercialCategory: '', providerId: '', imageUrl: null } })}>
            <Plus size={16} />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      <div className="table-container" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SKU</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PRODUCTO</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PESABLE</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PRECIO SIN IVA</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PRECIO FINAL</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>No se encontraron productos.</td>
              </tr>
            ) : (
              filteredProducts
                .map((p) => {
                  const costo = Number(p.costPrice) || 0;
                  const precioFinal = Number(p.listPrice) || 0;
                  const precioSinIva = precioFinal / 1.21;
                  const catDetails = getCategoryInfo(p);
                  
                  const handleOpenEdit = () => {
                    setProductModal({ 
                      open: true, 
                      mode: 'edit', 
                      data: { 
                        id: p.id, 
                        sku: p.sku, 
                        name: p.name, 
                        description: p.description || '', 
                        barcode: p.barcode || '', 
                        costPrice: p.costPrice, 
                        listPrice: p.listPrice, 
                        listPriceB: p.listPriceB || 0, 
                        listPriceC: p.listPriceC || 0, 
                        profitMargin: p.profitMargin !== null && p.profitMargin !== undefined ? Math.round((Number(p.profitMargin) - 1) * 100) : (p.rubro && p.rubro.profitMargin !== null && p.rubro.profitMargin !== undefined ? Math.round((Number(p.rubro.profitMargin) - 1) * 100) : 25),
                        minStock: p.minStock, 
                        isPesable: p.isPesable || false, 
                        approximateWeight: p.approximateWeight || 0,
                        unitsPerBox: p.unitsPerBox || 1,
                        rubroId: p.rubroId || '',
                        commercialCategory: p.commercialCategory || '',
                        providerId: p.providerId || '',
                        imageUrl: p.imageUrl || null,
                        isActive: p.isActive !== false
                      } 
                    });
                  };
                  
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'default', opacity: p.isActive === false ? 0.6 : 1 }} className="hover-bg-muted">
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }} onClick={handleOpenEdit} title="Clic para editar producto">{p.sku}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div 
                            style={{ position: 'relative', cursor: 'pointer' }} 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (p.imageUrl) {
                                const fullUrl = p.imageUrl.startsWith('http') ? p.imageUrl : (p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=1.1` : `/uploads/products/${p.imageUrl}?v=1.1`);
                                setPreviewModal({
                                  open: true,
                                  imageUrl: fullUrl,
                                  name: p.name,
                                  sku: p.sku,
                                  productId: p.id,
                                  categoryName: catDetails.name,
                                  categoryIcon: catDetails.icon
                                });
                              } else if (onUploadImage) {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = (ev: any) => {
                                  if (ev.target.files && ev.target.files[0]) {
                                    onUploadImage(p.id, ev.target.files[0]);
                                  }
                                };
                                input.click();
                              }
                            }}
                            title={p.imageUrl ? "Clic para ver la imagen ampliada" : "Subir imagen de producto"}
                          >
                            {p.imageUrl ? (
                              <img 
                                src={p.imageUrl.startsWith('http') ? p.imageUrl : (p.imageUrl.startsWith('/') ? `${p.imageUrl}?v=1.1` : `/uploads/products/${p.imageUrl}?v=1.1`)} 
                                alt={p.name} 
                                style={{ width: '40px', height: '40px', minWidth: '40px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', padding: '2px' }} 
                              />
                            ) : (
                              <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: '6px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                                S/F
                              </div>
                            )}
                            
                            {/* Floating Minimalist Category Emoji Badge */}
                            <div 
                              title={`Categoría: ${catDetails.name}`} 
                              style={{ 
                                position: 'absolute', 
                                top: -5, 
                                left: -5, 
                                backgroundColor: 'var(--bg-card)', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '50%', 
                                width: '18px', 
                                height: '18px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '0.65rem', 
                                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                                zIndex: 2,
                                lineHeight: 1 
                              }}
                            >
                              {catDetails.icon}
                            </div>

                            {onUploadImage && (
                              <div 
                                title="Cambiar imagen"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e: any) => {
                                    if (e.target.files && e.target.files[0]) {
                                      onUploadImage(p.id, e.target.files[0]);
                                    }
                                  };
                                  input.click();
                                }}
                                style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '50%', padding: '2px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, cursor: 'pointer' }}
                              >
                                <Upload size={10} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }} onClick={handleOpenEdit} title="Clic para editar producto">{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ backgroundColor: 'var(--bg-muted)', padding: '2px 7px', borderRadius: '5px', border: '1px solid var(--border-color)', fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {extractLabel(p.rubro)}
                              </span>
                              {p.minOrderQuantity && p.minOrderQuantity > 1 && (
                                <span style={{ backgroundColor: 'rgba(227, 6, 19, 0.12)', color: '#e30613', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem' }}>
                                  Mín. {p.minOrderQuantity} u.
                                </span>
                              )}
                              {p.description && <span>{p.description}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {p.isPesable ? (
                          <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '0.7rem' }}>
                            SI (~{p.approximateWeight}kg)
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>NO</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        {editingCell?.id === p.id && editingCell?.field === 'listPrice' ? (
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleEditSave(p, 'listPrice')}
                            onKeyDown={(e) => e.key === 'Enter' && handleEditSave(p, 'listPrice')}
                            style={{ width: '80px', textAlign: 'right', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-primary)' }}
                          />
                        ) : (
                          <div onClick={() => handleEditStart(p.id, 'listPrice', Math.round(precioSinIva))} style={{ cursor: 'pointer', padding: '4px', border: '1px solid transparent' }} title="Clic para editar rápido">
                            ${precioSinIva.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {editingCell?.id === p.id && editingCell?.field === 'listPriceFinal' ? (
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleEditSave(p, 'listPriceFinal')}
                            onKeyDown={(e) => e.key === 'Enter' && handleEditSave(p, 'listPriceFinal')}
                            style={{ width: '80px', textAlign: 'right', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-primary)' }}
                          />
                        ) : (
                          <div onClick={() => handleEditStart(p.id, 'listPriceFinal', Math.round(precioFinal))} style={{ cursor: 'pointer', padding: '4px', border: '1px solid transparent' }} title="Clic para editar rápido (Precio Final)">
                            ${precioFinal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Lightbox de Vista Previa de Imagen Ampliada */}
      {previewModal?.open && (
        <div 
          className="modal-overlay" 
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPreviewModal(null)}
        >
          <div 
            className="modal-content fade-in" 
            style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '16px', maxWidth: '500px', width: '90%', textAlign: 'center', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setPreviewModal(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 'bold' }}
            >
              ✕
            </button>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-muted)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
              <span>{previewModal.categoryIcon}</span>
              <span>{previewModal.categoryName}</span>
              <span style={{ opacity: 0.5 }}>|</span>
              <span style={{ fontFamily: 'monospace' }}>SKU: {previewModal.sku}</span>
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
              {previewModal.name}
            </h3>

            <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px', maxHeight: '420px', overflow: 'hidden' }}>
              <img 
                src={previewModal.imageUrl} 
                alt={previewModal.name} 
                style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: '8px' }} 
              />
            </div>

            {onUploadImage && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ borderRadius: '8px', fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e: any) => {
                      if (e.target.files && e.target.files[0]) {
                        onUploadImage(previewModal.productId, e.target.files[0]);
                        setPreviewModal(null);
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload size={14} />
                  <span>Cambiar Imagen</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
