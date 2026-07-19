import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
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
  // Estados para la configuración del PDF
  const [catalogTitle, setCatalogTitle] = useState('OFERTAS DE LA SEMANA');
  const [validityText, setValidityText] = useState('Válido hasta agotar stock');
  const [columnsCount, setColumnsCount] = useState<2 | 3>(3);
  
  // Estados de selección de productos y precios especiales
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [offerPrices, setOfferPrices] = useState<Record<number, string>>({});
  
  // Estado de carga durante la generación del PDF
  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Obtener rubros únicos para el filtro
  const rubros = useMemo(() => {
    const list = products.map(p => p.rubro?.name || 'OTROS').filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [products]);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      
      const rubroName = p.rubro?.name || 'OTROS';
      const matchRubro = !selectedRubro || rubroName === selectedRubro;

      return matchSearch && matchRubro;
    });
  }, [products, searchQuery, selectedRubro]);

  // Toggle de selección individual
  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Seleccionar/Deseleccionar todos los filtrados
  const toggleSelectAll = () => {
    const allSelected = filteredProducts.every(p => selectedIds.has(p.id));
    const next = new Set(selectedIds);
    if (allSelected) {
      filteredProducts.forEach(p => next.delete(p.id));
    } else {
      filteredProducts.forEach(p => next.add(p.id));
    }
    setSelectedIds(next);
  };

  // Manejar el cambio de precio de oferta
  const handleOfferPriceChange = (id: number, value: string) => {
    setOfferPrices(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Convertir URL de imagen a Base64 asíncronamente
  const getBase64ImageFromUrl = async (url: string): Promise<string> => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network response was not ok');
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn(`Error al cargar imagen para PDF: ${url}`, err);
      throw err;
    }
  };

  // Generar Catálogo PDF
  const handleGeneratePdf = async () => {
    if (selectedIds.size === 0) {
      alert('Por favor, selecciona al menos un producto para incluir en el catálogo.');
      return;
    }

    setGenerating(true);
    setProgressMsg('Iniciando generador de PDF...');

    try {
      // 1. Inicializar jsPDF (Formato A4 vertical: 210mm ancho x 297mm alto)
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      
      // Obtener productos seleccionados en orden de la lista
      const selectedProducts = products.filter(p => selectedIds.has(p.id));
      
      // 2. Intentar cargar el logo del distribuidor
      let logoBase64 = '';
      try {
        logoBase64 = await getBase64ImageFromUrl(`http://${window.location.hostname}:3000/api/purchases/files/logo.png`);
      } catch (e) {
        console.warn('No se pudo cargar el logo de la distribuidora para el PDF. Se usará texto.');
      }

      // Configuración de grilla
      const cols = columnsCount;
      const gap = 6;
      const totalWidthAvailable = pageWidth - (margin * 2);
      const cardWidth = (totalWidthAvailable - (gap * (cols - 1))) / cols;
      const cardHeight = cols === 2 ? 95 : 72; // Más alto si son 2 columnas
      const cardsPerPage = cols === 2 ? 4 : 9; // 2x2 o 3x3 por página
      
      let currentCardIndex = 0;
      let pageNumber = 1;

      // Helper para dibujar encabezado y pie de página
      const drawPageHeaderAndFooter = (pdfDoc: jsPDF, pageNum: number) => {
        // Logo o Texto Don Venancio
        if (logoBase64) {
          pdfDoc.addImage(logoBase64, 'PNG', margin, 12, 35, 12);
        } else {
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(14);
          pdfDoc.setTextColor(227, 6, 19); // Rojo corporativo
          pdfDoc.text('DON VENANCIO', margin, 18);
        }

        // Título del catálogo
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(13);
        pdfDoc.setTextColor(30, 41, 59); // Slate 800
        pdfDoc.text(catalogTitle.toUpperCase(), 75, 17);

        // Subtítulo / Vigencia
        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.setFontSize(8.5);
        pdfDoc.setTextColor(100, 116, 139); // Slate 500
        pdfDoc.text(validityText, 75, 22);

        // Línea divisora
        pdfDoc.setDrawColor(226, 232, 240); // Slate 200
        pdfDoc.setLineWidth(0.4);
        pdfDoc.line(margin, 27, pageWidth - margin, 27);

        // Pie de Página
        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(148, 163, 184); // Slate 400
        pdfDoc.text('Distribuidora Don Venancio - Catálogo de Ofertas', margin, pageHeight - 10);
        pdfDoc.text(`Página ${pageNum}`, pageWidth - margin - 15, pageHeight - 10);
      };

      // Dibujar primer encabezado
      drawPageHeaderAndFooter(doc, pageNumber);

      // 3. Renderizar cada producto en la grilla
      for (let i = 0; i < selectedProducts.length; i++) {
        const prod = selectedProducts[i];
        
        // Progreso para la UI
        setProgressMsg(`Procesando producto ${i + 1} de ${selectedProducts.length}: ${prod.name}`);

        // Verificar si necesitamos cambiar de página
        if (currentCardIndex > 0 && currentCardIndex % cardsPerPage === 0) {
          doc.addPage();
          pageNumber++;
          drawPageHeaderAndFooter(doc, pageNumber);
          currentCardIndex = 0;
        }

        // Calcular posición X e Y de la tarjeta
        const colIndex = currentCardIndex % cols;
        const rowIndex = Math.floor(currentCardIndex / cols);
        
        const startX = margin + colIndex * (cardWidth + gap);
        const startY = 32 + rowIndex * (cardHeight + gap); // 32mm después del encabezado

        // Dibujar borde de la tarjeta (Gris Linear fino)
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(startX, startY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

        // Intentar renderizar la imagen del producto
        const imgHeight = cols === 2 ? 45 : 30;
        const imgWidth = cardWidth - 8;
        const imgX = startX + 4;
        const imgY = startY + 4;

        if (prod.imageUrl) {
          try {
            const absoluteImgUrl = `http://${window.location.hostname}:3000${prod.imageUrl}`;
            const base64 = await getBase64ImageFromUrl(absoluteImgUrl);
            // Intentar detectar formato (JPG o PNG)
            const format = prod.imageUrl.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';
            doc.addImage(base64, format, imgX, imgY, imgWidth, imgHeight, undefined, 'FAST');
          } catch (e) {
            // Dibujar placeholder si falla la carga
            doc.setDrawColor(241, 245, 249);
            doc.setFillColor(248, 250, 252);
            doc.rect(imgX, imgY, imgWidth, imgHeight, 'F');
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text('Foto no disponible', imgX + (imgWidth / 2) - 11, imgY + (imgHeight / 2));
          }
        } else {
          // Si no tiene imagen, mostrar placeholder de Sin Foto
          doc.setDrawColor(241, 245, 249);
          doc.setFillColor(248, 250, 252);
          doc.rect(imgX, imgY, imgWidth, imgHeight, 'F');
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(148, 163, 184);
          doc.text('Sin Foto', imgX + (imgWidth / 2) - 5, imgY + (imgHeight / 2));
        }

        // Título del Producto (Ajuste de líneas)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cols === 2 ? 8.5 : 7.2);
        doc.setTextColor(30, 41, 59); // Slate 800

        const nameY = imgY + imgHeight + 4;
        const wrappedName = doc.splitTextToSize(prod.name.toUpperCase(), cardWidth - 6);
        // Limitar a máximo 2 líneas para no pisar el precio
        const linesToShow = wrappedName.slice(0, 2);
        doc.text(linesToShow, startX + 3, nameY);

        // Precios
        const priceY = startY + cardHeight - 4;
        const regPrice = Number(prod.listPrice) || 0;
        
        // Determinar precio de oferta (si ingresó uno, usarlo; sino, restar un 10% por defecto)
        const customOfferPriceStr = offerPrices[prod.id];
        let offerPrice = regPrice * 0.9; // Default 10% descuento
        if (customOfferPriceStr && !isNaN(Number(customOfferPriceStr))) {
          offerPrice = Number(customOfferPriceStr);
        }

        // 1. Precio Original Tachado
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(cols === 2 ? 8 : 7);
        doc.setTextColor(148, 163, 184); // Slate 400
        const regPriceText = `Antes: $${Math.round(regPrice).toLocaleString('es-AR')}`;
        doc.text(regPriceText, startX + 3, priceY - 3.5);

        // Dibujar línea de tachado sobre el precio original
        const textWidth = doc.getTextWidth(regPriceText);
        doc.setDrawColor(239, 68, 68); // Rojo Red 500
        doc.setLineWidth(0.3);
        doc.line(startX + 3, priceY - 4.5, startX + 3 + textWidth, priceY - 4.5);

        // 2. Precio de Oferta Destacado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cols === 2 ? 11.5 : 9.5);
        doc.setTextColor(227, 6, 19); // Rojo corporativo
        doc.text(`$${Math.round(offerPrice).toLocaleString('es-AR')}`, startX + 3, priceY);

        // Medida del producto (por bulto / kg / etc) si aplica
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        const rubroText = prod.rubro?.name || 'OTROS';
        doc.text(rubroText.toUpperCase(), startX + cardWidth - doc.getTextWidth(rubroText.toUpperCase()) - 3, priceY);

        currentCardIndex++;
      }

      // 4. Guardar archivo
      const cleanTitle = catalogTitle.toLowerCase().replace(/[^a-z0-9]/g, '_');
      doc.save(`ofertas_${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);
      
      setGenerating(false);
      setProgressMsg('');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Ocurrió un error inesperado al generar el catálogo en PDF.');
      setGenerating(false);
      setProgressMsg('');
    }
  };

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
              2 Columnas (4/Pág)
            </button>
            <button 
              type="button" 
              className={`btn ${columnsCount === 3 ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setColumnsCount(3)}
              style={{ borderRadius: '8px', fontSize: '0.8rem', padding: '8px' }}
            >
              3 Columnas (9/Pág)
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
      <div className="card" style={{ backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
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
            {filteredProducts.every(p => selectedIds.has(p.id)) ? (
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
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
              <tr>
                <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}></th>
                <th style={{ padding: '10px 12px', width: '60px', textAlign: 'center' }}>Foto</th>
                <th style={{ padding: '10px 12px', width: '80px', textAlign: 'left' }}>SKU</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Producto</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Precio Regular (IVA)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '150px' }}>Precio de Oferta (IVA)</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const regPrice = Number(p.listPrice) || 0;
                  const isSelected = selectedIds.has(p.id);
                  const offerVal = offerPrices[p.id] || '';

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
                        {isSelected ? (
                          <CheckSquare size={18} style={{ color: '#E30613' }} />
                        ) : (
                          <Square size={18} style={{ color: 'var(--text-muted)' }} />
                        )}
                      </td>
                      
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {p.imageUrl ? (
                          <img 
                            src={`http://${window.location.hostname}:3000${p.imageUrl}`} 
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '0.85rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}>$</span>
                          <input 
                            type="number" 
                            className="input" 
                            placeholder={Math.round(regPrice * 0.9).toString()} // Sugiere 10% desc
                            value={offerVal} 
                            onChange={(e) => handleOfferPriceChange(p.id, e.target.value)}
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

    </div>
  );
}
