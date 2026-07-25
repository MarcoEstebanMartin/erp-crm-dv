import React, { useState } from 'react';
import { X, Send, Users, MapPin, UserCheck, CheckCircle2 } from 'lucide-react';

interface CrmBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: any[];
  availableCities: string[];
  availableSellers: string[];
}

export default function CrmBroadcastModal({
  isOpen,
  onClose,
  conversations,
  availableCities,
  availableSellers
}: CrmBroadcastModalProps) {
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [template, setTemplate] = useState<string>('LISTA_PRECIOS');
  const [customText, setCustomText] = useState<string>(
    '📋 *LISTA DE PRECIOS E ESPECIALES DE LA SEMANA*\n\nHola! Te enviamos nuestra lista de precios actualizada y las ofertas especiales para tu zona.\n\n👉 Respondé este mensaje con tu pedido para reservarlo de inmediato.'
  );
  const [sending, setSending] = useState(false);
  const [successResult, setSuccessResult] = useState<{ total: number; city: string } | null>(null);

  if (!isOpen) return null;

  const getSellerDisplayName = (sellerObj: any): string => {
    if (!sellerObj) return 'Sin asignación';
    if (sellerObj.name) return sellerObj.name;
    if (sellerObj.username) {
      const u = sellerObj.username.toLowerCase();
      if (u === 'diego') return 'Diego';
      if (u === 'fabian') return 'Fabián';
      if (u === 'norberto') return 'Norberto';
      if (u === 'maria_jose') return 'María José';
      return u.charAt(0).toUpperCase() + u.slice(1);
    }
    return 'Sin asignación';
  };

  // Filtrar destinatarios según los filtros
  const targetRecipients = conversations.filter(c => {
    const cCity = (c.persona?.city || '').toUpperCase();
    const cityMatch = selectedCity === 'ALL' || cCity === selectedCity.toUpperCase();
    const sellerName = getSellerDisplayName(c.persona?.seller);
    const sellerMatch = selectedSeller === 'ALL' || sellerName === selectedSeller;
    return cityMatch && sellerMatch;
  });

  const handleTemplateChange = (tpl: string) => {
    setTemplate(tpl);
    if (tpl === 'LISTA_PRECIOS') {
      setCustomText(
        '📋 *LISTA DE PRECIOS E ESPECIALES DE LA SEMANA*\n\nHola! Te enviamos nuestra lista de precios actualizada y las ofertas especiales para tu zona.\n\n👉 Respondé este mensaje con tu pedido para reservarlo de inmediato.'
      );
    } else if (tpl === 'OFERTA_BEBIDAS') {
      setCustomText(
        '🍻 *OFERTAS DESTACADAS EN BEBIDAS*\n\nHola! Esta semana tenemos descuentos especiales en cajones y packs por pallet.\n\n🔹 Cervezas y Bebidas en Promoción\n🔹 Entrega prioritaria en tu localidad\n\n¿Te armamos el pedido con descuento?'
      );
    } else if (tpl === 'RECORDATORIO_RECOMPRA') {
      setCustomText(
        '🚚 *PRÓXIMO RECORRIDO DE REPARTO EN TU ZONA*\n\nHola! Nuestro camión estará pasando por tu localidad entre mañana y pasado.\n\n¿Te hace falta reponer stock de algún producto para aprovechar la ruta?'
      );
    }
  };

  const handleSendBroadcast = async () => {
    if (targetRecipients.length === 0) return;

    setSending(true);
    // Simular el proceso de envío a la audiencia elegida
    await new Promise(resolve => setTimeout(resolve, 1200));
    setSending(false);
    setSuccessResult({
      total: targetRecipients.length,
      city: selectedCity === 'ALL' ? 'Todas las localidades' : selectedCity
    });
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '620px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header del Modal */}
        <div 
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB' }}>
              <Send size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Enviar Difusión de Precios & Ofertas por WhatsApp
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Envío masivo segmentado por localidad y vendedor asignado
              </p>
            </div>
          </div>
          <button 
            className="btn btn-ghost" 
            style={{ padding: '4px', borderRadius: '6px' }} 
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {successResult ? (
            <div style={{ textAlign: 'center', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '16px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#16A34A' }}>
                ¡Difusión enviada con éxito!
              </h4>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                Se despachó el mensaje promocional a <strong>{successResult.total} contactos</strong> pertenecientes a <strong>{successResult.city}</strong>.
              </p>
              <button 
                className="btn btn-primary"
                style={{ marginTop: '12px', padding: '8px 24px' }}
                onClick={() => {
                  setSuccessResult(null);
                  onClose();
                }}
              >
                Entendido
              </button>
            </div>
          ) : (
            <>
              {/* Segmentación de Audiencia */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🎯 Target / Audiencia Objetivo
                </strong>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <MapPin size={12} /> Localidad / Ciudad:
                    </label>
                    <select 
                      className="form-control"
                      style={{ padding: '6px 10px', fontSize: '0.82rem', width: '100%' }}
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                    >
                      <option value="ALL">Todas las ciudades ({conversations.length})</option>
                      {availableCities.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <UserCheck size={12} /> Vendedor Asignado:
                    </label>
                    <select 
                      className="form-control"
                      style={{ padding: '6px 10px', fontSize: '0.82rem', width: '100%' }}
                      value={selectedSeller}
                      onChange={(e) => setSelectedSeller(e.target.value)}
                    >
                      <option value="ALL">Todos los vendedores</option>
                      {availableSellers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', backgroundColor: '#FFFFFF', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={13} /> Alcance del mensaje:
                  </span>
                  <strong style={{ color: targetRecipients.length > 0 ? '#2563EB' : '#DC2626' }}>
                    {targetRecipients.length} Clientes Mayoristas
                  </strong>
                </div>
              </div>

              {/* Plantillas Predeterminadas */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Plantillas de Difusión:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button"
                    className={`btn ${template === 'LISTA_PRECIOS' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    onClick={() => handleTemplateChange('LISTA_PRECIOS')}
                  >
                    📋 Lista Semanal
                  </button>
                  <button 
                    type="button"
                    className={`btn ${template === 'OFERTA_BEBIDAS' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    onClick={() => handleTemplateChange('OFERTA_BEBIDAS')}
                  >
                    🍻 Ofertas Bebidas
                  </button>
                  <button 
                    type="button"
                    className={`btn ${template === 'RECORDATORIO_RECOMPRA' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    onClick={() => handleTemplateChange('RECORDATORIO_RECOMPRA')}
                  >
                    🚚 Aviso de Ruta
                  </button>
                </div>
              </div>

              {/* Contenido del Mensaje */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Mensaje a Enviar por WhatsApp:
                </label>
                <textarea 
                  className="form-control"
                  rows={5}
                  style={{ width: '100%', fontSize: '0.85rem', fontFamily: 'inherit', padding: '10px' }}
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                />
              </div>

              {/* Footer de Acciones */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={onClose}
                >
                  Cancelar
                </button>

                <button 
                  type="button" 
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleSendBroadcast}
                  disabled={sending || targetRecipients.length === 0}
                >
                  <Send size={14} />
                  <span>{sending ? 'Despachando...' : `Enviar a ${targetRecipients.length} contactos`}</span>
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
