import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Product, ProductLot } from '../../types';
import type { DepositSlot } from './depositomapaData';
import { computeProductWmsBreakdown } from './wmsStockBreakdown';
import { extractCleanLotNumber, formatCleanExpirationDate } from '../stock/lotLabel';
import { computeLevelMixWarning, type RackLevel } from './wmsMapHelpers';

interface Slot3DLoadStockFormProps {
  slot: DepositSlot;
  activeLevel: RackLevel;
  products: Product[];
  filteredProducts: Product[];
  selectedProduct: Product | undefined;
  selectedProductId: number | '';
  setSelectedProductId: (id: number | '') => void;
  productSearch: string;
  setProductSearch: (q: string) => void;
  sourceLotId: number | '';
  setSourceLotId: (id: number | '') => void;
  lotNumber: string;
  setLotNumber: (lot: string) => void;
  isNewLot: boolean;
  setIsNewLot: (v: boolean) => void;
  expirationDate: string;
  setExpirationDate: (d: string) => void;
  quantity: number | '';
  setQuantity: (q: number | '') => void;
  reason: string;
  setReason: (r: string) => void;
  existingLevelItems: { product: Product; lot: ProductLot }[];
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const Slot3DLoadStockForm: React.FC<Slot3DLoadStockFormProps> = ({
  slot, activeLevel, products, filteredProducts, selectedProduct, selectedProductId, setSelectedProductId,
  productSearch, setProductSearch, sourceLotId, setSourceLotId, lotNumber, setLotNumber, isNewLot, setIsNewLot,
  expirationDate, setExpirationDate, quantity, setQuantity, reason, setReason, existingLevelItems, loading,
  onSubmit, onCancel,
}) => {
  const [mixConfirmed, setMixConfirmed] = useState(false);

  const wms = selectedProduct ? computeProductWmsBreakdown(selectedProduct) : null;
  const activeLots = (selectedProduct?.lots || []).filter((l) => l.stock > 0);
  const chosenSourceLot = activeLots.find((l) => l.id === Number(sourceLotId));
  const physicalUnits = wms ? wms.totalUnits : 0;
  const availableUnits = selectedProduct ? Math.max(0, Number(selectedProduct.stock || 0)) : 0;
  const reservedUnits = Math.max(0, physicalUnits - availableUnits);
  const maxRelocatable = chosenSourceLot ? chosenSourceLot.stock : physicalUnits;

  const autoFefoCandidate =
    !chosenSourceLot && !isNewLot
      ? activeLots.find((l) => !l.location || l.location === 'S/U') || activeLots[0]
      : undefined;

  const mixWarning = computeLevelMixWarning(existingLevelItems, {
    productId: selectedProductId,
    lotNumber: isNewLot
      ? lotNumber
      : chosenSourceLot?.lotNumber || autoFefoCandidate?.lotNumber || lotNumber,
    expirationDate: isNewLot
      ? expirationDate || null
      : chosenSourceLot?.expirationDate || autoFefoCandidate?.expirationDate || null,
  });

  useEffect(() => {
    setMixConfirmed(false);
  }, [selectedProductId, activeLevel, sourceLotId, isNewLot, expirationDate, lotNumber]);

  const quickFillUnits = chosenSourceLot ? chosenSourceLot.stock : wms ? wms.unassignedUnits : 0;

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0', borderRadius: '12px', padding: '15px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A' }}>
          Ubicar en Nivel {activeLevel}
        </h4>
        <span className="badge" style={{ backgroundColor: '#E2E8F0', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>
          {slot.code}-{activeLevel}
        </span>
      </div>

      <div>
        <label htmlFor="slot-load-product" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
          Producto
        </label>

        {selectedProduct && wms ? (
          <div style={{ padding: '10px 12px', backgroundColor: '#F0F9FF', border: '1.5px solid #007AFF', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, color: '#007AFF', backgroundColor: '#E0F2FE', padding: '2px 7px', borderRadius: '5px', fontSize: '0.76rem' }}>
                  {selectedProduct.sku}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>{selectedProduct.name}</span>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedProductId(''); setProductSearch(''); setSourceLotId(''); setQuantity(''); }}
                style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '3px 9px', cursor: 'pointer' }}
              >
                Cambiar
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '0.72rem' }}>
              <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', fontVariantNumeric: 'tabular-nums' }}>
                Sin Ubicar (S/U): {wms.unassignedUnits} u.
              </span>
              <span style={{ backgroundColor: '#E2E8F0', color: '#334155', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', fontVariantNumeric: 'tabular-nums' }}>
                En Mapa: {wms.locatedUnits} u.
              </span>
              <span style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', fontVariantNumeric: 'tabular-nums' }}>
                Físico: {physicalUnits} u.
              </span>
              {reservedUnits > 0 && (
                <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', fontVariantNumeric: 'tabular-nums' }}>
                  Reservado: {reservedUnits} u. · Disponible: {availableUnits} u.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="search" className="form-control" aria-label="Buscar producto o SKU" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Buscar nombre o SKU"
              value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
              style={{ height: '36px', fontSize: '0.83rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', paddingLeft: '12px' }}
            />
            <select
              id="slot-load-product"
              className="form-control" value={selectedProductId}
              onChange={(e) => {
                const nextId = e.target.value ? Number(e.target.value) : '';
                setSelectedProductId(nextId);
                setSourceLotId('');
              }}
              style={{ height: '36px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
            >
              <option value="">-- Seleccionar producto del depósito --</option>
              {(filteredProducts.length > 0 ? filteredProducts : products || [])
                .filter((p) => computeProductWmsBreakdown(p).totalUnits > 0)
                .map((p) => {
                  const b = computeProductWmsBreakdown(p);
                  return (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} — S/U: {b.unassignedUnits} u. (Físico: {b.totalUnits} u.)
                    </option>
                  );
                })}
            </select>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label htmlFor="slot-load-source-lot" style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', margin: 0 }}>Lote de Origen</label>
          <label style={{ fontSize: '0.73rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#64748B', fontWeight: 600 }}>
            <input type="checkbox" checked={isNewLot} onChange={(e) => { setIsNewLot(e.target.checked); if (e.target.checked) setSourceLotId(''); }} />
            <span>Renombrar código de lote</span>
          </label>
        </div>

        {selectedProduct && activeLots.length > 0 && !isNewLot ? (
          <select
            id="slot-load-source-lot"
            className="form-control"
            value={sourceLotId}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : '';
              setSourceLotId(id);
              const found = activeLots.find((l) => l.id === id);
              setLotNumber(found ? extractCleanLotNumber(found.lotNumber) : '');
            }}
            style={{ height: '35px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
          >
            <option value="">Automático FEFO (prioriza Sin Ubicar S/U)</option>
            {activeLots.map((l) => (
              <option key={l.id} value={l.id}>
                Lote {extractCleanLotNumber(l.lotNumber)} ({l.location || 'S/U'}) — {l.stock} u. | Venc: {formatCleanExpirationDate(l.expirationDate)}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="slot-load-source-lot"
            type="text" className="form-control" autoCorrect="off" autoCapitalize="none" spellCheck={false} placeholder="Código de lote (opcional)" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
            style={{ height: '35px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
          />
        )}

        {isNewLot && (
          <div style={{ marginTop: '8px' }}>
            <label htmlFor="slot-load-exp" style={{ display: 'block', fontSize: '0.73rem', color: '#64748B', marginBottom: '3px', fontWeight: 600 }}>Vencimiento (Opcional)</label>
            <input
              id="slot-load-exp"
              type="date" className="form-control" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
              style={{ height: '34px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
        <div style={{ width: '165px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label htmlFor="slot-load-qty" style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>Cantidad (u.)</label>
            {quickFillUnits > 0 && (
              <button
                type="button"
                onClick={() => setQuantity(quickFillUnits)}
                style={{ fontSize: '0.68rem', fontWeight: 700, color: '#007AFF', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}
              >
                Usar {quickFillUnits} u.
              </button>
            )}
          </div>
          <input
            id="slot-load-qty"
            type="number" min="1" max={maxRelocatable > 0 ? maxRelocatable : undefined} step="1"
            className="form-control" placeholder="Cant." value={quantity}
            onChange={(e) => setQuantity(e.target.value ? Math.trunc(Number(e.target.value)) : '')}
            style={{ height: '36px', fontSize: '0.88rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor="slot-load-reason" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>Observación</label>
          <input
            id="slot-load-reason"
            type="text" className="form-control" placeholder="Observación" value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ height: '36px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {mixWarning && (
        <div
          role="status"
          style={{
            backgroundColor: '#fffbeb',
            border: '1.5px solid #f59e0b',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '0.77rem',
            color: '#92400e',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontWeight: 700 }}>
            <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{mixWarning.message}</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={mixConfirmed}
              onChange={(e) => setMixConfirmed(e.target.checked)}
            />
            <span>Confirmo ubicar junto a la mercadería existente</span>
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || (selectedProduct ? maxRelocatable <= 0 : false) || Boolean(mixWarning && !mixConfirmed)}
          style={{ flex: 1, height: '38px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px', backgroundColor: '#0F172A', borderColor: '#0F172A', color: '#FFFFFF' }}
        >
          {loading ? 'Ubicando...' : `Ubicar en Nivel ${activeLevel}`}
        </button>
        <button
          type="button" className="btn btn-secondary" onClick={onCancel}
          style={{ height: '38px', fontSize: '0.82rem', fontWeight: 600, borderRadius: '8px', padding: '0 14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#64748B' }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};
