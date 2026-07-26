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
  Building2,
  TrendingUp,
  RefreshCw,
  Users,
  ArrowRight
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
    label: '🟢 Al Día / Frecuentes',
    sublabel: 'Compraron hace ≤ 7 días',
    badgeText: 'Activo',
    color: '#10B981',
    bgColor: '#F0FDF4',
    borderColor: '#BBF7D0'
  },
  {
    id: 'AT_RISK',
    label: '🟡 En Riesgo (7-14 días)',
    sublabel: 'Ciclo habitual por vencer',
    badgeText: 'Llamar Hoy',
    color: '#D97706',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  {
    id: 'INACTIVE',
    label: '🔴 Inactivos (> 15 días)',
    sublabel: 'Alerta a vendedor asignado',
    badgeText: 'Recuperar',
    color: '#E30613',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  {
    id: 'NEW_LEAD',
    label: '⭐ Prospectos WA',
    sublabel: 'Nuevas consultas sin CUIT',
    badgeText: 'Vincular',
    color: '#4F46E5',
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

  // Calcular días de inactividad comercial
  const getDaysInactive = (conv: any): number => {
    const lastDateStr = conv.persona?.lastOrderDate || conv.lastMessageAt;
    if (!lastDateStr) return 999;
    const diffMs = Date.now() - new Date(lastDateStr).getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Extraer ciudades y vendedores únicos disponibles
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

  // Categorizar según días sin comprar o estado del prospecto
  const categorizeConversation = (conv: any): string => {
    if (!conv.personaId) {
      return 'NEW_LEAD';
    }
    const days = getDaysInactive(conv);
    if (days <= 7) return 'FREQUENT';
    if (days <= 14) return 'AT_RISK';
    return 'INACTIVE';
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
        (c.persona?.name && c.persona.name.toLowerCase().includes(q)) ||
        (c.persona?.cuit && c.persona.cuit.includes(q));

      return cityMatch && sellerMatch && nameMatch;
    });
  }, [conversations, selectedCity, selectedSeller, searchQuery]);

  // KPIs Resumen Ejecutivo
  const kpis = useMemo(() => {
    let frequent = 0;
    let atRisk = 0;
    let inactive = 0;
    let leads = 0;
    let totalDebt = 0;

    filteredConversations.forEach(c => {
      const cat = categorizeConversation(c);
      if (cat === 'FREQUENT') frequent++;
      else if (cat === 'AT_RISK') atRisk++;
      else if (cat === 'INACTIVE') inactive++;
      else if (cat === 'NEW_LEAD') leads++;

      if (c.persona?.outstandingBalance) {
        totalDebt += Number(c.persona.outstandingBalance);
      }
    });

    return { frequent, atRisk, inactive, leads, totalDebt };
  }, [filteredConversations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: 'calc(100vh - 170px)', minHeight: '580px' }}>
      
      {/* 1. Tarjetas KPI de Resumen Ejecutivo Superior */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        
        {/* Card 1: Al Día */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ backgroundColor: '#ECFDF5', color: '#10B981', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Frecuentes (≤7d)</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>{kpis.frequent}</div>
          </div>
        </div>

        {/* Card 2: En Riesgo */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ backgroundColor: '#FFFBEB', color: '#D97706', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>En Riesgo (7-14d)</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#D97706' }}>{kpis.atRisk}</div>
          </div>
        </div>

        {/* Card 3: Inactivos */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ backgroundColor: '#FEF2F2', color: '#E30613', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Inactivos (&gt;15d)</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#E30613' }}>{kpis.inactive}</div>
          </div>
        </div>

        {/* Card 4: Prospectos */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Prospectos WA</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4F46E5' }}>{kpis.leads}</div>
          </div>
        </div>

        {/* Card 5: Deuda Cta Cte */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ backgroundColor: '#F1F5F9', color: '#334155', padding: '8px', borderRadius: '8px', display: 'flex' }}>
            <CreditCard size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Deuda Cta Cte</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: kpis.totalDebt > 0 ? '#E30613' : '#10B981' }}>
              ${kpis.totalDebt.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

      </div>

      {/* 2. Barra de Herramientas & Filtros (Stripe Style) */}
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          
          {/* Búsqueda */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input 
              type="text"
              className="form-control"
              placeholder="Buscar por cliente, CUIT o cel..."
              style={{ paddingLeft: '30px', fontSize: '0.82rem', height: '34px', borderRadius: '6px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filtro Ciudad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} style={{ color: '#64748B' }} />
            <select 
              className="form-control"
              style={{ fontSize: '0.82rem', height: '34px', padding: '0 8px', borderRadius: '6px' }}
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
            <UserCheck size={14} style={{ color: '#64748B' }} />
            <select 
              className="form-control"
              style={{ fontSize: '0.82rem', height: '34px', padding: '0 8px', borderRadius: '6px' }}
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
            >
              <option value="ALL">👤 Todos los Vendedores</option>
              {availableSellers.map(s => (
                <option key={s} value={s}>👤 {s}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '6px 10px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={onRefresh}
            title="Actualizar datos"
          >
            <RefreshCw size={14} />
            <span>Refrescar</span>
          </button>
        </div>

        {/* Botón de Enviar Difusión de Precios */}
        <button 
          type="button"
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', fontSize: '0.82rem', fontWeight: 600 }}
          onClick={() => setShowBroadcastModal(true)}
        >
          <Send size={14} />
          <span>📤 Difusión Masiva de Precios</span>
        </button>
      </div>

      {/* 3. Tablero Kanban de Recompras Mayoristas */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '12px', 
          flex: 1,
          minHeight: 0,
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
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                minHeight: 0
              }}
            >
              {/* Header de la columna */}
              <div 
                style={{ 
                  paddingBottom: '8px', 
                  borderBottom: `2px solid ${col.color}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0F172A' }}>
                    {col.label}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                    {col.sublabel}
                  </div>
                </div>

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

              {/* Lista de Tarjetas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
                {colItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', fontSize: '0.78rem', color: '#94A3B8' }}>
                    Sin clientes en esta etapa
                  </div>
                ) : (
                  colItems.map(conv => {
                    const persona = conv.persona;
                    const contactName = persona?.name || conv.contactName || conv.waId;
                    const city = (persona?.city || 'GENERAL VILLEGAS').toUpperCase();
                    const sellerName = getSellerDisplayName(persona?.seller);
                    const balance = Number(persona?.outstandingBalance || 0);
                    const daysInactive = getDaysInactive(conv);

                    return (
                      <div 
                        key={conv.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* Título & Chat Directo */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, paddingRight: '6px' }}>
                            <strong style={{ fontSize: '0.85rem', color: '#0F172A', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {contactName}
                            </strong>
                            {persona?.cuit ? (
                              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                CUIT: {persona.cuit}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                                WA: +{conv.waId}
                              </span>
                            )}
                          </div>
                          
                          <button 
                            className="btn btn-primary"
                            style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', borderRadius: '6px', fontWeight: 600 }}
                            onClick={() => onSelectConversation(conv)}
                          >
                            <MessageSquare size={12} />
                            <span>Chat</span>
                          </button>
                        </div>

                        {/* Badges de Inactividad y Saldo */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {daysInactive < 999 ? (
                            <span style={{ backgroundColor: daysInactive > 14 ? '#FEF2F2' : daysInactive > 7 ? '#FFFBEB' : '#ECFDF5', color: daysInactive > 14 ? '#E30613' : daysInactive > 7 ? '#D97706' : '#10B981', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              ⏱️ hace {daysInactive} d
                            </span>
                          ) : (
                            <span style={{ backgroundColor: '#F1F5F9', color: '#64748B', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }}>
                              ⏱️ Sin compra
                            </span>
                          )}

                          {persona && (
                            <span style={{ backgroundColor: balance > 0 ? '#FEF2F2' : '#F0FDF4', color: balance > 0 ? '#E30613' : '#10B981', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                              Cta Cte: ${balance.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>

                        {/* Ubicación y Vendedor */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: '#64748B', paddingTop: '2px', borderTop: '1px solid #F1F5F9' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MapPin size={11} style={{ color: '#94A3B8' }} />
                            {city}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <UserCheck size={11} style={{ color: '#94A3B8' }} />
                            {sellerName}
                          </span>
                        </div>

                        {/* Botón de Acción Directa 1-Clic */}
                        <button 
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            width: '100%',
                            fontSize: '0.72rem',
                            padding: '4px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            backgroundColor: '#F8FAFC',
                            border: '1px dashed #CBD5E1',
                            borderRadius: '6px',
                            color: '#334155',
                            fontWeight: 600,
                            marginTop: '2px'
                          }}
                          onClick={() => onSelectConversation(conv)}
                        >
                          <Sparkles size={12} style={{ color: '#4F46E5' }} />
                          <span>⚡ Armar Pedido en WA</span>
                          <ArrowRight size={12} style={{ color: '#94A3B8', marginLeft: 'auto' }} />
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
