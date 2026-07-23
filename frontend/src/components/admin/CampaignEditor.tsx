import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Trash2, Tag, Wand2, AlertTriangle, TrendingDown, ArrowUp, ArrowDown, RefreshCw, Edit2 } from 'lucide-react';
import { api, API_BASE_URL } from '../../utils/api';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';

interface CampaignEditorProps {
  campaignId: number;
  onBack: () => void;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  listPrice: number;
  rubro?: { name: string } | null;
}

interface CampaignItem {
  id: number;
  productId: number;
  offerPrice: number;
  previousPrice?: number | null;
  specialTag?: string | null;
  showListPrice: boolean;
  campaignGroup?: string;
  product: {
    id: number;
    name: string;
    sku: string;
    listPrice: number;
    rubro: { name: string };
  };
}

const AVAILABLE_GROUPS = [
  'Refrigerados', 'Bebidas', 'Bebidas Alcoholicas', 'Vinos', 'Pastas Secas', 
  'Conservas', 'Aderezos y Aceites', 'Fiambres', 'Yerbas', 'Papeles', 
  'No comestibles', 'Estucheria y Regalerìa', 'Varios'
];

interface Campaign {
  id: number;
  title: string;
  isActive: boolean;
  customRubroOrder?: string[];
  items: CampaignItem[];
}

