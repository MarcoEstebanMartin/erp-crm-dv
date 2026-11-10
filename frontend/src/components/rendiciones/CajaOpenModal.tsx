import React from 'react';

interface CajaOpenModalProps {
  open: boolean;
  amountInput: string;
  onAmountChange: (val: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function CajaOpenModal({
  open,
  amountInput,
  onAmountChange,
  onClose,
  onSubmit
}: CajaOpenModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>Apertura de Caja Depósito</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label>Efectivo Inicial en Caja ($)</label>
            <input
              type="number"
              className="input"
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
          <div className="modal-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}>
              Abrir Caja
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
