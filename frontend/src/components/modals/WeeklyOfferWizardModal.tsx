import React, { useState, useEffect } from 'react';
import { Wand2, X, Sparkles, PackageCheck, Sliders, RefreshCw, ArrowRightLeft, CheckCircle2, AlertTriangle, ShieldCheck, Tag } from 'lucide-react';
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

export default function WeeklyOfferWizardModal({ isOpen, onClose, onCampaignCreated }: WeeklyOfferWizardModalProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'proposal' | 'comparison'>('proposal');
  
  // Recommendations data
  const [recommendations, setRecommendations] = useState<Record<string, RecommendedProduct[]>>({});
  const [detectedWeekNumber, setDetectedWeekNumber] = useState<number>(1);
  const [selectedWeekParam, setSelectedWeekParam] = useState<'auto' | '1' | '2'>('auto');

  // Comparison data
  const [comparisonData, setComparisonData] = useState<any | null>(null);

  // Custom campaign title
  const [title, setTitle] = useState('');

  // Map of selected productId -> boolean
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});
  
  // Custom edited prices: productId -> number
  const [customPrices, setCustomPrices] = useState<Record<number, number>>({});
  
  // Custom edited tags: productId -> string
  const [customTags, setCustomTags] = useState<Record<number, string>>({});

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const titleDefault = `Ofertas Semanales ${today.getDate()} al ${nextWeek.getDate()} de ${today.toLocaleString('es-AR', { month: 'long' })}`;
      setTitle(titleDefault);
      
      loadRecommendations('auto');
      loadComparison();
    }
  }, [isOpen]);

  const loadRecommendations = async (weekVal: 'auto' | '1' | '2' = 'auto', isShuffle: boolean = false) => {
    setLoading(true);
    try {
      const res = await api.getWeeklyOfferRecommendations({
        week: weekVal,
        shuffle: isShuffle ? 'true' : 'false'
      } as any);

      const payload = res?.recommendationsByGroup ? res : (res?.data || {});
      if (payload && payload.recommendationsByGroup) {
        const groups: Record<string, RecommendedProduct[]> = payload.recommendationsByGroup || {};
        setRecommendations(groups);
        setDetectedWeekNumber(payload.detectedWeekNumber || 1);

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
    } catch (error) {
      console.error('Error loading offer recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadComparison = async () => {
    try {
      const res = await api.getCampaignComparison();
      const payload = res?.details ? res : (res?.data || {});
      if (payload) {
        setComparisonData(payload);
      }
    } catch (error) {
      console.error('Error loading comparison:', error);
    }
  };

  const handleWeekChange = (weekVal: 'auto' | '1' | '2') => {
    setSelectedWeekParam(weekVal);
    loadRecommendations(weekVal);
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
        maxWidth: '1120px',
        maxHeight: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-color, #e2e8f0)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
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
                Matriz de rotación automática basada en la planilla maestra (Fijos + Alternancia Semana 1 / 2 + Stock Vivo).
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

        {/* Top Control Bar: Mode Toggle & Selector */}
        <div style={{
          padding: '10px 24px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px'
        }}>
          {/* Week Selector Buttons */}
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
              onClick={() => loadRecommendations(selectedWeekParam, true)}
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

          {/* View Mode Toggle: Proposal vs Side-by-Side Comparison */}
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('proposal')}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: viewMode === 'proposal' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'proposal' ? '#8b5cf6' : 'var(--text-secondary)',
                boxShadow: viewMode === 'proposal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              📋 Lista Pre-armada
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              style={{
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                backgroundColor: viewMode === 'comparison' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'comparison' ? '#8b5cf6' : 'var(--text-secondary)',
                boxShadow: viewMode === 'comparison' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <ArrowRightLeft size={14} /> Comparador Side-by-Side
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
              placeholder="Ej: Ofertas Semanales 15 de Agosto"
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

        {/* Main Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <Sparkles className="animate-spin" size={32} style={{ marginBottom: '12px', color: '#8b5cf6', margin: '0 auto 12px auto' }} />
              <div>Cargando matriz paramétrica y stock vivo del catálogo...</div>
            </div>
          ) : viewMode === 'comparison' ? (
            /* SIDE BY SIDE COMPARISON VIEW */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                
                {/* Column 1: Baseline Previous Offer */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', backgroundColor: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⏮️ Baseline / Oferta Anterior (15-08)</span>
                    <span style={{ fontSize: '11px', fontWeight: 'normal', backgroundColor: 'var(--bg-card)', padding: '2px 8px', borderRadius: '4px' }}>69 productos</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                    Estructura tomada como referencia base de catálogo semanal.
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto' }}>
                    {comparisonData?.details?.removedByRotation?.map((item: any) => (
                      <div key={item.id} style={{ fontSize: '12px', padding: '6px 10px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{item.product?.name || item.name}</span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#ef4444' }}>ROTADO OUT</span>
                      </div>
                    ))}
                    {comparisonData?.details?.retained?.map((item: any) => (
                      <div key={item.id} style={{ fontSize: '12px', padding: '6px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{item.product?.name || item.name}</span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#10b981' }}>SE MANTIENE</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: New Proposed Offer */}
                <div style={{ border: '1px solid #8b5cf6', borderRadius: '10px', padding: '14px', backgroundColor: 'rgba(139, 92, 246, 0.03)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#8b5cf6', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>✨ Nueva Oferta Pre-armada (Semana {detectedWeekNumber})</span>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#8b5cf6', color: 'white', padding: '2px 8px', borderRadius: '4px' }}>
                      {selectedCount} seleccionados
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
                    Alternancia aplicada automáticamente con validación de stock.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '350px', overflowY: 'auto' }}>
                    {Object.values(recommendations).flat().filter(p => selectedMap[p.id]).map(p => (
                      <div key={p.id} style={{ fontSize: '12px', padding: '6px 10px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{p.reason}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: p.isFixedAlways ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: p.isFixedAlways ? '#10b981' : '#3b82f6'
                          }}>
                            {p.isFixedAlways ? 'FIJO' : `ROTACIÓN SEM ${detectedWeekNumber}`}
                          </span>
                          <span style={{ fontWeight: 'bold', color: '#8b5cf6' }}>
                            ${(customPrices[p.id] !== undefined ? customPrices[p.id] : p.suggestedPrice).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* PREPROPOSED LIST VIEW (DEFAULT) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Object.entries(recommendations).map(([category, items]) => {
                if (!items || items.length === 0) return null;
                const categoryAllSelected = items.every(p => selectedMap[p.id]);
                return (
                  <div key={category} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                    {/* Category Header */}
                    <div style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-secondary, #f8fafc)',
                      borderBottom: '1px solid var(--border-color)',
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
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {category.toUpperCase()} ({items.length} sugeridos)
                        </span>
                      </div>
                      <button
                        onClick={() => toggleCategory(items)}
                        style={{ background: 'none', border: 'none', color: '#8b5cf6', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {categoryAllSelected ? 'Desmarcar Grupo' : 'Seleccionar Grupo'}
                      </button>
                    </div>

                    {/* Category Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', fontSize: '11px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                          <th style={{ padding: '8px 12px', width: '36px' }}></th>
                          <th style={{ padding: '8px 12px' }}>Producto</th>
                          <th style={{ padding: '8px 12px' }}>Motivo / Regla</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Stock Depósito</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Precio Lista</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: '110px' }}>Precio Oferta</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', width: '140px' }}>Etiqueta / Promo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(p => {
                          const isSelected = !!selectedMap[p.id];
                          return (
                            <tr key={p.id} style={{
                              borderBottom: '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.02)' : 'transparent',
                              opacity: isSelected ? 1 : 0.5
                            }}>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(p.id)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#8b5cf6' }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {p.name}
                                  {p.isFixedAlways && (
                                    <span style={{ fontSize: '9px', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '1px 5px', borderRadius: '4px' }}>
                                      FIJO
                                    </span>
                                  )}
                                  {p.isRotatedIn && (
                                    <span style={{ fontSize: '9px', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', padding: '1px 5px', borderRadius: '4px' }}>
                                      ROTACIÓN
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>SKU: {p.sku}</div>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  backgroundColor: p.reason.includes('⚠️') ? 'rgba(239, 68, 68, 0.1)' : p.reason.includes('Rotación') ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  color: p.reason.includes('⚠️') ? '#ef4444' : p.reason.includes('Rotación') ? '#3b82f6' : '#10b981'
                                }}>
                                  {p.reason}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '500' }}>
                                <span style={{
                                  color: p.stockStatus === 'OUT_OF_STOCK' ? '#ef4444' : p.stockStatus === 'LOW_STOCK' ? '#f59e0b' : 'var(--text-secondary)',
                                  fontWeight: p.stockStatus !== 'OK' ? 'bold' : 'normal'
                                }}>
                                  {p.stock} un.
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                ${p.listPrice.toFixed(2)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>$</span>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    value={customPrices[p.id] !== undefined ? customPrices[p.id] : p.suggestedPrice}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setCustomPrices(prev => ({ ...prev, [p.id]: isNaN(val) ? 0 : val }));
                                    }}
                                    style={{
                                      width: '85px',
                                      padding: '4px 6px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      textAlign: 'right',
                                      fontWeight: 'bold',
                                      fontSize: '12px',
                                      backgroundColor: 'var(--bg-card)',
                                      color: 'var(--text-primary)'
                                    }}
                                  />
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <input 
                                  type="text"
                                  value={customTags[p.id] || ''}
                                  onChange={(e) => setCustomTags(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  placeholder="Ej: CADA 4 CAJAS $599"
                                  style={{
                                    width: '130px',
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    textAlign: 'center',
                                    fontSize: '10px',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)'
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
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
              padding: '9px 22px',
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
    </div>
  );
}
