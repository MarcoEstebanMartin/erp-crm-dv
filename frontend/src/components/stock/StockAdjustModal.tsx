import React from 'react';
import { X } from 'lucide-react';
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
    <div className="modal-overlay">
      <div className="modal-content" style={{ borderRadius: '12px', padding: '24px', maxWidth: '450px' }}>
        <div className="modal-header" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Ajustar Stock Físico</h3>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
            onClick={onClose}
          >
            <X size={16} />
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
              <strong>Artículo:</strong> {modal.product.name}
            </div>
            <div style={{ marginBottom: '4px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              SKU: {modal.product.sku}
            </div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>
              <strong>Stock actual en depósito:</strong>{' '}
              <span style={{ fontWeight: 700 }}>{modal.product.stock} u.</span>
            </div>
          </div>

          <div className="form-group">
            <label>Cantidad a Sumar o Restar</label>
            <input
              type="number"
              className="input"
              placeholder="Ej: 24 para ingresar, -12 para egresar"
              value={modal.quantityChange || ''}
              onChange={(e) => onChange({ ...modal, quantityChange: Number(e.target.value) })}
              required
              style={{ borderRadius: '8px' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Use valores positivos para entradas de stock y negativos para salidas.
            </span>
          </div>

          <div className="form-group">
            <label>Lote del Producto</label>
            <select
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
              <option value="">Sin lote (Stock Genérico / General)</option>
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
                <label>Código Lote</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: L-2026-01"
                  value={modal.lotNumber}
                  onChange={(e) => onChange({ ...modal, lotNumber: e.target.value })}
                  required
                  style={{ borderRadius: '8px' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Fecha Vencimiento</label>
                <input
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
            <label>Detalle / Motivo del Ajuste</label>
            <select
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
              {loading ? 'Procesando...' : 'Aplicar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
