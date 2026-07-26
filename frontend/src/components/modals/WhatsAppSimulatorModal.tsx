import React, { useState } from 'react';
import { X, Send, Sparkles, Phone, User, MessageSquare } from 'lucide-react';
import { api } from '../../utils/api';

interface WhatsAppSimulatorModalProps {
  onClose: () => void;
  onSimulated: (convId?: number) => void;
}

export default function WhatsAppSimulatorModal({ onClose, onSimulated }: WhatsAppSimulatorModalProps) {
  const [fromPhone, setFromPhone] = useState('5491133334444');
  const [profileName, setProfileName] = useState('Supermercado San Martín');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyPreset = (presetText: string) => {
    setText(presetText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromPhone || !text.trim()) {
      setErrorMsg('Por favor ingrese el número y el texto del mensaje.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.simulateCrmIncomingMessage({
        fromPhone,
        profileName,
        text
      });
      const convId = res?.data?.conversation?.id || res?.conversation?.id || res?.data?.message?.conversationId;
      onSimulated(convId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al simular el mensaje de WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1150 }}>
      <div className="modal-content" style={{ maxWidth: '580px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#DCF8C6', padding: '8px', borderRadius: '8px', color: '#075E54', display: 'flex' }}>
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Simulador de WhatsApp (Sandbox)</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Simule un mensaje de cliente entrante para probar el Bot 24/7 y la IA en tiempo real.
              </p>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {errorMsg && (
              <div style={{ backgroundColor: '#FFF2F2', borderLeft: '4px solid var(--color-corp-red)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                {errorMsg}
              </div>
            )}

            {/* Datos del Cliente Simulado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Número WhatsApp (Teléfono):</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <Phone size={14} style={{ color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: 5491133334444"
                    value={fromPhone}
                    onChange={e => setFromPhone(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre del Contacto:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <User size={14} style={{ color: 'var(--text-secondary)' }} />
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: Juan Pérez"
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Presets de Prueba Rápida */}
            <div>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Escenarios de Prueba Rápida (1 Clic):</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                  onClick={() => handleApplyPreset('¿Cuánto debo en mi cuenta corriente?')}
                >
                  💳 Consulta de Saldo Cta Cte
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                  onClick={() => handleApplyPreset('Hola, mándame 10 cajones de Quilmes 1L y 5 de Coca Cola 2.25L')}
                >
                  ⚡ Pedido de Mercadería (IA Gemini)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                  onClick={() => handleApplyPreset('¿Qué días pasa el reparto por Villegas?')}
                >
                  🚚 Consulta de Ruta de Reparto
                </button>
              </div>
            </div>

            {/* Texto del Mensaje */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mensaje Entrante de WhatsApp:</label>
              <textarea
                className="input"
                rows={3}
                placeholder="Escriba aquí el mensaje que enviaría el cliente..."
                value={text}
                onChange={e => setText(e.target.value)}
                style={{ width: '100%', marginTop: '4px', fontSize: '0.88rem', padding: '10px', resize: 'vertical' }}
              />
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
              style={{ backgroundColor: '#075E54', borderColor: '#075E54', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={loading || !text.trim()}
            >
              <Send size={15} />
              <span>{loading ? 'Simulando...' : '🚀 Simular Mensaje Entrante'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
