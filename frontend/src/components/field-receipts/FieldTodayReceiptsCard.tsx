import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileDown, Send } from 'lucide-react';
import {
  fieldReceiptsApi,
  type FieldReceiptDTO,
} from '../../api/fieldReceipts.api';
import {
  downloadReceiptPdf,
  type PublicReceiptData,
} from '../../utils/receiptPdfGenerator';
import {
  buildFieldReceiptWhatsAppMessage,
  formatFieldPaymentsSummary,
} from '../../utils/receiptWhatsApp';
import {
  ReceiptWhatsAppSendModal,
  type ReceiptWhatsAppTarget,
} from './ReceiptWhatsAppSendModal';

export function fieldReceiptToPublicData(receipt: FieldReceiptDTO): PublicReceiptData {
  const primaryMethod = receipt.payments?.[0]?.paymentMethod || 'CASH';
  const summary = formatFieldPaymentsSummary(receipt.payments);
  const checkWithNumber = receipt.payments?.find(
    (p) => p.paymentMethod === 'CHECK' && p.checkNumber,
  );
  const description = checkWithNumber
    ? `Pago a cuenta corriente · Cheque N° ${checkWithNumber.checkNumber}`
    : receipt.payments && receipt.payments.length > 1
      ? `Pago a cuenta corriente (${summary})`
      : 'Pago a cuenta corriente';

  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber || receipt.provisionalCode,
    amount: receipt.totalAmount,
    paymentMethod: primaryMethod,
    description,
    createdAt: receipt.capturedAt,
    verified: receipt.status === 'VERIFIED',
    verificationCode: receipt.provisionalCode,
    publicUrl: receipt.pdfUrl
      ? receipt.pdfUrl.startsWith('http')
        ? receipt.pdfUrl
        : `${typeof window !== 'undefined' ? window.location.origin : ''}${receipt.pdfUrl}`
      : null,
    persona: receipt.persona
      ? { id: receipt.persona.id, name: receipt.persona.name }
      : null,
  };
}

interface FieldTodayReceiptsCardProps {
  receipts: FieldReceiptDTO[];
  onRefresh: () => void;
}

export const FieldTodayReceiptsCard: React.FC<FieldTodayReceiptsCardProps> = ({
  receipts,
  onRefresh,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [waTarget, setWaTarget] = useState<ReceiptWhatsAppTarget | null>(null);

  if (receipts.length === 0) return null;

  const visibleReceipts = expanded ? receipts : receipts.slice(0, 3);

  const handleDownloadPdf = async (r: FieldReceiptDTO) => {
    if (busyKey) return;
    setBusyKey(`pdf-${r.id}`);
    try {
      await downloadReceiptPdf(fieldReceiptToPublicData(r));
    } finally {
      setBusyKey(null);
    }
  };

  const handleOpenWhatsApp = (r: FieldReceiptDTO) => {
    setWaTarget({
      personaId: r.persona?.id ?? r.personaId,
      clientName: r.persona?.name || 'Cliente',
      phone: r.persona?.phone ?? null,
      whatsappVerifiedAt: r.persona?.whatsappVerifiedAt ?? null,
      receiptLabel: r.receiptNumber || r.provisionalCode,
      amount: r.totalAmount,
      messageText: buildFieldReceiptWhatsAppMessage(r, window.location.origin),
      fieldReceiptId: r.id,
      publicReceiptData: fieldReceiptToPublicData(r),
    });
  };

  return (
    <section
      aria-label="Recibos de hoy"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#111827' }}>
          Recibos de hoy ({receipts.length})
        </h4>
        {receipts.length > 3 && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              color: '#4b5563',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>{expanded ? 'Ver menos' : `Ver todos (${receipts.length})`}</span>
            {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visibleReceipts.map((r) => {
          const isPdfBusy = busyKey === `pdf-${r.id}`;
          const methodText = formatFieldPaymentsSummary(r.payments);
          const isVoided = r.status === 'VOIDED';

          return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid #f3f4f6',
                background: '#f9fafb',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      color: '#111827',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.persona?.name || 'Cliente'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px', fontSize: '0.75rem', color: '#6b7280' }}>
                    <span className="tabular-nums" style={{ fontWeight: 600, color: '#374151' }}>
                      {r.receiptNumber || 'Transferencia'}
                    </span>
                    <span>·</span>
                    <span>{methodText}</span>
                    {!r.receiptNumber && !isVoided && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: '999px',
                          background: '#fef3c7',
                          color: '#92400e',
                        }}
                      >
                        Sin acreditar
                      </span>
                    )}
                    {isVoided && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#E30613' }}>
                        ANULADO
                      </span>
                    )}
                  </div>
                </div>

                <span
                  className="tabular-nums"
                  style={{
                    fontWeight: 800,
                    fontSize: '0.96rem',
                    color: isVoided ? '#9ca3af' : '#111827',
                    flexShrink: 0,
                  }}
                >
                  ${Math.round(Number(r.totalAmount)).toLocaleString('es-AR')}
                </span>
              </div>

              {r.receiptNumber && !isVoided && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => void handleDownloadPdf(r)}
                    disabled={isPdfBusy}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      minHeight: '32px',
                      padding: '0 10px',
                      borderRadius: '7px',
                      border: '1px solid #111827',
                      background: '#111827',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: isPdfBusy ? 'wait' : 'pointer',
                      opacity: isPdfBusy ? 0.65 : 1,
                    }}
                  >
                    <FileDown size={13} aria-hidden="true" />
                    <span>{isPdfBusy ? 'Generando…' : 'PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenWhatsApp(r)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      minHeight: '32px',
                      padding: '0 10px',
                      borderRadius: '7px',
                      border: '1px solid #16a34a',
                      background: '#ffffff',
                      color: '#15803d',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Send size={13} aria-hidden="true" />
                    <span>WhatsApp</span>
                  </button>

                  {r.whatsappStatus === 'FAILED' && (
                    <button
                      type="button"
                      onClick={() => void fieldReceiptsApi.resendWhatsApp(r.id).then(() => onRefresh())}
                      title="Reenviar por API Meta"
                      style={{
                        minHeight: '32px',
                        padding: '0 10px',
                        borderRadius: '7px',
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        color: '#374151',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Reenviar API
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ReceiptWhatsAppSendModal
        target={waTarget}
        onClose={() => setWaTarget(null)}
        onSaved={() => onRefresh()}
      />
    </section>
  );
};
