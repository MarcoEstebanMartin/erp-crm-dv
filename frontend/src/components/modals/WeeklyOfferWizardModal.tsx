import React, { useState, useEffect } from 'react';
import { Wand2, Check, X, Sparkles, AlertCircle, PackageCheck, Tag } from 'lucide-react';
import { api } from '../../utils/api';

interface RecommendedProduct {
  id: number;
  sku: string;
  name: string;
  stock: number;
  listPrice: number;
  suggestedPrice: number;
  suggestedTag: string | null;
  category: string;
  reason: string;
  score: number;
}

interface WeeklyOfferWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: (campaignId: number) => void;
}

export default function WeeklyOfferWizardModal({ isOpen, onClose, onCampaignCreated }: WeeklyOfferWizardModalProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [recommendations, setRecommendations] = useState<Record<string, RecommendedProduct[]>>({});
  
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
      // Set default title e.g. "Semana 26 al 02"
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const titleDefault = `Semana ${today.getDate()} al ${nextWeek.getDate()} de ${today.toLocaleString('es-AR', { month: 'long' })}`;
      setTitle(titleDefault);
      
      loadRecommendations();
    }
  }, [isOpen]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const res = await api.getWeeklyOfferRecommendations();
      if (res && res.data && res.data.recommendationsByGroup) {
        const groups: Record<string, RecommendedProduct[]> = res.data.recommendationsByGroup;
        setRecommendations(groups);

        // Pre-select all recommended products
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
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
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
      // 1. Create campaign
      const newCampaign = await api.createCampaign({
        title: title.trim(),
        isActive: true
      });

      if (newCampaign && newCampaign.id) {
        // 2. Prepare selected items to add in bulk
        const allProducts = Object.values(recommendations).flat();
        const itemsToAdd = allProducts
          .filter(p => selectedMap[p.id])
          .map(p => ({
            productId: p.id,
            offerPrice: customPrices[p.id] !== undefined ? customPrices[p.id] : (p.suggestedPrice || p.listPrice),
            specialTag: customTags[p.id] && customTags[p.id].trim() ? customTags[p.id].trim() : null,
            campaignGroup: p.category
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
        maxWidth: '1050px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid var(--border-color, #e2e8f0)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: 'rgba(139, 92, 246, 0.12)',
              color: '#8b5cf6',
              padding: '10px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Wand2 size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary, #0f172a)' }}>
                Asistente de Rotación Semanal
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
                Recomendaciones automáticas de productos según vencimientos, stock y rotación previa.
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

        {/* Campaign Title & Global Actions Bar */}
        <div style={{ padding: '16px 24px', backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Nombre de la Campaña
            </label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Semana 26 al 02 de Agosto"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontWeight: '600',
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '6px 12px', borderRadius: '20px' }}>
              {selectedCount} seleccionados
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              <Sparkles className="animate-spin" size={32} style={{ marginBottom: '12px', color: '#8b5cf6' }} />
              <div>Analizando inventario, vencimientos y rotación histórica...</div>
            </div>
          ) : Object.keys(recommendations).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              No se encontraron recomendaciones automáticas para esta semana.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.entries(recommendations).map(([category, items]) => {
                const categoryAllSelected = items.every(p => selectedMap[p.id]);
                return (
                  <div key={category} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                    {/* Category Header */}
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-secondary, #f8fafc)',
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                          type="checkbox"
                          checked={categoryAllSelected}
                          onChange={() => toggleCategory(items)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#8b5cf6' }}
                        />
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
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
                        <tr style={{ color: 'var(--text-secondary)', textAlign: 'left', fontSize: '11px', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '8px 12px', width: '40px' }}></th>
                          <th style={{ padding: '8px 12px' }}>Producto</th>
                          <th style={{ padding: '8px 12px' }}>Motivo de Rotación</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Stock</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Precio Lista</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', width: '110px' }}>Precio Oferta</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', width: '130px' }}>Etiqueta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(p => {
                          const isSelected = !!selectedMap[p.id];
                          return (
                            <tr key={p.id} style={{
                              borderBottom: '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.02)' : 'transparent',
                              opacity: isSelected ? 1 : 0.6
                            }}>
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(p.id)}
                                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#8b5cf6' }}
                                />
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{p.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>SKU: {p.sku}</div>
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: p.reason.includes('vencer') ? 'rgba(239, 68, 68, 0.1)' : p.reason.includes('Exceso') ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  color: p.reason.includes('vencer') ? '#ef4444' : p.reason.includes('Exceso') ? '#3b82f6' : '#10b981'
                                }}>
                                  {p.reason}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '500', color: 'var(--text-secondary)' }}>
                                {p.stock} un.
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                ${p.listPrice.toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
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
                                      width: '80px',
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
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input 
                                  type="text"
                                  value={customTags[p.id] || ''}
                                  onChange={(e) => setCustomTags(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  placeholder="Ej: 2X1!"
                                  style={{
                                    width: '100px',
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    textAlign: 'center',
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
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
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justify: 'space-between',
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
              padding: '10px 20px',
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
            {creating ? 'Creando Campaña...' : `Confirmar y Crear Campaña (${selectedCount} productos)`}
          </button>
        </div>

      </div>
    </div>
  );
}
