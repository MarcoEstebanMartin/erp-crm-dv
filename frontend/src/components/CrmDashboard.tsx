import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { 
  Sparkles, 
  Users, 
  ShoppingCart, 
  Send, 
  CheckCircle, 
  Loader2,
  RefreshCw,
  TrendingUp,
  X,
  AlertTriangle,
  MessageSquare,
  Phone,
  Search,
  CheckCheck,
  FileText,
  Clock,
  Bot,
  Kanban,
  FlaskConical,
  Cake,
  Gift,
  Trash2
} from 'lucide-react';
import OrderDraftApprovalModal from './modals/OrderDraftApprovalModal';
import WhatsAppSimulatorModal from './modals/WhatsAppSimulatorModal';
import CrmWholesaleBoard from './crm/CrmWholesaleBoard';

function BirthDateInput({ 
  personaId, 
  initialBirthDate, 
  onSave 
}: { 
  personaId: number; 
  initialBirthDate?: string | null; 
  onSave: (personaId: number, val: string) => void;
}) {
  const formattedInitial = useMemo(() => {
    if (!initialBirthDate) return '';
    try {
      return new Date(initialBirthDate).toISOString().split('T')[0];
    } catch {
      return '';
    }
  }, [initialBirthDate]);

  const [value, setValue] = useState(formattedInitial);

  useEffect(() => {
    setValue(formattedInitial);
  }, [personaId, formattedInitial]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    if (val && /^\d{4}-\d{2}-\d{2}$/.test(val) && val !== formattedInitial) {
      onSave(personaId, val);
    }
  };

  const handleBlur = () => {
    if (value !== formattedInitial) {
      if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        onSave(personaId, value);
      }
    }
  };

  return (
    <input 
      type="date" 
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      style={{ fontSize: '0.72rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid #CBD5E1', outline: 'none' }}
    />
  );
}

interface CrmDashboardProps {
  initialTab?: 'whatsapp' | 'pipeline' | 'alerts';
  hideHeaderTabs?: boolean;
}

