import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileDown, Send, X } from 'lucide-react';
import {
  fieldReceiptsApi,
  type SavedClientWhatsAppDTO,
} from '../../api/fieldReceipts.api';
import {
  buildWhatsAppDeepLink,
  formatReceiptAmountAr,
  normalizeArgentinaWhatsAppPhone,
} from '../../utils/receiptWhatsApp';
import {
  downloadReceiptPdf,
  type PublicReceiptData,
} from '../../utils/receiptPdfGenerator';
import { NativeModalDialog } from '../modals/NativeModalDialog';

export interface ReceiptWhatsAppTarget {
  personaId: number | null;
  clientName: string;
  phone?: string | null;
  whatsappVerifiedAt?: string | null;
  receiptLabel: string;
  amount: number | string;
  messageText: string;
  fieldReceiptId?: number | null;
  publicReceiptData?: PublicReceiptData | null;
}

interface ReceiptWhatsAppSendModalProps {
  target: ReceiptWhatsAppTarget | null;
  onClose: () => void;
  onSaved?: (saved: SavedClientWhatsAppDTO) => void;
}

export function isValidArgentinaWhatsAppPhone(raw: string): boolean {
  const normalized = normalizeArgentinaWhatsAppPhone(raw);
  return normalized.length >= 11 && normalized.length <= 15;
}

export const ReceiptWhatsAppSendModal: React.FC<ReceiptWhatsAppSendModalProps> = ({
  target,
  onClose,
  onSaved,
}) => {
  const [phoneInput, setPhoneInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setPhoneInput(target.phone || '');
    setError(null);
    setSaving(false);
  }, [target]);

  if (!target) return null;

  const normalized = normalizeArgentinaWhatsAppPhone(phoneInput);
  const isValid = isValidArgentinaWhatsAppPhone(phoneInput);
  const initialNormalized = normalizeArgentinaWhatsAppPhone(target.phone);
  const phoneChanged = normalized !== initialNormalized;
  const isAlreadyVerified = Boolean(target.whatsappVerifiedAt) && Boolean(initialNormalized) && !phoneChanged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);

    if (!isValid) {
      setError('Ingresá código de área + número (ej: 3388412345).');
      return;
    }

    const whatsappUrl = buildWhatsAppDeepLink(normalized, target.messageText);
    const shouldPersist =
      Boolean(target.personaId) &&
      (!target.whatsappVerifiedAt || phoneChanged || Boolean(target.fieldReceiptId));

    setSaving(true);
    try {
      if (shouldPersist && target.personaId) {
        const saved = await fieldReceiptsApi.saveClientWhatsApp(target.personaId, {
          phone: normalized,
          fieldReceiptId: target.fieldReceiptId ?? null,
        });
        onSaved?.(saved);
      }

      const popup = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.location.href = whatsappUrl;
      }
      onClose();
    } catch (err: any) {
      setError(String(err?.message || 'No se pudo guardar el WhatsApp del cliente.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!target.publicReceiptData || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadReceiptPdf(target.publicReceiptData);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <NativeModalDialog
      isOpen={Boolean(target)}
      onClose={onClose}
      ariaLabelledBy="receipt-wa-modal-title"
      style={{
        width: 'min(420px, 94vw)',
        borderRadius: '14px',
        padding: 0,
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            padding: '15px 18px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3
              id="receipt-wa-modal-title"
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 700,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {target.clientName}
            </h3>
            <div className="tabular-nums" style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
              {target.receiptLabel} · <strong>{formatReceiptAmountAr(target.amount)}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', flexShrink: 0 }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <label
              htmlFor="receipt-wa-phone-input"
              style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}
            >
              WhatsApp
            </label>
            {isAlreadyVerified && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#ecfdf5',
                  color: '#047857',
                }}
              >
                <CheckCircle2 size={12} aria-hidden="true" />
                Verificado
              </span>
            )}
          </div>

          <input
            id="receipt-wa-phone-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus={!isAlreadyVerified}
            placeholder="Ej: 3388412345"
            value={phoneInput}
            onChange={(e) => {
              setPhoneInput(e.target.value);
              if (error) setError(null);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: error ? '1px solid #dc2626' : '1px solid #d1d5db',
              fontSize: '16px',
              boxSizing: 'border-box',
              fontVariantNumeric: 'tabular-nums',
            }}
          />

          {isValid && (
            <div className="tabular-nums" style={{ fontSize: '0.76rem', color: '#6b7280' }}>
              +{normalized}
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: '8px 10px', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', fontSize: '0.82rem' }}>
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {target.publicReceiptData ? (
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloadingPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                minHeight: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#111827',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: downloadingPdf ? 'wait' : 'pointer',
              }}
            >
              <FileDown size={14} aria-hidden="true" />
              <span>{downloadingPdf ? 'Generando…' : 'PDF'}</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={saving || !isValid}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              minHeight: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: saving || !isValid ? 'not-allowed' : 'pointer',
              opacity: saving || !isValid ? 0.55 : 1,
            }}
          >
            <Send size={14} aria-hidden="true" />
            <span>
              {saving ? 'Guardando…' : isAlreadyVerified ? 'Enviar WhatsApp' : 'Guardar y Enviar'}
            </span>
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
