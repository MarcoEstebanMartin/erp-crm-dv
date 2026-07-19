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
  const [offerLabels, setOfferLabels] = useState<Record<number, string>>({});
  
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

  // Manejar el cambio de etiqueta de oferta (Cartel llamativo)
  const handleOfferLabelChange = (id: number, value: string) => {
    setOfferLabels(prev => ({
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

  // Helper para convertir nombres a formato elegante de catálogo
  const toTitleCase = (str: string) => {
    if (!str) return '';
    const words = str.toLowerCase().split(' ');
    const articles = ['de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'y', 'en', 'con', 'sin', 'x', 'para', 'ml', 'gr', 'kg', 'lt'];
    return words.map((word, index) => {
      const cleanWord = word.replace(/[^a-z0-9ñáéíóúü]/g, '');
      if (index > 0 && articles.includes(cleanWord)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  // Generar Catálogo PDF
  const handleGeneratePdf = async () => {
    if (selectedIds.size === 0) {
      alert('Por favor, selecciona al menos un producto para incluir en el catálogo.');
      return;
    }

    setGenerating(true);
    setProgressMsg('Iniciando generador de PDF...');

    // Helper interno para calcular proporciones sin deformar imágenes (contain)
    const getFitDimensions = (origW: number, origH: number, maxW: number, maxH: number) => {
      const origRatio = origW / origH;
      const maxRatio = maxW / maxH;
      let w = maxW;
      let h = maxH;
      if (origRatio > maxRatio) {
        w = maxW;
        h = maxW / origRatio;
      } else {
        h = maxH;
        w = maxH * origRatio;
      }
      return {
        w,
        h,
        xOffset: (maxW - w) / 2,
        yOffset: (maxH - h) / 2
      };
    };

    // Helper interno para obtener base64 y dimensiones reales de la imagen
    const getBase64AndDimensions = async (url: string): Promise<{ base64: string; width: number; height: number; format: string }> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch image');
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(blob);
      });

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            base64,
            width: img.width,
            height: img.height,
            format: url.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG'
          });
        };
        img.onerror = () => reject(new Error('Failed to load image element'));
        img.src = base64;
      });
    };

    try {
      // 1. Inicializar jsPDF (Formato A4 vertical: 210mm ancho x 297mm alto)
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      
      // Obtener productos seleccionados en orden de la lista
      const selectedProducts = products.filter(p => selectedIds.has(p.id));
      
      // 2. Cargar el logo con sus dimensiones reales
      let logoData: { base64: string; width: number; height: number; format: string } | null = null;
      try {
        logoData = await getBase64AndDimensions(`http://${window.location.hostname}:3000/api/purchases/files/logo.png`);
      } catch (e) {
        console.warn('No se pudo cargar el logo de la distribuidora para el PDF. Se usará texto.');
      }

      // Configuración de grilla premium
      const cols = columnsCount;
      const gap = 5;
      const totalWidthAvailable = pageWidth - (margin * 2);
      const cardWidth = (totalWidthAvailable - (gap * (cols - 1))) / cols;
      const cardHeight = cols === 2 ? 98 : 75; // Altura con buen espaciado
      const cardsPerPage = cols === 2 ? 4 : 9; // 2x2 o 3x3 por página
      
      let currentCardIndex = 0;
      let pageNumber = 1;

      // Helper para dibujar encabezado y pie de página premium
      const drawPageHeaderAndFooter = (pdfDoc: jsPDF, pageNum: number) => {
        // A. Franja Roja Superior Corporativa
        pdfDoc.setFillColor(227, 6, 19); // Rojo Don Venancio
        pdfDoc.rect(0, 0, pageWidth, 2.5, 'F');

        // B. Logo de Distribuidora sin deformaciones
        if (logoData) {
          const fitLogo = getFitDimensions(logoData.width, logoData.height, 35, 12);
          pdfDoc.addImage(
            logoData.base64, 
            logoData.format, 
            margin + fitLogo.xOffset, 
            9 + fitLogo.yOffset, 
            fitLogo.w, 
            fitLogo.h, 
            undefined, 
            'FAST'
          );
        } else {
          pdfDoc.setFont('helvetica', 'bold');
          pdfDoc.setFontSize(14);
          pdfDoc.setTextColor(227, 6, 19); // Rojo corporativo
          pdfDoc.text('DON VENANCIO', margin, 18);
        }

        // C. Título del catálogo
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(6);
        pdfDoc.setTextColor(148, 163, 184); // Slate 400
        pdfDoc.text('DISTRIBUIDORA DE ALIMENTOS & BEBIDAS', 54, 12);

        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(13.5);
        pdfDoc.setTextColor(15, 23, 42); // Slate 900
        pdfDoc.text(catalogTitle.toUpperCase(), 54, 18.2);

        // D. Pastilla de fecha (Validity Badge)
        const badgeText = validityText.toUpperCase();
        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(7.5);
        const badgeWidth = pdfDoc.getTextWidth(badgeText) + 6;
        const badgeX = pageWidth - margin - badgeWidth;
        
        pdfDoc.setFillColor(227, 6, 19); // Fondo Rojo Fuerte
        pdfDoc.roundedRect(badgeX, 12, badgeWidth, 6, 1, 1, 'F');
        
        pdfDoc.setTextColor(255, 255, 255); // Texto Blanco
        pdfDoc.text(badgeText, badgeX + 3, 16.2);

        // Línea divisora fina
        pdfDoc.setDrawColor(241, 245, 249); // Slate 100
        pdfDoc.setLineWidth(0.4);
        pdfDoc.line(margin, 25, pageWidth - margin, 25);

        // Pie de Página
        pdfDoc.setDrawColor(241, 245, 249);
        pdfDoc.setLineWidth(0.4);
        pdfDoc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

        pdfDoc.setFont('helvetica', 'bold');
        pdfDoc.setFontSize(7.5);
        pdfDoc.setTextColor(71, 85, 105); // Slate 600
        pdfDoc.text('Distribuidora Don Venancio', margin, pageHeight - 9);

        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.setFontSize(7.5);
        pdfDoc.setTextColor(148, 163, 184); // Slate 400
        pdfDoc.text('•  Ventas y Distribución de Alimentos y Bebidas', margin + 37, pageHeight - 9);
        pdfDoc.text(`Página ${pageNum}`, pageWidth - margin - 15, pageHeight - 9);
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
        const startY = 30 + rowIndex * (cardHeight + gap); // 30mm después del encabezado

        // A. Fondo de la tarjeta (Gris suave Slate 50)
        doc.setDrawColor(241, 245, 249); // Slate 100
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.roundedRect(startX, startY, cardWidth, cardHeight, 2, 2, 'FD');

        // B. Contenedor Blanco de la Imagen
        const imgBgPadding = 3;
        const imgBgWidth = cardWidth - (imgBgPadding * 2);
        const imgBgHeight = cols === 2 ? 50 : 36;
        
        doc.setFillColor(255, 255, 255); // Blanco
        doc.roundedRect(startX + imgBgPadding, startY + imgBgPadding, imgBgWidth, imgBgHeight, 1.5, 1.5, 'F');

        // C. Renderizar la foto del producto SIN deformaciones (usando Contain)
        const imgPadding = 2;
        const maxImgWidth = imgBgWidth - (imgPadding * 2);
        const maxImgHeight = imgBgHeight - (imgPadding * 2);
        const imgX = startX + imgBgPadding + imgPadding;
        const imgY = startY + imgBgPadding + imgPadding;

        if (prod.imageUrl) {
          try {
            const absoluteImgUrl = `http://${window.location.hostname}:3000${prod.imageUrl}`;
            const imgInfo = await getBase64AndDimensions(absoluteImgUrl);
            
            // Calcular tamaño respetando proporciones originales
            const fit = getFitDimensions(imgInfo.width, imgInfo.height, maxImgWidth, maxImgHeight);
            
            doc.addImage(
              imgInfo.base64, 
              imgInfo.format, 
              imgX + fit.xOffset, 
              imgY + fit.yOffset, 
              fit.w, 
              fit.h, 
              undefined, 
              'FAST'
            );
          } catch (e) {
            // Fallback si falla
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text('Foto no disponible', imgX + (maxImgWidth / 2) - 11, imgY + (maxImgHeight / 2));
          }
        } else {
          // Placeholder Sin Foto
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text('Sin Foto', imgX + (maxImgWidth / 2) - 5, imgY + (maxImgHeight / 2));
        }

        // Calculemos valores de precio
        const regPrice = Number(prod.listPrice) || 0;
        const customOfferPriceStr = offerPrices[prod.id];
        let offerPrice = regPrice * 0.9; // Default 10%
        if (customOfferPriceStr && !isNaN(Number(customOfferPriceStr))) {
          offerPrice = Number(customOfferPriceStr);
        }

        // D. Pastilla de Descuento (Sello Circular Promocional con Borde Blanco)
        const discountPercent = Math.round((1 - (offerPrice / regPrice)) * 100);
        if (discountPercent > 0) {
          const circleX = startX + cardWidth - 8.5;
          const circleY = startY + 8.5;
          const radius = 5.5; // Diámetro de 11mm
          
          doc.setFillColor(227, 6, 19); // Rojo Don Venancio
          doc.setDrawColor(255, 255, 255); // Borde Blanco
          doc.setLineWidth(0.4);
          doc.circle(circleX, circleY, radius, 'FD');
          
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(255, 255, 255);
          const pctText = `-${discountPercent}%`;
          const pctWidth = doc.getTextWidth(pctText);
          doc.text(pctText, circleX - (pctWidth / 2), circleY + 2.2);
        }

        // D2. Cartel Llamativo Personalizable (Sticker en esquina superior izquierda)
        const customTag = offerLabels[prod.id] || '';
        if (customTag) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(cols === 2 ? 6.5 : 5.5);
          const tagText = customTag.toUpperCase();
          const tagWidth = doc.getTextWidth(tagText) + 4;
          
          // Dibujar cápsula negra llamativa
          doc.setFillColor(15, 23, 42); // Negro Slate 900
          doc.roundedRect(startX + 4, startY + 4, tagWidth, 4.5, 0.8, 0.8, 'F');
          
          doc.setTextColor(255, 255, 255); // Blanco
          doc.text(tagText, startX + 6, startY + 7.2);
        }

        // E. Título del Producto (Title Case y Slate 800)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cols === 2 ? 8.5 : 7.2);
        doc.setTextColor(30, 41, 59); // Slate 800

        const nameY = startY + imgBgHeight + 7;
        const formattedName = toTitleCase(prod.name);
        const wrappedName = doc.splitTextToSize(formattedName, cardWidth - 6);
        const linesToShow = wrappedName.slice(0, 2);
        doc.text(linesToShow, startX + 3.5, nameY);

        // F. Contenedor de Precio Promocional Solapado (Yankee Sticker Style)
        const priceBoxHeight = cols === 2 ? 18 : 15;
        const priceBoxY = startY + cardHeight - priceBoxHeight - 2.5;

        // F1. Caja Roja Grande (Precio de Oferta)
        const redBoxWidth = cols === 2 ? 54 : 35;
        const redBoxHeight = cols === 2 ? 16.5 : 13.5;
        const redBoxX = startX + 2.5;
        const redBoxY = priceBoxY + 0.8;

        doc.setFillColor(227, 6, 19); // Rojo Don Venancio
        doc.roundedRect(redBoxX, redBoxY, redBoxWidth, redBoxHeight, 1.2, 1.2, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cols === 2 ? 6.5 : 5.5);
        doc.setTextColor(255, 255, 255); // Blanco
        doc.text('AHORA:', redBoxX + 2.5, redBoxY + (cols === 2 ? 4.5 : 3.8));

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cols === 2 ? 15 : 12);
        doc.text(`$${Math.round(offerPrice).toLocaleString('es-AR')}`, redBoxX + 2.5, redBoxY + (cols === 2 ? 12.5 : 10.2));

        // F2. Caja Amarilla Pequeña Solapada (Antes)
        const yellowBoxWidth = cols === 2 ? 28 : 17.5;
        const yellowBoxHeight = cols === 2 ? 11 : 9.5;
        const yellowBoxX = startX + cardWidth - yellowBoxWidth - 2.5;
        const yellowBoxY = priceBoxY - (cols === 2 ? 2.5 : 2.0); // Desplazado hacia arriba para solapamiento

        doc.setFillColor(254, 240, 138); // Amarillo 200
        doc.roundedRect(yellowBoxX, yellowBoxY, yellowBoxWidth, yellowBoxHeight, 1, 1, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cols === 2 ? 5.5 : 4.5);
        doc.setTextColor(71, 85, 105); // Slate 600
        doc.text('ANTES:', yellowBoxX + 2, yellowBoxY + (cols === 2 ? 3.8 : 3.5));

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cols === 2 ? 8.2 : 6.8);
        doc.setTextColor(15, 23, 42); // Slate 900
        const regPriceText = `$${Math.round(regPrice).toLocaleString('es-AR')}`;
        doc.text(regPriceText, yellowBoxX + 2, yellowBoxY + (cols === 2 ? 8.5 : 7.5));

        // Dibujar línea de tachado roja gruesa sobre el precio original
        const beforeTextWidth = doc.getTextWidth(regPriceText);
        doc.setDrawColor(220, 38, 38); // Rojo Red 600
        doc.setLineWidth(0.4);
        doc.line(yellowBoxX + 1.8, yellowBoxY + (cols === 2 ? 7.2 : 6.3), yellowBoxX + 2.2 + beforeTextWidth, yellowBoxY + (cols === 2 ? 7.2 : 6.3));

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
                        <input 
                          list="tag-suggestions"
                          type="text" 
                          className="input" 
                          placeholder="Ej: OFERTÓN!" 
                          value={labelVal} 
                          onChange={(e) => handleOfferLabelChange(p.id, e.target.value)}
                          disabled={!isSelected}
                          style={{ 
                            width: '120px', 
                            padding: '4px 8px', 
                            borderRadius: '6px', 
                            fontSize: '0.85rem',
                            border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? '#fff' : 'var(--bg-muted)',
                            boxSizing: 'border-box'
                          }}
                        />
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

      <datalist id="tag-suggestions">
        <option value="¡OFERTÓN!" />
        <option value="¡SUPER OFERTA!" />
        <option value="¡ÚLTIMAS UNIDADES!" />
        <option value="¡ÚLTIMAS 3!" />
        <option value="¡HASTA AGOTAR STOCK!" />
        <option value="¡PRECIO EXCLUSIVO!" />
        <option value="¡LIQUIDACIÓN!" />
      </datalist>
    </div>
  );
}
