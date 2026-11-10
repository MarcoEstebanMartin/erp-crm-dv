import React from 'react';
import type { Product } from '../../types';
import type { DepositSlot } from './depositomapaData';

interface Slot3DLoadStockFormProps {
  slot: DepositSlot;
  activeLevel: 'A' | 'B' | 'C';
  products: Product[];
  filteredProducts: Product[];
  selectedProduct: Product | undefined;
  selectedProductId: number | '';
  setSelectedProductId: (id: number | '') => void;
  productSearch: string;
  setProductSearch: (q: string) => void;
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
  productSearch, setProductSearch, lotNumber, setLotNumber, isNewLot, setIsNewLot, expirationDate, setExpirationDate,
  quantity, setQuantity, reason, setReason, loading, onSubmit, onCancel,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📥 Cargar Mercadería en Piso {activeLevel === 'A' ? '1 (Nivel A)' : activeLevel === 'B' ? '2 (Nivel B)' : '3 (Nivel C)'}
        </h4>
        <span className="badge" style={{ backgroundColor: '#E2E8F0', color: '#475569', fontSize: '0.72rem', fontWeight: 700 }}>
          Slot {slot.code}-{activeLevel}
        </span>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
          1. Seleccionar Producto (Catálogo)
        </label>

        {selectedProduct ? (
          <div style={{ padding: '10px 14px', backgroundColor: '#F0F9FF', border: '1.5px solid #007AFF', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontWeight: 800, color: '#007AFF', backgroundColor: '#E0F2FE', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                {selectedProduct.sku}
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#0F172A' }}>{selectedProduct.name}</div>
                <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '1px' }}>Stock Global Disponible: <strong>{selectedProduct.stock} u.</strong></div>
              </div>
            </div>
            <button
              type="button" onClick={() => { setSelectedProductId(''); setProductSearch(''); }}
              style={{ fontSize: '0.76rem', fontWeight: 700, color: '#0F172A', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}
            >
              ✕ Cambiar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              type="text" className="form-control" placeholder="🔍 Buscar por nombre o SKU (ej: Cremoso, 0001)..."
              value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
              style={{ height: '38px', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', paddingLeft: '12px' }}
            />
            <select
              className="form-control" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
              style={{ height: '38px', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A' }}
            >
              <option value="">-- Seleccionar de los {(filteredProducts.length > 0 ? filteredProducts : products || []).length} productos disponibles --</option>
              {(filteredProducts.length > 0 ? filteredProducts : products || []).map((p) => (
                <option key={p.id} value={p.id}>[{p.sku}] {p.name} — Stock Global: {p.stock} u.</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', margin: 0 }}>2. Número de Lote</label>
          <label style={{ fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontWeight: 600 }}>
            <input type="checkbox" checked={isNewLot} onChange={(e) => setIsNewLot(e.target.checked)} />
            <span>Crear como Lote Nuevo</span>
          </label>
        </div>

        {selectedProduct && selectedProduct.lots && selectedProduct.lots.length > 0 && !isNewLot ? (
          <select
            className="form-control" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
            style={{ height: '36px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
          >
            <option value="">-- Seleccionar Lote Existente del Producto --</option>
            {selectedProduct.lots.map((l) => (
              <option key={l.id} value={l.lotNumber}>Lote: {l.lotNumber} | Venc: {new Date(l.expirationDate).toLocaleDateString('es-AR')} | Stock: {l.stock} u.</option>
            ))}
          </select>
        ) : (
          <input
            type="text" className="form-control" placeholder="(ej: L-2026)" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)}
            style={{ height: '36px', fontSize: '0.84rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
          />
        )}

        {(isNewLot || (selectedProduct && (!selectedProduct.lots || selectedProduct.lots.length === 0))) && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748B', marginBottom: '4px', fontWeight: 600 }}>Fecha de Vencimiento</label>
            <input
              type="date" className="form-control" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
              style={{ height: '36px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', width: '100%', marginTop: '4px' }}>
        <div style={{ width: '130px', flexShrink: 0 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>3. Cantidad (u.)</label>
          <input
            type="number" min="1" className="form-control" placeholder="Cant." value={quantity} onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
            style={{ height: '38px', fontSize: '0.88rem', fontWeight: 700, borderRadius: '8px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>4. Observación / Motivo</label>
          <input
            type="text" className="form-control" placeholder="Ej: Carga inicial WMS" value={reason} onChange={(e) => setReason(e.target.value)}
            style={{ height: '38px', fontSize: '0.82rem', borderRadius: '8px', border: '1px solid #CBD5E1', width: '100%', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
        <button
          type="submit" className="btn btn-primary" disabled={loading}
          style={{ flex: 1, height: '40px', fontSize: '0.86rem', fontWeight: 700, borderRadius: '8px', backgroundColor: '#0F172A', borderColor: '#0F172A', color: '#FFFFFF' }}
        >
          {loading ? 'Guardando...' : `📥 Guardar en Piso ${activeLevel}`}
        </button>
        <button
          type="button" className="btn btn-secondary" onClick={onCancel}
          style={{ height: '40px', fontSize: '0.84rem', fontWeight: 600, borderRadius: '8px', padding: '0 16px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#64748B' }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};
