import React, { useState, useEffect } from 'react';
import { Wand2, X, Sparkles, PackageCheck, RefreshCw, CheckCircle2, Info, Edit2, Replace, Search } from 'lucide-react';
import { api } from '../../utils/api';

interface RecommendedProduct {
  id: number;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  listPrice: number;
  suggestedPrice: number;
  suggestedTag: string | null;
  campaignGroup: string;
  isFixedAlways?: boolean;
  isRotatedIn?: boolean;
  reason: string;
  stockStatus: 'OK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

interface WeeklyOfferWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: (campaignId: number) => void;
}

function getConciseReason(productName: string, group?: string, rawReason?: string): string {
  if (rawReason && !rawReason.includes('Seleccionado automáticamente') && !rawReason.includes('regla de rubro') && !rawReason.includes('Producto Seleccionado')) {
    return rawReason;
  }
  const p = (productName || '').toUpperCase();

  // 1. Duros (REGG, REGGANITO, REGGIANITO, SARDO, SBRINZ, PEPATO, PROV, PROVOLONE, PROVOLETA, GOYA, etc.)
  if (
    p.includes('REGG') || p.includes('SARDO') || p.includes('SBRINZ') || 
    p.includes('PEPATO') || p.includes('PROV') || p.includes('GOYA') || 
    p.includes('PARMESANO') || p.includes('ROMANO') || p.includes('DURO')
  ) {
    return '2 Quesos Duros';
  }

  // 2. Semiduros (TYBO, GOUDA, CHEDDAR, FONT, FONTINA, HOLANDO, DANBO, BARRA, PATE, PATEGRAS, EDAM, etc.)
  if (
    p.includes('TYBO') || p.includes('GOUDA') || p.includes('CHEDDAR') || 
    p.includes('FONT') || p.includes('HOLANDO') || p.includes('DANBO') || 
    p.includes('BARRA') || p.includes('PATE') || p.includes('EDAM') || 
    p.includes('FIAMBRE') || p.includes('SEMIDURO')
  ) {
    return '2 Quesos Semiduros';
  }

  // 3. Blandos & Especiales (AZUL, ROQUEFORT, CREMOSO, CREM, SALUT, MOZZA, BLANDO, FRESCO)
  if (p.includes('AZUL') || p.includes('ROQUEFORT')) {
    return 'Queso Azul Especial';
  }
  if (
    p.includes('CREMOSO') || p.includes('CREM') || p.includes('SALUT') || 
    p.includes('MOZZARELLA') || p.includes('MOZZA') || p.includes('BLANDO') || 
    p.includes('FRESCO')
  ) {
    return '2 Quesos Blandos';
  }

  // 4. Rallados & Untables
  if (p.includes('RALLADO') || p.includes('RALL')) {
    return '1 Queso Rallado Obligatorio';
  }
  if (p.includes('UNTABLE') || p.includes('QUESO CREMA') || p.includes('CREMA')) {
    return '1 Untable / Queso Crema Obligatorio';
  }

  // 5. Rotación Cremigal / Lácteos
  if (p.includes('POLVO')) return 'Rotación Leche en Polvo';
  if (p.includes('DULCE') || p.includes('DDL') || p.includes('REPOSTERO')) return 'Rotación Dulce de Leche';
  if (p.includes('MANTECA')) return 'Rotación Manteca';
  if (p.includes('LECHE') || p.includes('YOGURT')) return 'Básico Fijo Cremigal';

  // 6. Bebidas & RPB
  if (p.includes('BAGGIO') || p.includes('VIDA') || p.includes('MOCORETA') || p.includes('RPB')) return 'Jugo Baggio / Vida (Fijo)';
  if (p.includes('FERNET') || p.includes('BRANCA')) return 'Fernet Branca (Fijo)';
  if (
    p.includes('VINO') || p.includes('BALBO') || p.includes('JULIA') || 
    p.includes('BIANCHI') || p.includes('ALAMBRADO') || p.includes('PERDIZ') || 
    p.includes('ZUCCARDI') || p.includes('LOPEZ') || p.includes('RURAL')
  ) return 'Vino Seleccionado de Bodega';

  // 7. Almacén
  if (p.includes('GIACOMO') || p.includes('CAPELETTINI')) return 'Capelettini Giacomo (Fijo)';
  if (p.includes('NATURA') || p.includes('MAYONESA') || p.includes('MAYO') || p.includes('MOSTAZA') || p.includes('KETCHUP')) return 'Rotación Mayonesa / Aderezos';
  if (p.includes('AMANDA') || p.includes('ANDRESITO') || p.includes('PLAYADITO') || p.includes('YERBA')) return 'Rotación Yerba Mate';

  // Fallbacks limpios por grupo
  if (group === 'MELINCUE' || group === 'CREMIGAL') return 'Sugerido por parámetro de Quesería / Lácteos';
  if (group === 'BEBIDAS' || group === 'R.P.B') return 'Sugerido por parámetro de Bebidas';
  if (group === 'ALMACEN') return 'Sugerido por parámetro de Almacén';

  return 'Sugerido por regla del catálogo';
}

