import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Image as ImageIcon, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../../utils/api';

interface WebChatWidgetProps {
  customerName?: string;
  priceListType?: 'LISTA_A' | 'LISTA_B' | 'LISTA_C';
  onAddToCart?: (productId: number, quantity: number) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  imageUrl?: string;
  items?: Array<{
    productId: number;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  timestamp: string;
}

export const WebChatWidget: React.FC<WebChatWidgetProps> = ({
  customerName = 'Visitante',
  priceListType = 'LISTA_A'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Hola ${customerName}! Soy Ben, tu asistente de inteligencia artificial. Contame con el mayor detalle posible que necesitas, asi puedo darte una mejor respuesta. Estoy aca para ayudarte.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, loading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setSelectedImage({
        base64,
        mimeType: file.type,
        preview: result
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if ((!text || !text.trim()) && !selectedImage) return;

    const currentText = (text || '').trim();
    const currentImg = selectedImage;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: currentText,
      imageUrl: currentImg?.preview,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const historyContext = messages.slice(-6).map(m => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        content: m.text
      }));

      const response = await fetch(`${API_BASE_URL}/web-chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: currentText,
          history: historyContext,
          mediaBase64: currentImg?.base64,
          mediaMimeType: currentImg?.mimeType,
          customerName,
          priceListType
        })
      });

      const resData = await response.json();

      if (resData.status === 'success' && resData.data) {
        const botMsg: Message = {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: resData.data.text,
          items: resData.data.draftOrderItems,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(resData.message || 'Error de respuesta');
      }
    } catch (err: any) {
      console.error('Error enviando mensaje al chat:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'bot',
          text: 'Disculpame, tuve un inconveniente para procesar tu consulta en este momento. Por favor reintenta en unos instantes o aguarda que te atenderá un operador humano.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.widgetContainer}>
      {/* Botón flotante launcher */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={styles.launcherBtn}
        >
          <span style={styles.pingDot} />
          <Bot style={{ width: 22, height: 22, color: '#ffffff' }} />
          <span style={styles.launcherText}>Asistente Virtual IA</span>
        </button>
      )}

      {/* Ventana flotante del Chatbot */}
      {isOpen && (
        <div style={styles.chatWindow}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.headerTitleContainer}>
              <div style={styles.avatarBox}>
                <Bot style={{ width: 20, height: 20, color: '#ffffff' }} />
                <span style={styles.onlineBadge} />
              </div>
              <div>
                <h3 style={styles.headerTitle}>
                  Ben <Sparkles style={{ width: 14, height: 14, color: '#fbbf24', display: 'inline' }} />
                </h3>
                <p style={styles.headerSubtitle}>
                  Asistente DV • <span style={{ color: '#10b981', fontWeight: 600 }}>En línea</span>
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={styles.closeBtn}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          {/* Área de Mensajes */}
          <div style={styles.messagesArea}>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div
                  style={{
                    ...styles.avatarSmall,
                    background: msg.sender === 'user' ? '#E30613' : '#1e293b',
                    color: '#ffffff'
                  }}
                >
                  {msg.sender === 'user' ? <User style={{ width: 14, height: 14 }} /> : <Bot style={{ width: 14, height: 14, color: '#f87171' }} />}
                </div>

                <div style={{ maxWidth: '82%' }}>
                  <div
                    style={{
                      ...styles.bubble,
                      background: msg.sender === 'user' ? '#E30613' : '#1e293b',
                      color: '#ffffff',
                      borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px'
                    }}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Adjunto"
                        style={styles.attachedImg}
                      />
                    )}
                    <div style={{ whitespace: 'pre-line', lineHeight: '1.45', fontSize: '13px' }}>
                      {msg.text}
                    </div>
                  </div>

                  {msg.items && msg.items.length > 0 && (
                    <div style={styles.draftBox}>
                      <div style={styles.draftHeader}>
                        <span>🛒 Borrador Detectado ({msg.items.length} ítems):</span>
                        <span>${msg.items.reduce((acc, i) => acc + i.subtotal, 0).toLocaleString('es-AR')}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {msg.items.map((item, idx) => (
                          <div key={idx} style={styles.draftItemRow}>
                            <span>• {item.quantity}x {item.productName}</span>
                            <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>${item.subtotal.toLocaleString('es-AR')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <span style={styles.timestamp}>{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {loading && (
              <div style={styles.loadingRow}>
                <Loader2 style={{ width: 16, height: 16, color: '#E30613', animation: 'spin 1s linear infinite' }} />
                <span>Ben está consultando la base de datos...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Botones de sugerencia rápida */}
          <div style={styles.suggestionsContainer}>
            <button onClick={() => handleSendMessage('¿Cuáles son los productos en oferta?')} style={styles.suggestionBtn}>
              🔥 Ver Ofertas
            </button>
            <button onClick={() => handleSendMessage('Quiero hacer un pedido')} style={styles.suggestionBtn}>
              🛒 Armar Pedido
            </button>
            <button onClick={() => handleSendMessage('Quiero hablar con un representante comercial')} style={styles.suggestionBtn}>
              👤 Asesor Humano
            </button>
          </div>

          {/* Preview de foto seleccionada */}
          {selectedImage && (
            <div style={styles.previewBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' }}>
                <img src={selectedImage.preview} alt="Preview" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
                <span>Foto cargada para enviar</span>
              </div>
              <button onClick={() => setSelectedImage(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          )}

          {/* Bar de Input */}
          <div style={styles.inputBar}>
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={styles.iconBtn}
              title="Adjuntar foto o comprobante"
            >
              <ImageIcon style={{ width: 18, height: 18, color: '#94a3b8' }} />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe tu consulta o pedido..."
              style={styles.textInput}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={loading || (!inputText.trim() && !selectedImage)}
              style={{
                ...styles.sendBtn,
                opacity: loading || (!inputText.trim() && !selectedImage) ? 0.5 : 1
              }}
            >
              <Send style={{ width: 16, height: 16, color: '#ffffff' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  widgetContainer: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 99999,
    fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif"
  },
  launcherBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'linear-gradient(135deg, #E30613 0%, #b91c1c 100%)',
    color: '#ffffff',
    padding: '12px 20px',
    borderRadius: '30px',
    boxShadow: '0 10px 25px rgba(227, 6, 19, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'transform 0.2s ease'
  },
  pingDot: {
    width: '10px',
    height: '10px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    display: 'inline-block',
    boxShadow: '0 0 8px #10b981'
  },
  launcherText: {
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '13px'
  },
  chatWindow: {
    width: '380px',
    height: '560px',
    background: '#0f172a',
    borderRadius: '24px',
    border: '1px solid #1e293b',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    background: '#1e293b',
    padding: '14px 18px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatarBox: {
    position: 'relative',
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #E30613 0%, #991b1b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  onlineBadge: {
    position: 'absolute',
    bottom: '-2px',
    right: '-2px',
    width: '10px',
    height: '10px',
    backgroundColor: '#10b981',
    border: '2px solid #0f172a',
    borderRadius: '50%'
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: '15px',
    fontWeight: 700,
    margin: 0
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: '11px',
    margin: 0
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  messagesArea: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  messageRow: {
    display: 'flex',
    gap: '10px'
  },
  avatarSmall: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  bubble: {
    padding: '12px 14px',
    fontSize: '13px',
    border: '1px solid rgba(255, 255, 255, 0.06)'
  },
  attachedImg: {
    width: '100%',
    maxHeight: '160px',
    objectFit: 'cover',
    borderRadius: '8px',
    marginBottom: '8px'
  },
  draftBox: {
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '12px',
    padding: '10px 12px',
    marginTop: '6px',
    fontSize: '12px'
  },
  draftHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 600,
    color: '#34d399',
    marginBottom: '6px'
  },
  draftItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#cbd5e1',
    fontSize: '11px'
  },
  timestamp: {
    fontSize: '10px',
    color: '#64748b',
    marginTop: '4px',
    display: 'block'
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#94a3b8',
    fontSize: '12px',
    padding: '4px'
  },
  suggestionsContainer: {
    padding: '8px 12px',
    background: '#020617',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    gap: '8px',
    overflowX: 'auto'
  },
  suggestionBtn: {
    background: '#1e293b',
    color: '#cbd5e1',
    border: '1px solid #334155',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    whiteSpace: 'nowrap',
    cursor: 'pointer'
  },
  previewBar: {
    padding: '8px 14px',
    background: '#0f172a',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  inputBar: {
    padding: '12px 14px',
    background: '#1e293b',
    borderTop: '1px solid #334155',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    padding: '6px',
    cursor: 'pointer',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  textInput: {
    flex: 1,
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#f8fafc',
    fontSize: '13px',
    outline: 'none'
  },
  sendBtn: {
    background: '#E30613',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};
