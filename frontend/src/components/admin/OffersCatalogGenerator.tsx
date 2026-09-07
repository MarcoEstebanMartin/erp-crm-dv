import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Download, RefreshCw, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { API_BASE_URL } from '../../utils/api';

export interface CampaignItem {
  id: number | string;
  offerPrice: number;
  specialTag: string | null;
  previousPrice?: number;
  campaignGroup?: string;
  product: {
    id: number | string;
    sku: string;
    name: string;
    listPrice: number;
    imageUrl?: string | null;
    rubro?: { name: string };
  };
}

export interface Campaign {
  id: number | string;
  title: string;
  startDate: string;
  endDate: string | null;
  items: CampaignItem[];
  customRubroOrder?: string[];
}

export interface OffersCatalogGeneratorProps {
  campaignId?: number;
  campaignData?: Campaign;
  onBack: () => void;
  onUpdateRubroOrder?: (newOrder: string[]) => void;
}

export default function OffersCatalogGenerator({ campaignId, campaignData, onBack, onUpdateRubroOrder }: OffersCatalogGeneratorProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(campaignData || null);
  const [loading, setLoading] = useState(true);
  const [columnsCount, setColumnsCount] = useState<2 | 3>(2);
  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [cacheBuster] = useState(Date.now());
  const [rubroOrder, setRubroOrder] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState('OFERTAS SEMANALES');
  const [customSubtitle, setCustomSubtitle] = useState('');

  useEffect(() => {
    if (campaignData) {
      setCampaign(campaignData);
      setLoading(false);
    } else if (campaignId) {
      fetchCampaign();
    }
  }, [campaignId, campaignData]);

  useEffect(() => {
    if (campaign && campaign.items.length > 0) {
      setCustomTitle(campaign.title || 'OFERTAS SEMANALES');
      
      const rawDate = campaign.startDate || new Date().toISOString().split('T')[0];
      const parts = rawDate.split('T')[0].split('-');
      const year = parts[0];
      const month = parseInt(parts[1], 10) - 1;
      const day = parts[2];
      const startDate = new Date(Number(year), month, Number(day));
      
      const startDateStr = startDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
      setCustomSubtitle(`EDICIÓN: ${startDateStr.toUpperCase()}`);

      if (campaign.customRubroOrder && campaign.customRubroOrder.length > 0) {
        const uniqueRubros = Array.from(new Set(campaign.items.map((item: any) => item.campaignGroup || item.product?.rubro?.name || 'Varios'))) as string[];
        const validOrder = campaign.customRubroOrder.filter((r: string) => uniqueRubros.includes(r));
        uniqueRubros.forEach(r => {
          if (!validOrder.includes(r)) validOrder.push(r);
        });
        setRubroOrder(validOrder);
      } else {
        const uniqueRubros = Array.from(new Set(campaign.items.map((item: any) => item.campaignGroup || item.product?.rubro?.name || 'Varios'))) as string[];
        uniqueRubros.sort((a, b) => {
          if (a === 'Varios' || a === 'VARIOS') return 1;
          if (b === 'Varios' || b === 'VARIOS') return -1;
          return a.localeCompare(b);
        });
        setRubroOrder(uniqueRubros);
      }
    }
  }, [campaign]);

  const moveRubro = async (index: number, direction: 'up' | 'down') => {
    const newOrder = [...rubroOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < rubroOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    } else {
      return;
    }
    
    setRubroOrder(newOrder);
    if (onUpdateRubroOrder) {
      onUpdateRubroOrder(newOrder);
    }

    if (campaignId) {
      try {
        await fetch(`${API_BASE_URL}/offers/${campaignId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            customRubroOrder: newOrder
          })
        });
      } catch (error) {
        console.error('Error saving rubro order:', error);
      }
    }
  };

  const fetchCampaign = async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/offers/${campaignId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCampaign(data);
      }
    } catch (error) {
      console.error('Error fetching campaign:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!campaign || campaign.items.length === 0) {
      alert('La campaña no tiene productos.');
      return;
    }
    setGenerating(true);
    setProgressMsg('Preparando imágenes de alta resolución...');

    try {
      const page = document.querySelector('.pdf-page-container') as HTMLElement;
      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdfWidth = 210; // Base A4 width in mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });
      
      setProgressMsg('Guardando archivo...');
      doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      doc.save(`ofertas_semanales.pdf`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Ocurrió un error inesperado al generar el catálogo.');
    } finally {
      setGenerating(false);
      setProgressMsg('');
    }
  };

  if (loading || !campaign) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando catálogo...</div>;
  }



  return (
    <div className="fade-in" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button 
          onClick={onBack}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <ArrowLeft size={18} /> Volver a Campañas
        </button>

        <div style={{ display: 'flex', gap: '15px', flex: 1, margin: '0 20px' }}>
          <input 
            type="text" 
            value={customTitle} 
            onChange={e => setCustomTitle(e.target.value)} 
            placeholder="Título del catálogo"
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 'bold' }}
          />
          <input 
            type="text" 
            value={customSubtitle} 
            onChange={e => setCustomSubtitle(e.target.value)} 
            placeholder="Subtítulo (ej. OFERTAS VÁLIDAS...)"
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
            <button 
              className={`btn ${columnsCount === 2 ? 'btn-primary' : ''}`}
              onClick={() => setColumnsCount(2)}
              style={{ borderRadius: 0, border: 'none', backgroundColor: columnsCount === 2 ? '#111827' : 'transparent', color: columnsCount === 2 ? '#fff' : 'var(--text-primary)' }}
            >
              2 Columnas
            </button>
            <button 
              className={`btn ${columnsCount === 3 ? 'btn-primary' : ''}`}
              onClick={() => setColumnsCount(3)}
              style={{ borderRadius: 0, border: 'none', backgroundColor: columnsCount === 3 ? '#111827' : 'transparent', color: columnsCount === 3 ? '#fff' : 'var(--text-primary)' }}
            >
              3 Columnas
            </button>
          </div>

          <button 
            className="btn-primary" 
            style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#e30613', border: 'none' }}
            onClick={handleGeneratePdf}
            disabled={generating || campaign.items.length === 0}
          >
            {generating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Descargar PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {generating && (
        <div style={{ textAlign: 'right', marginBottom: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {progressMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {/* CONTENEDOR VISIBLE PARA PREVIEW Y RENDERIZAR EL PDF */}
        <div style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <div id="pdf-templates-wrapper">
            <div 
              className="pdf-page-container" 
              style={{ 
                width: '794px', 
                minHeight: '1123px', // Crece hacia abajo automáticamente
                backgroundColor: '#ffffff', 
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                position: 'relative', 
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header Único */}
              <div style={{ backgroundColor: '#cc000f', padding: '20px 40px', color: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 20px rgba(204,0,15,0.15)' }}>
                <img 
                  src="/logo.png"
                  crossOrigin="anonymous" 
                  alt="Logo" 
                  style={{ height: '110px', objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo-don-venancio.png';
                  }}
                />
                
                {/* Título Centrado y Fecha */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '15px', gap: '8px' }}>
                  <h1 style={{ 
                    margin: 0, 
                    fontSize: '44px', 
                    fontWeight: 900, 
                    letterSpacing: '-1px', 
                    textAlign: 'center', 
                    fontFamily: '"Arial Black", Impact, sans-serif',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    textShadow: '2px 2px 0px rgba(0,0,0,0.3)'
                  }}>
                    {customTitle}
                  </h1>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '12px' }}>
                    <div style={{ height: '1px', width: '40px', backgroundColor: '#ffffff' }}></div>
                    <span style={{ 
                      fontSize: '18px', 
                      fontWeight: 800, 
                      color: '#ffffff', 
                      letterSpacing: '1.5px',
                    }}>
                      {customSubtitle}
                    </span>
                    <div style={{ height: '1px', width: '40px', backgroundColor: '#ffffff' }}></div>
                  </div>
                </div>
              </div>

              {/* Grid de Productos Infinito */}
              <div style={{ 
                flex: 1, 
                padding: '20px 40px', 
                display: 'grid', 
                gridTemplateColumns: columnsCount === 2 ? '1fr 1fr' : '1fr 1fr 1fr', 
                gap: '60px 40px',
                alignContent: 'start',
                paddingBottom: '80px',
                position: 'relative'
              }}>
                {(() => {
                  const groupedItems = campaign.items.reduce((acc, item) => {
                    const rubroName = item.campaignGroup || item.product?.rubro?.name || 'Varios';
                    if (!acc[rubroName]) acc[rubroName] = [];
                    acc[rubroName].push(item);
                    return acc;
                  }, {} as Record<string, typeof campaign.items>);

                  // Use custom user-defined sort order
                  const rubros = rubroOrder.filter(r => groupedItems[r]);

                  return rubros.map((rubro, index) => (
                    <React.Fragment key={rubro}>
                      {/* Cabecera del Rubro */}
                      <div style={{ 
                        gridColumn: '1 / -1', 
                        backgroundColor: '#1e293b', 
                        color: 'white', 
                        padding: '12px 24px', 
                        borderRadius: '8px',
                        marginTop: '20px',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        position: 'relative'
                      }}>
                        <span style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '2px', textTransform: 'uppercase' }}>
                          {rubro}
                        </span>
                        
                        {/* Flechas de ordenamiento - NO SE IMPRIMEN EN EL PDF */}
                        <div data-html2canvas-ignore="true" style={{ position: 'absolute', right: '20px', display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveRubro(index, 'up'); }}
                            disabled={index === 0}
                            style={{ background: index === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: '#fff', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                            title="Subir Rubro"
                          >
                            <ArrowUp size={20} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); moveRubro(index, 'down'); }}
                            disabled={index === rubros.length - 1}
                            style={{ background: index === rubros.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)', border: 'none', cursor: index === rubros.length - 1 ? 'not-allowed' : 'pointer', color: '#fff', padding: '6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                            title="Bajar Rubro"
                          >
                            <ArrowDown size={20} />
                          </button>
                        </div>
                      </div>

                      {/* Items del Rubro */}
                      {groupedItems[rubro].map(item => {
                        const regPrice = Number(item.product.listPrice) || 0;
                        const finalPrice = Number(item.offerPrice) || Number(item.product.listPrice) || 0;
                        const customTag = item.specialTag;

                        const tagWidth = columnsCount === 2 ? 150 : 110;
                        const tagHeight = columnsCount === 2 ? 80 : 60;

                        return (
                          <div key={item.id} style={{ display: 'flex', flexDirection: 'column', position: 'relative', minHeight: columnsCount === 2 ? '340px' : '240px' }}>
                            
                            {/* Contenedor Imagen */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '10px 20px 0px 20px', position: 'relative', minHeight: columnsCount === 2 ? '200px' : '140px' }}>
                              {item.product.imageUrl ? (
                                <img 
                                  src={item.product.imageUrl.startsWith('http') ? item.product.imageUrl : (item.product.imageUrl.startsWith('/') ? `${item.product.imageUrl}?v=1.3` : `/uploads/products/${item.product.imageUrl}?v=1.3`)} 
                                  crossOrigin="anonymous"
                                  alt={item.product.name} 
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `/uploads/products/${String(item.product.sku).padStart(4, '0')}.jpg`;
                                  }}
                                />
                              ) : (
                                <img 
                                  src={`/uploads/products/${String(item.product.sku).padStart(4, '0')}.jpg`} 
                                  crossOrigin="anonymous"
                                  alt={item.product.name} 
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }}
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              )}

                              {/* Etiqueta de Precio */}
                              <div style={{ 
                                position: 'absolute', 
                                top: columnsCount === 2 ? '0px' : '-5px', 
                                right: columnsCount === 2 ? '-10px' : '-5px', 
                                width: `${tagWidth}px`, 
                                height: columnsCount === 2 ? '120px' : '90px',
                                zIndex: 10,
                                fontFamily: '"Arial Black", Impact, sans-serif'
                              }}>
                                {/* Precio Anterior Globo (Opcional) */}
                                {item.previousPrice && Number(item.previousPrice) > 0 && (
                                  <div style={{
                                    position: 'absolute',
                                    top: columnsCount === 2 ? '-5px' : '-2px',
                                    right: columnsCount === 2 ? '-10px' : '-5px',
                                    backgroundColor: '#fbbf24', // Amarillo cálido
                                    padding: columnsCount === 2 ? '4px 12px' : '3px 10px',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    zIndex: 20, // Ahora está por encima del SVG (11)
                                    transform: 'rotate(3deg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
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
                                      ${Number(item.previousPrice).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                    </span>
                                  </div>
                                )}

                                {/* Precio Oferta SVG */}
                                <div style={{
                                  position: 'absolute',
                                  bottom: '15px',
                                  left: '0px',
                                  width: `${tagWidth}px`,
                                  height: `${tagHeight}px`,
                                  zIndex: 11
                                }}>
                                  <svg width={tagWidth + 20} height={tagHeight + 20} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1, overflow: 'visible' }}>
                                    <rect x="0" y="4" width={tagWidth} height={tagHeight} rx="16" fill="rgba(0,0,0,0.05)" />
                                    <rect x="0" y="8" width={tagWidth} height={tagHeight} rx="16" fill="rgba(0,0,0,0.10)" />
                                    <rect x="0" y="12" width={tagWidth} height={tagHeight} rx="16" fill="rgba(0,0,0,0.05)" />
                                    <rect x="0" y="0" width={tagWidth} height={tagHeight} rx="16" fill="#ffffff" />
                                    <rect x="4" y="4" width={tagWidth - 8} height={tagHeight - 8} rx="12" fill="#e30613" />
                                  </svg>

                                  <div style={{
                                    position: 'relative',
                                    zIndex: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    height: '100%'
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
                                </div>

                                {/* Etiqueta Especial */}
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
                            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                              <div style={{ 
                                fontSize: columnsCount === 2 ? '22px' : '16px', 
                                fontWeight: 800, 
                                color: '#0f172a', 
                                lineHeight: '1.1',
                                letterSpacing: '-0.5px',
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {item.product.name.toUpperCase()}
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </React.Fragment>
                  ));
                })()}
              </div>

              {/* Pie de Página */}
              <div style={{ 
                backgroundColor: '#0f172a', 
                color: '#ffffff', 
                padding: '12px 40px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                fontSize: '13px', 
                fontWeight: 600,
                boxShadow: '0 -4px 10px rgba(0,0,0,0.1)',
                zIndex: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', backgroundColor: '#e30613', borderRadius: '50%', flexShrink: 0 }}></div>
                  <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px' }}>
                    ESTA LISTA ESTÁ SUJETA A MODIFICACIONES
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <img 
                    src="/logo.png" 
                    crossOrigin="anonymous" 
                    alt="Logo Final" 
                    style={{ height: '32px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/logo-don-venancio.png';
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
