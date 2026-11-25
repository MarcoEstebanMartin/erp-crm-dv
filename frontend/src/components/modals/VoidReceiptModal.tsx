import React, { useEffect, useState } from 'react';
import { Ban, X } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';

const QUICK_REASONS = [
  'Importe erróneo',
  'Cliente equivocado',
  'Medio de pago incorrecto',
  'Cobro duplicado',
];

export interface VoidReceiptModalProps {
  isOpen: boolean;
  receiptLabel: string;
  clientName: string;
  amount: number;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const VoidReceiptModal: React.FC<VoidReceiptModalProps> = ({
  isOpen,
  receiptLabel,
  clientName,
  amount,
  submitting = false,
  error = null,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTouched(false);
    }
  }, [isOpen, receiptLabel]);

  const trimmed = reason.trim();
  const isInvalid = trimmed.length < 5;
  const showValidationError = touched && isInvalid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (isInvalid || submitting) return;
    await onConfirm(trimmed);
  };

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={submitting ? () => {} : onClose}
      ariaLabelledBy="void-receipt-title"
      style={{ maxWidth: '440px', width: '92vw', padding: '20px', borderRadius: '12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 id="void-receipt-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Anular {receiptLabel}
        </h3>
        <button
          type="button"
          className="btn btn-ghost"
          aria-label="Cerrar"
          disabled={submitting}
          onClick={onClose}
          style={{ padding: '4px' }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          marginBottom: '14px',
          fontSize: '0.84rem',
        }}
      >
        <span style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {clientName}
        </span>
        <strong className="tabular-nums" style={{ color: '#111827', flexShrink: 0 }}>
          ${Math.round(Number(amount || 0)).toLocaleString('es-AR')}
        </strong>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {QUICK_REASONS.map((preset) => {
            const active = trimmed === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setReason(preset);
                  setTouched(true);
                }}
                style={{
                  padding: '4px 9px',
                  borderRadius: '999px',
                  border: active ? '1px solid #111827' : '1px solid #e5e7eb',
                  background: active ? '#111827' : '#fff',
                  color: active ? '#fff' : '#374151',
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {preset}
              </button>
            );
          })}
        </div>

        <label
          htmlFor="void-receipt-reason"
          style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}
        >
          Motivo
        </label>
        <textarea
          id="void-receipt-reason"
          rows={2}
          maxLength={300}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={showValidationError}
          aria-describedby={showValidationError || error ? 'void-receipt-error' : undefined}
          placeholder="Ej.: Error de importe al cargar"
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: '8px',
            border: `1px solid ${showValidationError || error ? '#E30613' : '#d1d5db'}`,
            fontSize: '0.86rem',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />

        {(showValidationError || error) && (
          <div
            id="void-receipt-error"
            role="alert"
            style={{ marginTop: '6px', fontSize: '0.78rem', color: '#E30613', fontWeight: 500 }}
          >
            {error || 'Ingresá un motivo de al menos 5 caracteres.'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={submitting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#E30613',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            <Ban size={14} aria-hidden="true" />
            {submitting ? 'Anulando…' : 'Anular recibo'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
