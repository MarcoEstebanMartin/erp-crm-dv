import React, { useState } from 'react';
import { X, Send, Megaphone, Users, MapPin, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';

interface CampaignBroadcastModalProps {
  campaign: any;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function CampaignBroadcastModal({ campaign, onClose, onSuccess }: CampaignBroadcastModalProps) {
  const [targetSegment, setTargetSegment] = useState<'ALL' | 'ROUTE' | 'INACTIVE'>('ALL');
  const [routeName, setRouteName] = useState('Villegas');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formatear texto de vista previa
  const items = campaign.items || [];
  let previewText = `🔥 *OFERTAS IMPERDIBLES - DV DISTRIBUIDORA* 🔥\n📌 *${campaign.title}*\n\nAprovechá las mejores ofertas disponibles esta semana:\n`;
  items.forEach((item: any) => {
    previewText += `• *${item.product?.name || 'Producto'}*: *$${Number(item.offerPrice || 0).toLocaleString('es-AR')}*\n`;
  });
  previewText += `\n💬 *Respondé a este mensaje para tomar tu pedido directo con nuestro Asistente.*`;

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.broadcastCrmCampaign({
        campaignId: campaign.id,
        targetSegment,
        routeName: targetSegment === 'ROUTE' ? routeName : undefined
      });

      onSuccess(`🚀 Difusión enviada exitosamente a ${res.sentCount} clientes en WhatsApp.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la difusión de la campaña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1150 }}>
      <div className="modal-content" style={{ maxWidth: '640px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#EEF2FF', padding: '8px', borderRadius: '8px', color: '#4F46E5', display: 'flex' }}>
              <Megaphone size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Difundir Ofertas por WhatsApp</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Envíe una campaña promocional segmentada directamente al celular de sus clientes.
              </p>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleBroadcast}>
          <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {errorMsg && (
              <div style={{ backgroundColor: '#FFF2F2', borderLeft: '4px solid var(--color-corp-red)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ color: 'var(--color-corp-red)' }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Campaña Seleccionada */}
            <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Campaña Activa:</span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>{campaign.title}</h4>
              </div>
              <span className="badge" style={{ backgroundColor: '#DCFCE7', color: '#16A34A', fontWeight: 700 }}>
                {items.length} Ofertas Incluidas
              </span>
            </div>

            {/* Segmentación de Destinatarios */}
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px', display: 'block' }}>
                Seleccionar Segmento de Clientes:
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div 
                  onClick={() => setTargetSegment('ALL')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetSegment === 'ALL' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    backgroundColor: targetSegment === 'ALL' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center'
                  }}
                >
                  <Users size={18} style={{ color: targetSegment === 'ALL' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Todos los Clientes</span>
                </div>

                <div 
                  onClick={() => setTargetSegment('ROUTE')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetSegment === 'ROUTE' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    backgroundColor: targetSegment === 'ROUTE' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center'
                  }}
                >
                  <MapPin size={18} style={{ color: targetSegment === 'ROUTE' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Por Ruta de Reparto</span>
                </div>

                <div 
                  onClick={() => setTargetSegment('INACTIVE')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: targetSegment === 'INACTIVE' ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    backgroundColor: targetSegment === 'INACTIVE' ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    textAlign: 'center'
                  }}
                >
                  <Megaphone size={18} style={{ color: targetSegment === 'INACTIVE' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Clientes Inactivos</span>
                </div>
              </div>

              {targetSegment === 'ROUTE' && (
                <div style={{ marginTop: '10px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre de la Ruta / Localidad:</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: Villegas, Bunge, Buchardo..."
                    value={routeName}
                    onChange={e => setRouteName(e.target.value)}
                    style={{ fontSize: '0.85rem', marginTop: '4px' }}
                  />
                </div>
              )}
            </div>

            {/* Vista Previa del Mensaje de WhatsApp */}
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Vista Previa del Mensaje en WhatsApp:
              </span>
              <div style={{
                backgroundColor: '#DCF8C6',
                color: '#1E293B',
                padding: '12px 16px',
                borderRadius: '12px 0px 12px 12px',
                marginTop: '6px',
                fontSize: '0.82rem',
                whiteSpace: 'pre-wrap',
                border: '1px solid #C4E8A7',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
              }}>
                {previewText}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ backgroundColor: '#4F46E5', borderColor: '#4F46E5', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={loading || items.length === 0}
            >
              {loading ? <Loader2 className="spin-anim" size={16} /> : <Send size={15} />}
              <span>{loading ? 'Enviando Campaña...' : '🚀 Iniciar Difusión por WhatsApp'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
