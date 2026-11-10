import { CheckCircle } from 'lucide-react';
import { getWhatsAppSendLink } from './types';

interface ArqueoResultModalProps {
  arqueoResult: any | null;
  onClose: () => void;
}

export default function ArqueoResultModal({
  arqueoResult,
  onClose
}: ArqueoResultModalProps) {
  if (!arqueoResult) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px', width: '95%', padding: '24px', borderRadius: '12px' }}>
        <div className="modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
            <CheckCircle size={24} color="#10b981" />
            Arqueo Procesado Exitosamente
          </h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem' }}>Caja / Rama:</span>
              <strong style={{ color: 'var(--text-primary)' }}>{arqueoResult.drawer?.branch || 'Caja Operativa'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem' }}>Diferencia de Arqueo:</span>
              <strong style={{ color: arqueoResult.difference === 0 ? '#166534' : arqueoResult.difference > 0 ? '#0f766e' : '#b91c1c' }}>
                {arqueoResult.difference > 0 ? '+' : ''}${Number(arqueoResult.difference || 0).toLocaleString('es-AR')}
              </strong>
            </div>
          </div>
        </div>

        <h4 style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
          Comprobantes validados y notificados por el ERP ({arqueoResult.verifiedReceipts?.length || 0})
        </h4>

        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', maxHeight: '250px', overflowY: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0 }}>
              <tr style={{ color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px' }}>Recibo</th>
                <th style={{ padding: '10px' }}>Cliente</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Monto</th>
                <th style={{ padding: '10px', textAlign: 'center' }}>WhatsApp (Respaldo)</th>
              </tr>
            </thead>
            <tbody>
              {!arqueoResult.verifiedReceipts || arqueoResult.verifiedReceipts.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                    No se procesaron recibos individuales en esta rendición.
                  </td>
                </tr>
              ) : (
                arqueoResult.verifiedReceipts.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{r.receiptNumber}</td>
                    <td style={{ padding: '10px' }}>
                      <div>{r.clientName}</div>
                      {r.clientPhone ? (
                        <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 500 }}>
                          📲 Enviado al ERP (+{r.clientPhone.replace(/\D/g, '')})
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 500 }}>
                          ⚠️ Sin teléfono registrado
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                      ${r.amount.toLocaleString('es-AR')}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      {r.clientPhone ? (
                        <a
                          href={getWhatsAppSendLink(r.clientPhone, r.clientName, r.receiptNumber, r.amount, r.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            color: '#047857',
                            backgroundColor: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '4px',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Reenviar comprobante por WhatsApp Web"
                        >
                          <span>Reenviar</span>
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
            style={{ padding: '8px 24px', backgroundColor: 'var(--text-primary)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
