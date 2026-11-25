import { CheckCircle, Printer, X } from 'lucide-react';
import { getWhatsAppSendLink } from './types';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { api } from '../../utils/api';
import {
  buildArqueoTicketData,
  printHandoverTicket80mm,
} from '../../utils/print/printHandoverTicket80mm';

interface ArqueoResultModalProps {
  arqueoResult: any | null;
  onClose: () => void;
}

export default function ArqueoResultModal({
  arqueoResult,
  onClose,
}: ArqueoResultModalProps) {
  return (
    <NativeModalDialog
      isOpen={Boolean(arqueoResult)}
      onClose={onClose}
      ariaLabelledBy="arqueo-result-title"
      style={{ maxWidth: '650px', width: '95vw', padding: '24px' }}
    >
      {arqueoResult && (
        <>
          <div className="modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 id="arqueo-result-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: '#047857' }}>
              <CheckCircle size={22} color="#10b981" aria-hidden="true" />
              Arqueo Confirmado
            </h3>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '18px', fontSize: '0.9rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem' }}>Caja</span>
                <strong style={{ color: 'var(--text-primary)' }}>{arqueoResult.drawer?.branch || 'Caja Operativa'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem' }}>Diferencia</span>
                <strong className="tabular-nums" style={{ color: arqueoResult.difference === 0 ? '#166534' : arqueoResult.difference > 0 ? '#0f766e' : '#b91c1c' }}>
                  {arqueoResult.difference > 0 ? '+' : ''}${Number(arqueoResult.difference || 0).toLocaleString('es-AR')}
                </strong>
              </div>
            </div>
          </div>

          <h4 className="tabular-nums" style={{ fontSize: '0.92rem', fontWeight: 600, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
            Comprobantes ({arqueoResult.verifiedReceipts?.length || 0})
          </h4>

          <div className="table-container" role="region" aria-label="Comprobantes procesados" tabIndex={0} style={{ marginBottom: '18px', maxHeight: '250px', marginTop: 0 }}>
            <table style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th scope="col">Recibo</th>
                  <th scope="col">Cliente</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                  <th scope="col" style={{ textAlign: 'center' }}>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {!arqueoResult.verifiedReceipts || arqueoResult.verifiedReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                      Sin recibos en esta rendición.
                    </td>
                  </tr>
                ) : (
                  arqueoResult.verifiedReceipts.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.receiptNumber}</td>
                      <td>
                        <div>{r.clientName}</div>
                        {r.clientPhone ? (
                          <span className="tabular-nums" style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 500 }}>
                            Enviado (+{r.clientPhone.replace(/\D/g, '')})
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 500 }}>
                            Sin teléfono
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${r.amount.toLocaleString('es-AR')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
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
                              gap: '4px',
                            }}
                          >
                            Reenviar
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

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() =>
                printHandoverTicket80mm(
                  buildArqueoTicketData(arqueoResult, {
                    receivedBy: api.getCurrentUser()?.username || 'Caja / Administración',
                  }),
                )
              }
            >
              <Printer size={15} aria-hidden="true" /> Ticket 80mm
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </NativeModalDialog>
  );
}
