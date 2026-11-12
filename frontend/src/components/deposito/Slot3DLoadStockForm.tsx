import React from 'react';
import type { Product } from '../../types';
import type { DepositSlot } from './depositomapaData';
import { computeProductWmsBreakdown } from './wmsStockBreakdown';
import { extractCleanLotNumber, formatCleanExpirationDate } from '../stock/lotLabel';

interface Slot3DLoadStockFormProps {
  slot: DepositSlot;
  activeLevel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
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
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const Slot3DLoadStockForm: React.FC<Slot3DLoadStockFormProps> = ({
  slot, activeLevel, products, filteredProducts, selectedProduct, selectedProductId, setSelectedProductId,
  productSearch, setProductSearch, sourceLotId, setSourceLotId, lotNumber, setLotNumber, isNewLot, setIsNewLot,
  expirationDate, setExpirationDate, quantity, setQuantity, reason, setReason, loading, onSubmit, onCancel,
}) => {
  const wms = selectedProduct ? computeProductWmsBreakdown(selectedProduct) : null;
  const activeLots = (selectedProduct?.lots || []).filter((l) => l.stock > 0);
  const chosenSourceLot = activeLots.find((l) => l.id === Number(sourceLotId));
  const maxRelocatable = chosenSourceLot ? chosenSourceLot.stock : wms ? wms.totalUnits : 0;

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
          📥 Ubicar Mercadería en Nivel {activeLevel}
        </h4>
        <span className="badge" style={{ backgroundColor: '#E2E8F0', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>
          {slot.code}-{activeLevel}
        </span>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>
          1. Seleccionar Producto con Stock Disponible
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
                ✕ Cambiar
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.73rem' }}>
              <span style={{ backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 700, padding: '2px 7px', borderRadius: '4px' }}>
                📦 Sin Ubicar (S/U): {wms.unassignedUnits} u.
              </span>
              <span style={{ backgroundColor: '#E2E8F0', color: '#334155', fontWeight: 600, padding: '2px 7px', borderRadius: '4px' }}>
                🟢 Ya en Mapa: {wms.locatedUnits} u.
              </span>
              <span style={{ color: '#475569', fontWeight: 600, padding: '2px 4px' }}>
                Total Físico: <strong>{wms.totalUnits} u.</strong>
              </span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="text" className="form-control" placeholder="🔍 Buscar por nombre o SKU (ej: Cremoso, 0001)..."
              value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
              style={{ height: '36px', fontSize: '0.83rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', paddingLeft: '12px' }}
            />
            <select
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
                .filter((p) => p.stock > 0)
                .map((p) => {
                  const b = computeProductWmsBreakdown(p);
                  return (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} — S/U: {b.unassignedUnits} u. (Total: {b.totalUnits} u.)
                    </option>
                  );
                })}
            </select>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569', margin: 0 }}>2. Lote de Origen</label>
          <label style={{ fontSize: '0.73rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', color: '#64748B', fontWeight: 600 }}>
            <input type="checkbox" checked={isNewLot} onChange={(e) => { setIsNewLot(e.target.checked); if (e.target.checked) setSourceLotId(''); }} />
            <span>Renombrar código de lote</span>
          </label>
        </div>

        {selectedProduct && activeLots.length > 0 && !isNewLot ? (
          <select
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
            type="text" className="form-control" placeholder="Código de lote opcional (ej: L-2026)" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
            style={{ height: '35px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
          />
        )}

        {isNewLot && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ display: 'block', fontSize: '0.73rem', color: '#64748B', marginBottom: '3px', fontWeight: 600 }}>Fecha de Vencimiento (Opcional)</label>
            <input
              type="date" className="form-control" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
              style={{ height: '34px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
        <div style={{ width: '165px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>3. Cantidad (u.)</label>
            {wms && wms.unassignedUnits > 0 && (
              <button
                type="button"
                onClick={() => setQuantity(chosenSourceLot ? chosenSourceLot.stock : wms.unassignedUnits)}
                style={{ fontSize: '0.68rem', fontWeight: 700, color: '#007AFF', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Usar {chosenSourceLot ? chosenSourceLot.stock : wms.unassignedUnits} u.
              </button>
            )}
          </div>
          <input
            type="number" min="1" max={maxRelocatable > 0 ? maxRelocatable : undefined} step="1"
            className="form-control" placeholder="Cant." value={quantity}
            onChange={(e) => setQuantity(e.target.value ? Math.trunc(Number(e.target.value)) : '')}
            style={{ height: '36px', fontSize: '0.88rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#475569', marginBottom: '5px' }}>4. Observación</label>
          <input
            type="text" className="form-control" placeholder="Ej: Acomodado en cámara" value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ height: '36px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        <button
          type="submit" className="btn btn-primary" disabled={loading || (selectedProduct ? maxRelocatable <= 0 : false)}
          style={{ flex: 1, height: '38px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '8px', backgroundColor: '#0F172A', borderColor: '#0F172A', color: '#FFFFFF' }}
        >
          {loading ? 'Ubicando...' : `📥 Ubicar en Nivel ${activeLevel} (Δ Stock = 0)`}
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
