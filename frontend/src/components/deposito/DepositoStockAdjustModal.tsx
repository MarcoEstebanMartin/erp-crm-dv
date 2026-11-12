import React from 'react';
import type { Product } from '../../types';
import { LOCATION_MAP } from './depositoHelpers';
import { extractCleanLotNumber, formatCleanExpirationDate } from '../stock/lotLabel';

export interface StockAdjustModalState {
  open: boolean;
  product: Product | null;
  quantityChange: number;
  reason: string;
  lotNumber: string;
  isNewLot: boolean;
  expirationDate: string;
  location: string;
}

interface DepositoStockAdjustModalProps {
  stockModal: StockAdjustModalState;
  setStockModal: React.Dispatch<React.SetStateAction<StockAdjustModalState>>;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const DepositoStockAdjustModal: React.FC<DepositoStockAdjustModalProps> = ({
  stockModal,
  setStockModal,
  loading,
  onSubmit,
}) => {
  if (!stockModal.open || !stockModal.product) return null;

  const handleClose = () =>
    setStockModal({
      open: false,
      product: null,
      quantityChange: 0,
      reason: '',
      lotNumber: '',
      isNewLot: false,
      expirationDate: '',
      location: '',
    });

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Ajustar Stock Físico</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={handleClose}>
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
            <p>
              <strong>Artículo:</strong> {stockModal.product.name}
            </p>
            <p>
              <strong>SKU:</strong> {stockModal.product.sku}
            </p>
            <p>
              <strong>Stock actual total:</strong> {stockModal.product.stock} u.
            </p>
          </div>

          <div className="form-group">
            <label>Cantidad a Sumar o Restar</label>
            <input
              type="number"
              className="input"
              placeholder="Ej: 50 para sumar, -20 para restar"
              value={stockModal.quantityChange || ''}
              onChange={(e) =>
                setStockModal({ ...stockModal, quantityChange: Number(e.target.value) })
              }
              required
            />
          </div>

          <div className="form-group">
            <label>Lote Asociado</label>
            <select
              className="select"
              value={stockModal.isNewLot ? '__new__' : stockModal.lotNumber}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__new__') {
                  setStockModal({
                    ...stockModal,
                    isNewLot: true,
                    lotNumber: '',
                    expirationDate: '',
                    location: '',
                  });
                } else {
                  const lot = (stockModal.product?.lots || []).find(
                    (l: any) => l.lotNumber === val,
                  );
                  setStockModal({
                    ...stockModal,
                    isNewLot: false,
                    lotNumber: val,
                    expirationDate: '',
                    location: lot ? lot.location || '' : '',
                  });
                }
              }}
            >
              <option value="">Sin lote (Stock Genérico / General)</option>
              {(stockModal.product?.lots || []).map((lot: any) => (
                <option key={lot.id} value={lot.lotNumber}>
                  Lote: {extractCleanLotNumber(lot.lotNumber)} ({lot.location || 'S/U'} · Stock: {lot.stock} u. ·{' '}
                  {formatCleanExpirationDate(lot.expirationDate)})
                </option>
              ))}
              {Number(stockModal.quantityChange) > 0 && (
                <option value="__new__">+ Crear nuevo lote...</option>
              )}
            </select>
          </div>

          {(stockModal.lotNumber || stockModal.isNewLot) && (
            <div className="form-group">
              <label>Ubicación Física Estandarizada</label>
              <select
                className="select"
                value={
                  Object.keys(LOCATION_MAP).includes(stockModal.location)
                    ? stockModal.location
                    : stockModal.location && stockModal.location !== 'S/U'
                      ? '__custom__'
                      : 'S/U'
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__custom__') {
                    setStockModal({ ...stockModal, location: '' });
                  } else {
                    setStockModal({ ...stockModal, location: val });
                  }
                }}
              >
                {Object.entries(LOCATION_MAP).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.label}
                  </option>
                ))}
                <option value="__custom__">✍️ Personalizada / Otra...</option>
              </select>

              {(!Object.keys(LOCATION_MAP).includes(stockModal.location) ||
                stockModal.location === '') && (
                <input
                  type="text"
                  className="input"
                  style={{ marginTop: '8px' }}
                  placeholder="Escribir ubicación personalizada..."
                  value={stockModal.location || ''}
                  onChange={(e) => setStockModal({ ...stockModal, location: e.target.value })}
                />
              )}
            </div>
          )}

          {stockModal.isNewLot && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nro de Lote Nuevo</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ej: L-VENC-01"
                  value={stockModal.lotNumber}
                  onChange={(e) => setStockModal({ ...stockModal, lotNumber: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Fecha de Vencimiento</label>
                <input
                  type="date"
                  className="input"
                  value={stockModal.expirationDate}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, expirationDate: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Motivo del Ajuste de Stock</label>
            <select
              className="select"
              value={stockModal.reason}
              onChange={(e) => setStockModal({ ...stockModal, reason: e.target.value })}
              required
            >
              <option value="">Seleccionar motivo...</option>
              <option value="Ingreso de mercadería por compras">
                Ingreso de mercadería por compras
              </option>
              <option value="Ajuste por inventario físico mensual">
                Ajuste por inventario físico mensual
              </option>
              <option value="Rotura / Vencimiento de lote">Rotura / Vencimiento de lote</option>
              <option value="Devolución de cliente">Devolución de cliente</option>
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Ajustando...' : 'Aplicar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
