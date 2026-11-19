import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import type { Product } from '../../types';
import { KNOWN_WMS_LOCATION_SET, WMS_LOCATION_GROUPS } from './depositoHelpers';
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
    <NativeModalDialog
      isOpen={Boolean(stockModal.open && stockModal.product)}
      onClose={handleClose}
      ariaLabelledBy="deposito-stock-adjust-title"
      style={{ maxWidth: '480px', width: '94vw', padding: '24px' }}
    >
      <div>
        <div className="modal-header">
          <h3 id="deposito-stock-adjust-title" style={{ margin: 0 }}>Ajustar Stock</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={handleClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
            <p>
              <strong>{stockModal.product.name}</strong>
            </p>
            <p style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
              SKU: {stockModal.product.sku}
            </p>
            <p className="tabular-nums">
              <strong>Stock actual:</strong> {stockModal.product.stock} u.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="deposito-adjust-qty">Cantidad (+ / -)</label>
            <input
              id="deposito-adjust-qty"
              type="number"
              className="input tabular-nums"
              placeholder="+50 / -20"
              value={stockModal.quantityChange || ''}
              onChange={(e) =>
                setStockModal({ ...stockModal, quantityChange: Number(e.target.value) })
              }
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="deposito-adjust-lot">Lote</label>
            <select
              id="deposito-adjust-lot"
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
              <option value="">Sin lote</option>
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

          {(stockModal.lotNumber || stockModal.isNewLot) && (() => {
            const normalizedLoc = (stockModal.location || '').trim().toUpperCase();
            const isStandardLoc = normalizedLoc === '' || normalizedLoc === 'S/U' || KNOWN_WMS_LOCATION_SET.has(normalizedLoc);
            const selectVal = normalizedLoc === '' || normalizedLoc === 'S/U'
              ? 'S/U'
              : KNOWN_WMS_LOCATION_SET.has(normalizedLoc)
                ? normalizedLoc
                : '__custom__';
            return (
              <div className="form-group">
                <label htmlFor="deposito-adjust-location">Ubicación</label>
                <select
                  id="deposito-adjust-location"
                  className="select"
                  value={selectVal}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setStockModal({ ...stockModal, location: isStandardLoc ? '' : normalizedLoc });
                    } else {
                      setStockModal({ ...stockModal, location: val });
                    }
                  }}
                >
                  <option value="S/U">Sin Ubicación (S/U)</option>
                  {WMS_LOCATION_GROUPS.map((group) => (
                    <optgroup key={group.chamber} label={group.label}>
                      {group.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">Otra / Personalizada...</option>
                </select>

                {selectVal === '__custom__' && (
                  <input
                    id="deposito-adjust-custom-location"
                    type="text"
                    className="input"
                    aria-label="Ubicación personalizada"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    style={{ marginTop: '8px' }}
                    placeholder="Código de ubicación"
                    value={stockModal.location || ''}
                    onChange={(e) => setStockModal({ ...stockModal, location: e.target.value })}
                  />
                )}
              </div>
            );
          })()}

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
                <label htmlFor="deposito-adjust-new-lot">Nuevo Lote</label>
                <input
                  id="deposito-adjust-new-lot"
                  type="text"
                  className="input"
                  placeholder="L-VENC-01"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={stockModal.lotNumber}
                  onChange={(e) => setStockModal({ ...stockModal, lotNumber: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="deposito-adjust-new-exp">Vencimiento</label>
                <input
                  id="deposito-adjust-new-exp"
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
            <label htmlFor="deposito-adjust-reason">Motivo</label>
            <select
              id="deposito-adjust-reason"
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
              {loading ? 'Ajustando...' : 'Aplicar'}
            </button>
          </div>
        </form>
      </div>
    </NativeModalDialog>
  );
};
