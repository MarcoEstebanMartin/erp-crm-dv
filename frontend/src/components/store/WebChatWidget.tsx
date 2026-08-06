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
  priceListType = 'LISTA_A',
  onAddToCart
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `¡Hola ${customerName}! 👋 Soy **Santi**, el asistente virtual de **DV Distribuidora**.\n\nPuedo ayudarte a consultar precios, verificar stock, procesar fotos de pedidos anotados o comprobantes de transferencia. ¿En qué te puedo colaborar hoy?`,
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

    const currentText = text.trim();
    const currentImg = selectedImage;

    // Agregar mensaje del usuario a la vista
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
      // Formatear historial reciente para el contexto de Gemini
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
          text: '¡Uy! Ocurrió un inconveniente momentáneo al procesar tu consulta. En un segundo me reconecto o podés volver a intentar. 😊',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Botón flotante de activación */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 bg-gradient-to-r from-red-600 to-red-700 text-white px-5 py-3.5 rounded-full shadow-2xl hover:scale-105 transition-all duration-300 border border-red-500/30 active:scale-95"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <Bot className="w-6 h-6 text-white group-hover:rotate-12 transition-transform duration-300" />
          <span className="font-semibold text-sm tracking-wide">Asistente Virtual IA</span>
        </button>
      )}

      {/* Ventana Modal del Chatbot */}
      {isOpen && (
        <div className="w-[380px] sm:w-[420px] h-[580px] bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-red-500 flex items-center justify-center shadow-lg shadow-red-950/50">
                <Bot className="w-5 h-5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-1.5">
                  Santi <Sparkles className="w-3.5 h-3.5 text-amber-400 inline" />
                </h3>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <span>Asistente DV</span> • <span className="text-emerald-400 font-medium">En línea</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    msg.sender === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-red-400" />}
                </div>

                <div className={`max-w-[82%] space-y-2`}>
                  <div
                    className={`p-3.5 rounded-2xl ${
                      msg.sender === 'user'
                        ? 'bg-red-600 text-white rounded-tr-none shadow-md shadow-red-950/20'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-none'
                    }`}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Adjunto"
                        className="w-full max-h-40 object-cover rounded-lg mb-2 border border-slate-700"
                      />
                    )}
                    <div className="whitespace-pre-line leading-relaxed text-xs sm:text-sm">
                      {msg.text}
                    </div>
                  </div>

                  {/* Si el mensaje del bot incluye un borrador de pedido detectado */}
                  {msg.items && msg.items.length > 0 && (
                    <div className="bg-slate-800/60 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                      <div className="text-xs font-semibold text-emerald-400 flex items-center justify-between">
                        <span>🛒 Borrador Detectado ({msg.items.length} ítems):</span>
                        <span>${msg.items.reduce((acc, i) => acc + i.subtotal, 0).toLocaleString('es-AR')}</span>
                      </div>
                      <div className="space-y-1">
                        {msg.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-300">
                            <span>• {item.quantity}x {item.productName}</span>
                            <span className="font-mono text-slate-400">${item.subtotal.toLocaleString('es-AR')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-500 block px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs p-2">
                <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                <span>Santi está consultando la base de datos...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Botones de acción rápida */}
          <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/60 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
            <button
              onClick={() => handleSendMessage('¿Cuáles son los productos en oferta?')}
              className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
            >
              🔥 Ver Ofertas
            </button>
            <button
              onClick={() => handleSendMessage('Quiero hacer un pedido')}
              className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
            >
              🛒 Armar Pedido
            </button>
            <button
              onClick={() => handleSendMessage('Quiero hablar con un representante comercial')}
              className="px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 whitespace-nowrap transition-colors"
            >
              👤 Asesor Humano
            </button>
          </div>

          {/* Previsualización de imagen a subir */}
          {selectedImage && (
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <img src={selectedImage.preview} alt="Preview" className="w-8 h-8 rounded object-cover border border-slate-700" />
                <span>Foto lista para enviar</span>
              </div>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-slate-400 hover:text-white text-xs"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Input de Mensaje */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              title="Adjuntar foto de pedido o comprobante"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Escribe tu consulta o pedido..."
              className="flex-1 bg-slate-800 text-slate-100 text-sm px-4 py-2.5 rounded-xl border border-slate-700/60 focus:outline-none focus:border-red-500 placeholder-slate-500"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={loading || (!inputText.trim() && !selectedImage)}
              className="p-2.5 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-950/40"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