function renderTypeBadge(productName: string) {
  const p = (productName || '').toUpperCase();
  
  let label = '';
  let bg = 'rgba(148, 163, 184, 0.12)';
  let color = '#475569';
  let border = 'rgba(148, 163, 184, 0.25)';

  if (
    p.includes('REGG') || p.includes('SARDO') || p.includes('SBRINZ') || 
    p.includes('PEPATO') || p.includes('PROV') || p.includes('GOYA') || 
    p.includes('PARMESANO') || p.includes('ROMANO') || p.includes('DURO')
  ) {
    label = 'DURO';
    bg = 'rgba(59, 130, 246, 0.12)';
    color = '#2563eb';
    border = 'rgba(59, 130, 246, 0.25)';
  } else if (
    p.includes('TYBO') || p.includes('GOUDA') || p.includes('CHEDDAR') || 
    p.includes('FONT') || p.includes('HOLANDO') || p.includes('DANBO') || 
    p.includes('BARRA') || p.includes('PATE') || p.includes('EDAM') || 
    p.includes('FIAMBRE') || p.includes('SEMIDURO')
  ) {
    label = 'SEMIDURO';
    bg = 'rgba(139, 92, 246, 0.12)';
    color = '#7c3aed';
    border = 'rgba(139, 92, 246, 0.25)';
  } else if (p.includes('AZUL') || p.includes('ROQUEFORT')) {
    label = 'AZUL';
    bg = 'rgba(14, 165, 233, 0.12)';
    color = '#0284c7';
    border = 'rgba(14, 165, 233, 0.25)';
  } else if (
    p.includes('CREMOSO') || p.includes('CREM') || p.includes('SALUT') || 
    p.includes('MOZZARELLA') || p.includes('MOZZA') || p.includes('BLANDO') || 
    p.includes('FRESCO')
  ) {
    label = 'BLANDO';
    bg = 'rgba(16, 185, 129, 0.12)';
    color = '#059669';
    border = 'rgba(16, 185, 129, 0.25)';
  } else if (p.includes('RALLADO') || p.includes('RALL')) {
    label = 'RALLADO';
    bg = 'rgba(245, 158, 11, 0.12)';
    color = '#d97706';
    border = 'rgba(245, 158, 11, 0.25)';
  } else if (p.includes('UNTABLE') || p.includes('QUESO CREMA') || p.includes('CREMA')) {
    label = 'UNTABLE';
    bg = 'rgba(6, 182, 212, 0.12)';
    color = '#0891b2';
    border = 'rgba(6, 182, 212, 0.25)';
  }

  if (!label) return null;

  return (
    <span style={{
      fontSize: '9px',
      fontWeight: 'bold',
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: bg,
      color: color,
      border: `1px solid ${border}`,
      letterSpacing: '0.4px',
      textTransform: 'uppercase',
      flexShrink: 0
    }}>
      {label}
    </span>
  );
}

