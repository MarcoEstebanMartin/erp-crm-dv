import React, { useState } from 'react';
import { api } from '../../utils/api';
import { UserCheck, MessageSquare, ArrowRight, CheckCircle2, XCircle, FileText, Phone } from 'lucide-react';

interface CrmPipelineKanbanProps {
  conversations: any[];
  onRefresh: () => void;
  onSelectConversation: (conv: any) => void;
}

const STAGES = [
  { id: 'LEAD', label: 'Nuevo Lead', color: '#64748B', bg: '#F1F5F9' },
  { id: 'CONTACTED', label: 'Contactado', color: '#2563EB', bg: '#EFF6FF' },
  { id: 'QUOTED', label: 'Presupuestado', color: '#D97706', bg: '#FEF3C7' },
  { id: 'WON', label: 'Cliente Ganado', color: '#16A34A', bg: '#DCFCE7' },
  { id: 'LOST', label: 'Perdido', color: '#DC2626', bg: '#FEE2E2' }
];

export default function CrmPipelineKanban({ conversations, onRefresh, onSelectConversation }: CrmPipelineKanbanProps) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const handleStageChange = async (convId: number, newStage: string) => {
    setUpdatingId(convId);
    try {
      await api.updateCrmStage(convId, newStage);
      onRefresh();
    } catch (err: any) {
      console.error('Error al mover etapa:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', minHeight: '560px', overflowX: 'auto' }}>
      {STAGES.map(stage => {
        const stageConvs = conversations.filter(c => (c.stage || 'LEAD') === stage.id);

        return (
          <div 
            key={stage.id}
            style={{
              backgroundColor: '#FAFAFA',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {/* Header de la columna */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '2px solid ' + stage.color }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: stage.color }}>
                {stage.label}
              </span>
              <span style={{ backgroundColor: stage.bg, color: stage.color, fontSize: '0.75rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                {stageConvs.length}
              </span>
            </div>

            {/* Tarjetas de Conversaciones / Leads */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
              {stageConvs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Sin oportunidades en esta etapa
                </div>
              ) : (
                stageConvs.map(conv => (
                  <div 
                    key={conv.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {conv.contactName || conv.waId}
                      </strong>
                      <button 
                        className="btn btn-ghost"
                        style={{ padding: '2px 6px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => onSelectConversation(conv)}
                      >
                        <MessageSquare size={12} />
                        <span>Chat</span>
                      </button>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={11} />
                        <span>+{conv.waId}</span>
                      </div>
                      {conv.persona && (
                        <div style={{ marginTop: '2px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Saldo Cta Cte: ${Number(conv.persona.outstandingBalance || 0).toLocaleString('es-AR')}
                        </div>
                      )}
                    </div>

                    {/* Selector rápido para mover entre columnas */}
                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Mover a:</span>
                      <select
                        className="select"
                        value={conv.stage || 'LEAD'}
                        disabled={updatingId === conv.id}
                        onChange={e => handleStageChange(conv.id, e.target.value)}
                        style={{ fontSize: '0.72rem', padding: '2px 4px', borderRadius: '4px' }}
                      >
                        {STAGES.map(s => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
