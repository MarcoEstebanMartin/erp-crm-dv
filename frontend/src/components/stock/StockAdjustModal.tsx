import React from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import type { AdjustModalState } from './types';
import {
  extractCleanLotNumber,
  formatCleanExpirationDate,
  isSentinelExpiration
} from './lotLabel';

interface StockAdjustModalProps {
  modal: AdjustModalState;
  loading: boolean;
  onChange: (next: AdjustModalState) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function StockAdjustModal({
  modal,
  loading,
  onChange,
  onClose,
  onSubmit
}: StockAdjustModalProps) {
  if (!modal.open || !modal.product) return null;

  return (
    <NativeModalDialog
      isOpen={Boolean(modal.open && modal.product)}
      onClose={onClose}
      ariaLabelledBy="stock-adjust-modal-title"
      style={{ borderRadius: '12px', padding: '24px', maxWidth: '450px', width: '94vw' }}
    >
      <div>
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h3 id="stock-adjust-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Ajustar Stock</h3>
          <button
            type="button"
            className="btn btn-ghost"
            aria-label="Cerrar"
            style={{ padding: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div
            style={{
              backgroundColor: 'var(--bg-app)',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '0.84rem',
              marginBottom: '16px',
              border: '1px solid var(--border-color)'
            }}
          >
            <div style={{ marginBottom: '4px' }}>
              <strong>{modal.product.name}</strong>
            </div>
            <div style={{ marginBottom: '4px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              SKU: {modal.product.sku}
            </div>
            <div className="tabular-nums">
              <strong>Stock actual:</strong>{' '}
              <span style={{ fontWeight: 700 }}>{modal.product.stock} u.</span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="stock-adjust-qty">Cantidad (+ / -)</label>
            <input
              id="stock-adjust-qty"
              type="number"
              className="input tabular-nums"
              placeholder="+24 / -12"
              value={modal.quantityChange || ''}
              onChange={(e) => onChange({ ...modal, quantityChange: Number(e.target.value) })}
              required
              style={{ borderRadius: '8px' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="stock-adjust-lot">Lote</label>
            <select
              id="stock-adjust-lot"
              className="select"
              value={modal.isNewLot ? '__new__' : modal.lotNumber}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__new__') {
                  onChange({ ...modal, isNewLot: true, lotNumber: '', expirationDate: '' });
                } else {
                  onChange({ ...modal, isNewLot: false, lotNumber: val, expirationDate: '' });
                }
              }}
              style={{ borderRadius: '8px' }}
            >
              <option value="">Sin lote</option>
              {(modal.product.lots || []).map((lot: any) => {
                const cleanLot = extractCleanLotNumber(lot.lotNumber);
                const locLabel = lot.location && lot.location !== 'S/U' ? ` · ${lot.location}` : '';
                const expLabel = isSentinelExpiration(lot.expirationDate)
                  ? 'Sin vencimiento'
                  : `Vence: ${formatCleanExpirationDate(lot.expirationDate)}`;
                return (
                  <option key={lot.id} value={lot.lotNumber}>
                    Lote: {cleanLot}
                    {locLabel} ({lot.stock} u. · {expLabel})
                  </option>
                );
              })}
              {Number(modal.quantityChange) > 0 && (
                <option value="__new__">+ Registrar nuevo lote...</option>
              )}
            </select>
          </div>

          {modal.isNewLot && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', animation: 'fadeIn 0.2s ease-out' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="stock-adjust-new-lot">Código Lote</label>
                <input
                  id="stock-adjust-new-lot"
                  type="text"
                  className="input"
                  placeholder="L-2026-01"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={modal.lotNumber}
                  onChange={(e) => onChange({ ...modal, lotNumber: e.target.value })}
                  required
                  style={{ borderRadius: '8px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="stock-adjust-new-exp">Vencimiento</label>
                <input
                  id="stock-adjust-new-exp"
                  type="date"
                  className="input"
                  value={modal.expirationDate}
                  onChange={(e) => onChange({ ...modal, expirationDate: e.target.value })}
                  required
                  style={{ borderRadius: '8px' }}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="stock-adjust-reason">Motivo</label>
            <select
              id="stock-adjust-reason"
              className="select"
              value={modal.reason}
              onChange={(e) => onChange({ ...modal, reason: e.target.value })}
              required
              style={{ borderRadius: '8px' }}
            >
              <option value="">Seleccione un motivo...</option>
              <option value="Ingreso de mercadería por compras">Ingreso de mercadería por compras</option>
              <option value="Ajuste por inventario físico mensual">Ajuste por inventario físico mensual</option>
              <option value="Rotura / Envase dañado en depósito">Rotura / Envase dañado en depósito</option>
              <option value="Vencimiento de mercadería">Vencimiento de mercadería</option>
              <option value="Devolución de cliente">Devolución de cliente</option>
              <option value="Ajuste manual administrativo">Ajuste manual administrativo</option>
            </select>
          </div>

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ borderRadius: '8px' }}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ borderRadius: '8px' }}>
              {loading ? 'Procesando...' : 'Aplicar'}
            </button>
          </div>
        </form>
      </div>
    </NativeModalDialog>
  );
}
