import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  Tag, 
  ArrowLeft, 
  Save, 
  Download,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import defaultProductsData from '../../utils/products_data.json';

export interface CatalogProduct {
  id: number | string;
  sku: string;
  name: string;
  listPrice: number;
  category?: string;
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
}

export interface WeeklyCampaign {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
  items: WeeklyOfferItem[];
}

const DEFAULT_TAGS = [
  'SUPER OFERTA',
  'LLEVANDO 3+',
  'LLEVANDO BULTO',
  'COMBO SEMANAL',
  'HASTA AGOTAR STOCK',
  'PRECIO BOMBA',
  'DESTACADO'
];

export default function StandaloneOffersManager({ onBackToLogin }: { onBackToLogin?: () => void }) {
  // 1. Catálogo de productos (Cargado de LocalStorage o por defecto de products_data.json)
  const [catalog, setCatalog] = useState<CatalogProduct[]>(() => {
    try {
      const saved = localStorage.getItem('dv_custom_catalog');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading saved catalog:', e);
    }
    return (defaultProductsData as any[]).map(p => ({
      id: p.id || p.sku,
      sku: String(p.sku).padStart(4, '0'),
      name: p.name,
      listPrice: Number(p.listPrice) || 0,
      category: p.category || 'VARIOS',
      description: p.description || ''
    }));
  });

  // 2. Campañas guardadas
  const [savedCampaigns, setSavedCampaigns] = useState<WeeklyCampaign[]>(() => {
    try {
      const saved = localStorage.getItem('dv_saved_campaigns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading saved campaigns:', e);
    }
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return [{
      id: 'default-1',
      title: 'Ofertas Semanales',
      startDate: today.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
      notes: 'Precios válidos para entrega inmediata hasta agotar stock.',
      items: []
    }];
  });

  const [activeCampaignId, setActiveCampaignId] = useState<string>(() => savedCampaigns[0]?.id || 'default-1');

  // Campaña activa actual
  const activeCampaign = useMemo(() => {
    return savedCampaigns.find(c => c.id === activeCampaignId) || savedCampaigns[0];
  }, [savedCampaigns, activeCampaignId]);

  // Estados de interfaz
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isFlyerModalOpen, setIsFlyerModalOpen] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [catalogUploadSuccessMsg, setCatalogUploadSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Guardar campañas en localStorage cuando cambian
  useEffect(() => {
    try {
      localStorage.setItem('dv_saved_campaigns', JSON.stringify(savedCampaigns));
    } catch (e) {
      console.warn('Error saving campaigns:', e);
    }
  }, [savedCampaigns]);

  // Actualizar la campaña activa
  const updateActiveCampaign = (updater: (prev: WeeklyCampaign) => WeeklyCampaign) => {
    setSavedCampaigns(prev => prev.map(c => c.id === activeCampaign.id ? updater(c) : c));
  };

  // 3. Subir y procesar archivo Excel (.xlsx, .xls, .csv)
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (rawData.length < 2) {
          alert('El archivo no parece tener datos suficientes.');
          return;
        }

        // Detectar encabezados
        const headerRow: string[] = (rawData[0] || []).map((h: any) => String(h || '').trim().toUpperCase());
        
        let skuIdx = headerRow.findIndex(h => h.includes('SKU') || h.includes('COD') || h.includes('ART'));
        let nameIdx = headerRow.findIndex(h => h.includes('NOM') || h.includes('DESC') || h.includes('DETALLE') || h.includes('PRODUCTO'));
        let priceIdx = headerRow.findIndex(h => h.includes('LISTA') || h.includes('PRECIO') || h.includes('VENTA') || h.includes('COSTO'));
        let catIdx = headerRow.findIndex(h => h.includes('RUBRO') || h.includes('CAT') || h.includes('GRUPO') || h.includes('FAMILIA'));

        // Fallbacks inteligentes si los encabezados varían
        if (skuIdx === -1) skuIdx = 0;
        if (nameIdx === -1) nameIdx = 1;
        if (priceIdx === -1) priceIdx = headerRow.length > 2 ? 2 : 1;

        const newProducts: CatalogProduct[] = [];

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;

          const rawSku = row[skuIdx];
          const rawName = row[nameIdx];
          const rawPrice = row[priceIdx];
          const rawCat = catIdx !== -1 ? row[catIdx] : 'GENERAL';

          if (!rawName) continue;

          let parsedPrice = 0;
          if (typeof rawPrice === 'number') {
            parsedPrice = rawPrice;
          } else if (typeof rawPrice === 'string') {
            parsedPrice = parseFloat(rawPrice.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
          }

          const cleanSku = rawSku ? String(rawSku).trim() : `ITEM-${i}`;

          newProducts.push({
            id: cleanSku,
            sku: cleanSku.padStart(4, '0'),
            name: String(rawName).trim(),
            listPrice: parsedPrice,
            category: rawCat ? String(rawCat).trim().toUpperCase() : 'GENERAL'
          });
        }

        if (newProducts.length > 0) {
          setCatalog(newProducts);
          localStorage.setItem('dv_custom_catalog', JSON.stringify(newProducts));
          setCatalogUploadSuccessMsg(`¡Éxito! Se cargaron ${newProducts.length} productos desde tu archivo Excel.`);
          setIsExcelModalOpen(false);
          setTimeout(() => setCatalogUploadSuccessMsg(null), 5000);
        } else {
          alert('No se pudieron extraer productos del archivo.');
        }
      } catch (err: any) {
        console.error('Error procesando Excel:', err);
        alert('Error al leer el archivo Excel: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Restaurar catálogo original
  const handleResetToDefaultCatalog = () => {
    if (confirm('¿Restaurar el catálogo original de DV Distribuidora?')) {
      localStorage.removeItem('dv_custom_catalog');
      const defaults = (defaultProductsData as any[]).map(p => ({
        id: p.id || p.sku,
        sku: String(p.sku).padStart(4, '0'),
        name: p.name,
        listPrice: Number(p.listPrice) || 0,
        category: p.category || 'VARIOS',
        description: p.description || ''
      }));
      setCatalog(defaults);
      setCatalogUploadSuccessMsg('Se restauró el catálogo predeterminado de DV Distribuidora.');
      setTimeout(() => setCatalogUploadSuccessMsg(null), 4000);
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
      specialTag: ''
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

  // 5. Motor de sugerencias inteligentes (Reglas de la distribuidora)
  const handleSuggestWeeklySelection = () => {
    const selectedSkus = new Set(activeCampaign.items.map(it => it.sku));
    const toAdd: WeeklyOfferItem[] = [];

    const pickFirstMatching = (predicate: (p: CatalogProduct) => boolean, tag = '', discount = 12) => {
      const match = catalog.find(p => !selectedSkus.has(p.sku) && predicate(p));
      if (match) {
        selectedSkus.add(match.sku);
        const calculatedPrice = Math.round(match.listPrice * (1 - discount / 100));
        toAdd.push({
          id: `${match.sku}-${Date.now()}-${Math.random()}`,
          sku: match.sku,
          name: match.name,
          category: match.category || 'VARIOS',
          listPrice: match.listPrice,
          offerPrice: calculatedPrice,
          discountPercent: discount,
          specialTag: tag
        });
      }
    };

    // 1. Queso Duro
    pickFirstMatching(p => /SARDO|REGGIANITO|PROVOLONE|SBRINZ|GOYA/i.test(p.name), 'SUPER OFERTA', 15);
    // 2. Queso Semiduro
    pickFirstMatching(p => /TYBO|GOUDA|DANBO|HOLANDO|BARRA/i.test(p.name), 'LLEVANDO 3+', 12);
    // 3. Queso Blando / Mozzarella
    pickFirstMatching(p => /MOZZARELLA|CREMOSO|SALUT/i.test(p.name), 'COMBO SEMANAL', 10);
    // 4. Lácteo Cremigal
    pickFirstMatching(p => /CREMIGAL|DULCE|MANTECA|YOGURT/i.test(p.name), 'DESTACADO', 12);
    // 5. Bebida
    pickFirstMatching(p => /BAGGIO|VIDA|DR\.LEMON|FERNET|VINO/i.test(p.name), 'PRECIO BOMBA', 14);
    // 6. Almacén
    pickFirstMatching(p => /GIACOMO|AMANDA|NATURA|MAYONESA|YERBA/i.test(p.name), 'HASTA AGOTAR STOCK', 10);

    if (toAdd.length > 0) {
      updateActiveCampaign(prev => ({
        ...prev,
        items: [...prev.items, ...toAdd]
      }));
      setCatalogUploadSuccessMsg(`✨ Se agregaron ${toAdd.length} productos recomendados a la oferta.`);
      setTimeout(() => setCatalogUploadSuccessMsg(null), 4000);
    } else {
      alert('Ya tienes los productos principales sugeridos en la campaña actual.');
    }
  };

  // Crear nueva campaña semanal
  const handleCreateNewWeek = () => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const title = prompt('Nombre o fecha de la nueva campaña:', `Semana del ${today.getDate()} al ${nextWeek.getDate()}`);
    if (!title) return;

    const newCampaign: WeeklyCampaign = {
      id: `camp-${Date.now()}`,
      title: title.trim(),
      startDate: today.toISOString().split('T')[0],
      endDate: nextWeek.toISOString().split('T')[0],
      notes: 'Precios válidos para entrega inmediata hasta agotar stock.',
      items: []
    };

    setSavedCampaigns(prev => [newCampaign, ...prev]);
    setActiveCampaignId(newCampaign.id);
  };

  // Duplicar campaña actual
  const handleDuplicateCurrentWeek = () => {
    const newTitle = prompt('Nombre para la copia de la campaña:', `${activeCampaign.title} (Copia)`);
    if (!newTitle) return;

    const duplicated: WeeklyCampaign = {
      ...activeCampaign,
      id: `camp-${Date.now()}`,
      title: newTitle.trim(),
      items: activeCampaign.items.map(it => ({ ...it, id: `${it.sku}-${Date.now()}-${Math.random()}` }))
    };

    setSavedCampaigns(prev => [duplicated, ...prev]);
    setActiveCampaignId(duplicated.id);
  };

  // 6. Filtrar catálogo para búsqueda
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return catalog.filter(p => {
      const matchQuery = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const matchCat = selectedCategory === 'TODOS' || (p.category && p.category.toUpperCase() === selectedCategory);
      return matchQuery && matchCat;
    }).slice(0, 50);
  }, [catalog, searchQuery, selectedCategory]);

  // Lista de categorías únicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach(p => {
      if (p.category) set.add(p.category.toUpperCase());
    });
    return ['TODOS', ...Array.from(set).sort()];
  }, [catalog]);

  // 7. Generador de texto para WhatsApp
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
                Ofertas Semanales
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
                MODO OFICINA
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0 0' }}>
              Catálogo activo: <strong>{catalog.length}</strong> productos disponibles
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
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={16} color="#059669" />
            <span>Cargar Excel</span>
          </button>

          {/* Botón Sugerir Inteligente */}
          <button
            onClick={handleSuggestWeeklySelection}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#F3F4F6',
              color: '#111827',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Aplica reglas automáticas de quesería, bebidas y almacén"
          >
            <Sparkles size={15} color="#E30613" />
            <span>Sugerir Ofertas</span>
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

          {/* Botón Flyer / PDF */}
          <button
            onClick={() => setIsFlyerModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#111827',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} />
            <span>Flyer / Imprimir</span>
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
        gridTemplateColumns: '400px 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* COLUMNA IZQUIERDA: Buscador y Catálogo de Productos */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          padding: '16px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
              Agregar Productos ({filteredCatalog.length})
            </h2>
            <button
              onClick={handleResetToDefaultCatalog}
              style={{
                fontSize: '11px',
                color: '#6B7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              title="Restaurar productos base"
            >
              Restaurar Base
            </button>
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
                  <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#6B7280', backgroundColor: '#E5E7EB', padding: '1px 4px', borderRadius: '3px' }}>
                        {p.sku}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{p.category}</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }} title={p.name}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#4B5563', marginTop: '2px' }}>
                      Lista: <strong>${p.listPrice.toLocaleString('es-AR')}</strong>
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

            {filteredCatalog.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 8px', color: '#9CA3AF', fontSize: '13px' }}>
                No se encontraron productos con ese criterio.
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA DERECHA: Editor de la Campaña de Ofertas Activa */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card de Configuración de Campaña */}
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

              <button
                onClick={handleCreateNewWeek}
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                + Nueva Semana
              </button>

              <button
                onClick={handleDuplicateCurrentWeek}
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #E5E7EB',
                  backgroundColor: '#F9FAFB',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                Duplicar
              </button>
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
                <span>al</span>
                <input
                  type="date"
                  value={activeCampaign.endDate}
                  onChange={(e) => updateActiveCampaign(prev => ({ ...prev, endDate: e.target.value }))}
                  style={{ padding: '4px 6px', fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                />
              </div>

              <div style={{ fontSize: '13px', fontWeight: 600, color: '#E30613', backgroundColor: 'rgba(227,6,19,0.06)', padding: '4px 10px', borderRadius: '4px' }}>
                {activeCampaign.items.length} productos en oferta
              </div>
            </div>
          </div>

          {/* Tabla de Productos en Oferta */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                Productos Seleccionados para esta Semana
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

            {activeCampaign.items.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#6B7280' }}>
                <Sparkles size={36} color="#D1D5DB" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
                  No hay productos en esta oferta todavía
                </h3>
                <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto 16px' }}>
                  Podés buscar productos en la columna izquierda y agregarlos con el botón <strong>+</strong>, o hacer clic en <strong>Sugerir Ofertas</strong> para armar una propuesta automática.
                </p>
                <button
                  onClick={handleSuggestWeeklySelection}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#111827',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Sparkles size={14} color="#E30613" />
                  Sugerir Ofertas Automáticamente
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left', color: '#6B7280' }}>
                      <th style={{ padding: '10px 16px', fontWeight: 600, width: '70px' }}>SKU</th>
                      <th style={{ padding: '10px 16px', fontWeight: 600 }}>Producto</th>
                      <th style={{ padding: '10px 16px', fontWeight: 600, width: '130px' }}>Precio Lista</th>
                      <th style={{ padding: '10px 16px', fontWeight: 600, width: '140px' }}>Precio Oferta</th>
                      <th style={{ padding: '10px 16px', fontWeight: 600, width: '100px' }}>Desc. %</th>
                      <th style={{ padding: '10px 16px', fontWeight: 600, width: '200px' }}>Etiqueta / Condición</th>
                      <th style={{ padding: '10px 16px', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCampaign.items.map((item, index) => {
                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid #F3F4F6',
                            backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#6B7280', fontSize: '12px' }}>
                            {item.sku}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{item.name}</div>
                            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{item.category}</div>
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
                                  width: '55px',
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="text"
                                placeholder="ej: Llevando 3+"
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
                            </div>
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
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: Subir / Actualizar Excel */}
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
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Cargar Lista de Precios Excel</h3>
              </div>
              <button
                onClick={() => setIsExcelModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: 1.5, marginBottom: '20px' }}>
              Podés subir tu archivo maestro o lista de precios semanal (ej: <code>Maestro1.xlsx</code>). La aplicación detectará automáticamente el <strong>SKU</strong>, <strong>Descripción</strong>, <strong>Precio Lista</strong> y <strong>Rubro</strong> sin necesidad de tocar el servidor.
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
                Soporta archivos .xlsx, .xls o .csv
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
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

            <p style={{ fontSize: '13px', color: '#4B5563', marginBottom: '12px' }}>
              Mensaje formateado listo con negritas y precios tachados para copiar y pegar en grupos o chats directos:
            </p>

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

      {/* MODAL 3: Flyer / Impresión Visual */}
      {isFlyerModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          backdropFilter: 'blur(3px)',
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            overflow: 'hidden'
          }}>
            {/* Cabecera del modal */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Vista Previa de Flyer / Impresión</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#111827',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Printer size={15} /> Imprimir / Guardar como PDF
                </button>
                <button
                  onClick={() => setIsFlyerModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '18px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Contenido imprimible */}
            <div style={{ padding: '32px', overflowY: 'auto', backgroundColor: '#FFFFFF' }} className="print-area">
              {/* Encabezado del Flyer */}
              <div style={{
                textAlign: 'center',
                borderBottom: '2px solid #111827',
                paddingBottom: '20px',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '12px', letterSpacing: '0.15em', fontWeight: 700, color: '#E30613', textTransform: 'uppercase' }}>
                  DISTRIBUIDORA DV • VENTA MAYORISTA
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', margin: '4px 0 6px 0', color: '#111827' }}>
                  {activeCampaign.title.toUpperCase()}
                </h1>
                <p style={{ fontSize: '13px', color: '#4B5563', margin: 0 }}>
                  Vigencia del <strong>{activeCampaign.startDate}</strong> al <strong>{activeCampaign.endDate}</strong> o hasta agotar stock
                </p>
              </div>

              {/* Grilla de productos en oferta */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '16px'
              }}>
                {activeCampaign.items.map(it => (
                  <div
                    key={it.id}
                    style={{
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: '#FAFAFA',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                  >
                    {it.specialTag && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        right: '10px',
                        backgroundColor: '#E30613',
                        color: '#FFFFFF',
                        fontSize: '9px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        letterSpacing: '0.04em'
                      }}>
                        {it.specialTag}
                      </div>
                    )}

                    <div>
                      <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600, letterSpacing: '0.05em' }}>
                        {it.category}
                      </span>
                      <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '4px 0 12px 0', lineHeight: 1.3 }}>
                        {it.name}
                      </h4>
                    </div>

                    <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#6B7280', textDecoration: 'line-through' }}>
                          ${it.listPrice.toLocaleString('es-AR')}
                        </span>
                        {it.discountPercent > 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '1px 5px', borderRadius: '3px' }}>
                            -{it.discountPercent}% OFF
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#E30613', marginTop: '2px' }}>
                        ${it.offerPrice.toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pie de flyer */}
              <div style={{
                marginTop: '32px',
                paddingTop: '16px',
                borderTop: '1px solid #E5E7EB',
                textAlign: 'center',
                fontSize: '12px',
                color: '#6B7280'
              }}>
                Precios sujetos a disponibilidad. Haga sus pedidos con anticipación.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