export default function WeeklyOfferWizardModal({ isOpen, onClose, onCampaignCreated }: WeeklyOfferWizardModalProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Recommendations data
  const [recommendations, setRecommendations] = useState<Record<string, RecommendedProduct[]>>({});
  const [detectedWeekNumber, setDetectedWeekNumber] = useState<number>(1);
  const [selectedWeekParam, setSelectedWeekParam] = useState<'auto' | '1' | '2'>('auto');

  // Baseline comparison data
  const [baselineTitle, setBaselineTitle] = useState<string>('OFERTA ANTERIOR');
  const [baselineItemsMap, setBaselineItemsMap] = useState<Record<number, { price: number; name: string; sku: string; tag?: string }>>({});

  // Custom campaign title
  const [title, setTitle] = useState('');

  // Map of selected productId -> boolean
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});
  
  // Custom edited prices: productId -> number
  const [customPrices, setCustomPrices] = useState<Record<number, number>>({});
  
  // Custom edited tags: productId -> string
  const [customTags, setCustomTags] = useState<Record<number, string>>({});

  // Active (VER) detail modal
  const [activeVerModal, setActiveVerModal] = useState<RecommendedProduct | null>(null);

  // Product replacement drawer
  const [changingProductRow, setChangingProductRow] = useState<RecommendedProduct | null>(null);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [categoryProducts, setCategoryProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const titleDefault = `Ofertas Semanales ${today.getDate()} al ${nextWeek.getDate()} de ${today.toLocaleString('es-AR', { month: 'long' })}`;
      setTitle(titleDefault);
      
      loadData('auto');
    }
  }, [isOpen]);

  const loadData = async (weekVal: 'auto' | '1' | '2' = 'auto', isShuffle: boolean = false) => {
    setLoading(true);
    try {
      // 1. Cargar recomendaciones pre-armadas (Rotación + Stock vivo)
      const recRes = await api.getWeeklyOfferRecommendations({
        week: weekVal,
        shuffle: isShuffle ? 'true' : 'false'
      } as any);

      const recPayload = recRes?.recommendationsByGroup ? recRes : (recRes?.data || {});
      if (recPayload && recPayload.recommendationsByGroup) {
        const groups: Record<string, RecommendedProduct[]> = recPayload.recommendationsByGroup || {};
        setRecommendations(groups);
        setDetectedWeekNumber(recPayload.detectedWeekNumber || 1);

        const initialSelected: Record<number, boolean> = {};
        const initialPrices: Record<number, number> = {};
        const initialTags: Record<number, string> = {};

        Object.values(groups).flat().forEach(p => {
          initialSelected[p.id] = true;
          initialPrices[p.id] = p.suggestedPrice || p.listPrice;
          initialTags[p.id] = p.suggestedTag || '';
        });

        setSelectedMap(initialSelected);
        setCustomPrices(initialPrices);
        setCustomTags(initialTags);
      }

      // 2. Cargar campaña de la semana anterior (Baseline limpia)
      const compRes = await api.getCampaignComparison();
      const compPayload = compRes?.data || compRes || {};
      if (compPayload) {
        setBaselineTitle(compPayload.baselineTitle || 'OFERTA ANTERIOR VIGENTE');
        
        const bMap: Record<number, { price: number; name: string; sku: string; tag?: string }> = {};
        const details = compPayload.details || {};
        const baselineItems = [...(details.retained || []), ...(details.removedByRotation || [])];
        
        baselineItems.forEach((item: any) => {
          const pid = item.productId || item.product?.id || item.id;
          const price = Number(item.offerPrice || item.price || 0);
          const name = item.product?.name || item.name || '';
          const sku = item.product?.sku || item.sku || '';
          if (pid) {
            bMap[pid] = { price, name, sku, tag: item.specialTag || undefined };
          }
        });
        
        setBaselineItemsMap(bMap);
      }
    } catch (error) {
      console.error('Error loading wizard offer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWeekChange = (weekVal: 'auto' | '1' | '2') => {
    setSelectedWeekParam(weekVal);
    loadData(weekVal);
  };

  if (!isOpen) return null;

  const toggleSelect = (id: number) => {
    setSelectedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (categoryItems: RecommendedProduct[]) => {
    const allSelected = categoryItems.every(p => selectedMap[p.id]);
    setSelectedMap(prev => {
      const next = { ...prev };
      categoryItems.forEach(p => {
        next[p.id] = !allSelected;
      });
      return next;
    });
  };

  const selectedCount = Object.values(selectedMap).filter(Boolean).length;

  const handleCreateCampaign = async () => {
    if (selectedCount === 0 || !title.trim()) return;
    setCreating(true);

    try {
      const newCampaign = await api.createCampaign({
        title: title.trim(),
        isActive: true
      });

      if (newCampaign && newCampaign.id) {
        const allProducts = Object.values(recommendations).flat();
        const itemsToAdd = allProducts
          .filter(p => selectedMap[p.id])
          .map(p => ({
            productId: p.id,
            offerPrice: customPrices[p.id] !== undefined ? customPrices[p.id] : (p.suggestedPrice || p.listPrice),
            specialTag: customTags[p.id] && customTags[p.id].trim() ? customTags[p.id].trim() : null,
            campaignGroup: p.campaignGroup
          }));

        if (itemsToAdd.length > 0) {
          await api.addBulkCampaignItems(newCampaign.id, itemsToAdd);
        }

        onClose();
        onCampaignCreated(newCampaign.id);
      }
    } catch (error) {
      console.error('Error creating weekly campaign:', error);
      alert('Hubo un error al crear la campaña semanal.');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
  };

  const openReplacementModal = async (row: RecommendedProduct) => {
    setChangingProductRow(row);
    setLoadingProducts(true);
    try {
      const data = await api.getProducts(row.campaignGroup);
      setCategoryProducts(data || []);
    } catch (err) {
      console.error('Error loading replacement products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleReplaceProduct = (newProd: any) => {
    if (!changingProductRow) return;
    const group = changingProductRow.campaignGroup;

    setRecommendations(prev => {
      const copy = { ...prev };
      if (copy[group]) {
        copy[group] = copy[group].map(p => {
          if (p.id === changingProductRow.id) {
            return {
              ...p,
              id: newProd.id,
              name: newProd.name,
              sku: newProd.sku,
              listPrice: newProd.listPrice,
              suggestedPrice: newProd.listPrice,
              reason: `Sustituido manualmente por el usuario (${newProd.name})`
            };
          }
          return p;
        });
      }
      return copy;
    });

    setSelectedMap(prev => ({ ...prev, [newProd.id]: true }));
    setCustomPrices(prev => ({ ...prev, [newProd.id]: newProd.listPrice }));

    setChangingProductRow(null);
    setActiveVerModal(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1280px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-color, #e2e8f0)',
        overflow: 'hidden'
      }}>
        
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: '#8b5cf6',
              padding: '10px 14px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wand2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 'bold', color: 'var(--text-primary, #0f172a)' }}>
                  Generador de Ofertas Semanales
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  backgroundColor: detectedWeekNumber === 1 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                  color: detectedWeekNumber === 1 ? '#10b981' : '#3b82f6',
                  padding: '3px 9px',
                  borderRadius: '12px',
                  border: `1px solid ${detectedWeekNumber === 1 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                }}>
                  {`🔄 ${selectedWeekParam === 'auto' ? 'Auto-Detectada:' : 'Modo Manual:'} SEMANA ${detectedWeekNumber}`}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>
                Vista calcada de la planilla Excel con botones [OK] y (VER) para inspeccionar reglas y sustituir productos.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary, #64748b)', cursor: 'pointer', padding: '6px', borderRadius: '8px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Top Rotation Controls */}
        <div style={{
          padding: '10px 24px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '600', color: 'var(--text-secondary)', fontSize: '12px' }}>Rotación:</span>
            <button
              onClick={() => handleWeekChange('auto')}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: selectedWeekParam === 'auto' ? '#8b5cf6' : 'var(--bg-secondary)',
                color: selectedWeekParam === 'auto' ? 'white' : 'var(--text-primary)'
              }}
            >
              Auto ({`Sem. ${detectedWeekNumber}`})
            </button>
            <button
              onClick={() => handleWeekChange('1')}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: selectedWeekParam === '1' ? '#10b981' : 'var(--bg-secondary)',
                color: selectedWeekParam === '1' ? 'white' : 'var(--text-primary)'
              }}
            >
              Semana 1
            </button>
            <button
              onClick={() => handleWeekChange('2')}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: selectedWeekParam === '2' ? '#3b82f6' : 'var(--bg-secondary)',
                color: selectedWeekParam === '2' ? 'white' : 'var(--text-primary)'
              }}
            >
              Semana 2
            </button>

            <button
              onClick={() => loadData(selectedWeekParam, true)}
              style={{
                marginLeft: '12px',
                backgroundColor: 'transparent',
                color: '#8b5cf6',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px'
              }}
            >
              <RefreshCw size={13} /> Recalcular Stock
            </button>
          </div>
        </div>

        {/* Campaign Title & Selection Summary */}
        <div style={{ padding: '12px 24px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '3px', textTransform: 'uppercase' }}>
              Nombre de la Nueva Oferta Semanal
            </label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Ofertas Semanales 31 de Agosto"
              style={{
                width: '100%',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontWeight: '600',
                fontSize: '13px'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '5px 14px', borderRadius: '20px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              {selectedCount} productos en oferta
            </span>
          </div>
        </div>

        {/* Clean Side-by-Side Dual Table (Exact Excel Template Layout) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <Sparkles className="animate-spin" size={32} style={{ marginBottom: '12px', color: '#8b5cf6', margin: '0 auto 12px auto' }} />
              <div>Cargando matriz paramétrica y oferta previa del catálogo...</div>
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              
              {/* Dual Column Header (Excel Grey/Dark Banner Style) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', backgroundColor: '#334155', color: 'white', borderBottom: '2px solid #0f172a' }}>
                <div style={{ padding: '12px 18px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>VIGENCIA: {baselineTitle}</span>
                  <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 'normal' }}>Oferta Base Anterior</span>
                </div>
                <div style={{ padding: '12px 18px', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: '#1e1b4b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>VIGENCIA: {title || 'Propuesta de la Semana'}</span>
                  <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 'normal' }}>Ofertas Nuevas Sugeridas</span>
                </div>
              </div>

              {/* Render Groups (MELINCUE, CREMIGAL, R.P.B, BEBIDAS, ALMACEN, etc.) */}
              {Object.entries(recommendations).map(([category, items]) => {
                if (!items || items.length === 0) return null;
                
                // Get clean baseline list for this category
                const baselineEntries = Object.entries(baselineItemsMap)
                  .map(([pid, info]) => ({ pid: Number(pid), ...info }));
                
                const categoryAllSelected = items.every(p => selectedMap[p.id]);

                return (
                  <div key={category} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    
                    {/* Category Banner Row (Excel Style) */}
                    <div style={{ 
                      backgroundColor: 'var(--bg-secondary, #cbd5e1)', 
                      padding: '8px 18px', 
                      fontWeight: 'bold', 
                      fontSize: '13px', 
                      color: '#0f172a', 
                      borderBottom: '1px solid var(--border-color)',
                      borderTop: '1px solid var(--border-color)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="checkbox"
                          checked={categoryAllSelected}
                          onChange={() => toggleCategory(items)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#8b5cf6' }}
                        />
                        <span>{category}</span>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#475569' }}>
                        {items.length} sugeridos
                      </span>
                    </div>

                    {/* Side-by-Side Product Rows */}
                    {items.map((p, idx) => {
                      const isSelected = !!selectedMap[p.id];
                      const baselineInfo = baselineItemsMap[p.id];
                      const baselinePrice = baselineInfo ? baselineInfo.price : null;
                      const offerPrice = customPrices[p.id] !== undefined ? customPrices[p.id] : p.suggestedPrice;

                      return (
                        <div 
                          key={p.id}
                          style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '1fr 1fr',
                            borderBottom: idx === items.length - 1 ? 'none' : '1px solid var(--border-color)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(0, 0, 0, 0.015)',
                            opacity: isSelected ? 1 : 0.5
                          }}
                        >
                          {/* Left Column Cell: Previous Offer Product (Clean Intocada) */}
                          <div style={{ 
                            padding: '9px 18px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            borderRight: '1px solid var(--border-color)'
                          }}>
                            {baselinePrice !== null ? (
                              <>
                                <div style={{ flex: 1, paddingRight: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                    {baselineInfo?.name || p.name}
                                  </span>
                                  {renderTypeBadge(baselineInfo?.name || p.name)}
                                </div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                                  {formatCurrency(baselinePrice)}
                                </div>
                              </>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                            )}
                          </div>

                          {/* Right Column Cell: Proposed Offer Product */}
                          <div style={{ 
                            padding: '9px 18px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.02)' : 'transparent'
                          }}>
                            <div style={{ flex: 1, paddingRight: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(p.id)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#8b5cf6', flexShrink: 0 }}
                              />
                              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {p.name}
                              </span>
                              {renderTypeBadge(p.name)}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                                {formatCurrency(offerPrice)}
                              </span>

                              {/* (VER) Button */}
                              <button
                                onClick={() => setActiveVerModal(p)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#3b82f6',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  padding: '2px 4px'
                                }}
                              >
                                (VER)
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    })}

                  </div>
                );
              })}

            </div>
          )}
        </div>

        {/* Modal Footer Action Bar */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary, #f8fafc)'
        }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={creating}
          >
            Cancelar
          </button>

          <button
            onClick={handleCreateCampaign}
            disabled={selectedCount === 0 || !title.trim() || creating}
            style={{
              padding: '9px 24px',
              backgroundColor: selectedCount > 0 && title.trim() ? '#8b5cf6' : '#cbd5e1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: selectedCount > 0 && title.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)'
            }}
          >
            <PackageCheck size={18} />
            {creating ? 'Creando Campaña Semanal...' : `Confirmar y Publicar Campaña (${selectedCount} productos)`}
          </button>
        </div>

      </div>

      {/* (VER) Inspection & Replacement Popover Modal */}
      {activeVerModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#8b5cf6', textTransform: 'uppercase' }}>
                  Detalle Paramétrico & Edición
                </span>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                  {activeVerModal.name}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SKU: {activeVerModal.sku} | Rubro: {activeVerModal.campaignGroup}</span>
              </div>
              <button onClick={() => setActiveVerModal(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Motivo Paramétrico */}
            <div style={{ padding: '12px 14px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#1d4ed8', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} /> MOTIVO DE ELECCIÓN EN EL ARCHIVO MAESTRO:
              </div>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                {getConciseReason(activeVerModal.name, activeVerModal.campaignGroup, activeVerModal.reason)}
              </div>
            </div>

            {/* Price Edit Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Precio de Oferta ($)
              </label>
              <input
                type="number"
                value={customPrices[activeVerModal.id] !== undefined ? customPrices[activeVerModal.id] : activeVerModal.suggestedPrice}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCustomPrices(prev => ({ ...prev, [activeVerModal.id]: isNaN(val) ? 0 : val }));
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              />
            </div>

            {/* Replace Product Button */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                onClick={() => openReplacementModal(activeVerModal)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Replace size={16} /> Cambiar por Otro Producto
              </button>

              <button
                onClick={() => setActiveVerModal(null)}
                className="btn-primary"
                style={{ flex: 1, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <CheckCircle2 size={16} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Replacement Modal */}
      {changingProductRow && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Sustituir {changingProductRow.name}
              </h3>
              <button onClick={() => setChangingProductRow(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '14px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={replacementSearch}
                onChange={(e) => setReplacementSearch(e.target.value)}
                placeholder="Buscar reemplazo en el rubro..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {loadingProducts ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>Cargando catálogo...</div>
              ) : categoryProducts.filter(p => p.name.toLowerCase().includes(replacementSearch.toLowerCase())).map(p => (
                <div
                  key={p.id}
                  onClick={() => handleReplaceProduct(p)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-card)'
                  }}
                  className="hover:bg-gray-50"
                >
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SKU: {p.sku} | Stock: {p.stock} un.</div>
                  </div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#8b5cf6' }}>
                    ${p.listPrice}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
