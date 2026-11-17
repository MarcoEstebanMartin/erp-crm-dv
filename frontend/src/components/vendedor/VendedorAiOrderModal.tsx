import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, Sparkles, X, Trash2, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { orderApi } from '../../api/order.api';
import type { Persona, Product } from '../../types';

interface ParsedDraftItem {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

interface ClientCandidate {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
}

interface VendedorAiOrderModalProps {
  open: boolean;
  onClose: () => void;
  clients: Persona[];
  products: Product[];
  selectedClient: Persona | null;
  onApplyDraft: (payload: {
    client: Persona | null;
    items: Array<{ product: Product; quantity: number }>;
    orderNotes: string | null;
  }) => void;
}

export const VendedorAiOrderModal: React.FC<VendedorAiOrderModalProps> = ({
  open,
  onClose,
  clients,
  products,
  selectedClient,
  onApplyDraft,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [loadingLabel, setLoadingLabel] = useState('Procesando...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const [draftClientId, setDraftClientId] = useState<number | null>(selectedClient?.id ?? null);
  const [clientCandidates, setClientCandidates] = useState<ClientCandidate[]>([]);
  const [clientQuery, setClientQuery] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<ParsedDraftItem[]>([]);
  const [unmatchedLines, setUnmatchedLines] = useState<string[]>([]);
  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const [hasParsed, setHasParsed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setErrorMsg(null);
      setDraftClientId(selectedClient?.id ?? null);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, selectedClient]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const handleCancelProcessing = () => {
    requestSeqRef.current += 1;
    setLoading(false);
    setErrorMsg('Procesamiento cancelado.');
  };

  const runParse = async (payload: { text?: string; audioBase64?: string; audioMimeType?: string }) => {
    const seq = ++requestSeqRef.current;
    setLoading(true);
    setLoadingLabel(payload.audioBase64 ? 'Transcribiendo audio...' : 'Interpretando pedido...');
    setErrorMsg(null);
    let timeoutId: number | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error('Tiempo de espera agotado (30s). Reintentá.')), 30_000);
      });
      const res = await Promise.race([
        orderApi.parseOrderWithAi({
          ...payload,
          selectedClientId: selectedClient?.id,
        }),
        timeoutPromise,
      ]);
      if (seq !== requestSeqRef.current) return;
      const data = res.data;
      if (data.rawText && !textInput.trim()) {
        setTextInput(data.rawText);
      } else if (payload.audioBase64 && data.rawText) {
        setTextInput(data.rawText);
      }

      if (!selectedClient) {
        if (data.detectedClient) {
          setDraftClientId(data.detectedClient.id);
        } else {
          setDraftClientId(null);
        }
        setClientCandidates(data.clientCandidates || []);
        setClientQuery(data.clientQuery || null);
      }

