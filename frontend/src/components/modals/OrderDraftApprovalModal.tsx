import React, { useState } from 'react';
import { X, Check, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';
import { api } from '../../utils/api';

interface OrderDraftApprovalModalProps {
  draft: any;
  onClose: () => void;
  onApproved: () => void;
}

export default function OrderDraftApprovalModal({ draft, onClose, onApproved }: OrderDraftApprovalModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const items = JSON.parse(draft.itemsJson || '[]');

  const handleApprove = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.approveCrmOrderDraft(draft.id);
      onApproved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al aprobar el borrador.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '620px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
        
        {/* Header con Badge de IA */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ backgroundColor: '#EEF2FF', padding: '8px', borderRadius: '8px', color: '#4F46E5', display: 'flex' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Aprobar Borrador de Pedido IA</h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Verifique los artículos detectados por la Inteligencia Artificial antes de cargarlos al ERP.
              </p>
            </div>
          </div>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {errorMsg && (
            <div style={{ backgroundColor: '#FFF2F2', borderLeft: '4px solid var(--color-corp-red)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} style={{ color: 'var(--color-corp-red)' }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Texto original recibido por WhatsApp */}
          <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Mensaje del Cliente (WhatsApp):
            </span>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--text-primary)' }}>
              "{draft.rawText}"
            </p>
          </div>

          {/* Tabla de ítems detectados */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Artículos Detectados ({items.length}):</span>
            </div>

            <div className="table-container" style={{ borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <table style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8F9FA' }}>
                    <th>Producto</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'center' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>Precio Unit.</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '16px' }}>
                        No se detectaron productos del catálogo con coincidencia exacta.
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.productName}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{item.sku || 'N/A'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity} u.</td>
                        <td style={{ textAlign: 'right' }}>${Number(item.unitPrice).toLocaleString('es-AR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(item.subtotal).toLocaleString('es-AR')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resumen y Total */}
          <div style={{
            display: 'flex',
            justify: 'space-between',
            alignItems: 'center',
            padding: '14px',
            backgroundColor: '#F8FAFC',
            borderRadius: '8px',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <ShoppingBag size={18} />
              <span>Total Estimado del Borrador:</span>
            </div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-color)' }}>
              ${Number(draft.totalEstimated).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>

        </div>

        {/* Footer con botones de acción */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={handleApprove}
            disabled={loading || items.length === 0}
          >
            <Check size={16} />
            <span>{loading ? 'Aprobando...' : 'Aprobar y Generar Preventa ERP'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
