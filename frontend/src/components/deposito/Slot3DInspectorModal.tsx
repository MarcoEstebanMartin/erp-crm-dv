import React, { useState } from 'react';
import type { Product, ProductLot } from '../../types';
import type { DepositSlot } from './depositomapaData';
import { SECTORS_INFO } from './depositomapaData';
import { X, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { Slot3DRackIsometricView } from './Slot3DRackIsometricView';
import { Slot3DLoadStockForm } from './Slot3DLoadStockForm';

interface Slot3DInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: DepositSlot | null;
  products: Product[];
  onStockUpdated: () => void;
}

export const Slot3DInspectorModal: React.FC<Slot3DInspectorModalProps> = ({
  isOpen, onClose, slot, products, onStockUpdated,
}) => {
  if (!isOpen || !slot) return null;

  const confirm = useConfirm();
  const chamberInfo = SECTORS_INFO[slot.chamber] || SECTORS_INFO.GENERAL;
  const supportsLevelB = slot.nivel.includes('B');
  const supportsLevelC = slot.nivel.includes('C');

  const [activeLevel, setActiveLevel] = useState<'A' | 'B' | 'C'>('A');
  const [showLoadForm, setShowLoadForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [productSearch, setProductSearch] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [isNewLot, setIsNewLot] = useState(false);
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('Carga directa en mapa de depósito');
  const [localProducts, setLocalProducts] = useState<Product[]>(products || []);

  React.useEffect(() => { setLocalProducts(products || []); }, [products]);

  const filteredProducts = (localProducts || [])
    .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase()) || (p.barcode && p.barcode.includes(productSearch)))
    .slice(0, 8);
  const selectedProduct = (localProducts || []).find((p) => p.id === Number(selectedProductId));

  const getItemsForLevel = (level: 'A' | 'B' | 'C') => {
    const levelCode = `${slot.code}-${level}`;
    const levelItems: { product: Product; lot: ProductLot }[] = [];
    (localProducts || []).forEach((p) => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach((l) => {
          if (l.stock > 0 && (l.location === levelCode || (level === 'A' && l.location === slot.code))) levelItems.push({ product: p, lot: l });
        });
      } else if (p.stock > 0 && (p.defaultLocation === levelCode || (level === 'A' && p.defaultLocation === slot.code))) {
        levelItems.push({
          product: p,
          lot: { id: 0, productId: p.id, lotNumber: 'S/L', expirationDate: new Date().toISOString(), stock: p.stock, location: levelCode, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        });
      }
    });
    return levelItems;
  };

  const itemsLevelA = getItemsForLevel('A');
  const itemsLevelB = getItemsForLevel('B');
  const itemsLevelC = getItemsForLevel('C');
  const totalStockInSlot = itemsLevelA.reduce((s, i) => s + i.lot.stock, 0) + itemsLevelB.reduce((s, i) => s + i.lot.stock, 0) + itemsLevelC.reduce((s, i) => s + i.lot.stock, 0);

  const handleLoadStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return setErrorMsg('Seleccioná un producto de la lista.');
    if (!quantity || Number(quantity) <= 0) return setErrorMsg('Ingresá una cantidad mayor a 0.');
    const targetLocation = `${slot.code}-${activeLevel}`;
    try {
      setLoading(true); setErrorMsg(null);
      await api.assignWmsLocation({ productId: Number(selectedProductId), locationCode: targetLocation, quantity: Number(quantity), lotNumber: lotNumber.trim() || undefined, expirationDate: expirationDate || undefined });
      setSuccessMsg(`⚡ ¡Mercadería asignada a la posición ${targetLocation} con éxito!`);
      setShowLoadForm(false); setSelectedProductId(''); setQuantity(''); setLotNumber('');
      onStockUpdated();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar la mercadería en el slot.'); } finally { setLoading(false); }
  };

  const handleMoveLot = async (lot: ProductLot, newLevel: 'A' | 'B' | 'C') => {
    const newLocation = `${slot.code}-${newLevel}`;
    try {
      setLoading(true); setErrorMsg(null);
      await api.updateLot(lot.id, { location: newLocation });
      setSuccessMsg(`✅ Lote ${lot.lotNumber} reubicado al Nivel ${newLevel}.`);
      onStockUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) { setErrorMsg(err.message || 'Error al reubicar el lote.'); } finally { setLoading(false); }
  };

  const handleVacatePosition = async (product: Product, lot: ProductLot) => {
    const isConfirmed = await confirm({ title: 'Vaciar y Liberar Posición', message: `¿Confirmás vaciar y liberar la posición del producto [${product.sku}] ${product.name}?`, type: 'danger', confirmText: 'Sí, Vaciar Posición', cancelText: 'Cancelar' });
    if (!isConfirmed) return;
    const currentLevelCode = lot.location && lot.location !== 'S/U' ? lot.location : `${slot.code}-${activeLevel}`;
    try {
      setLoading(true); setErrorMsg(null);
      await api.clearWmsLocation(currentLevelCode);
      setLocalProducts((prev) => prev.map((p) => p.id !== product.id ? p : {
        ...p,
        defaultLocation: p.defaultLocation && p.defaultLocation.toUpperCase().startsWith(slot.code.toUpperCase()) ? null : p.defaultLocation,
        lots: (p.lots || []).map((l) => l.id === lot.id || l.location === currentLevelCode ? { ...l, stock: 0, location: 'S/U' } : l),
      }));
      setSuccessMsg(`⚡ Posición ${currentLevelCode} liberada con éxito.`);
      onStockUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) { setErrorMsg(err.message || 'Error al vaciar la posición del slot.'); } finally { setLoading(false); }
  };

  const handleVacateEntireSlot = async () => {
    const isConfirmed = await confirm({ title: 'Vaciar Slot Completo', message: `¿Confirmás VACIAR COMPLETAMENTE el slot ${slot.code} (todos sus pisos A, B, C)?`, type: 'danger', confirmText: 'Sí, Vaciar Slot Completo', cancelText: 'Cancelar' });
    if (!isConfirmed) return;
    try {
      setLoading(true); setErrorMsg(null);
      await api.clearWmsLocation(slot.code);
      setSuccessMsg(`🧹 Slot ${slot.code} vaciado por completo.`);
      onStockUpdated();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) { setErrorMsg(err.message || 'Error al vaciar el slot completo.'); } finally { setLoading(false); }
  };

  const currentItems = getItemsForLevel(activeLevel);

  return (
    <div className="wms-modal-backdrop" onClick={onClose}>
      <div className="wms-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wms-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: chamberInfo.bg, color: chamberInfo.color, border: `1.5px solid ${chamberInfo.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
              {chamberInfo.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>Slot {slot.code}</h3>
                <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                  {totalStockInSlot > 0 ? `🟢 ${totalStockInSlot} u. en Stock` : '⚪ Vacío / Libre'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {slot.deposito} • {chamberInfo.label} • Nivel Físico: <strong>{slot.nivel}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {totalStockInSlot > 0 && (
              <button type="button" className="btn btn-sm" style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 700, fontSize: '0.78rem', padding: '6px 12px', borderRadius: '6px' }} onClick={handleVacateEntireSlot} disabled={loading}>
                🧹 Vaciar Slot Completo
              </button>
            )}
            <button type="button" className="wms-close-btn" onClick={onClose} aria-label="Cerrar modal"><X size={20} /></button>
          </div>
        </div>

        {errorMsg && <div className="alert alert-danger" style={{ margin: '12px 18px 0 18px', padding: '10px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /><span>{errorMsg}</span></div>}
        {successMsg && <div className="alert alert-success" style={{ margin: '12px 18px 0 18px', padding: '10px 14px', fontSize: '0.82rem' }}>{successMsg}</div>}

        <div className="wms-modal-body">
          <Slot3DRackIsometricView activeLevel={activeLevel} setActiveLevel={setActiveLevel} supportsLevelB={supportsLevelB} supportsLevelC={supportsLevelC} itemsLevelA={itemsLevelA} itemsLevelB={itemsLevelB} itemsLevelC={itemsLevelC} />

          <div className="wms-shelf-detail-container">
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '14px', gap: '6px', alignItems: 'center' }}>
              {(['A', ...(supportsLevelB ? ['B'] : []), ...(supportsLevelC ? ['C'] : [])] as ('A' | 'B' | 'C')[]).map((lvl) => (
                <button key={lvl} type="button" className={`btn btn-sm ${activeLevel === lvl ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setActiveLevel(lvl); setShowLoadForm(false); }} style={{ fontSize: '0.8rem', padding: '6px 14px', fontWeight: 700, borderRadius: '6px' }}>
                  Piso {lvl === 'A' ? '1 (Nivel A)' : lvl === 'B' ? '2 (Nivel B)' : '3 (Nivel C)'}
                </button>
              ))}
            </div>

            {showLoadForm ? (
              <Slot3DLoadStockForm
                slot={slot} activeLevel={activeLevel} products={products} filteredProducts={filteredProducts} selectedProduct={selectedProduct}
                selectedProductId={selectedProductId} setSelectedProductId={setSelectedProductId} productSearch={productSearch} setProductSearch={setProductSearch}
                lotNumber={lotNumber} setLotNumber={setLotNumber} isNewLot={isNewLot} setIsNewLot={setIsNewLot} expirationDate={expirationDate} setExpirationDate={setExpirationDate}
                quantity={quantity} setQuantity={setQuantity} reason={reason} setReason={setReason} loading={loading} onSubmit={handleLoadStock} onCancel={() => setShowLoadForm(false)}
              />
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>Mercadería en Piso {activeLevel}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>{currentItems.length} producto(s)</span>
                    {currentItems.length > 0 && (
                      <button type="button" className="btn btn-sm btn-primary" style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }} onClick={() => setShowLoadForm(true)}>
                        ➕ Agregar Mercadería
                      </button>
                    )}
                  </div>
                </div>

                {currentItems.length === 0 ? (
                  <div style={{ padding: '30px 10px', textAlign: 'center', backgroundColor: '#fafafa', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>⚪</div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Piso Vacío (Disponible)</div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 14px 0' }}>No hay productos registrados en esta altura de la estantería.</p>
                    <button type="button" className="btn btn-primary" style={{ fontSize: '0.82rem', padding: '7px 14px', fontWeight: 600 }} onClick={() => setShowLoadForm(true)}>➕ Cargar Mercadería Aquí</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                    {currentItems.map(({ product, lot }, idx) => (
                      <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', backgroundColor: '#ffffff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>[{product.sku}] {product.name}</div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Rubro: {product.rubro?.name || 'General'}</div>
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 700 }}>{lot.stock} u.</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '6px', marginBottom: '8px' }}>
                          <div>Lote: <strong>{lot.lotNumber}</strong></div>
                          <div>Venc: <strong>{lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString('es-AR') : 'S/F'}</strong></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', gap: '4px', fontSize: '0.74rem', alignItems: 'center' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Mover a:</span>
                            {activeLevel !== 'A' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleMoveLot(lot, 'A')} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>Piso 1 (A)</button>}
                            {supportsLevelB && activeLevel !== 'B' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleMoveLot(lot, 'B')} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>Piso 2 (B)</button>}
                            {supportsLevelC && activeLevel !== 'C' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleMoveLot(lot, 'C')} style={{ fontSize: '0.72rem', padding: '2px 6px' }}>Piso 3 (C)</button>}
                          </div>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => handleVacatePosition(product, lot)} style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px', color: '#e30613', borderColor: '#fca5a5', fontWeight: 700 }}>
                            🗑️ Vaciar Posición
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="wms-modal-footer">
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} color="#22c55e" /><span>Auditoría de Movimientos y Stock 100% Sincronizado</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>Cerrar Inspector</button>
        </div>
      </div>
    </div>
  );
};
