import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  UserCheck, 
  MessageSquare, 
  Phone, 
  Search, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Sparkles,
  CreditCard,
  Building2
} from 'lucide-react';
import CrmBroadcastModal from '../modals/CrmBroadcastModal';

interface CrmWholesaleBoardProps {
  conversations: any[];
  onRefresh: () => void;
  onSelectConversation: (conv: any) => void;
}

const COLUMNS = [
  {
    id: 'FREQUENT',
    label: '🟢 Compra Frecuente (Activos)',
    sublabel: 'Compraron recientemente',
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  {
    id: 'AT_RISK',
    label: '🟡 En Riesgo (7-14 días)',
    sublabel: 'Ciclo habitual por vencer',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  {
    id: 'INACTIVE',
    label: '🔴 Cliente Inactivo (> 15 días)',
    sublabel: 'Alerta a Vendedor asignado',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  {
    id: 'NEW_LEAD',
    label: '⭐ Nueva Consulta / Prospecto WA',
    sublabel: 'Sin CUIT o cliente nuevo',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    borderColor: '#C7D2FE'
  }
];

export default function CrmWholesaleBoard({
  conversations,
  onRefresh,
  onSelectConversation
}: CrmWholesaleBoardProps) {
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showBroadcastModal, setShowBroadcastModal] = useState<boolean>(false);

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

  // Extraer ciudades y vendedores únicos disponibles en las conversaciones o personas
  const availableCities = useMemo(() => {
    const citiesSet = new Set<string>();
    conversations.forEach(c => {
      if (c.persona?.city) {
        citiesSet.add(c.persona.city.toUpperCase());
      }
    });
    if (citiesSet.size === 0) {
      ['GENERAL VILLEGAS', 'BANDERALÓ', 'INTENDENTE ALVEAR', 'EMILIO BUNGE', 'PIEDRITAS', 'BERNARDO LARROUDÉ', 'TRES ALGARROBOS', 'RIVADAVIA'].forEach(c => citiesSet.add(c));
    }
    return Array.from(citiesSet).sort();
  }, [conversations]);

  const availableSellers = useMemo(() => {
    const sellersSet = new Set<string>();
    conversations.forEach(c => {
      const sName = getSellerDisplayName(c.persona?.seller);
      if (sName && sName !== 'Sin asignación') sellersSet.add(sName);
    });
    if (sellersSet.size === 0) {
      ['Diego', 'Fabián', 'Norberto', 'María José'].forEach(s => sellersSet.add(s));
    }
    return Array.from(sellersSet).sort();
  }, [conversations]);

  // Asignar dinámicamente cada conversación a una columna según su estado/persona
  const categorizeConversation = (conv: any): string => {
    const stage = conv.stage || 'LEAD';
    if (!conv.personaId || stage === 'LEAD') {
      return 'NEW_LEAD';
    }
    if (stage === 'WON') {
      return 'FREQUENT';
    }
    if (stage === 'QUOTED' || stage === 'CONTACTED') {
      return 'AT_RISK';
    }
    if (stage === 'LOST') {
      return 'INACTIVE';
    }
    return 'FREQUENT';
  };

  // Filtrado de conversaciones
  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const city = (c.persona?.city || 'General Villegas').toUpperCase();
      const seller = getSellerDisplayName(c.persona?.seller);

      const cityMatch = selectedCity === 'ALL' || city === selectedCity;
      const sellerMatch = selectedSeller === 'ALL' || seller === selectedSeller;

      const q = searchQuery.toLowerCase().trim();
      const nameMatch = !q || 
        (c.contactName && c.contactName.toLowerCase().includes(q)) ||
        (c.waId && c.waId.includes(q)) ||
        (c.persona?.cuit && c.persona.cuit.includes(q));

      return cityMatch && sellerMatch && nameMatch;
    });
  }, [conversations, selectedCity, selectedSeller, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Barra de Herramientas & Filtros de Segmentación (Stripe Style) */}
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          
          {/* Búsqueda */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text"
              className="form-control"
              placeholder="Buscar por cliente, CUIT o cel..."
              style={{ paddingLeft: '30px', fontSize: '0.82rem', height: '34px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filtro Ciudad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} style={{ color: 'var(--text-secondary)' }} />
            <select 
              className="form-control"
              style={{ fontSize: '0.82rem', height: '34px', padding: '0 8px' }}
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="ALL">📍 Todas las Localidades</option>
              {availableCities.map(c => (
                <option key={c} value={c}>📍 {c}</option>
              ))}
            </select>
          </div>

          {/* Filtro Vendedor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <UserCheck size={14} style={{ color: 'var(--text-secondary)' }} />
            <select 
              className="form-control"
              style={{ fontSize: '0.82rem', height: '34px', padding: '0 8px' }}
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
            >
              <option value="ALL">👤 Todos los Vendedores</option>
              {availableSellers.map(s => (
                <option key={s} value={s}>👤 {s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botón de Enviar Difusión de Precios */}
        <button 
          type="button"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem' }}
          onClick={() => setShowBroadcastModal(true)}
        >
          <Send size={15} />
          <span>📤 Difusión Masiva de Precios / Ofertas</span>
        </button>
      </div>

      {/* Tablero Kanban de Recompras Mayoristas */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '14px', 
          minHeight: '580px',
          overflowX: 'auto' 
        }}
      >
        {COLUMNS.map(col => {
          const colItems = filteredConversations.filter(c => categorizeConversation(c) === col.id);

          return (
            <div 
              key={col.id}
              style={{
                backgroundColor: '#FAFAFA',
                border: `1px solid ${col.borderColor}`,
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Header de la columna */}
              <div 
                style={{ 
                  paddingBottom: '10px', 
                  borderBottom: `2px solid ${col.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {col.label}
                  </span>
                  <span 
                    style={{ 
                      backgroundColor: col.bgColor, 
                      color: col.color, 
                      fontSize: '0.75rem', 
                      fontWeight: 800, 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      border: `1px solid ${col.borderColor}`
                    }}
                  >
                    {colItems.length}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {col.sublabel}
                </span>
              </div>

              {/* Lista de Tarjetas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
                {colItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Sin clientes en este estado
                  </div>
                ) : (
                  colItems.map(conv => {
                    const persona = conv.persona;
                    const city = (persona?.city || 'GENERAL VILLEGAS').toUpperCase();
                    const sellerName = getSellerDisplayName(persona?.seller);
                    const balance = Number(persona?.outstandingBalance || 0);

                    return (
                      <div 
                        key={conv.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                        }}
                      >
                        {/* Título & Chat Directo */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
                              {conv.contactName || conv.waId}
                            </strong>
                            {persona?.cuit && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                CUIT: {persona.cuit}
                              </span>
                            )}
                          </div>
                          
                          <button 
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => onSelectConversation(conv)}
                          >
                            <MessageSquare size={12} style={{ color: '#2563EB' }} />
                            <span>Chat</span>
                          </button>
                        </div>

                        {/* Detalles Mayoristas (Ciudad / Vendedor / Saldo) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={12} style={{ color: '#64748B' }} />
                            <span><strong>Ciudad:</strong> {city}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UserCheck size={12} style={{ color: '#64748B' }} />
                            <span><strong>Vendedor:</strong> {sellerName}</span>
                          </div>

                          {persona && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <CreditCard size={12} style={{ color: balance > 0 ? 'var(--color-corp-red)' : '#16A34A' }} />
                              <span>
                                <strong>Cta Cte: </strong> 
                                <span style={{ color: balance > 0 ? 'var(--color-corp-red)' : '#16A34A', fontWeight: 700 }}>
                                  ${balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Botón de Acción Directa */}
                        <button 
                          className="btn btn-ghost"
                          style={{
                            width: '100%',
                            fontSize: '0.74rem',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            backgroundColor: '#F8FAFC',
                            border: '1px dashed var(--border-color)',
                            borderRadius: '6px',
                            marginTop: '2px'
                          }}
                          onClick={() => onSelectConversation(conv)}
                        >
                          <Sparkles size={12} style={{ color: '#4F46E5' }} />
                          <span>Armar Pedido en WhatsApp</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Difusión Masiva */}
      <CrmBroadcastModal 
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        conversations={conversations}
        availableCities={availableCities}
        availableSellers={availableSellers}
      />
    </div>
  );
}