export default function CrmDashboard({ initialTab = 'whatsapp', hideHeaderTabs = false }: CrmDashboardProps) {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'pipeline' | 'alerts'>(initialTab);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  
  // Ref para auto-scroll del chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Estados de Alertas Inteligentes
  const [alerts, setAlerts] = useState<any | null>(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [suggestedPoModal, setSuggestedPoModal] = useState<any | null>(null);

  // Estados de WhatsApp CRM
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine' | 'unassigned' | number>('all');
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [allPersonas, setAllPersonas] = useState<any[]>([]);
  const [linkingPersonaId, setLinkingPersonaId] = useState<string>('');

  // Obtener usuario autenticado actual
  const currentUser = useMemo(() => {
    try {
      return api.getCurrentUser() || JSON.parse(localStorage.getItem('auth_user') || '{}');
    } catch {
      return {};
    }
  }, []);

  // Verificar si el usuario actual pertenece a Administración / Autorizados para CRM WhatsApp
  const isAuthorizedCrmUser = useMemo(() => {
    return true; // Acceso habilitado para administración y trabajo del CRM
  }, [currentUser]);

  // Filtrar exclusivamente a los usuarios de Administración (Darío, Agustín, Esteban, Admin) para asignaciones
  const adminUsers = useMemo(() => {
    const allowedUsernames = ['dario', 'agustin', 'esteban', 'admin', 'pablo'];
    return systemUsers.filter(u => {
      const role = u.role?.toUpperCase();
      const uname = u.username?.toLowerCase();
      return role === 'ADMIN' || role === 'FACTURACION' || allowedUsernames.includes(uname);
    });
  }, [systemUsers]);

  // Cargar Usuarios y Clientes del sistema
  useEffect(() => {
    const loadSystemData = async () => {
      try {
        const uList = await api.getUsers();
        setSystemUsers(Array.isArray(uList) ? uList : []);
        const pList = await api.getPersonas();
        setAllPersonas(Array.isArray(pList) ? pList : []);
      } catch (err) {
        console.error('Error al cargar datos auxiliares CRM:', err);
      }
    };
    loadSystemData();
  }, []);

  // Borrador de Pedido IA modal
  const [selectedDraftModal, setSelectedDraftModal] = useState<any | null>(null);
  const [parsingAi, setParsingAi] = useState(false);

  // Cargar Alertas Inteligentes
  const fetchCRMAlerts = async () => {
    setLoadingAlerts(true);
    setErrorMsg(null);
    try {
      const data = await api.getCrmAlerts();
      setAlerts(data);
    } catch (err: any) {
      setErrorMsg('Error al calcular predicciones de CRM.');
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Cargar Conversaciones CRM
  const fetchConversations = async (targetConvId?: number) => {
    try {
      const data = await api.getCrmConversations();
      const convList = Array.isArray(data) ? data : (data?.data || []);
      setConversations(convList);

      const targetId = targetConvId || selectedConversation?.id;
      let convToSelect = targetId 
        ? convList.find((c: any) => c.id === targetId) 
        : (convList.length > 0 ? convList[0] : null);

      if (convToSelect) {
        setSelectedConversation(convToSelect);
        const res = await api.getCrmMessages(convToSelect.id);
        const msgList = res?.data?.messages || res?.messages || (Array.isArray(res) ? res : []);
        setMessages(msgList);
      }
    } catch (err: any) {
      console.error('Error al cargar conversaciones CRM:', err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleSelectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    setLoadingMessages(true);
    try {
      const res = await api.getCrmMessages(conv.id);
      const msgList = res?.data?.messages || res?.messages || (Array.isArray(res) ? res : []);
      setMessages(msgList);
      // Actualizar conteo no leído local
      setConversations(prev => (Array.isArray(prev) ? prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c) : []));
    } catch (err: any) {
      console.error('Error al cargar mensajes:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleDeleteConversation = async (conversationId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('¿Estás seguro de que deseas eliminar este chat? Se borrará el historial de esta conversación.')) return;
    try {
      await api.deleteCrmConversation(conversationId);
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
      fetchConversations();
    } catch (err: any) {
      console.error('Error al eliminar conversación:', err);
      alert('Error al eliminar la conversación.');
    }
  };

  // Auto-scroll al fondo del chat (sin mover la ventana ni la página)
  useEffect(() => {
    const scrollToBottom = () => {
      if (chatMessagesContainerRef.current) {
        chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
      }
    };
    
    scrollToBottom();
    const timer1 = setTimeout(scrollToBottom, 50);
    const timer2 = setTimeout(scrollToBottom, 200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [messages, selectedConversation]);

  useEffect(() => {
    setLoadingConversations(true);
    fetchConversations();
    fetchCRMAlerts();

    // Polling en tiempo real cada 4 segundos cuando estamos en la pestaña WhatsApp
    const interval = setInterval(() => {
      if (activeTab === 'whatsapp') {
        fetchConversations();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // Enviar mensaje de respuesta
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConversation) return;

    setSendingMsg(true);
    try {
      const res = await api.sendCrmMessage({
        to: selectedConversation.waId,
        text: replyText
      });

      const sentMsg = res?.data?.message || res?.data || res?.message;
      if (sentMsg) {
        setMessages(prev => [...prev, sentMsg]);
      }
      setReplyText('');
      fetchConversations(selectedConversation.id);
    } catch (err: any) {
      setErrorMsg('Error al enviar el mensaje de WhatsApp.');
    } finally {
      setSendingMsg(false);
    }
  };

  // Solicitar interpretación de pedido con IA
  const handleParseOrderWithAI = async () => {
    if (!selectedConversation) return;
    const lastInboundMsg = [...messages].reverse().find(m => m.direction === 'INBOUND');
    const textToParse = lastInboundMsg ? lastInboundMsg.body : '10 cajones de Quilmes 1L';

    setParsingAi(true);
    setErrorMsg(null);
    try {
      const draft = await api.parseCrmOrderDraft(selectedConversation.id, textToParse);
      setSelectedDraftModal(draft);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo interpretar el pedido con la IA.');
    } finally {
      setParsingAi(false);
    }
  };

  // Enviar Resumen de Cuenta por WhatsApp
  const handleSendBalanceSummary = async () => {
    if (!selectedConversation) return;
    const persona = selectedConversation.persona;
    const balance = persona ? Number(persona.outstandingBalance || 0) : 0;

    const text = `Hola ${selectedConversation.contactName || 'Cliente'}, te enviamos tu resumen de cuenta corriente de DV Distribuidora. Saldo actual: $${balance.toLocaleString('es-AR')}. ¡Quedamos a tu disposición para tomar tu pedido!`;
    setReplyText(text);
  };

  // Actualizar Fecha de Nacimiento del Cliente desde el CRM
  const handleUpdateBirthDate = async (personaId: number, birthDateStr: string) => {
    try {
      const res = await api.updatePersona(personaId, { birthDate: birthDateStr || null });
      const updatedPersona = res.data?.persona || res.persona || res;
      setSelectedConversation((prev: any) => prev ? { ...prev, persona: { ...prev.persona, birthDate: updatedPersona.birthDate || birthDateStr } } : null);
      setConversations((prev: any[]) => prev.map((c: any) => c.persona?.id === personaId ? { ...c, persona: { ...c.persona, birthDate: updatedPersona.birthDate || birthDateStr } } : c));
      setSuccessMsg('🎉 Fecha de nacimiento guardada exitosamente.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar la fecha de nacimiento.');
    }
  };

  // Toggle Auto-Reply 24/7 (Bot)
  const handleToggleAutoReply = async (convId: number, enabled: boolean) => {
    try {
      const updated = await api.toggleCrmAutoReply(convId, enabled);
      setSelectedConversation((prev: any) => prev ? { ...prev, autoReplyEnabled: updated.autoReplyEnabled } : null);
      setConversations((prev: any[]) => prev.map((c: any) => c.id === convId ? { ...c, autoReplyEnabled: updated.autoReplyEnabled } : c));
    } catch (err: any) {
      setErrorMsg('Error al modificar auto-respuesta del bot.');
    }
  };

  // Asignar conversación a un Usuario Administrativo
  const handleAssignUser = async (convId: number, userId: number | null) => {
    try {
      const updated = await api.assignCrmConversation(convId, userId);
      const assignedUserObj = systemUsers.find(u => u.id === userId) || null;
      setSelectedConversation((prev: any) => prev?.id === convId ? { ...prev, assignedSellerId: userId, assignedUser: assignedUserObj } : prev);
      setConversations((prev: any[]) => prev.map((c: any) => c.id === convId ? { ...c, assignedSellerId: userId, assignedUser: assignedUserObj } : c));
    } catch (err: any) {
      setErrorMsg('Error al derivar la conversación.');
    }
  };

  // Vincular conversación a Ficha de Cliente ERP
  const handleLinkPersona = async (convId: number, personaId: number) => {
    try {
      const updated = await api.linkCrmPersona(convId, personaId);
      const personaObj = allPersonas.find(p => p.id === personaId) || updated.persona;
      setSelectedConversation((prev: any) => prev?.id === convId ? { ...prev, personaId, persona: personaObj, contactName: personaObj?.name || prev.contactName } : prev);
      setConversations((prev: any[]) => prev.map((c: any) => c.id === convId ? { ...c, personaId, persona: personaObj, contactName: personaObj?.name || c.contactName } : c));
      setLinkingPersonaId('');
    } catch (err: any) {
      setErrorMsg('Error al vincular el cliente ERP.');
    }
  };

  // Filtrar conversaciones
  const filteredConversations = useMemo(() => {
    if (!Array.isArray(conversations)) return [];
    return conversations.filter(c => {
      // 1. Filtro de asignación
      if (assignedFilter === 'mine') {
        const userObj = api.getCurrentUser() || {};
        if (c.assignedSellerId !== userObj?.id) return false;
      } else if (assignedFilter === 'unassigned') {
        if (c.assignedSellerId) return false;
      } else if (typeof assignedFilter === 'number') {
        if (c.assignedSellerId !== assignedFilter) return false;
      }

      // 2. Filtro de texto
      if (!searchFilter) return true;
      const term = searchFilter.toLowerCase();
      return (
        c.contactName?.toLowerCase().includes(term) || 
        c.waId?.includes(term) ||
        c.persona?.name?.toLowerCase().includes(term)
      );
    });
  }, [conversations, searchFilter, assignedFilter]);

  // Manejo de Orden de Compra Auto-sugerida
  const handleAutoGeneratePO = (suggestionGroup: any) => {
    const providerId = suggestionGroup.suggestedProviderId;
    const providerName = suggestionGroup.suggestedProviderName;
    const items = alerts?.replenishmentSuggestions
      .filter((s: any) => s.suggestedProviderId === providerId)
      .map((s: any) => ({
        productId: s.productId,
        productName: s.productName,
        sku: s.sku,
        quantity: s.suggestedQuantity,
        costPrice: s.costPrice
      }));

    setSuggestedPoModal({ providerId, providerName, items });
  };

  const handleConfirmSuggestedPOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!suggestedPoModal) return;

    try {
      setLoadingAlerts(true);
      await api.createPurchaseOrder({
        personaId: suggestedPoModal.providerId,
        items: suggestedPoModal.items.map((i: any) => ({
          productId: i.productId,
          quantity: i.quantity,
          costPrice: i.costPrice
        }))
      });

      setSuccessMsg(`✨ Orden de compra sugerida por la IA creada con éxito para ${suggestedPoModal.providerName}.`);
      setSuggestedPoModal(null);
      fetchCRMAlerts();
    } catch (err: any) {
      setErrorMsg('Error al guardar la orden de compra sugerida.');
    } finally {
      setLoadingAlerts(false);
    }
  };

  const replenishmentGroups = useMemo(() => {
    if (!alerts?.replenishmentSuggestions) return [];
    const groups: { [key: number]: { providerId: number, providerName: string, items: any[] } } = {};
    alerts.replenishmentSuggestions.forEach((s: any) => {
      if (!groups[s.suggestedProviderId]) {
        groups[s.suggestedProviderId] = {
          providerId: s.suggestedProviderId,
          providerName: s.suggestedProviderName,
          items: []
        };
      }
      groups[s.suggestedProviderId].items.push(s);
    });
    return Object.values(groups);
  }, [alerts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Feedback Messages */}
      {successMsg && (
        <div style={{ backgroundColor: 'var(--color-success-bg)', borderLeft: '4px solid var(--color-success)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{successMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {errorMsg && (
        <div style={{ backgroundColor: '#FFF2F2', borderLeft: '4px solid var(--color-corp-red)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMsg}</span>
          <button className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* Header Minimalista CRM (Stripe Style) */}
      {!hideHeaderTabs && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '8px', borderRadius: '8px', display: 'flex' }}>
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Inbox WhatsApp CRM 24/7</span>
                {conversations.some(c => c.unreadCount > 0) && (
                  <span style={{ backgroundColor: 'var(--color-corp-red)', color: 'white', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    {conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)} nuevos
                  </span>
                )}
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Gestión fluida de conversaciones, mensajes de voz con IA y generación instantánea de preventas ERP.
              </p>
            </div>
          </div>
        </div>
      )}



      {!isAuthorizedCrmUser && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '50px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FEF2F2', color: 'var(--color-corp-red)', marginBottom: '16px' }}>
            <AlertTriangle size={32} />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Acceso Restringido - CRM WhatsApp
          </h3>
          <p style={{ margin: '0 auto', maxWidth: '500px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            El Inbox de WhatsApp CRM está reservado exclusivamente para el personal de <strong>Administración</strong> (Darío, Agustín, Esteban y Administradores).
          </p>
        </div>
      )}

      {isAuthorizedCrmUser && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 280px', gap: '16px', height: 'calc(100vh - 170px)', minHeight: '550px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          
          {/* Panel Izquierdo: Lista de Conversaciones */}
          <div style={{ borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', backgroundColor: '#FAFAFA', minHeight: 0, height: '100%', overflow: 'hidden' }}>
            
            {/* Filtros de Asignación a Administrativos */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', gap: '4px', overflowX: 'auto' }}>
              <button 
                type="button" 
                className={`btn ${assignedFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.72rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setAssignedFilter('all')}
              >
                📥 Todos ({conversations.length})
              </button>
              <button 
                type="button" 
                className={`btn ${assignedFilter === 'mine' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.72rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setAssignedFilter('mine')}
              >
                👤 Mis Chats
              </button>
              <button 
                type="button" 
                className={`btn ${assignedFilter === 'unassigned' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.72rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => setAssignedFilter('unassigned')}
              >
                ❓ Sin Asignar
              </button>
            </div>

            <div style={{ padding: '10px 12px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF' }}>
              <Search size={15} style={{ color: '#94A3B8' }} />
              <input 
                type="text" 
                placeholder="Buscar cliente o número..." 
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: '#0F172A' }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingConversations ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                  <Loader2 className="spin-anim" style={{ margin: '0 auto 8px auto' }} />
                  <span style={{ fontSize: '0.8rem' }}>Cargando chats...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748B', fontSize: '0.82rem' }}>
                  No se encontraron conversaciones activas.
                </div>
              ) : (
                filteredConversations.map(conv => {
                  const isSelected = selectedConversation?.id === conv.id;
                  const lastMsg = conv.messages?.[0];
                  const latestDraft = conv.drafts?.[0];
                  const hasPendingDraft = latestDraft?.status === 'PENDING';
                  const isApprovedDraft = latestDraft?.status === 'APPROVED';
                  const hasDebt = Number(conv.persona?.outstandingBalance || 0) > 0;

                  return (
                    <div 
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#F1F5F9' : 'transparent',
                        borderLeft: isSelected ? '3px solid #0F172A' : '3px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.86rem', color: isSelected ? '#0F172A' : '#334155' }}>
                          {conv.contactName || conv.waId}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.68rem', color: '#94A3B8' }}>
                            {new Date(conv.lastMessageAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            title="Eliminar conversación"
                            style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Insignias de Estado Comercial */}
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {hasPendingDraft && (
                          <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            ⚡ Borrador IA
                          </span>
                        )}
                        {isApprovedDraft && (
                          <span style={{ backgroundColor: '#D1FAE5', color: '#065F46', fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            ✓ Pedido Concretado
                          </span>
                        )}
                        {hasDebt && (
                          <span style={{ backgroundColor: '#FEE2E2', color: 'var(--color-corp-red)', fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            Deuda: ${Number(conv.persona.outstandingBalance).toLocaleString('es-AR')}
                          </span>
                        )}
                        {conv.assignedUser && (
                          <span style={{ backgroundColor: '#E2E8F0', color: '#475569', fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }}>
                            👤 {conv.assignedUser.username}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                          {lastMsg ? lastMsg.body : 'Sin mensajes'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span style={{ backgroundColor: 'var(--color-corp-red)', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel Central: Chat Activo */}
          <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF', minHeight: 0, height: '100%', overflow: 'hidden' }}>
            {selectedConversation ? (
              <>
                {/* Header del Chat */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#0F172A' }}>
                      {selectedConversation.contactName || selectedConversation.waId}
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                      WhatsApp ID: +{selectedConversation.waId}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className={`btn ${selectedConversation.autoReplyEnabled !== false ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ 
                        padding: '5px 10px', 
                        fontSize: '0.75rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        backgroundColor: selectedConversation.autoReplyEnabled !== false ? '#10B981' : '#F1F5F9',
                        borderColor: selectedConversation.autoReplyEnabled !== false ? '#10B981' : '#E2E8F0',
                        color: selectedConversation.autoReplyEnabled !== false ? '#FFFFFF' : '#475569'
                      }}
                      onClick={() => handleToggleAutoReply(selectedConversation.id, !selectedConversation.autoReplyEnabled)}
                    >
                      <Bot size={14} />
                      <span>{selectedConversation.autoReplyEnabled !== false ? '🤖 Bot 24/7 Activo' : '🤖 Bot Pausado'}</span>
                    </button>

                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #E2E8F0' }}
                      onClick={handleParseOrderWithAI}
                      disabled={parsingAi}
                    >
                      <Sparkles size={14} style={{ color: '#4F46E5' }} />
                      <span>{parsingAi ? 'Analizando...' : '⚡ Armar Pedido (IA)'}</span>
                    </button>

                    <a 
                      className="btn btn-secondary" 
                      style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #E2E8F0' }}
                      href={`https://wa.me/${selectedConversation.waId}`} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      <Phone size={14} />
                      <span>Abrir WA Web</span>
                    </a>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '5px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #FECDD3', color: '#E11D48', backgroundColor: '#FFF1F2' }}
                      onClick={(e) => handleDeleteConversation(selectedConversation.id, e)}
                      title="Eliminar conversación"
                    >
                      <Trash2 size={14} />
                      <span>Borrar Chat</span>
                    </button>
                  </div>
                </div>

                {/* Mensajes del Chat */}
                <div ref={chatMessagesContainerRef} style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F8FAFC' }}>
                  {loadingMessages ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                      <Loader2 className="spin-anim" style={{ margin: '0 auto 8px auto' }} />
                      <span style={{ fontSize: '0.8rem' }}>Cargando conversación...</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748B', fontSize: '0.82rem' }}>
                      No hay mensajes en esta conversación.
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isInbound = msg.direction === 'INBOUND';
                      return (
                        <div 
                          key={msg.id || idx}
                          style={{
                            alignSelf: isInbound ? 'flex-start' : 'flex-end',
                            maxWidth: '72%',
                            backgroundColor: isInbound ? '#FFFFFF' : '#DCF8C6',
                            color: '#0F172A',
                            padding: '10px 14px',
                            borderRadius: isInbound ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            border: isInbound ? '1px solid #E2E8F0' : '1px solid #C8E6C9',
                            fontSize: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                        >
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{msg.body}</p>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#64748B' }}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                            {!isInbound && <CheckCheck size={12} style={{ color: '#0284C7' }} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                  {/* Elemento de anclaje para auto-scroll */}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chips de Respuestas Rápidas (1-Clic) */}
                <div style={{ padding: '6px 12px', backgroundColor: '#FFFFFF', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '6px', overflowX: 'auto' }}>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#334155' }}
                    onClick={handleSendBalanceSummary}
                  >
                    💳 Enviar Saldo Cta Cte
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#334155' }}
                    onClick={() => setReplyText('Realizamos repartos continuos en Villegas y zonas cercanas. ¿Deseas coordinar un pedido?')}
                  >
                    🚚 Consulta de Reparto
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost" 
                    style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#334155' }}
                    onClick={handleParseOrderWithAI}
                  >
                    ⚡ Borrador Pedido (IA)
                  </button>
                </div>

                {/* Footer Input de Respuesta */}
                <form onSubmit={handleSendMessage} style={{ padding: '10px 12px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', backgroundColor: '#FFFFFF' }}>
                  <input 
                    type="text" 
                    placeholder="Escribir mensaje para enviar por WhatsApp Cloud API..." 
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ padding: '0 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
                    disabled={sendingMsg || !replyText.trim()}
                  >
                    <Send size={15} />
                    <span>{sendingMsg ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </form>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B', fontSize: '0.88rem' }}>
                Selecciona una conversación para chatear.
              </div>
            )}
          </div>

          {/* Panel Derecho: Ficha Comercial del Cliente 360° & Derivación */}
          <div style={{ borderLeft: '1px solid #E2E8F0', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#FAFAFA', overflowY: 'auto', minHeight: 0, height: '100%' }}>
            <h4 style={{ margin: 0, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748B', fontWeight: 700 }}>
              Ficha del Cliente 360° ERP
            </h4>

            {selectedConversation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Selector de Asignación / Derivación a Administrativo */}
                <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>
                    👨‍💼 Responsable del Chat:
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%', fontSize: '0.82rem', padding: '6px 8px' }}
                    value={selectedConversation.assignedSellerId || ''}
                    onChange={(e) => handleAssignUser(selectedConversation.id, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">❓ Sin Asignar (General)</option>
                    {adminUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        👤 {u.username} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedConversation.persona ? (
                  <>
                    {/* Alerta & Saludo de Cumpleaños si hoy es su cumpleaños */}
                    {(() => {
                      const p = selectedConversation.persona;
                      if (!p.birthDate) return null;
                      const b = new Date(p.birthDate);
                      const today = new Date();
                      const isBirthdayToday = b.getUTCDate() === today.getDate() && b.getUTCMonth() === today.getMonth();
                      if (!isBirthdayToday) return null;

                      return (
                        <div style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem' }}>
                          <div style={{ color: '#4338CA', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <Cake size={16} style={{ color: '#6366F1' }} />
                            <span>¡Hoy es su Cumpleaños! 🥳🎂</span>
                          </div>
                          <div style={{ color: '#3730A3', fontSize: '0.74rem', marginBottom: '8px' }}>
                            ¡Enviále un saludo festivo institucional a {p.name}!
                          </div>
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', fontSize: '0.74rem', padding: '6px 8px', backgroundColor: '#4F46E5', borderColor: '#4F46E5', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            onClick={() => {
                              setReplyText(`¡Hola ${p.name}! 🎂🎈 De parte de todo el equipo de DV Distribuidora te deseamos un muy feliz cumpleaños. ¡Que tengas un día excelente! 🎉🥂`);
                            }}
                          >
                            <Gift size={13} />
                            <span>Enviar Saludo de Cumpleaños</span>
                          </button>
                        </div>
                      );
                    })()}

                    {/* Alerta de Datos Incompletos del Cliente */}
                    {(() => {
                      const p = selectedConversation.persona;
                      const missing: string[] = [];
                      if (!p.cuit) missing.push('CUIT/DNI');
                      if (!p.address) missing.push('Dirección');
                      if (!p.city) missing.push('Localidad');
                      if (!p.email) missing.push('Email');
                      if (!p.birthDate) missing.push('Fecha de Nacimiento');

                      if (missing.length === 0) return null;

                      return (
                        <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '10px 12px', borderRadius: '8px', fontSize: '0.78rem' }}>
                          <div style={{ color: '#B45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                            <AlertTriangle size={14} />
                            <span>Datos Incompletos ({missing.length})</span>
                          </div>
                          <div style={{ color: '#78350F', fontSize: '0.74rem', marginBottom: '8px' }}>
                            Pendientes: <strong>{missing.join(', ')}</strong>.
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ width: '100%', fontSize: '0.74rem', padding: '5px 8px', backgroundColor: '#FFFFFF', borderColor: '#F59E0B', color: '#B45309', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            onClick={() => {
                              setReplyText(`Hola ${p.name}, para completar tu ficha de cliente en nuestro sistema, ¿nos podrías confirmar tus datos pendientes (${missing.join(', ')})? ¡Muchas gracias!`);
                            }}
                          >
                            <Send size={12} />
                            <span>Solicitar Datos por WhatsApp</span>
                          </button>
                        </div>
                      );
                    })()}

                    <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <strong style={{ display: 'block', fontSize: '0.92rem', marginBottom: '4px', color: '#0F172A' }}>
                        {selectedConversation.persona.name}
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span>CUIT: {selectedConversation.persona.cuit || 'S/D'}</span>
                        {selectedConversation.persona.address && <span>🏠 {selectedConversation.persona.address}</span>}
                        {selectedConversation.persona.city && <span>📍 {selectedConversation.persona.city} ({selectedConversation.persona.province || 'BsAs'})</span>}
                        {selectedConversation.persona.email && <span>✉️ {selectedConversation.persona.email}</span>}
                        {selectedConversation.persona.route && <span>🚚 Ruta: {selectedConversation.persona.route}</span>}

                        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Cake size={13} style={{ color: '#E11D48' }} /> Cumpleaños:
                          </span>
                          <BirthDateInput 
                            personaId={selectedConversation.persona.id}
                            initialBirthDate={selectedConversation.persona.birthDate}
                            onSave={handleUpdateBirthDate}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Saldo de Cuenta Corriente */}
                    <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Saldo Cta Cte:</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 800, color: Number(selectedConversation.persona.outstandingBalance) > 0 ? 'var(--color-corp-red)' : '#10B981', marginTop: '2px' }}>
                        ${Number(selectedConversation.persona.outstandingBalance || 0).toLocaleString('es-AR')}
                      </div>
                    </div>

                    {/* Lista de Precios */}
                    <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Lista de Precios:</span>
                      <span className="badge" style={{ backgroundColor: '#E2E8F0', color: '#0F172A', fontWeight: 700 }}>
                        Lista {selectedConversation.persona.priceList || 'A'}
                      </span>
                    </div>

                    {/* Acciones Rápidas ERP */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.78rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', border: '1px solid #E2E8F0' }}
                        onClick={handleSendBalanceSummary}
                      >
                        <FileText size={14} />
                        <span>💳 Enviar Saldo por WhatsApp</span>
                      </button>

                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '0.78rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}
                        onClick={handleParseOrderWithAI}
                        disabled={parsingAi}
                      >
                        <Sparkles size={14} style={{ color: '#E30613' }} />
                        <span>{parsingAi ? 'Interpretando...' : '⚡ Borrador Pedido con IA'}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Vincular a Ficha de Cliente ERP
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Selecciona el cliente del catálogo para asociar esta conversación y ver su saldo:
                    </span>
                    <select
                      className="input"
                      style={{ fontSize: '0.8rem', padding: '6px' }}
                      value={linkingPersonaId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLinkingPersonaId(val);
                        if (val) handleLinkPersona(selectedConversation.id, Number(val));
                      }}
                    >
                      <option value="">-- Seleccionar Cliente ERP --</option>
                      {allPersonas.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.cuit ? `(CUIT: ${p.cuit})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
                Selecciona una conversación para ver su Ficha Comercial.
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL: APROBACIÓN DE BORRADOR IA */}
      {selectedDraftModal && (
        <OrderDraftApprovalModal 
          draft={selectedDraftModal}
          onClose={() => setSelectedDraftModal(null)}
          onApproved={() => {
            setSelectedDraftModal(null);
            setSuccessMsg('✨ ¡Borrador aprobado con éxito! La orden de preventa ha sido cargada en el ERP.');
            fetchConversations();
          }}
        />
      )}

      {/* MODAL: ORDEN DE COMPRA REABASTECIMIENTO */}
      {suggestedPoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Confirmar Borrador sugerido por la IA</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSuggestedPoModal(null)}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleConfirmSuggestedPOSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
                <div>
                  <strong>Proveedor de Abastecimiento:</strong> {suggestedPoModal.providerName}
                </div>
                <div>
                  <strong>Artículos sugeridos a reponer (Stock &lt;= Mínimo):</strong>
                </div>

                <div className="table-container" style={{ borderRadius: '6px' }}>
                  <table style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Artículo</th>
                        <th style={{ textAlign: 'right' }}>Cant Sugerida</th>
                        <th style={{ textAlign: 'right' }}>Costo Est.</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestedPoModal.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td>{item.productName} ({item.sku})</td>
                          <td style={{ textAlign: 'right' }}>{item.quantity} u.</td>
                          <td style={{ textAlign: 'right' }}>${item.costPrice}</td>
                          <td style={{ textAlign: 'right' }}>${(item.quantity * item.costPrice).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  backgroundColor: '#F8F8FA',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.95rem'
                }}>
                  <span>Total Estimado del Abastecimiento:</span>
                  <span style={{ color: 'var(--accent-color)' }}>
                    ${suggestedPoModal.items.reduce((acc: number, i: any) => acc + (i.quantity * i.costPrice), 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSuggestedPoModal(null)}>Descartar Borrador</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                  Generar Orden de Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SIMULADOR DE WHATSAPP SANDBOX */}
      {showSimulatorModal && (
        <WhatsAppSimulatorModal 
          onClose={() => setShowSimulatorModal(false)}
          onSimulated={(convId) => {
            setAssignedFilter('all');
            setSearchFilter('');
            fetchConversations(convId);
            setSuccessMsg('⚡ Mensaje simulado ingresado con éxito. ¡Revisa la conversación y las respuestas automáticas del Bot!');
          }}
        />
      )}

      {/* Estilos para animaciones */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1.2s linear infinite;
        }
      `}</style>

    </div>
  );
}
