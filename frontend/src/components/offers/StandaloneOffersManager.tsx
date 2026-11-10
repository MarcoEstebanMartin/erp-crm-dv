import React, { useState, useEffect, useMemo, useRef } from 'react';
import { parseExcelFileInBrowser } from '../../utils/excelBrowserReader';
import { 
  FileSpreadsheet, 
  Upload, 
  Sparkles, 
  Share2, 
  Printer, 
  Plus, 
  Trash2, 
  Search, 
  Check, 
  Copy, 
  Calendar, 
  ArrowLeft, 
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import maestroProductsData from '../../utils/maestro_products.json';
import initialWeeklyOffers from '../../utils/initial_weekly_offers.json';
import OffersCatalogGenerator from '../admin/OffersCatalogGenerator';

export interface CatalogProduct {
  id: number | string;
  sku: string;
  name: string;
  listPrice: number;
  category?: string;
  rubro?: string;
  hasPhoto?: boolean;
  imageUrl?: string | null;
  description?: string;
}

export interface WeeklyOfferItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  listPrice: number;
  offerPrice: number;
  discountPercent: number;
  specialTag: string;
  imageUrl?: string | null;
}

export interface WeeklyCampaign {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  subtitle?: string;
  notes?: string;
  customRubroOrder?: string[];
  items: WeeklyOfferItem[];
}

