import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';

interface ProductsListProps {
  products: any[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  setProductModal: (modal: any) => void;
  onUpdateProduct?: (product: any) => Promise<void>;
}

export default function ProductsList({ products, searchQuery, setSearchQuery, setProductModal, onUpdateProduct }: ProductsListProps) {
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [selectedSubrubro, setSelectedSubrubro] = useState<string>('');
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

    if (field === 'costPrice') {
      updatedProduct.costPrice = numValue;
      // If we want to maintain 25% rentabilidad, we could do it here, but let's just update cost.
    } else if (field === 'listPrice') {
      updatedProduct.listPrice = numValue;
    } else if (field === 'rentabilidad') {
      // User entered a percentage, e.g., 25
      // rentabilidad = precioFinal / costo -> precioFinal = costo * (1 + rent/100)
      // precioSinIva = precioFinal / 1.21
      const costo = Number(p.costPrice) || 0;
      const factor = 1 + (numValue / 100);
      const precioFinal = costo * factor;
      updatedProduct.listPrice = precioFinal / 1.21;
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
    .filter((p: any) => !selectedSubrubro || extractLabel(p.description) === selectedSubrubro);

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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            style={{ borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }} 
            onClick={async () => {
              const val = window.prompt("Ingrese el % de rentabilidad a aplicar a TODOS los productos filtrados en pantalla (ej: 25):", "25");
              if (!val) return;
              const parsed = parseFloat(val);
              if (isNaN(parsed) || parsed < 0) return alert("Por favor, ingrese un número válido mayor a 0.");
              if (!window.confirm(`¿Seguro que desea aplicar un ${parsed}% de rentabilidad a los ${filteredProducts.length} productos mostrados?`)) return;
              
              let count = 0;
              for (const p of filteredProducts) {
                const costo = Number(p.costPrice) || 0;
                if (costo > 0) {
                  const factor = 1 + (parsed / 100);
                  const precioFinal = costo * factor;
                  const newListPrice = precioFinal / 1.21;
                  await onUpdateProduct({ ...p, listPrice: newListPrice });
                  count++;
                }
              }
              alert(`Se actualizaron ${count} productos con éxito.`);
            }}
          >
            <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>%</span>
            <span>Rentabilidad Masiva</span>
          </button>

          <button className="btn btn-primary" style={{ borderRadius: '8px' }} onClick={() => setProductModal({ open: true, mode: 'create', data: { id: 0, sku: '', name: '', description: '', barcode: '', costPrice: 0, listPrice: 0, listPriceB: 0, listPriceC: 0, minStock: 0 } })}>
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
                  const precioSinIva = Number(p.listPrice) || 0;
                  const precioFinal = precioSinIva * 1.21;
                  // Rentabilidad inversa: si precio final = costo * rentabilidad -> rentabilidad = precio final / costo
                  const rentabilidad = costo > 0 ? (precioFinal / costo) : 0;
                  
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', cursor: 'default' }} className="hover-bg-muted">
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.9rem' }}>{p.sku}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          <span style={{ backgroundColor: 'var(--bg-body)', padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>{extractLabel(p.rubro)}</span>
                          {p.description}
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
                        ${precioFinal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button 
                          className="btn btn-ghost" 
                          style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-secondary)' }} 
                          title="Editar producto completo"
                          onClick={() => setProductModal({ open: true, mode: 'edit', data: { id: p.id, sku: p.sku, name: p.name, description: p.description || '', barcode: p.barcode || '', costPrice: p.costPrice, listPrice: p.listPrice, listPriceB: p.listPriceB || 0, listPriceC: p.listPriceC || 0, minStock: p.minStock } })}
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
