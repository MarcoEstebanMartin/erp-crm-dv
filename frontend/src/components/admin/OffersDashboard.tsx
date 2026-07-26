import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Calendar, Tag, FileText, Trash2, Edit, Copy, Megaphone, Wand2 } from 'lucide-react';
import { API_BASE_URL } from '../../utils/api';
import CampaignEditor from './CampaignEditor';
import OffersCatalogGenerator from './OffersCatalogGenerator';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';
import CampaignBroadcastModal from '../modals/CampaignBroadcastModal';
import WeeklyOfferWizardModal from '../modals/WeeklyOfferWizardModal';

interface OfferCampaign {
  id: number;
  title: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { items: number };
}

export default function OffersDashboard() {
  const [campaigns, setCampaigns] = useState<OfferCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor' | 'pdf'>('list');
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [broadcastCampaignModal, setBroadcastCampaignModal] = useState<any | null>(null);
  const [wizardModalOpen, setWizardModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'list') {
      fetchCampaigns();
    }
  }, [view]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/offers`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeCreateCampaign = async (title: string) => {
    setPromptModal(prev => ({ ...prev, isOpen: false }));
    try {
      const res = await fetch(`${API_BASE_URL}/offers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const newCampaign = await res.json();
        setSelectedCampaignId(newCampaign.id);
        setView('editor');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      setConfirmModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al crear la campaña',
        type: 'danger',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const createCampaign = () => {
    setPromptModal({
      isOpen: true,
      title: 'Nueva Campaña de Ofertas',
      message: 'Ingresa el nombre de la nueva campaña de ofertas (Ej: Semana 18 al 25):',
      defaultValue: '',
      onConfirm: (val) => executeCreateCampaign(val)
    });
  };

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title?: string, message: string, onConfirm: () => void, type?: 'danger'|'warning'|'info', isAlert?: boolean}>({ isOpen: false, message: '', onConfirm: () => {} });
  const [promptModal, setPromptModal] = useState<{isOpen: boolean, title: string, message: string, defaultValue: string, onConfirm: (val: string) => void}>({ isOpen: false, title: '', message: '', defaultValue: '', onConfirm: () => {} });

  const executeDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/offers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.ok) {
        fetchCampaigns();
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
    } finally {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  const deleteCampaign = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Campaña',
      message: '¿Seguro que deseas eliminar esta campaña y todos sus precios de oferta?',
      type: 'danger',
      onConfirm: () => executeDelete(id)
    });
  };

  const executeDuplicate = async (campaign: OfferCampaign, newTitle: string) => {
    setLoading(true);
    setPromptModal(prev => ({ ...prev, isOpen: false }));
    try {
      const res = await fetch(`${API_BASE_URL}/offers/${campaign.id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!res.ok) throw new Error('Error fetching original campaign');
      const originalCampaign = await res.json();
      
      const createRes = await fetch(`${API_BASE_URL}/offers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ title: newTitle, isActive: false })
      });
      if (!createRes.ok) throw new Error('Error creating new campaign');
      const newCampaign = await createRes.json();
      
      if (originalCampaign.items && originalCampaign.items.length > 0) {
        const itemsToAdd = originalCampaign.items.map((item: any) => ({
          productId: item.productId,
          offerPrice: item.offerPrice,
          previousPrice: item.previousPrice,
          specialTag: item.specialTag,
          showListPrice: item.showListPrice,
          campaignGroup: item.campaignGroup
        }));
        
        await fetch(`${API_BASE_URL}/offers/${newCampaign.id}/items/bulk`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ items: itemsToAdd })
        });
        
        if (originalCampaign.customRubroOrder) {
          await fetch(`${API_BASE_URL}/offers/${newCampaign.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({ customRubroOrder: originalCampaign.customRubroOrder })
          });
        }
      }
      
      setSelectedCampaignId(newCampaign.id);
      setView('editor');
    } catch (error) {
      console.error('Error duplicating campaign:', error);
      setConfirmModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al duplicar la campaña',
        type: 'danger',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setLoading(false);
    }
  };

  const duplicateCampaign = (campaign: OfferCampaign) => {
    setConfirmModal({
      isOpen: true,
      title: 'Duplicar Campaña',
      message: `¿Deseas duplicar la campaña "${campaign.title}"?`,
      type: 'info',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setTimeout(() => {
          setPromptModal({
            isOpen: true,
            title: 'Nombre de la nueva campaña',
            message: 'Escribe el nombre para la campaña duplicada:',
            defaultValue: `${campaign.title} (Copia)`,
            onConfirm: (val) => executeDuplicate(campaign, val)
          });
        }, 300);
      }
    });
  };

  if (view === 'editor' && selectedCampaignId) {
    return <CampaignEditor campaignId={selectedCampaignId} onBack={() => setView('list')} />;
  }

  if (view === 'pdf' && selectedCampaignId) {
    return <OffersCatalogGenerator campaignId={selectedCampaignId} onBack={() => setView('list')} />;
  }

  return (
    <div className="fade-in" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {successMsg && (
        <div style={{ backgroundColor: 'var(--color-success-bg)', borderLeft: '4px solid var(--color-success)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{successMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Campañas de Ofertas
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Gestiona las listas semanales de ofertas y genera el catálogo PDF premium.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={fetchCampaigns}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={18} /> Actualizar
          </button>
          <button 
            onClick={() => setWizardModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(139, 92, 246, 0.2)'
            }}
          >
            <Wand2 size={18} /> Asistente Semanal
          </button>
          <button 
            onClick={createCampaign}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Nueva Vacía
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Cargando campañas...</div>
      ) : campaigns.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'var(--bg-card)' }}>
          <Tag size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 20px auto' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '10px' }}>
            No hay campañas creadas
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Comienza creando tu primera lista semanal de ofertas.
          </p>
          <button onClick={createCampaign} className="btn-primary">
            Crear Primera Campaña
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
          {campaigns.map(camp => (
            <div key={camp.id} className="card" style={{ 
              backgroundColor: 'var(--bg-card)', 
              borderRadius: '12px', 
              padding: '24px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {camp.title}
                  </h3>
                  <div style={{ 
                    backgroundColor: camp.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)', 
                    color: camp.isActive ? '#10b981' : '#64748b',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {camp.isActive ? 'ACTIVA' : 'INACTIVA'}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '25px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    <Calendar size={16} />
                    <span>Inicio: {new Date(camp.startDate).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    <Tag size={16} />
                    <span>{camp._count?.items || 0} Productos en Oferta</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'nowrap', alignItems: 'center' }}>
                <button 
                  onClick={() => { setSelectedCampaignId(camp.id); setView('editor'); }}
                  className="btn-secondary"
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', padding: '10px' }}
                  title="Editar"
                >
                  <Edit size={16} /> Editar
                </button>
                <button 
                  onClick={() => duplicateCampaign(camp)}
                  className="btn-secondary"
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', backgroundColor: '#f8fafc', padding: '10px' }}
                  title="Duplicar como plantilla"
                >
                  <Copy size={16} /> Duplicar
                </button>
                <button 
                  onClick={() => setBroadcastCampaignModal(camp)}
                  className="btn-secondary"
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', backgroundColor: '#EEF2FF', color: '#4F46E5', borderColor: '#C7D2FE', fontWeight: 600, padding: '10px' }}
                  title="Difundir Ofertas por WhatsApp"
                >
                  <Megaphone size={16} /> WhatsApp
                </button>
                <button 
                  onClick={() => { setSelectedCampaignId(camp.id); setView('pdf'); }}
                  className="btn-primary"
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', backgroundColor: '#e30613', padding: '10px' }}
                >
                  <FileText size={16} /> PDF
                </button>
                <button 
                  onClick={() => deleteCampaign(camp.id)}
                  style={{ 
                    padding: '10px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  title="Eliminar campaña"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
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

      {/* Modal de Difusión de Ofertas por WhatsApp */}
      {broadcastCampaignModal && (
        <CampaignBroadcastModal 
          campaign={broadcastCampaignModal}
          onClose={() => setBroadcastCampaignModal(null)}
          onSuccess={(msg) => setSuccessMsg(msg)}
        />
      )}

      {/* Modal Asistente Semanal de Rotación */}
      <WeeklyOfferWizardModal
        isOpen={wizardModalOpen}
        onClose={() => setWizardModalOpen(false)}
        onCampaignCreated={(id) => {
          setSelectedCampaignId(id);
          setView('editor');
        }}
      />
    </div>
  );
}