export default function CampaignEditor({ campaignId, onBack }: CampaignEditorProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [newItemTag, setNewItemTag] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [swapTarget, setSwapTarget] = useState<CampaignItem | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title?: string, message: string, onConfirm: () => void, type?: 'danger'|'warning'|'info'|'success', isAlert?: boolean}>({ isOpen: false, message: '', onConfirm: () => {} });
  const [promptModal, setPromptModal] = useState<{isOpen: boolean, title: string, message: string, defaultValue: string, onConfirm: (val: string) => void}>({ isOpen: false, title: '', message: '', defaultValue: '', onConfirm: () => {} });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchProducts();
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchCampaign = async () => {
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

  const loadSuggestions = async () => {
    if (suggestions) return;
    setLoadingSuggestions(true);
    try {
      const data = await api.getCampaignSuggestions();
      setSuggestions(data);
    } catch (err) {
      console.error('Error loading suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleToggleSuggestions = () => {
    const nextState = !showSuggestions;
    setShowSuggestions(nextState);
    if (nextState) {
      loadSuggestions();
    }
  };

  const handleSelectProduct = (p: any) => {
    setSelectedProduct(p);
    setNewItemPrice(p.listPrice.toString());
  };


  const searchProducts = async () => {
    setSearching(true);
    try {
      const data = await api.getProducts(searchTerm);
      setSearchResults(data.slice(0, 5)); // Limitar a 5 resultados
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setSearching(false);
    }
  };

  const addItem = async () => {
    if (!selectedProduct || !newItemPrice) return;

    try {
      const offerValue = parseFloat(newItemPrice);
      const discount = 1 - (offerValue / selectedProduct.listPrice);
      let finalTag = newItemTag || null;
      if (!finalTag && discount >= 0.15) {
        finalTag = '💥 MEGA OFERTA';
      }

      if (swapTarget) {
        await fetch(`${API_BASE_URL}/offers/${campaignId}/items/${swapTarget.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
      }

      const res = await fetch(`${API_BASE_URL}/offers/${campaignId}/items`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          productId: selectedProduct.id,
          offerPrice: offerValue,
          previousPrice: swapTarget ? swapTarget.previousPrice : null,
          specialTag: finalTag,
          showListPrice: swapTarget ? swapTarget.showListPrice : false,
          campaignGroup: swapTarget ? swapTarget.campaignGroup : null
        })
      });

      if (res.ok) {
        setSearchTerm('');
        setSelectedProduct(null);
        setNewItemPrice('');
        setNewItemTag('');
        setSwapTarget(null);
        fetchCampaign();
      }
    } catch (error) {
      console.error('Error adding/swapping item:', error);
      setConfirmModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al procesar producto en la oferta',
        type: 'danger',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const addBulkStructure = async () => {
    if (!suggestions || !suggestions.structures) return;
    const itemsToAdd: any[] = [];
    const structures = suggestions.structures;
    
    (structures.quesos || []).forEach((p: any) => {
      itemsToAdd.push({
        productId: p.id,
        offerPrice: p.listPrice,
        specialTag: null,
        showListPrice: true,
        campaignGroup: 'Quesos'
      });
    });

    (structures.fiambres || []).forEach((p: any) => {
      itemsToAdd.push({
        productId: p.id,
        offerPrice: p.listPrice,
        specialTag: null,
        showListPrice: true,
        campaignGroup: 'Fiambres'
      });
    });

    (structures.almacen || []).forEach((p: any) => {
      itemsToAdd.push({
        productId: p.id,
        offerPrice: p.listPrice,
        specialTag: null,
        showListPrice: true,
        campaignGroup: 'Almacén'
      });
    });

    (structures.frescos || []).forEach((p: any) => {
      itemsToAdd.push({
        productId: p.id,
        offerPrice: p.listPrice,
        specialTag: null,
        showListPrice: true,
        campaignGroup: 'Refrigerados'
      });
    });

    if (itemsToAdd.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Cargar Estructura',
      message: `¿Agregar ${itemsToAdd.length} productos de la estructura sugerida al catálogo (al precio de lista original)?`,
      type: 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.addBulkCampaignItems(Number(campaignId), itemsToAdd);
          fetchCampaign();
          setShowSuggestions(false);
        } catch (error) {
          console.error('Error adding bulk items:', error);
          setConfirmModal({
            isOpen: true,
            title: 'Error',
            message: 'Error al agregar estructura automática',
            type: 'danger',
            isAlert: true,
            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
          });
        }
      }
    });
  };

  const executeRemoveItem = async (itemId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/offers/${campaignId}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        fetchCampaign();
      }
    } catch (error) {
      console.error('Error removing item:', error);
    } finally {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const removeItem = (itemId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Quitar Producto',
      message: '¿Quitar este producto de la oferta?',
      type: 'danger',
      onConfirm: () => executeRemoveItem(itemId)
    });
  };

  const moveRubro = async (rubro: string, direction: 'up' | 'down') => {
    if (!campaign) return;
    
    const groupedItems = campaign.items.reduce((acc, item) => {
      const r = item.campaignGroup || item.product.rubro?.name || 'Varios';
      if (!acc[r]) acc[r] = [];
      acc[r].push(item);
      return acc;
    }, {} as Record<string, typeof campaign.items>);
    
    let currentOrder = campaign.customRubroOrder && campaign.customRubroOrder.length > 0
      ? campaign.customRubroOrder.filter(r => groupedItems[r])
      : Object.keys(groupedItems).sort((a, b) => {
          if (a === 'Varios' || a === 'OTROS') return 1;
          if (b === 'Varios' || b === 'OTROS') return -1;
          return a.localeCompare(b);
        });
    
    Object.keys(groupedItems).forEach(r => {
      if (!currentOrder.includes(r)) currentOrder.push(r);
    });

    const index = currentOrder.indexOf(rubro);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [currentOrder[index - 1], currentOrder[index]] = [currentOrder[index], currentOrder[index - 1]];
    } else if (direction === 'down' && index < currentOrder.length - 1) {
      [currentOrder[index + 1], currentOrder[index]] = [currentOrder[index], currentOrder[index + 1]];
    } else {
      return;
    }

    setCampaign({ ...campaign, customRubroOrder: currentOrder });

    try {
      await fetch(`${API_BASE_URL}/offers/${campaignId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          customRubroOrder: currentOrder
        })
      });
    } catch (error) {
      console.error('Error saving rubro order:', error);
      fetchCampaign();
    }
  };

  const updateCampaignItem = async (item: CampaignItem, updates: Partial<CampaignItem>) => {
    try {
      // Optimizacion: Actualizar estado local inmediatamente para buena UX
      setCampaign(prev => {
        if (!prev) return prev;
        const updatedItems = prev.items.map(i => i.id === item.id ? { ...i, ...updates } : i);
        return { ...prev, items: updatedItems };
      });

      await fetch(`${API_BASE_URL}/offers/${campaignId}/items`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          productId: item.productId,
          offerPrice: updates.offerPrice !== undefined ? updates.offerPrice : item.offerPrice,
          previousPrice: updates.previousPrice !== undefined ? updates.previousPrice : item.previousPrice,
          specialTag: updates.specialTag !== undefined ? updates.specialTag : item.specialTag,
          showListPrice: updates.showListPrice !== undefined ? updates.showListPrice : item.showListPrice,
          campaignGroup: updates.campaignGroup !== undefined ? updates.campaignGroup : item.campaignGroup
        })
      });
      // Optionally fetch again to ensure sync, but local update handles it
    } catch (error) {
      console.error('Error updating item:', error);
      fetchCampaign();
    }
  };

  const saveAndSync = async () => {
    // Explicit sync button for peace of mind
    if (!campaign) return;
    try {
      await fetch(`${API_BASE_URL}/offers/${campaignId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          customRubroOrder: campaign.customRubroOrder
        })
      });
      await fetchCampaign();
      setConfirmModal({
        isOpen: true,
        title: '¡Guardado Exitoso!',
        message: 'Todos los cambios y el orden se han guardado correctamente.',
        type: 'success',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    } catch (error) {
      console.error('Error saving:', error);
      setConfirmModal({
        isOpen: true,
        title: 'Error',
        message: 'Hubo un error al guardar los cambios.',
        type: 'danger',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  if (loading || !campaign) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Cargando editor...</div>;
  }

  return (
    <div className="fade-in" style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      <button 
        onClick={onBack}
        className="btn-secondary"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}
      >
        <ArrowLeft size={18} /> Volver a Campañas
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
            Editando: {campaign.title}
          </h2>
          <button 
            onClick={() => {
              setPromptModal({
                isOpen: true,
                title: 'Renombrar Campaña',
                message: 'Ingresa el nuevo nombre (ej: Semana 25 al 31):',
                defaultValue: campaign.title,
                onConfirm: async (newTitle) => {
                  setPromptModal(prev => ({ ...prev, isOpen: false }));
                  try {
                    await fetch(`${API_BASE_URL}/offers/${campaignId}`, {
                      method: 'PUT',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                      },
                      body: JSON.stringify({ title: newTitle })
                    });
                    fetchCampaign();
                  } catch (error) {
                    console.error('Error renaming:', error);
                  }
                }
              });
            }}
            style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            title="Renombrar campaña"
          >
            <Edit2 size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button 
            onClick={saveAndSync}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#10b981', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
            }}
          >
            Guardar Cambios
          </button>
          <div style={{ 
            backgroundColor: campaign.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)', 
            color: campaign.isActive ? '#10b981' : '#64748b',
            padding: '6px 16px',
            borderRadius: '20px',
            fontWeight: 'bold'
          }}>
            {campaign.isActive ? 'ACTIVA' : 'INACTIVA'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
        {/* Panel izquierdo: Buscador */}
        <div className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-card)', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
              {swapTarget ? 'Reemplazar Producto' : 'Agregar Oferta'}
            </h3>
            <button 
              onClick={handleToggleSuggestions}
              style={{ 
                background: showSuggestions ? 'rgba(139, 92, 246, 0.1)' : 'transparent', 
                border: '1px solid #8b5cf6', 
                color: '#8b5cf6', 
                padding: '6px 12px', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px'
              }}
            >
              <Wand2 size={16} /> 
              {showSuggestions ? 'Cerrar Asistente' : 'Asistente IA'}
            </button>
          </div>

          {swapTarget && (
            <div style={{ fontSize: '13px', color: '#f59e0b', marginBottom: '15px', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '10px', borderRadius: '8px' }}>
              Reemplazando: <strong>{swapTarget.product.name}</strong>
              <button 
                onClick={() => setSwapTarget(null)} 
                style={{ marginLeft: '10px', background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
              >
                Cancelar
              </button>
            </div>
          )}

          {!selectedProduct ? (
            showSuggestions ? (
              <div>
                {loadingSuggestions || !suggestions ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Analizando inventario...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
                    
                    {/* Próximos a vencer */}
                    {suggestions.expiring?.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 'bold', marginBottom: '10px' }}>
                          <AlertTriangle size={16} /> Próximos a Vencer
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {suggestions.expiring.map((p: any) => (
                            <div key={p.id} onClick={() => handleSelectProduct(p)} className="hover-bg-secondary" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: '500', fontSize: '13px' }}>{p.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Stock: {p.stock} | Lista: ${Number(p.listPrice).toFixed(2)}</div>
                              </div>
                              <Plus size={16} color="var(--text-muted)" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exceso de Stock */}
                    {suggestions.overstock?.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#3b82f6', fontWeight: 'bold', marginBottom: '10px' }}>
                          <TrendingDown size={16} /> Exceso de Stock
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {suggestions.overstock.map((p: any) => (
                            <div key={p.id} onClick={() => handleSelectProduct(p)} className="hover-bg-secondary" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: '500', fontSize: '13px' }}>{p.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Stock: {p.stock} | Lista: ${Number(p.listPrice).toFixed(2)}</div>
                              </div>
                              <Plus size={16} color="var(--text-muted)" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Estructuras Generales */}
                    {suggestions.structures && (
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 'bold' }}>
                            <Tag size={16} /> Estructura Sugerida
                          </div>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              onClick={() => {
                                if (!campaign || campaign.items.length === 0) return;
                                setConfirmModal({
                                  isOpen: true,
                                  title: 'Vaciar Campaña',
                                  message: '¿Estás seguro de que deseas eliminar TODOS los productos de esta campaña?',
                                  type: 'danger',
                                  onConfirm: async () => {
                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                    try {
                                      await Promise.all(campaign.items.map(item => 
                                        fetch(`${API_BASE_URL}/offers/${campaignId}/items/${item.id}`, {
                                          method: 'DELETE',
                                          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
                                        })
                                      ));
                                      fetchCampaign();
                                    } catch (error) {
                                      console.error('Error emptying campaign:', error);
                                    }
                                  }
                                });
                              }}
                              style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              Vaciar Campaña
                            </button>
                            <button
                              onClick={addBulkStructure}
                              style={{
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                            >
                              Cargar Estructura
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {['quesos', 'fiambres', 'almacen', 'frescos'].map(tipo => {
                            if (!suggestions.structures[tipo]) return null;
                            return suggestions.structures[tipo].map((p: any) => (
                              <div key={p.id} onClick={() => handleSelectProduct(p)} className="hover-bg-secondary" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: '500', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-secondary)', marginRight: '5px', textTransform: 'capitalize' }}>[{tipo}]</span> 
                                    {p.name}
                                  </div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Stock: {p.stock} | Lista: ${Number(p.listPrice).toFixed(2)}</div>
                                </div>
                                <Plus size={16} color="var(--text-muted)" />
                              </div>
                            ))
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ position: 'relative', marginBottom: '15px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 10px 10px 40px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {searching && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Buscando...</div>}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map(prod => (
                  <div 
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod)}
                    style={{
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    className="hover-bg-secondary"
                  >
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{prod.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{prod.sku}</div>
                    </div>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      ${Number(prod.listPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '500', color: '#3b82f6' }}>{selectedProduct.name}</div>
                  <button onClick={() => setSelectedProduct(null)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '20px' }}>&times;</button>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Precio de Lista: ${Number(selectedProduct.listPrice).toFixed(2)}</div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Precio de Oferta ($)
                </label>
                <input
                  type="number"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  placeholder="Ej: 8500.00"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Etiqueta Especial (Opcional)
                </label>
                <input
                  type="text"
                  value={newItemTag}
                  onChange={(e) => setNewItemTag(e.target.value)}
                  placeholder="Ej: ¡LLEVÁ 2 Y PAGÁ 1!"
                  maxLength={30}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <button 
                onClick={addItem}
                disabled={!newItemPrice}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', backgroundColor: swapTarget ? '#f59e0b' : '#10b981' }}
              >
                {swapTarget ? (
                  <>
                    <RefreshCw size={18} /> Reemplazar Producto
                  </>
                ) : (
                  <>
                    <Plus size={18} /> Agregar Oferta
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Panel derecho: Tabla de productos (Alta Densidad) */}
        <div className="card" style={{ padding: '0px', backgroundColor: 'var(--bg-card)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <div style={{ padding: '20px 20px 10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
              Productos en la Campaña ({campaign.items.length})
            </h3>
          </div>

          {campaign.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
              Aún no hay productos en esta campaña.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)', color: 'var(--text-secondary, #64748b)', textAlign: 'left', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>SKU</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Producto</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600' }}>Grupo</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Precio Lista</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Precio Oferta ($)</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'center' }}>% Ahorro</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'right' }}>Anterior (Tachado)</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'center' }}>Etiqueta</th>
                    <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'center', width: '70px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Agrupación por Rubro */}
                  {(() => {
                    const groupedItems = campaign.items.reduce((acc, item) => {
                      const rubro = item.campaignGroup || item.product.rubro?.name || 'Varios';
                      if (!acc[rubro]) acc[rubro] = [];
                      acc[rubro].push(item);
                      return acc;
                    }, {} as Record<string, typeof campaign.items>);

                      let rubroOrder = campaign.customRubroOrder && campaign.customRubroOrder.length > 0
                        ? campaign.customRubroOrder.filter(r => groupedItems[r])
                        : Object.keys(groupedItems).sort((a, b) => {
                            if (a === 'Varios' || a === 'OTROS') return 1;
                            if (b === 'Varios' || b === 'OTROS') return -1;
                            return a.localeCompare(b);
                          });
                        
                    Object.keys(groupedItems).forEach(r => {
                      if (!rubroOrder.includes(r)) rubroOrder.push(r);
                    });

                    return rubroOrder.map((rubro, index) => {
                      const items = groupedItems[rubro];
                      return (
                        <React.Fragment key={rubro}>
                          <tr style={{ backgroundColor: 'var(--bg-secondary, #f1f5f9)' }}>
                            <td colSpan={9} style={{ padding: '8px 14px', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <span>{rubro.toUpperCase()} ({items.length})</span>
                                  <select
                                    title="Mover todos a..."
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val) {
                                        setConfirmModal({
                                          isOpen: true,
                                          title: 'Mover Productos',
                                          message: `¿Mover los ${items.length} productos de ${rubro.toUpperCase()} al grupo "${val}"?`,
                                          type: 'info',
                                          onConfirm: () => {
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                            items.forEach(it => updateCampaignItem(it, { campaignGroup: val }));
                                          }
                                        });
                                      }
                                      e.target.value = "";
                                    }}
                                    style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}
                                  >
                                    <option value="">Mover todos a...</option>
                                    <option value="Automático">Automático</option>
                                    {AVAILABLE_GROUPS.map(g => (
                                      <option key={g} value={g}>{g}</option>
                                    ))}
                                  </select>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    onClick={() => moveRubro(rubro, 'up')}
                                    disabled={index === 0}
                                    style={{ background: index === 0 ? 'var(--border-color)' : 'var(--text-primary)', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: '#fff', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Subir Rubro"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button 
                                    onClick={() => moveRubro(rubro, 'down')}
                                    disabled={index === rubroOrder.length - 1}
                                    style={{ background: index === rubroOrder.length - 1 ? 'var(--border-color)' : 'var(--text-primary)', border: 'none', cursor: index === rubroOrder.length - 1 ? 'not-allowed' : 'pointer', color: '#fff', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Bajar Rubro"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                      {items.map((item, index) => {
                        const listPrice = Number(item.product.listPrice);
                        const offerPrice = Number(item.offerPrice);
                        const savingPct = listPrice > 0 ? ((listPrice - offerPrice) / listPrice * 100) : 0;
                        
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: index % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)' }}>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              {item.product.sku}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                              {item.product.name}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <select 
                                value={item.campaignGroup || ''} 
                                onChange={(e) => updateCampaignItem(item, { campaignGroup: e.target.value })}
                                style={{ padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '11px', width: '130px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              >
                                <option value="">Automático</option>
                                {AVAILABLE_GROUPS.map(g => (
                                  <option key={g} value={g}>{g}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              ${listPrice.toFixed(2)}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--color-corp-red, #E30613)' }}>$</span>
                                <input 
                                  key={`offer-${item.id}-${offerPrice}`}
                                  type="number"
                                  step="0.01"
                                  defaultValue={offerPrice ? offerPrice : ''}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val) && val > 0 && val !== offerPrice) {
                                      updateCampaignItem(item, { offerPrice: val });
                                    }
                                  }}
                                  style={{ 
                                    width: '95px', 
                                    padding: '4px 6px', 
                                    borderRadius: '4px', 
                                    border: '1px solid var(--color-corp-red, #E30613)', 
                                    textAlign: 'right', 
                                    fontWeight: 'bold', 
                                    color: 'var(--color-corp-red, #E30613)',
                                    fontSize: '13px',
                                    backgroundColor: 'rgba(227, 6, 19, 0.04)'
                                  }}
                                  placeholder="Ej: 8500"
                                />
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {savingPct > 0 ? (
                                <span style={{ 
                                  fontSize: '11px', 
                                  fontWeight: 'bold', 
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                                  color: '#10b981', 
                                  padding: '2px 8px', 
                                  borderRadius: '12px' 
                                }}>
                                  -{savingPct.toFixed(0)}%
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>0%</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>$</span>
                                <input 
                                  key={`prev-${item.id}-${item.previousPrice || ''}`}
                                  type="number"
                                  defaultValue={item.previousPrice ? Number(item.previousPrice) : ''}
                                  onBlur={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      if (val !== Number(item.previousPrice)) updateCampaignItem(item, { previousPrice: val });
                                    } else if (item.previousPrice !== null) {
                                      updateCampaignItem(item, { previousPrice: null });
                                    }
                                  }}
                                  style={{ 
                                    width: '85px', 
                                    padding: '4px 6px', 
                                    borderRadius: '4px', 
                                    border: '1px solid var(--border-color)', 
                                    textAlign: 'right', 
                                    fontWeight: '500', 
                                    color: 'var(--text-secondary)',
                                    fontSize: '12px',
                                    backgroundColor: 'var(--bg-card)'
                                  }}
                                  placeholder="Ej: 10500"
                                />
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <input 
                                key={`tag-${item.id}-${item.specialTag || ''}`}
                                type="text"
                                defaultValue={item.specialTag || ''}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val !== (item.specialTag || '')) {
                                    updateCampaignItem(item, { specialTag: val || null });
                                  }
                                }}
                                style={{ 
                                  width: '100px', 
                                  padding: '4px 6px', 
                                  borderRadius: '4px', 
                                  border: '1px solid var(--border-color)', 
                                  textAlign: 'center', 
                                  fontSize: '11px',
                                  textTransform: 'uppercase',
                                  backgroundColor: item.specialTag ? 'rgba(227, 6, 19, 0.08)' : 'var(--bg-card)',
                                  color: item.specialTag ? 'var(--color-corp-red, #E30613)' : 'var(--text-secondary)',
                                  fontWeight: item.specialTag ? 'bold' : 'normal'
                                }}
                                placeholder="Ej: 2x1!"
                              />
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                <button
                                  onClick={() => {
                                    setSwapTarget(item);
                                    setSearchTerm('');
                                    setSelectedProduct(null);
                                    setNewItemPrice('');
                                    setNewItemTag(item.specialTag || '');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                                  title="Reemplazar producto"
                                >
                                  <RefreshCw size={15} />
                                </button>
                                <button
                                  onClick={() => removeItem(item.id)}
                                  style={{ background: 'none', border: 'none', color: 'var(--color-danger, #ef4444)', cursor: 'pointer', padding: '4px' }}
                                  title="Eliminar producto"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        isAlert={confirmModal.isAlert}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
      <PromptModal
        isOpen={promptModal.isOpen}
        title={promptModal.title}
        message={promptModal.message}
        defaultValue={promptModal.defaultValue}
        onConfirm={promptModal.onConfirm}
        onCancel={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
