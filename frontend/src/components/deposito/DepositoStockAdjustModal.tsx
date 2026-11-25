import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import type { Product } from '../../types';
import { KNOWN_WMS_LOCATION_SET, WMS_LOCATION_GROUPS } from './depositoHelpers';
import { extractCleanLotNumber, formatCleanExpirationDate } from '../stock/lotLabel';
import {
  computeStockAdjustDelta,
  getDefaultReasonForMode,
  type StockAdjustMode,
} from './stockFilterHelpers';

export interface StockAdjustModalState {
  open: boolean;
  product: Product | null;
  quantityChange: number;
  reason: string;
  lotId?: number | null;
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

const REASON_PRESETS = [
  { label: 'Compra', value: 'Ingreso de mercadería por compras' },
  { label: 'Conteo físico', value: 'Ajuste por inventario físico mensual' },
  { label: 'Rotura / Vto', value: 'Rotura / Vencimiento de lote' },
  { label: 'Devolución', value: 'Devolución de cliente' },
];

export const DepositoStockAdjustModal: React.FC<DepositoStockAdjustModalProps> = ({
  stockModal,
  setStockModal,
  loading,
  onSubmit,
}) => {
  const [mode, setMode] = useState<StockAdjustMode>('ADD');
  const [amountInput, setAmountInput] = useState<string>('');

  const productId = stockModal.product?.id ?? null;
  const currentStock = Number(stockModal.product?.stock ?? 0);

  useEffect(() => {
    if (!stockModal.open || !stockModal.product) return;
    setMode('ADD');
    setAmountInput('');
    setStockModal((prev) => ({
      ...prev,
      quantityChange: 0,
      reason: prev.reason || getDefaultReasonForMode('ADD'),
    }));
  }, [stockModal.open, productId, setStockModal]);

  if (!stockModal.open || !stockModal.product) return null;

  const parsedInput = amountInput.trim() === '' ? NaN : Number(amountInput);
  const delta = Number.isFinite(parsedInput)
    ? computeStockAdjustDelta(mode, parsedInput, currentStock)
    : 0;
  const resultingStock = currentStock + delta;

  const syncModeAndAmount = (nextMode: StockAdjustMode, nextAmount: string) => {
    setMode(nextMode);
    setAmountInput(nextAmount);
    const num = nextAmount.trim() === '' ? NaN : Number(nextAmount);
    const nextDelta = Number.isFinite(num) ? computeStockAdjustDelta(nextMode, num, currentStock) : 0;
    setStockModal((prev) => ({
      ...prev,
      quantityChange: nextDelta,
      reason: getDefaultReasonForMode(nextMode),
      isNewLot: nextDelta > 0 ? prev.isNewLot : false,
    }));
  };

  const handleClose = () =>
    setStockModal({
      open: false, product: null, quantityChange: 0, reason: '',
      lotId: null, lotNumber: '', isNewLot: false, expirationDate: '', location: '',
    });

  const normalizedLoc = (stockModal.location || '').trim().toUpperCase();
  const isStandardLoc = normalizedLoc === '' || normalizedLoc === 'S/U' || KNOWN_WMS_LOCATION_SET.has(normalizedLoc);
  const selectLocVal = normalizedLoc === '' || normalizedLoc === 'S/U'
    ? 'S/U'
    : KNOWN_WMS_LOCATION_SET.has(normalizedLoc) ? normalizedLoc : '__custom__';

  return (
    <NativeModalDialog
      isOpen={Boolean(stockModal.open && stockModal.product)}
      onClose={handleClose}
      ariaLabelledBy="deposito-stock-adjust-title"
      style={{ maxWidth: '460px', width: '94vw', padding: '22px' }}
    >
      <div>
        <div className="modal-header">
          <h3 id="deposito-stock-adjust-title" style={{ margin: 0 }}>Ajustar stock</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={handleClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>{stockModal.product.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontFamily: 'monospace' }}>{stockModal.product.sku}</span>
              <span className="tabular-nums">Actual: <strong>{currentStock} u.</strong></span>
            </div>
          </div>

          <div role="group" aria-label="Tipo de ajuste" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '14px' }}>
            {([
              { id: 'ADD', label: 'Ingresar' },
              { id: 'SUBTRACT', label: 'Retirar' },
              { id: 'COUNT', label: 'Contar real' },
            ] as const).map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={mode === opt.id}
                className={`dep-chip ${mode === opt.id ? 'dep-chip--active' : ''}`}
                style={{ justifyContent: 'center', borderRadius: '8px', minBlockSize: '40px' }}
                onClick={() => syncModeAndAmount(opt.id, opt.id === 'COUNT' ? String(currentStock) : '')}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="deposito-adjust-qty">
              {mode === 'ADD' ? 'Unidades a ingresar' : mode === 'SUBTRACT' ? 'Unidades a retirar' : 'Stock contado real'}
            </label>
            <input
              id="deposito-adjust-qty"
              type="number"
              inputMode="numeric"
              min={0}
              className="input tabular-nums"
              style={{ minBlockSize: '44px', fontSize: '1.05rem', fontWeight: 700 }}
              placeholder={mode === 'COUNT' ? String(currentStock) : '0'}
              value={amountInput}
              onChange={(e) => syncModeAndAmount(mode, e.target.value)}
              required
            />
            {delta !== 0 && (
              <div className="tabular-nums" style={{ marginTop: '6px', fontSize: '0.82rem', fontWeight: 600, color: delta > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {currentStock} u. → {resultingStock} u. ({delta > 0 ? `+${delta}` : delta} u.)
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="deposito-adjust-lot">Lote</label>
            <select
              id="deposito-adjust-lot"
              className="select"
              value={stockModal.isNewLot ? '__new__' : stockModal.lotId ? String(stockModal.lotId) : ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__new__') {
                  setStockModal({ ...stockModal, isNewLot: true, lotId: null, lotNumber: '', expirationDate: '', location: '' });
                } else if (!val) {
                  setStockModal({ ...stockModal, isNewLot: false, lotId: null, lotNumber: '', expirationDate: '', location: '' });
                } else {
                  const lot = (stockModal.product?.lots || []).find((l: any) => l.id === Number(val));
                  setStockModal({
                    ...stockModal, isNewLot: false, lotId: lot ? lot.id : Number(val),
                    lotNumber: lot ? lot.lotNumber : '', expirationDate: '', location: lot ? lot.location || 'S/U' : '',
                  });
                }
              }}
            >
              <option value="">Sin lote específico</option>
              {(stockModal.product?.lots || []).map((lot: any) => (
                <option key={lot.id} value={String(lot.id)}>
                  {extractCleanLotNumber(lot.lotNumber)} ({lot.location || 'S/U'} · {lot.stock} u. · {formatCleanExpirationDate(lot.expirationDate)})
                </option>
              ))}
              {delta > 0 && <option value="__new__">+ Crear nuevo lote...</option>}
            </select>
          </div>

          {(stockModal.lotNumber || stockModal.isNewLot) && (
            <div className="form-group">
              <label htmlFor="deposito-adjust-location">Ubicación</label>
              <select
                id="deposito-adjust-location"
                className="select"
                value={selectLocVal}
                onChange={(e) => {
                  const val = e.target.value;
                  setStockModal({ ...stockModal, location: val === '__custom__' ? (isStandardLoc ? '' : normalizedLoc) : val });
                }}
              >
                <option value="S/U">Sin ubicación (S/U)</option>
                {WMS_LOCATION_GROUPS.map((group) => (
                  <optgroup key={group.chamber} label={group.label}>
                    {group.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
                <option value="__custom__">Otra...</option>
              </select>
              {selectLocVal === '__custom__' && (
                <input
                  id="deposito-adjust-custom-location"
                  type="text"
                  className="input"
                  aria-label="Ubicación personalizada"
                  style={{ marginTop: '8px' }}
                  placeholder="Código de ubicación"
                  value={stockModal.location || ''}
                  onChange={(e) => setStockModal({ ...stockModal, location: e.target.value })}
                />
              )}
            </div>
          )}

          {stockModal.isNewLot && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="deposito-adjust-new-lot">Nuevo lote</label>
                <input
                  id="deposito-adjust-new-lot"
                  type="text"
                  className="input"
                  placeholder="L-01"
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
                  onChange={(e) => setStockModal({ ...stockModal, expirationDate: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Motivo</label>
            <div className="dep-chips-row">
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`dep-chip ${stockModal.reason === preset.value ? 'dep-chip--active' : ''}`}
                  style={{ minBlockSize: '34px', fontSize: '0.76rem', padding: '4px 10px' }}
                  onClick={() => setStockModal({ ...stockModal, reason: preset.value })}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || delta === 0}>
              {loading ? 'Aplicando...' : 'Aplicar'}
            </button>
          </div>
        </form>
      </div>
    </NativeModalDialog>
  );
};