      setDraftItems(data.items || []);
      setUnmatchedLines(data.unmatchedLines || []);
      setDraftNotes(data.orderNotes || null);
      setHasParsed(true);
    } catch (err: any) {
      if (seq !== requestSeqRef.current) return;
      setErrorMsg(err?.message || 'No se pudo interpretar el pedido.');
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (seq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const sendAudioBlob = (blob: Blob, fallbackMime: string) => {
    if (blob.size === 0) {
      setErrorMsg('No se detectó audio en la grabación.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const mimeType = (blob.type || fallbackMime || 'audio/webm').split(';')[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = typeof reader.result === 'string' ? reader.result : '';
      const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
      if (base64) {
        void runParse({ audioBase64: base64, audioMimeType: mimeType });
      } else {
        setLoading(false);
        setErrorMsg('No se pudo leer el audio grabado.');
      }
    };
    reader.onerror = () => {
      setLoading(false);
      setErrorMsg('Error al procesar el archivo de audio.');
    };
    reader.readAsDataURL(blob);
  };

  const handleStartRecording = async () => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setErrorMsg('El micrófono requiere HTTPS (o localhost en PC). Si estás probando por IP local, dictá usando el micrófono del teclado.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg('Tu navegador no habilita grabación directa. Podés dictar usando el micrófono del teclado.');
      return;
    }
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
      const supportedMime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const resolvedMime = recorder.mimeType || supportedMime || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: resolvedMime });
        sendAudioBlob(blob, resolvedMime);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMsg('Permiso de micrófono denegado o no disponible.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleUpdateQty = (productId: number, delta: number) => {
    setDraftItems((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0),
    );
  };

  const handleApply = () => {
    const resolvedClient =
      selectedClient || clients.find((c) => c.id === draftClientId) || null;

    const mappedItems = draftItems
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return product ? { product, quantity: item.quantity } : null;
      })
      .filter((entry): entry is { product: Product; quantity: number } => Boolean(entry));

    onApplyDraft({
      client: resolvedClient,
      items: mappedItems,
      orderNotes: draftNotes,
    });
    onClose();
  };

  const resolvedClientObj = selectedClient || clients.find((c) => c.id === draftClientId) || null;

  return (
    <dialog
      ref={dialogRef}
      className="app-native-dialog"
      aria-labelledby="ai-order-modal-title"
      closedby="any"
      onClose={onClose}
      style={{
        margin: 'auto',
        width: 'min(540px, 94vw)',
        maxHeight: '88vh',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        padding: 0,
        backgroundColor: '#fff',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--color-corp-red)" aria-hidden="true" />
            <h2 id="ai-order-modal-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Pedido IA
            </h2>
          </div>
          <button type="button" className="btn btn-secondary" style={{ padding: '6px' }} aria-label="Cerrar" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '14px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isRecording ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={handleStartRecording}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 14px', fontWeight: 700 }}
              >
                <Mic size={17} color="var(--color-corp-red)" aria-hidden="true" />
                Grabar audio
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={handleStopRecording}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 14px', fontWeight: 700, backgroundColor: 'var(--color-corp-red)', color: '#fff', border: 'none' }}
              >
                <Square size={14} aria-hidden="true" />
                <span className="tabular-nums">
                  Grabando {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')} · Enviar
                </span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="ai-order-text" className="sr-only">Mensaje o dictado del pedido</label>
            <textarea
              id="ai-order-text"
              className="input"
              rows={3}
              autoFocus
              placeholder="Ej: Para Don José: 2 cajas de fideos Matarazzo y 3 aceites Natura"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={loading || isRecording}
              style={{ width: '100%', resize: 'vertical', fontSize: '0.9rem', padding: '10px 12px' }}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || isRecording || !textInput.trim()}
              onClick={() => runParse({ text: textInput })}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 14px', fontWeight: 600 }}
            >
              <Send size={15} aria-hidden="true" />
              {loading ? 'Interpretando...' : 'Interpretar'}
            </button>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '0.84rem', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                <span>{loadingLabel}</span>
                <span className="tabular-nums" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{loadingSeconds}s</span>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancelProcessing}
                style={{ padding: '4px 10px', fontSize: '0.76rem' }}
              >
                Cancelar
              </button>
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(var(--color-corp-red-rgb), 0.08)', color: 'var(--color-corp-red)', fontSize: '0.82rem', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}

          {hasParsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
              {!selectedClient && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="ai-client-select" style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Cliente {clientQuery && !resolvedClientObj ? `(mencionado: "${clientQuery}")` : ''}
                  </label>
                  {clientCandidates.length > 0 && !resolvedClientObj && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {clientCandidates.map((cand) => (
                        <button
                          key={cand.id}
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                          onClick={() => setDraftClientId(cand.id)}
                        >
                          {cand.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <select
                    id="ai-client-select"
                    className="input"
                    value={draftClientId ?? ''}
                    onChange={(e) => setDraftClientId(e.target.value ? Number(e.target.value) : null)}
                    style={{ fontSize: '0.86rem', padding: '8px 10px' }}
                  >
                    <option value="">Elegir cliente después</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.city ? ` (${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {draftItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {draftItems.map((item) => (
                    <div
                      key={item.productId}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.productName}
                        </div>
                        <div className="tabular-nums" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                          ${Math.round(item.unitPrice).toLocaleString('es-AR')} c/u
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', fontWeight: 700 }} onClick={() => handleUpdateQty(item.productId, -1)}>-</button>
                        <span className="tabular-nums" style={{ minWidth: '24px', textAlign: 'center', fontWeight: 700, fontSize: '0.86rem' }}>{item.quantity}</span>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 9px', fontWeight: 700 }} onClick={() => handleUpdateQty(item.productId, 1)}>+</button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '5px' }} aria-label="Quitar" onClick={() => handleUpdateQty(item.productId, -item.quantity)}>
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px' }}>
                  Sin productos detectados.
                </div>
              )}

              {unmatchedLines.length > 0 && (
                <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.78rem', color: '#92400e', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} aria-hidden="true" />
                  <div>
                    <strong>No reconocidos:</strong> {unmatchedLines.join(' · ')}
                  </div>
                </div>
              )}

              {draftNotes && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <strong>Notas:</strong> {draftNotes}
                </div>
              )}
            </div>
          )}
        </div>

        {hasParsed && draftItems.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
            >
              <Check size={16} aria-hidden="true" />
              Cargar al carrito
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
};