function normalizeText(s: string) {
  return (s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestCatalogMatch(rawName: string, catalogList: CatalogProduct[]) {
  const norm = normalizeText(rawName);
  let best: CatalogProduct | null = null;
  let maxScore = 0;

  const wordsDesc = norm.split(' ').filter(w => w.length > 2 && !['PARA', 'CON', 'LOS', 'LAS', 'POR', 'KG', 'GRS', 'GR', 'ML', 'LT', 'LTS'].includes(w));

  for (const p of catalogList) {
    const pNorm = normalizeText(p.name);
    if (pNorm === norm) return p;

    const wordsP = new Set(pNorm.split(' ').filter(w => w.length > 2));
    let score = 0;
    for (const w of wordsDesc) {
      if (wordsP.has(w)) score += 2;
      else {
        for (const pw of wordsP) {
          if (pw.includes(w) || w.includes(pw)) {
            score += 1;
            break;
          }
        }
      }
    }
    if (score > maxScore && score >= 2) {
      maxScore = score;
      best = p;
    }
  }
  return best;
}

export default function StandaloneOffersManager({ onBackToLogin }: { onBackToLogin?: () => void }) {
  // 1. Catálogo maestro de productos (366 productos con fotos y precios de lista)
  const [catalog, setCatalog] = useState<CatalogProduct[]>(() => {
    try {
      const saved = localStorage.getItem('dv_custom_catalog_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading saved catalog:', e);
    }
    return (maestroProductsData as any[]).map(p => ({
      id: p.sku,
      sku: String(p.sku).padStart(4, '0'),
      name: p.name,
      listPrice: Number(p.listPrice) || 0,
      category: p.category || p.rubro || 'VARIOS',
      rubro: p.rubro || 'VARIOS',
      hasPhoto: !!p.hasPhoto,
      imageUrl: p.imageUrl || `/uploads/products/${String(p.sku).padStart(4, '0')}.jpg`,
      description: ''
    }));
  });

  // 2. Campañas guardadas (inicia directamente con la campaña de OFERTAS 07-09 con sus 66 productos)
  const [savedCampaigns, setSavedCampaigns] = useState<WeeklyCampaign[]>(() => {
    try {
      const saved = localStorage.getItem('dv_saved_campaigns_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading saved campaigns:', e);
    }
    return [initialWeeklyOffers as unknown as WeeklyCampaign];
  });

  const [activeCampaignId, setActiveCampaignId] = useState<string>(() => savedCampaigns[0]?.id || 'semana-07-09');

  // Campaña activa actual
  const activeCampaign = useMemo(() => {
    return savedCampaigns.find(c => c.id === activeCampaignId) || savedCampaigns[0];
  }, [savedCampaigns, activeCampaignId]);

  // Estados de interfaz
  const [view, setView] = useState<'editor' | 'catalog'>('editor');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [catalogUploadSuccessMsg, setCatalogUploadSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Adaptación de campaña para el generador PDF oficial
  const adaptedCampaignForCatalog = useMemo(() => {
    return {
      id: activeCampaign.id,
      title: activeCampaign.title || 'OFERTAS SEMANALES',
      startDate: activeCampaign.startDate || new Date().toISOString().split('T')[0],
      endDate: activeCampaign.endDate || null,
      customRubroOrder: activeCampaign.customRubroOrder,
      items: activeCampaign.items.map(it => {
        const cleanSku = String(it.sku || '').padStart(4, '0');
        const photoUrl = it.imageUrl || `/uploads/products/${cleanSku}.jpg`;

        return {
          id: it.id,
          offerPrice: it.offerPrice,
          specialTag: it.specialTag || null,
          previousPrice: it.listPrice,
          campaignGroup: it.category,
          product: {
            id: cleanSku,
            sku: cleanSku,
            name: it.name,
            listPrice: it.listPrice,
            imageUrl: photoUrl,
            rubro: { name: it.category }
          }
        };
      })
    };
  }, [activeCampaign]);

  // Guardar campañas en localStorage cuando cambian
  useEffect(() => {
    try {
      localStorage.setItem('dv_saved_campaigns_v3', JSON.stringify(savedCampaigns));
    } catch (e) {
      console.warn('Error saving campaigns:', e);
    }
  }, [savedCampaigns]);

  // Actualizar la campaña activa
  const updateActiveCampaign = (updater: (prev: WeeklyCampaign) => WeeklyCampaign) => {
    setSavedCampaigns(prev => prev.map(c => c.id === activeCampaign.id ? updater(c) : c));
  };

  // 3. Lector Universal de Excel: lee OFERTAS-*.xlsx o Maestro1.xlsx (sobre ExcelJS seguro)
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const wb = await parseExcelFileInBrowser(file);

      // Si tiene hoja "Productos", es un Maestro de catálogo
      if (wb.sheetNames.includes('Productos')) {
        const rawProducts = wb.sheetToObjects('Productos');
        const newProducts: CatalogProduct[] = rawProducts.map(p => {
          const cleanSku = String(p.SKU || '').trim().padStart(4, '0');
          return {
            id: cleanSku,
            sku: cleanSku,
            name: String(p.PRODUCTO || '').trim(),
            listPrice: Number(p['PRECIO FINAL']) || Number(p['PRECIO SIN IVA']) || 0,
            category: String(p.SUBRUBRO || p.RUBRO || 'VARIOS').trim().toUpperCase(),
            rubro: String(p.RUBRO || 'VARIOS').trim().toUpperCase(),
            hasPhoto: true,
            imageUrl: `/uploads/products/${cleanSku}.jpg`
          };
        });

        setCatalog(newProducts);
        localStorage.setItem('dv_custom_catalog_v2', JSON.stringify(newProducts));
        setCatalogUploadSuccessMsg(`¡Éxito! Se actualizaron ${newProducts.length} productos maestros del catálogo.`);
        setIsExcelModalOpen(false);
        setTimeout(() => setCatalogUploadSuccessMsg(null), 5000);
        return;
      }

      // Si es una planilla de ofertas semanales (como OFERTAS-07-09.xlsx)
      const wsName = wb.sheetNames[0];
      const rawData = wsName ? wb.sheetToMatrix(wsName) : [];

      if (rawData.length < 2) {
        alert('El archivo no parece tener datos suficientes.');
        return;
      }

        let currentRubro = 'MELINCUE';
        const parsedItems: WeeklyOfferItem[] = [];
        const detectedRubros: string[] = [];
        let detectedSubtitle = '';

        rawData.forEach((r: any[], idx: number) => {
          if (!r || r.length === 0) return;
          const colA = (r[0] || '').toString().trim();
          const colB = (r[1] || '').toString().trim();
          const colC = r[2];

          // Detección de Vigencia / Fecha
          if (idx === 0 && colB.toUpperCase().includes('VIGENCIA')) {
            detectedSubtitle = colB.trim();
            return;
          }

          // Detección de Rubro / Sección
          if (r.length === 1 || (colB && colC === undefined && typeof colB === 'string' && isNaN(Number(colB.replace(/\s/g, ''))))) {
            const possibleRubro = (colB || colA).trim();
            if (possibleRubro.length > 2 && !possibleRubro.includes('CADA 1 CAJA') && !possibleRubro.includes('PRECIO POR CAJA')) {
              currentRubro = possibleRubro.toUpperCase();
              if (!detectedRubros.includes(currentRubro)) detectedRubros.push(currentRubro);
              return;
            }
          }

          // Subrubro en columna A
          if (colA && ['CONSERVAS', 'PASTAS SECAS', 'ADEREZOS', 'VARIOS', 'FIAMBRES', 'YERBAS', 'PAPELES'].includes(colA.toUpperCase())) {
            currentRubro = colA.toUpperCase();
            if (!detectedRubros.includes(currentRubro)) detectedRubros.push(currentRubro);
          }

          let desc = '';
          let price = 0;
          if (typeof colC === 'number') {
            desc = colB || colA;
            price = colC;
          } else if (typeof colB === 'number') {
            desc = colA;
            price = colB;
          } else if (typeof colC === 'string') {
            const parsed = parseFloat(colC.replace(/[^0-9,-]+/g, '').replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) {
              desc = colB || colA;
              price = parsed;
            }
          }

          if (desc && price > 0) {
            let tag = '';
            let cleanName = desc;

            if (desc.includes('OFERTON')) {
              tag = 'OFERTÓN';
              cleanName = cleanName.replace(/OFERTON/gi, '').trim();
            } else if (desc.includes('C/U $') || desc.includes('( C/U')) {
              const matchTag = desc.match(/\(\s*C\/U\s*\$[0-9]+\s*\)/i);
              if (matchTag) {
                tag = matchTag[0];
                cleanName = cleanName.replace(matchTag[0], '').trim();
              }
            } else if (desc.includes('CADA 6 BOTELLAS')) {
              tag = '6+ x $21.499 C/U';
            } else if (desc.includes('CADA 12 BOTELLAS')) {
              tag = '12+ x $16.350 C/U';
            } else if (desc.includes('CADA 1 CAJA')) {
              tag = 'PRECIO POR CAJA';
            } else if (desc.includes('CADA 2 CAJAS')) {
              tag = 'LLEVANDO 2 CAJAS';
            } else if (desc.includes('NO REFRIGERADA')) {
              tag = 'NO REFRIGERADA';
              cleanName = cleanName.replace(/NO REFRIGERADA/gi, '').trim();
            }

            const matched = findBestCatalogMatch(cleanName, catalog);
            const sku = matched ? matched.sku : 'OFR-' + String(parsedItems.length + 1).padStart(3, '0');
            const listPrice = matched && matched.listPrice > 0 ? matched.listPrice : Math.round(price * 1.15);
            const discount = listPrice > price ? Math.round(((listPrice - price) / listPrice) * 100) : 0;
            const finalPhoto = `/uploads/products/${sku}.jpg`;

            parsedItems.push({
              id: `item-${Date.now()}-${idx}`,
              sku: sku,
              name: matched ? matched.name : cleanName.replace(/\s+/g, ' ').trim(),
              category: currentRubro,
              listPrice: listPrice,
              offerPrice: price,
              discountPercent: discount,
              specialTag: tag,
              imageUrl: finalPhoto
            });
          }
        });

        if (parsedItems.length > 0) {
          const campaignName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').toUpperCase();
          const today = new Date().toISOString().split('T')[0];

          const newCampaign: WeeklyCampaign = {
            id: `camp-${Date.now()}`,
            title: campaignName.includes('OFERTAS') ? campaignName : `OFERTAS ${campaignName}`,
            startDate: today,
            endDate: today,
            subtitle: detectedSubtitle || undefined,
            customRubroOrder: detectedRubros,
            items: parsedItems
          };

          setSavedCampaigns(prev => [newCampaign, ...prev]);
          setActiveCampaignId(newCampaign.id);
          setCatalogUploadSuccessMsg(`¡Éxito! Se cargaron ${parsedItems.length} ofertas semanales y ${detectedRubros.length} rubros desde tu archivo.`);
          setIsExcelModalOpen(false);
          setTimeout(() => setCatalogUploadSuccessMsg(null), 5000);
        } else {
          alert('No se pudieron extraer productos en oferta del archivo.');
        }
      } catch (err: any) {
        console.error('Error procesando Excel:', err);
        alert('Error al leer el archivo Excel: ' + err.message);
      } finally {
        e.target.value = '';
      }
  };

  // 4. Agregar producto a la campaña activa
  const handleAddProductToOffers = (product: CatalogProduct) => {
    if (activeCampaign.items.some(it => it.sku === product.sku)) {
      return;
    }

    const defaultDiscount = 10;
    const defaultOfferPrice = Math.round(product.listPrice * (1 - defaultDiscount / 100));

    const newItem: WeeklyOfferItem = {
      id: `${product.sku}-${Date.now()}`,
      sku: product.sku,
      name: product.name,
      category: product.category || 'VARIOS',
      listPrice: product.listPrice,
      offerPrice: defaultOfferPrice,
      discountPercent: defaultDiscount,
      specialTag: '',
      imageUrl: product.imageUrl || `/uploads/products/${product.sku}.jpg`
    };

    updateActiveCampaign(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Quitar producto de la campaña
  const handleRemoveItem = (itemId: string) => {
    updateActiveCampaign(prev => ({
      ...prev,
      items: prev.items.filter(it => it.id !== itemId)
    }));
  };

  // Cambiar precio de oferta o porcentaje
  const handleOfferPriceChange = (itemId: string, newPrice: number) => {
    updateActiveCampaign(prev => ({
      ...prev,
      items: prev.items.map(it => {
        if (it.id !== itemId) return it;
        const discount = it.listPrice > 0 
          ? Math.max(0, Math.round(((it.listPrice - newPrice) / it.listPrice) * 100))
          : 0;
        return {
          ...it,
          offerPrice: newPrice,
          discountPercent: discount
        };
      })
    }));
  };

  const handleDiscountPercentChange = (itemId: string, newPercent: number) => {
    updateActiveCampaign(prev => ({
      ...prev,
      items: prev.items.map(it => {
        if (it.id !== itemId) return it;
        const calculatedPrice = Math.round(it.listPrice * (1 - newPercent / 100));
        return {
          ...it,
          discountPercent: newPercent,
          offerPrice: calculatedPrice
        };
      })
    }));
  };

  const handleTagChange = (itemId: string, tag: string) => {
    updateActiveCampaign(prev => ({
      ...prev,
      items: prev.items.map(it => it.id === itemId ? { ...it, specialTag: tag } : it)
    }));
  };

  // 5. Filtrar catálogo para búsqueda
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return catalog.filter(p => {
      const matchQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCat = selectedCategory === 'TODOS' || (p.category && p.category.toUpperCase() === selectedCategory);
      return matchQuery && matchCat;
    }).slice(0, 60);
  }, [catalog, searchQuery, selectedCategory]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach(p => {
      if (p.category) set.add(p.category.toUpperCase());
    });
    return ['TODOS', ...Array.from(set).sort()];
  }, [catalog]);

  // 6. Generador de texto para WhatsApp
  const generateWhatsAppMessage = () => {
    let msg = `🔥 *OFERTAS DE LA SEMANA - DV DISTRIBUIDORA* 🔥\n`;
    msg += `📅 *Vigencia:* ${activeCampaign.startDate || 'Semana'} al ${activeCampaign.endDate || 'Fin de semana'}\n\n`;

    if (activeCampaign.items.length === 0) {
      msg += `_(Aún no hay productos cargados en esta oferta)_\n`;
    } else {
      const grouped: Record<string, WeeklyOfferItem[]> = {};
      activeCampaign.items.forEach(it => {
        const cat = it.category || 'VARIOS';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(it);
      });

      Object.entries(grouped).forEach(([cat, items]) => {
        msg += `📌 *${cat.toUpperCase()}*\n`;
        items.forEach(it => {
          const discountStr = it.discountPercent > 0 ? ` (-${it.discountPercent}%)` : '';
          const tagStr = it.specialTag ? ` 🏷️ _[${it.specialTag}]_` : '';
          msg += `• *${it.name}*\n`;
          msg += `  Antes: ~$${it.listPrice.toLocaleString('es-AR')}~ ➔ *OFERTA: $${it.offerPrice.toLocaleString('es-AR')}*${discountStr}${tagStr}\n\n`;
        });
      });
    }

    msg += `📦 _Consultas y pedidos respondiendo directamente a este mensaje._\n`;
    msg += `🚚 _Envíos programados a tu zona._`;

    return msg;
  };

  const handleCopyWhatsApp = () => {
    const text = generateWhatsAppMessage();
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    });
  };

  // Si estamos en vista catálogo, mostramos el generador PDF oficial del ERP
  if (view === 'catalog') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '20px 0' }}>
        <OffersCatalogGenerator
          campaignData={adaptedCampaignForCatalog}
          onBack={() => setView('editor')}
          onUpdateRubroOrder={(newOrder) => {
            updateActiveCampaign(prev => ({
              ...prev,
              customRubroOrder: newOrder
            }));
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', color: '#111827', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
      {/* Barra Superior Header */}
      <header style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {onBackToLogin && (
            <button
              onClick={onBackToLogin}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #E5E7EB',
                backgroundColor: '#FFFFFF',
                color: '#4B5563',
                fontSize: '13px',
                cursor: 'pointer'
              }}
              title="Volver al acceso"
            >
              <ArrowLeft size={16} /> Volver
            </button>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                {activeCampaign.title || 'Ofertas Semanales'}
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'rgba(227, 6, 19, 0.08)',
                color: '#E30613',
                padding: '2px 8px',
                borderRadius: '999px',
                letterSpacing: '0.04em'
              }}>
                EDICIÓN ACTIVA
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0 0' }}>
              Ofertas cargadas: <strong>{activeCampaign.items.length}</strong> artículos | Catálogo maestro: <strong>{catalog.length}</strong>
            </p>
          </div>
        </div>

        {/* Acciones principales de cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Botón Excel */}
          <button
            onClick={() => setIsExcelModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              color: '#059669',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={16} color="#059669" />
            <span>Cargar Excel Semanal</span>
          </button>

          {/* Botón WhatsApp */}
          <button
            onClick={() => setIsWhatsAppModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(37, 211, 102, 0.2)'
            }}
          >
            <Share2 size={15} />
            <span>WhatsApp</span>
          </button>

          {/* Botón Generar Catálogo PDF */}
          <button
            onClick={() => {
              if (activeCampaign.items.length === 0) {
                alert('Agregá al menos un producto a la oferta antes de generar el catálogo.');
                return;
              }
              setView('catalog');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#cc000f',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(204, 0, 15, 0.25)'
            }}
          >
            <Printer size={16} />
            <span>Generar Catálogo PDF</span>
          </button>
        </div>
      </header>

      {/* Banner de feedback */}
      {catalogUploadSuccessMsg && (
        <div style={{
          backgroundColor: '#ECFDF5',
          borderBottom: '1px solid #A7F3D0',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#065F46'
        }}>
          <Check size={16} />
          <span>{catalogUploadSuccessMsg}</span>
        </div>
      )}

      {/* Contenedor Principal: 2 Columnas */}
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: '420px 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* COLUMNA IZQUIERDA: Buscador y Catálogo de Productos con Miniaturas */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          padding: '16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
              Catálogo de Productos ({filteredCatalog.length})
            </h2>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>
              366 con fotos
            </span>
          </div>

          {/* Buscador */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Filtro por Categoría */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: selectedCategory === cat ? '#111827' : '#E5E7EB',
                  backgroundColor: selectedCategory === cat ? '#111827' : '#F9FAFB',
                  color: selectedCategory === cat ? '#FFFFFF' : '#4B5563',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Lista de productos para agregar */}
          <div style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredCatalog.map(p => {
              const isAlreadyAdded = activeCampaign.items.some(it => it.sku === p.sku);

              return (
                <div
                  key={p.sku}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #F3F4F6',
                    backgroundColor: isAlreadyAdded ? '#F3F4F6' : '#FAFAFA',
                    opacity: isAlreadyAdded ? 0.6 : 1,
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', paddingRight: '8px' }}>
                    {/* Miniatura Foto de Producto */}
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '6px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                      padding: '2px'
                    }}>
                      <img 
                        src={`/uploads/products/${p.sku}.jpg`}
                        alt={p.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>

                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6B7280', backgroundColor: '#E5E7EB', padding: '1px 4px', borderRadius: '3px' }}>
                          {p.sku}
                        </span>
                        <span style={{ fontSize: '10px', color: '#9CA3AF' }}>{p.category}</span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={p.name}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#4B5563', marginTop: '1px' }}>
                        Lista: <strong>${p.listPrice.toLocaleString('es-AR')}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddProductToOffers(p)}
                    disabled={isAlreadyAdded}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '30px',
                      height: '30px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: isAlreadyAdded ? '#D1D5DB' : '#111827',
                      backgroundColor: isAlreadyAdded ? '#E5E7EB' : '#111827',
                      color: isAlreadyAdded ? '#9CA3AF' : '#FFFFFF',
                      cursor: isAlreadyAdded ? 'default' : 'pointer',
                      flexShrink: 0
                    }}
                    title={isAlreadyAdded ? 'Ya incluido' : 'Agregar a la oferta'}
                  >
                    {isAlreadyAdded ? <Check size={14} /> : <Plus size={16} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMNA DERECHA: Editor de Ofertas Activas con Fotos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Barra de Control de Campaña */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select
                value={activeCampaign.id}
                onChange={(e) => setActiveCampaignId(e.target.value)}
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#111827',
                  cursor: 'pointer'
                }}
              >
                {savedCampaigns.map(c => (
                  <option key={c.id} value={c.id}>{c.title} ({c.items.length} ofertas)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#4B5563' }}>
                <Calendar size={14} />
                <span>Vigencia:</span>
                <input
                  type="date"
                  value={activeCampaign.startDate}
                  onChange={(e) => updateActiveCampaign(prev => ({ ...prev, startDate: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                />
              </div>

              <div style={{ fontSize: '13px', fontWeight: 700, color: '#E30613', backgroundColor: 'rgba(227,6,19,0.06)', padding: '4px 10px', borderRadius: '4px' }}>
                {activeCampaign.items.length} artículos en oferta
              </div>
            </div>
          </div>

          {/* Tabla de Productos en Oferta con Fotos */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                Artículos en Oferta ({activeCampaign.items.length})
              </h2>
              {activeCampaign.items.length > 0 && (
                <button
                  onClick={() => updateActiveCampaign(prev => ({ ...prev, items: [] }))}
                  style={{
                    fontSize: '11px',
                    color: '#EF4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Vaciar lista
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '10px 16px', fontWeight: 600, width: '60px' }}>Foto</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, width: '70px' }}>SKU</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600 }}>Producto</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, width: '130px' }}>Precio Lista</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, width: '140px' }}>Precio Oferta</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, width: '90px' }}>Desc. %</th>
                    <th style={{ padding: '10px 16px', fontWeight: 600, width: '180px' }}>Etiqueta / Condición</th>
                    <th style={{ padding: '10px 16px', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {activeCampaign.items.map((item, index) => {
                    const cleanSku = String(item.sku).padStart(4, '0');

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #F3F4F6',
                          backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                        }}
                      >
                        {/* Miniatura Foto */}
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '6px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            padding: '2px'
                          }}>
                            <img 
                              src={`/uploads/products/${cleanSku}.jpg`}
                              alt={item.name}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#6B7280', fontSize: '12px' }}>
                          {cleanSku}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Rubro: {item.category}</div>
                        </td>

                        <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                          <span style={{ textDecoration: 'line-through' }}>
                            ${item.listPrice.toLocaleString('es-AR')}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#E30613', fontWeight: 700 }}>$</span>
                            <input
                              type="number"
                              value={item.offerPrice}
                              onChange={(e) => handleOfferPriceChange(item.id, Number(e.target.value))}
                              style={{
                                width: '90px',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                border: '1px solid #D1D5DB',
                                fontWeight: 700,
                                color: '#E30613',
                                fontSize: '13px'
                              }}
                            />
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              value={item.discountPercent}
                              onChange={(e) => handleDiscountPercentChange(item.id, Number(e.target.value))}
                              style={{
                                width: '50px',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                border: '1px solid #D1D5DB',
                                fontWeight: 600,
                                fontSize: '13px'
                              }}
                            />
                            <span style={{ color: '#4B5563' }}>%</span>
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <input
                            type="text"
                            placeholder="ej: OFERTÓN"
                            value={item.specialTag}
                            onChange={(e) => handleTagChange(item.id, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #D1D5DB',
                              fontSize: '12px'
                            }}
                          />
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#9CA3AF',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            title="Quitar de la oferta"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Subir Archivo Excel */}
      {isExcelModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#059669" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Cargar Archivo Excel</h3>
              </div>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.5, marginBottom: '20px' }}>
              Podés subir tu archivo de <strong>Ofertas Semanales</strong> (ej: <code>OFERTAS-07-09.xlsx</code>) o el <strong>Catálogo Maestro</strong> (<code>Maestro1.xlsx</code>). El sistema detecta automáticamente el formato, los rubros, precios y empareja las fotos de catálogo.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #D1D5DB',
                borderRadius: '8px',
                padding: '32px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#F9FAFB',
                transition: 'all 0.15s'
              }}
            >
              <Upload size={32} color="#4B5563" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                Hacé clic aquí para elegir tu archivo Excel
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                Soporta archivos .xlsx
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleExcelUpload}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #D1D5DB',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Exportar para WhatsApp */}
      {isWhatsAppModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '560px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={20} color="#25D366" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Texto para Difusión por WhatsApp</h3>
              </div>
              <button
                onClick={() => setIsWhatsAppModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <textarea
              readOnly
              value={generateWhatsAppMessage()}
              rows={12}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid #D1D5DB',
                backgroundColor: '#F9FAFB',
                fontSize: '13px',
                fontFamily: 'monospace',
                lineHeight: 1.4,
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />

            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: copiedSuccess ? '#059669' : '#6B7280', fontWeight: 500 }}>
                {copiedSuccess ? '✅ ¡Copiado al portapapeles!' : 'Hacé clic para copiar'}
              </span>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCopyWhatsApp}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#25D366',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Copy size={15} />
                  Copiar Mensaje
                </button>

                <button
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #D1D5DB',
                    backgroundColor: '#FFFFFF',
                    color: '#374151',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
