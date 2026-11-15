import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface CajaOpenModalProps {
  open: boolean;
  amountInput: string;
  onAmountChange: (val: string) => void;
  errorMsg?: string | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CajaOpenModal({
  open,
  amountInput,
  onAmountChange,
  errorMsg,
  onClose,
  onSubmit,
}: CajaOpenModalProps) {
  return (
    <NativeModalDialog
      isOpen={open}
      onClose={onClose}
      ariaLabelledBy="caja-open-title"
      style={{ maxWidth: '400px', width: '92vw', padding: '24px' }}
    >
      <div className="modal-header" style={{ marginBottom: '16px' }}>
        <h3 id="caja-open-title" style={{ margin: 0 }}>Apertura de Caja Depósito</h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {errorMsg && (
        <div role="alert" style={{ padding: '10px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label htmlFor="caja-open-amount">Efectivo Inicial ($)</label>
          <input
            id="caja-open-amount"
            type="number"
            className="input tabular-nums"
            autoFocus
            required
            step="0.01"
            min="0"
            value={amountInput}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}
          />
        </div>
        <div className="modal-footer" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
            Abrir Caja
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
}
