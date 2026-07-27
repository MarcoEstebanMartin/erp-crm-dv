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

export default function ProductsList({ products, searchQuery, setSearchQuery, setProductModal, onUpdateProduct, onOpenImportZip, onUploadImage, catalogTab }: ProductsListProps) {
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [selectedSubrubro, setSelectedSubrubro] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all'); // all, active, inactive
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

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

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="actions-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px' }}>
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
          style={{ minWidth: '180px', borderRadius: '8px' }}
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
            style={{ minWidth: '150px', borderRadius: '8px' }}
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
            style={{ minWidth: '180px', borderRadius: '8px' }}
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
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>COSTO (C/IVA)</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>RENTABILIDAD</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PRECIO SIN IVA</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PRECIO FINAL</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ACTIVO</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>No se encontraron productos.</td>
              </tr>
            ) : (
              filteredProducts
                .map((p) => {
                  const costo = Number(p.costPrice) || 0;
                  const precioFinal = Number(p.listPrice) || 0;
                  const precioSinIva = precioFinal / 1.21;
                  
                  const rentabilidad = p.profitMargin !== null && p.profitMargin !== undefined
                    ? Number(p.profitMargin) 
                    : (p.rubro && p.rubro.profitMargin !== null && p.rubro.profitMargin !== undefined
                      ? Number(p.rubro.profitMargin) 
                      : (costo > 0 ? (precioFinal / costo) : 1.25));
                  
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'default', opacity: p.isActive === false ? 0.6 : 1 }} className="hover-bg-muted">
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.9rem' }}>{p.sku}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ position: 'relative', cursor: onUploadImage ? 'pointer' : 'default' }} onClick={() => {
                            if (onUploadImage) {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e: any) => {
                                if (e.target.files && e.target.files[0]) {
                                  onUploadImage(p.id, e.target.files[0]);
                                }
                              };
                              input.click();
                            }
                          }}>
                            {p.imageUrl ? (
                              <img 
                                src={p.imageUrl.startsWith('http') ? p.imageUrl : (p.imageUrl.startsWith('/') ? p.imageUrl : `/uploads/products/${p.imageUrl}`)} 
                                alt={p.name} 
                                style={{ width: '40px', height: '40px', minWidth: '40px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: '#fff', padding: '2px' }} 
                              />
                            ) : (
                              <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: '6px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: 600 }}>
                                S/F
                              </div>
                            )}
                            {onUploadImage && (
                              <div style={{ position: 'absolute', bottom: -5, right: -5, backgroundColor: 'var(--color-primary)', color: 'white', borderRadius: '50%', padding: '2px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Upload size={10} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              <span style={{ backgroundColor: 'var(--bg-body)', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>{extractLabel(p.rubro)}</span>
                              {p.minOrderQuantity && p.minOrderQuantity > 1 && (
                                <span style={{ backgroundColor: 'rgba(227, 6, 19, 0.12)', color: '#e30613', padding: '2px 6px', borderRadius: '4px', marginRight: '6px', fontWeight: 700, fontSize: '0.7rem' }}>
                                  Mín. {p.minOrderQuantity} u.
                                </span>
                              )}
                              {p.description}
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
                        {editingCell?.id === p.id && editingCell?.field === 'costPrice' ? (
                          <input
                            type="number"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleEditSave(p, 'costPrice')}
                            onKeyDown={(e) => e.key === 'Enter' && handleEditSave(p, 'costPrice')}
                            style={{ width: '80px', textAlign: 'right', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-primary)' }}
                          />
                        ) : (
                          <div onClick={() => handleEditStart(p.id, 'costPrice', Math.round(costo))} style={{ cursor: 'pointer', padding: '4px', border: '1px solid transparent' }} title="Clic para editar">
                            ${costo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {editingCell?.id === p.id && editingCell?.field === 'rentabilidad' ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input
                              type="number"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleEditSave(p, 'rentabilidad')}
                              onKeyDown={(e) => e.key === 'Enter' && handleEditSave(p, 'rentabilidad')}
                              style={{ width: '60px', textAlign: 'right', padding: '4px', borderRadius: '4px', border: '1px solid var(--color-primary)' }}
                            />
                            <span style={{ marginLeft: '4px' }}>%</span>
                          </div>
                        ) : (
                          <span 
                            onClick={() => handleEditStart(p.id, 'rentabilidad', Math.round(rentabilidad > 0 ? ((rentabilidad - 1) * 100) : 0))}
                            style={{ backgroundColor: 'var(--bg-muted)', padding: '4px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', cursor: 'pointer' }}
                            title="Clic para editar"
                          >
                            {(rentabilidad > 0 ? ((rentabilidad - 1) * 100) : 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}%
                          </span>
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
                          <div onClick={() => handleEditStart(p.id, 'listPrice', Math.round(precioSinIva))} style={{ cursor: 'pointer', padding: '4px', border: '1px solid transparent' }} title="Clic para editar">
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
                          <div onClick={() => handleEditStart(p.id, 'listPriceFinal', Math.round(precioFinal))} style={{ cursor: 'pointer', padding: '4px', border: '1px solid transparent' }} title="Clic para editar (Precio Final)">
                            ${precioFinal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <div 
                          style={{
                            width: '40px',
                            height: '22px',
                            borderRadius: '11px',
                            backgroundColor: p.isActive !== false ? 'var(--color-primary)' : 'var(--border-color)',
                            position: 'relative',
                            cursor: 'pointer',
                            display: 'inline-block',
                            transition: 'all 0.2s'
                          }}
                          onClick={() => {
                            if (onUpdateProduct) {
                              onUpdateProduct({ ...p, isActive: p.isActive === false ? true : false });
                            }
                          }}
                        >
                          <div style={{
                            width: '18px',
                            height: '18px',
                            backgroundColor: '#fff',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: p.isActive !== false ? '20px' : '2px',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button 
                          className="btn btn-ghost" 
                          style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-secondary)' }} 
                          title="Editar producto completo"
                          onClick={() => setProductModal({ 
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
                          })}
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
