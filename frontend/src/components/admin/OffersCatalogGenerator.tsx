import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Search, FileText, Download, CheckSquare, Square, RefreshCw } from 'lucide-react';

interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  costPrice: number | string;
  listPrice: number | string; // Precio final con IVA
  imageUrl: string | null;
  rubro?: { name: string } | null;
}

interface OffersCatalogGeneratorProps {
  products: Product[];
}

export default function OffersCatalogGenerator({ products }: OffersCatalogGeneratorProps) {
  const [catalogTitle, setCatalogTitle] = useState('OFERTAS DE LA SEMANA');
  const [validityText, setValidityText] = useState('Válido hasta agotar stock');
  const [columnsCount, setColumnsCount] = useState<2 | 3>(2);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [offerPrices, setOfferPrices] = useState<Record<number, string>>({});
  const [offerLabels, setOfferLabels] = useState<Record<number, string>>({});
  
  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const rubros = useMemo(() => {
    const list = products.map(p => p.rubro?.name || 'OTROS').filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const rubroName = p.rubro?.name || 'OTROS';
      const matchRubro = !selectedRubro || rubroName === selectedRubro;
      return matchSearch && matchRubro;
    });
  }, [products, searchQuery, selectedRubro]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const allSelected = filteredProducts.every(p => selectedIds.has(p.id));
    const next = new Set(selectedIds);
    if (allSelected) filteredProducts.forEach(p => next.delete(p.id));
    else filteredProducts.forEach(p => next.add(p.id));
    setSelectedIds(next);
  };

  const handleGeneratePdf = async () => {
    if (selectedIds.size === 0) {
      alert('Por favor, selecciona al menos un producto para incluir en el catálogo.');
      return;
    }
    setGenerating(true);
    setProgressMsg('Preparando imágenes de alta resolución...');

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pages = document.querySelectorAll('.pdf-page-container');
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        setProgressMsg(`Capturando página ${i + 1} de ${pages.length}...`);
        
        // Wait a tiny bit for DOM to be perfectly ready if needed
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(page, {
          scale: 2, // Retina resolution
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) doc.addPage();
        
        doc.addImage(imgData, 'JPEG', 0, 0, 210, 297);
      }
      
      setProgressMsg('Guardando archivo...');
      const cleanTitle = catalogTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`ofertas_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error al generar PDF con html2canvas:', err);
      alert('Ocurrió un error inesperado al generar el catálogo.');
    } finally {
      setGenerating(false);
      setProgressMsg('');
    }
  };

  // Preparar páginas para el render oculto
  const selectedProductsList = products.filter(p => selectedIds.has(p.id));
  const cardsPerPage = columnsCount === 2 ? 4 : 9;
  const pdfPages: Product[][] = [];
  for (let i = 0; i < selectedProductsList.length; i += cardsPerPage) {
    pdfPages.push(selectedProductsList.slice(i, i + cardsPerPage));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* PANEL IZQUIERDO: CONFIGURACIÓN */}
      <div className="card" style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '20px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} />
          Configurar Catálogo
        </h3>

        <div className="form-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Título del Catálogo</label>
          <input 
            type="text" 
            className="input" 
            value={catalogTitle} 
            onChange={(e) => setCatalogTitle(e.target.value)} 
            placeholder="Ej: OFERTAS IMPERDIBLES"
            style={{ borderRadius: '8px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div className="form-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Subtítulo / Validez</label>
          <input 
            type="text" 
            className="input" 
            value={validityText} 
            onChange={(e) => setValidityText(e.target.value)} 
            placeholder="Ej: Ofertas del 10 al 17 de Julio"
            style={{ borderRadius: '8px', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div className="form-group">
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Distribución de Grilla</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button 
              type="button" 
              className={`btn ${columnsCount === 2 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setColumnsCount(2)}
              style={{ borderRadius: '8px', fontSize: '0.8rem', padding: '8px' }}
            >
              2 Columnas
            </button>
            <button 
              type="button" 
              className={`btn ${columnsCount === 3 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setColumnsCount(3)}
              style={{ borderRadius: '8px', fontSize: '0.8rem', padding: '8px' }}
            >
              3 Columnas
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E30613', borderColor: '#E30613' }}
            onClick={handleGeneratePdf}
            disabled={generating || selectedIds.size === 0}
          >
            {generating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Descargar PDF ({selectedIds.size})</span>
              </>
            )}
          </button>
          {generating && (
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center', fontStyle: 'italic' }}>
              {progressMsg}
            </p>
          )}
        </div>
      </div>

      {/* PANEL DERECHO: SELECCIÓN DE PRODUCTOS */}
      <div className="card" style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px', overflowX: 'auto' }}>
        
        {/* Barra de Filtros */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '220px' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Buscar por SKU o Nombre para ofertar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <select 
            className="select" 
            value={selectedRubro} 
            onChange={(e) => setSelectedRubro(e.target.value)} 
            style={{ minWidth: '160px', borderRadius: '8px' }}
          >
            <option value="">Todos los Rubros</option>
            {rubros.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={toggleSelectAll}
            style={{ borderRadius: '8px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.8rem' }}
          >
            {filteredProducts.every(p => selectedIds.has(p.id)) && filteredProducts.length > 0 ? (
              <>
                <CheckSquare size={15} />
                <span>Desmarcar Todos</span>
              </>
            ) : (
              <>
                <Square size={15} />
                <span>Seleccionar Todos</span>
              </>
            )}
          </button>
        </div>

        {/* Tabla de Productos */}
        <div className="table-container" style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
              <tr>
                <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}></th>
                <th style={{ padding: '10px 12px', width: '60px', textAlign: 'center' }}>Foto</th>
                <th style={{ padding: '10px 12px', width: '80px', textAlign: 'left' }}>SKU</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Producto</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '120px' }}>Precio Regular</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Cartel Llamativo</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Precio Oferta</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const regPrice = Number(p.listPrice) || 0;
                  const isSelected = selectedIds.has(p.id);
                  const offerVal = offerPrices[p.id] || '';
                  const labelVal = offerLabels[p.id] || '';

                  return (
                    <tr 
                      key={p.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        backgroundColor: isSelected ? 'rgba(227, 6, 19, 0.02)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSelect(p.id)}>
                        {isSelected ? <CheckSquare size={18} style={{ color: '#E30613' }} /> : <Square size={18} style={{ color: 'var(--text-muted)' }} />}
                      </td>
                      
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {p.imageUrl ? (
                          <img 
                            src={`http://${window.location.hostname}:3000${p.imageUrl}`} 
                            crossOrigin="anonymous"
                            alt={p.name} 
                            style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: '#fff' }} 
                          />
                        ) : (
                          <div style={{ width: '32px', height: '32px', borderRadius: '4px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)', fontSize: '0.55rem', fontWeight: 600 }}>
                            S/F
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>
                        {p.sku}
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          {p.rubro?.name || 'OTROS'}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        ${Math.round(regPrice).toLocaleString('es-AR')}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <input 
                          list="tag-suggestions"
                          type="text" 
                          className="input" 
                          placeholder="Ej: OFERTÓN!" 
                          value={labelVal} 
                          onChange={(e) => setOfferLabels(prev => ({ ...prev, [p.id]: e.target.value }))}
                          disabled={!isSelected}
                          style={{ 
                            width: '120px', 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.85rem',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? '#fff' : 'var(--bg-muted)'
                          }}
                        />
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '0.85rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}>$</span>
                          <input 
                            type="number" 
                            className="input" 
                            placeholder={Math.round(regPrice * 0.9).toString()}
                            value={offerVal} 
                            onChange={(e) => setOfferPrices(prev => ({ ...prev, [p.id]: e.target.value }))}
                            disabled={!isSelected}
                            style={{ 
                              width: '90px', 
                              textAlign: 'right', 
                              padding: '4px 8px', 
                              borderRadius: '6px', 
                              fontSize: '0.85rem',
                              border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? '#fff' : 'var(--bg-muted)'
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <datalist id="tag-suggestions">
        <option value="¡OFERTÓN!" />
        <option value="¡SUPER OFERTA!" />
        <option value="¡ÚLTIMAS UNIDADES!" />
        <option value="¡ÚLTIMAS 3!" />
        <option value="¡HASTA AGOTAR STOCK!" />
        <option value="¡PRECIO EXCLUSIVO!" />
        <option value="¡LIQUIDACIÓN!" />
      </datalist>

      {/* CONTENEDOR OCULTO PARA RENDERIZAR EL PDF (A4 96 DPI: 794x1123) */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '0', height: '0', overflow: 'hidden' }}>
        <div id="pdf-templates-wrapper">
          {pdfPages.map((pageProducts, pageIdx) => (
            <div 
              key={pageIdx} 
              className="pdf-page-container" 
              style={{ 
                width: '794px', 
                height: '1123px', 
                backgroundColor: '#ffffff', 
                position: 'relative', 
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header Rojo */}
              <div style={{ backgroundColor: '#cc000f', padding: '30px 40px', color: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img 
                  src={`http://${window.location.hostname}:3000/api/purchases/files/logo.png`}
                  crossOrigin="anonymous" 
                  alt="Logo" 
                  style={{ height: '90px', objectFit: 'contain' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '30px', alignItems: 'flex-end' }}>
                  <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>{catalogTitle.toUpperCase()}</h1>
                  <span style={{ fontSize: '22px', fontWeight: 700 }}>{validityText}</span>
                </div>
              </div>

              {/* Grid de Productos */}
              <div style={{ 
                flex: 1, 
                padding: '40px', 
                display: 'grid', 
                gridTemplateColumns: columnsCount === 2 ? '1fr 1fr' : '1fr 1fr 1fr', 
                gap: '40px',
                alignContent: 'start'
              }}>
                {pageProducts.map(prod => {
                  const regPrice = Number(prod.listPrice) || 0;
                  const offerVal = offerPrices[prod.id];
                  let finalPrice = regPrice * 0.9;
                  if (offerVal && !isNaN(Number(offerVal))) finalPrice = Number(offerVal);
                  
                  const customTag = offerLabels[prod.id];

                  return (
                    <div key={prod.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative', height: columnsCount === 2 ? '380px' : '260px' }}>
                      
                      {/* Contenedor Imagen */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', position: 'relative' }}>
                        {prod.imageUrl ? (
                          <img 
                            src={`http://${window.location.hostname}:3000${prod.imageUrl}`} 
                            crossOrigin="anonymous"
                            alt={prod.name} 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <div style={{ color: '#cbd5e1', fontSize: '14px' }}>Sin Imagen</div>
                        )}

                        {/* Etiqueta de Precio Estilo Supermercado (Absoluto Arriba Derecha) */}
                        <div style={{ 
                          position: 'absolute', 
                          top: columnsCount === 2 ? '0px' : '-5px', 
                          right: columnsCount === 2 ? '-10px' : '-5px', 
                          width: columnsCount === 2 ? '150px' : '110px', 
                          height: columnsCount === 2 ? '120px' : '90px',
                          zIndex: 10,
                          fontFamily: '"Arial Black", Impact, sans-serif'
                        }}>
                          {/* Precio Regular Tachado (Pastilla Amarilla) */}
                          <div style={{
                            position: 'absolute',
                            top: '0px',
                            right: '0px',
                            backgroundColor: '#fbbf24', // Amarillo cálido
                            padding: columnsCount === 2 ? '4px 12px' : '2px 8px',
                            borderRadius: '8px',
                            zIndex: 12,
                            transform: 'rotate(4deg)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <span style={{ 
                              color: '#1e293b', 
                              fontSize: columnsCount === 2 ? '20px' : '14px', 
                              fontWeight: 900,
                              textDecoration: 'line-through',
                              textDecorationColor: '#e11d48',
                              textDecorationThickness: '3px'
                            }}>
                              ${Math.round(regPrice).toLocaleString('es-AR')}
                            </span>
                          </div>

                          {/* Precio Oferta (Caja Roja Principal) */}
                          <div style={{
                            position: 'absolute',
                            bottom: '15px',
                            left: '0px',
                            backgroundColor: '#e30613',
                            width: '100%',
                            height: columnsCount === 2 ? '80px' : '60px',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 11,
                            boxShadow: '0 6px 12px rgba(227, 6, 19, 0.3)',
                            border: '3px solid #ffffff'
                          }}>
                            <div style={{ 
                              color: '#ffffff', 
                              fontSize: columnsCount === 2 ? '42px' : '28px', 
                              fontWeight: 900, 
                              letterSpacing: '-1.5px',
                              textShadow: '2px 2px 0px rgba(0,0,0,0.2)'
                            }}>
                              ${Math.round(finalPrice).toLocaleString('es-AR')}
                            </div>
                          </div>

                          {/* Etiqueta Negra (Condiciones / Ofertón) */}
                          {customTag && (
                            <div style={{ 
                              position: 'absolute', 
                              bottom: '0px', 
                              left: '10px', 
                              backgroundColor: '#0f172a', 
                              color: '#ffffff', 
                              padding: columnsCount === 2 ? '6px 16px' : '4px 10px', 
                              borderRadius: '4px', 
                              fontSize: columnsCount === 2 ? '14px' : '10px', 
                              fontWeight: 800, 
                              zIndex: 13,
                              whiteSpace: 'nowrap',
                              transform: 'rotate(-3deg)',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                              letterSpacing: '0.5px'
                            }}>
                              {customTag.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Título de Producto */}
                      <div style={{ textAlign: 'center', marginTop: '15px', height: '60px' }}>
                        <div style={{ 
                          fontSize: columnsCount === 2 ? '22px' : '16px', 
                          fontWeight: 800, 
                          color: '#0f172a', 
                          lineHeight: '1.1',
                          letterSpacing: '-0.5px'
                        }}>
                          {prod.name.toUpperCase()}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Pie de Página */}
              <div style={{ padding: '20px 40px', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
                <span>Distribuidora Don Venancio • Ventas y Distribución de Alimentos y Bebidas</span>
                <span>Página {pageIdx + 1} de {pdfPages.length}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
