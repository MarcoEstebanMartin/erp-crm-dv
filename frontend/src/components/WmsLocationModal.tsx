import React, { useState, useEffect } from 'react';
import { X, Box, Plus, Trash2, MinusCircle, AlertTriangle, Check, Layers } from 'lucide-react';
import { api } from '../utils/api';

interface WmsLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  allProducts: any[];
  onRefresh: () => Promise<void>;
}

export default function WmsLocationModal({
  isOpen,
  onClose,
  slot,
  allProducts,
  onRefresh
}: WmsLocationModalProps) {
  const [selectedSubLevel, setSelectedSubLevel] = useState<string>('A');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal interno de confirmación para restar/vaciar
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    mode: 'subtract' | 'delete_lot' | 'clear_slot';
    product?: any;
    lot?: any;
    qtyToRemove?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen && slot) {
      setSelectedSubLevel('A');
      setSelectedProductId('');
      setLotNumber('');
      setExpirationDate('');
      setQuantity(1);
      setSuccessMsg(null);
      setErrorMsg(null);
      setConfirmModal(null);
      onRefresh();
    }
  }, [isOpen, slot, onRefresh]);

  if (!isOpen || !slot) return null;

  const safeProducts = Array.isArray(allProducts) ? allProducts.filter(p => p && typeof p === 'object') : [];

  const getSubLevelsList = (nivelStr: string): string[] => {
    if (nivelStr === 'A-B-C-D-E-F') return ['F', 'E', 'D', 'C', 'B', 'A'];
    if (nivelStr === 'A-B-C') return ['C', 'B', 'A'];
    if (nivelStr === 'A-B') return ['B', 'A'];
    return ['A'];
  };

  const levelsList = getSubLevelsList(slot.nivel || 'A');

  // Filtrado defensivo de productos por sub-nivel o por celda principal
  const getProductsInLevel = (lvl: string) => {
    const matching: { product: any; lot: any }[] = [];
    const targetLvlCode = `${slot.code}-${lvl}`.toUpperCase().trim();
    const targetSlotCode = slot.code.toUpperCase().trim();

    safeProducts.forEach(p => {
      let matchedInLots = false;
      const lotsList = Array.isArray(p.lots) ? p.lots : [];

      lotsList.forEach((l: any) => {
        if (!l || typeof l !== 'object') return;
        const loc = (l.location || '').toUpperCase().trim();
        if (Number(l.stock) > 0) {
          if (
            loc === targetLvlCode ||
            loc === `${targetSlotCode}-${lvl}` ||
            (loc === targetSlotCode && lvl === 'A') ||
            loc.startsWith(`${targetLvlCode}-`)
          ) {
            matching.push({ product: p, lot: l });
            matchedInLots = true;
          }
        }
      });

      const hasActiveLots = lotsList.some((l: any) => l && Number(l.stock) > 0);
      if (!hasActiveLots && !matchedInLots && Number(p.stock) > 0) {
        const defLoc = (p.defaultLocation || '').toUpperCase().trim();
        if (defLoc === targetLvlCode || defLoc === `${targetSlotCode}-${lvl}` || (defLoc === targetSlotCode && lvl === 'A')) {
          matching.push({
            product: p,
            lot: { id: null, lotNumber: 'S/L', stock: p.stock, location: p.defaultLocation, expirationDate: null }
          });
        }
      }
    });

    return matching;
  };

  // Obtener todos los productos almacenados en esta posición (en todos los subniveles)
  const getAllProductsInSlot = () => {
    const allMatching: { product: any; lot: any }[] = [];
    levelsList.forEach(lvl => {
      allMatching.push(...getProductsInLevel(lvl));
    });
    return allMatching;
  };

  const currentLevelProducts = getProductsInLevel(selectedSubLevel);
  const totalSlotStock = getAllProductsInSlot().reduce((acc, curr) => acc + (Number(curr.lot.stock) || 0), 0);

  // Cargar stock en la viga seleccionada
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) {
      setErrorMsg('Seleccioná un producto del catálogo y una cantidad mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const finalCode = `${slot.code}-${selectedSubLevel}`.toUpperCase().trim();
      let finalLotNumber = lotNumber.trim();
      if (!finalLotNumber) {
        finalLotNumber = `S/L-${finalCode}`;
      }

      await api.adjustStock(
        Number(selectedProductId),
        Number(quantity),
        'Carga desde WMS',
        finalLotNumber,
        expirationDate || undefined,
        finalCode
      );

      await onRefresh();

      setSuccessMsg(`¡Mercadería cargada con éxito en ${finalCode}!`);
      setTimeout(() => {
        setSuccessMsg(null);
        setSelectedProductId('');
        setLotNumber('');
        setExpirationDate('');
        setQuantity(1);
      }, 1400);
    } catch (err: any) {
      console.error('Error cargando stock WMS:', err);
      setErrorMsg(err.message || 'Error al registrar el stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ejecutar retiro o vaciado
  const handleRemoveStock = async (product: any, lot: any, qtyToSub: number, mode: 'subtract' | 'delete_lot') => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const numQty = Number(qtyToSub) > 0 ? Number(qtyToSub) : 1;
      const locToSub = lot.location || `${slot.code}-${selectedSubLevel}`;
      const lotNumToSub = lot.lotNumber || 'S/L';

      await api.adjustStock(
        product.id,
        -numQty,
        mode === 'delete_lot' ? 'Eliminación completa de lote WMS' : 'Retiro parcial WMS',
        lotNumToSub,
        lot.expirationDate || undefined,
        locToSub,
        lot.id || undefined
      );

      await onRefresh();

      setSuccessMsg(`¡${mode === 'delete_lot' ? 'Lote vaciado' : 'Stock actualizado'} con éxito!`);
      setTimeout(() => setSuccessMsg(null), 1400);
    } catch (err: any) {
      console.error('Error al retirar stock WMS:', err);
      setErrorMsg(err.message || 'Error al retirar la mercadería.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vaciar la posición entera (todos los subniveles)
  const handleClearEntireSlot = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const allItems = getAllProductsInSlot();
      for (const item of allItems) {
        const qtyToSub = Number(item.lot.stock) > 0 ? Number(item.lot.stock) : 1;
        const locToSub = item.lot.location || slot.code;
        const lotNumToSub = item.lot.lotNumber || 'S/L';
        await api.adjustStock(
          item.product.id,
          -qtyToSub,
          'Vaciamiento completo de posición WMS',
          lotNumToSub,
          item.lot.expirationDate || undefined,
          locToSub,
          item.lot.id || undefined
        );
      }

      await onRefresh();

      setSuccessMsg(`¡Posición ${slot.code} vaciada por completo!`);
      setTimeout(() => setSuccessMsg(null), 1400);
    } catch (err: any) {
      console.error('Error al vaciar posición entera WMS:', err);
      setErrorMsg(err.message || 'Error al vaciar la posición.');
    } finally {
      setIsSubmitting(false);
      setConfirmModal(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(6px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1020px',
        maxHeight: '92vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-color)',
        position: 'relative'
      }}>
        {/* Cabecera del Modal WMS */}
        <div style={{
          backgroundColor: '#0f172a', color: '#ffffff',
          padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #1e293b'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', borderRadius: '10px', backgroundColor: '#2563eb', color: '#ffffff' }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
                  Estantería {slot.code}
                </h3>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 800, backgroundColor: '#1e293b', color: '#38bdf8',
                  padding: '3px 9px', borderRadius: '12px', border: '1px solid #334155'
                }}>
                  Nivel {slot.nivel || 'A'}
                </span>
                {totalSlotStock > 0 && (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 800, backgroundColor: '#064e3b', color: '#34d399',
                    padding: '3px 9px', borderRadius: '12px', border: '1px solid #059669'
                  }}>
                    🟢 {totalSlotStock} u. Almacenadas
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                📍 {slot.deposito || 'Depósito 1'} — Fila {slot.row}, Columna {slot.col} (Sector: {slot.chamber || 'GENERAL'})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {totalSlotStock > 0 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, borderRadius: '8px' }}
                onClick={() => setConfirmModal({ open: true, mode: 'clear_slot' })}
              >
                <Trash2 size={15} />
                <span>Vaciar Posición Completa</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal: Columna Izquierda (Vigas) + Columna Derecha (Formulario Carga) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* ESTRUCTURA DE VIGAS (IZQUIERDA) */}
          <div style={{
            flex: 1.3, backgroundColor: '#090d16', padding: '24px 20px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
            position: 'relative', borderRight: '1px solid #1e293b'
          }}>
            <div style={{ width: '100%', marginBottom: '14px', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
              💡 Haz clic en una viga para seleccionarla y gestionar su mercadería.
            </div>

            <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {levelsList.map((lvl) => {
                const prodsInLvl = getProductsInLevel(lvl);
                const hasProds = prodsInLvl.length > 0;
                const isSelected = selectedSubLevel === lvl;

                const shelfBorder = isSelected ? '#3b82f6' : hasProds ? '#10b981' : '#334155';
                const shelfBg = isSelected ? 'rgba(37, 99, 235, 0.2)' : hasProds ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.7)';

                return (
                  <div
                    key={lvl}
                    onClick={() => setSelectedSubLevel(lvl)}
                    style={{
                      border: `2px solid ${shelfBorder}`,
                      backgroundColor: shelfBg,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.4)' : hasProds ? '0 0 12px rgba(16, 185, 129, 0.25)' : '0 4px 6px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.2s ease',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ height: '4px', backgroundColor: isSelected ? '#60a5fa' : hasProds ? '#34d399' : '#475569', borderRadius: '2px', marginBottom: '10px' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          backgroundColor: isSelected ? '#2563eb' : hasProds ? '#059669' : '#334155',
                          color: '#ffffff', fontWeight: 800, fontSize: '0.78rem', padding: '3px 9px', borderRadius: '6px'
                        }}>
                          VIGA {lvl} {lvl === 'A' ? '(PISO)' : ''}
                        </span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 800, color: isSelected ? '#93c5fd' : '#f8fafc' }}>
                          {slot.code}-{lvl}
                        </span>
                      </div>

                      <span style={{
                        fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: '12px',
                        backgroundColor: hasProds ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.12)',
                        color: hasProds ? '#34d399' : '#94a3b8', border: '1px solid ' + (hasProds ? '#059669' : '#475569')
                      }}>
                        {hasProds ? `🟢 ${prodsInLvl.reduce((acc, curr) => acc + (Number(curr.lot.stock) || 0), 0)} u. Almacenadas` : '⚪ Viga Libre'}
                      </span>
                    </div>

                    {hasProds ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                        {prodsInLvl.map(({ product, lot }, pIdx) => (
                          <div
                            key={pIdx}
                            style={{
                              backgroundColor: '#0f172a',
                              border: '1.5px solid #059669',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ backgroundColor: '#064e3b', color: '#34d399', borderRadius: '6px', padding: '6px' }}>
                                <Box size={18} />
                              </div>
                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff' }}>
                                  [{product.sku}] {product.name}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                  <span>Lote: <strong style={{ color: '#38bdf8' }}>{lot.lotNumber}</strong></span>
                                  {lot.expirationDate && (
                                    <span>Vence: <strong style={{ color: '#fbbf24' }}>{new Date(lot.expirationDate).toLocaleDateString('es-AR')}</strong></span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>
                                {lot.stock} un.
                              </span>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  title="Restar 1 unidad"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 6px', borderRadius: '6px', backgroundColor: '#334155', color: '#fbbf24', border: '1px solid #475569' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({ open: true, mode: 'subtract', product, lot, qtyToRemove: 1 });
                                  }}
                                >
                                  <MinusCircle size={14} />
                                </button>
                                <button
                                  type="button"
                                  title="Vaciar este lote de la viga"
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '4px 6px', borderRadius: '6px', backgroundColor: '#881337', color: '#fda4af', border: '1px solid #9f1239' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmModal({ open: true, mode: 'delete_lot', product, lot, qtyToRemove: lot.stock });
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
                        Sin bultos asignados a este nivel.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FORMULARIO DE CARGA (DERECHA) */}
          <div style={{ flex: 1, padding: '24px', backgroundColor: '#ffffff', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                INGRESAR MERCADERÍA
              </div>
              <h4 style={{ margin: '4px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Viga {selectedSubLevel} ({slot.code}-{selectedSubLevel})
              </h4>
            </div>

            {errorMsg && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600 }}>
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  1. Producto del Catálogo:
                </label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.86rem', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                  required
                >
                  <option value="">-- Buscar / Seleccionar Producto --</option>
                  {safeProducts.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (Stock Total: {p.stock} u.)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    2. Número de Lote (Opcional):
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: L-240810"
                    style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '8px' }}
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    3. Vencimiento (Opcional):
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '8px' }}
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  4. Cantidad de Bultos / Cajas:
                </label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '8px' }}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || !selectedProductId}
                style={{
                  width: '100%', marginTop: '10px', fontSize: '0.92rem', padding: '12px', borderRadius: '8px', fontWeight: 800,
                  backgroundColor: '#2563eb', border: 'none', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <Plus size={18} />
                <span>{isSubmitting ? 'Cargando Mercadería...' : `💾 Cargar Mercadería en Viga ${selectedSubLevel} (${slot.code}-${selectedSubLevel})`}</span>
              </button>
            </form>
          </div>
        </div>

        {/* MODAL DE CONFIRMACIÓN DE VACIADO / RETIRO */}
        {confirmModal && confirmModal.open && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(4px)',
            zIndex: 10001,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              border: '1px solid #cbd5e1',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '10px', borderRadius: '10px',
                  backgroundColor: confirmModal.mode === 'clear_slot' || confirmModal.mode === 'delete_lot' ? '#ffe4e6' : '#fef3c7',
                  color: confirmModal.mode === 'clear_slot' || confirmModal.mode === 'delete_lot' ? '#e11d48' : '#d97706'
                }}>
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    {confirmModal.mode === 'clear_slot'
                      ? 'Vaciar Posición Completa'
                      : confirmModal.mode === 'delete_lot'
                      ? 'Vaciar Lote de Mercadería'
                      : 'Restar Bultos'}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    {confirmModal.mode === 'clear_slot' ? `Posición ${slot.code}` : `[${confirmModal.product?.sku}] ${confirmModal.product?.name}`}
                  </div>
                </div>
              </div>

              {confirmModal.mode === 'clear_slot' ? (
                <div style={{ fontSize: '0.84rem', color: '#b91c1c', fontWeight: 600 }}>
                  ⚠️ Se eliminarán los <strong>{totalSlotStock} bultos</strong> asignados a todos los niveles de esta posición. La estantería volverá a estar 100% libre.
                </div>
              ) : confirmModal.mode === 'delete_lot' ? (
                <div style={{ fontSize: '0.84rem', color: '#b91c1c', fontWeight: 600 }}>
                  ⚠️ Se retirarán las <strong>{confirmModal.lot?.stock} unidades</strong> del lote <strong>"{confirmModal.lot?.lotNumber}"</strong>.
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                    Cantidad de bultos a restar:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={confirmModal.lot?.stock}
                    className="form-control"
                    style={{ fontSize: '0.9rem', padding: '10px 12px', borderRadius: '8px' }}
                    value={confirmModal.qtyToRemove}
                    onChange={(e) => setConfirmModal({ ...confirmModal, qtyToRemove: Math.min(confirmModal.lot?.stock, Math.max(1, Number(e.target.value))) })}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '0.86rem', fontWeight: 700 }}
                  onClick={() => setConfirmModal(null)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: '9px 18px', borderRadius: '8px', fontSize: '0.86rem', fontWeight: 800,
                    backgroundColor: confirmModal.mode === 'subtract' ? '#2563eb' : '#e11d48',
                    color: '#ffffff', border: 'none'
                  }}
                  onClick={() => {
                    if (confirmModal.mode === 'clear_slot') {
                      handleClearEntireSlot();
                    } else if (confirmModal.mode === 'delete_lot') {
                      handleRemoveStock(confirmModal.product, confirmModal.lot, confirmModal.lot.stock, 'delete_lot');
                      setConfirmModal(null);
                    } else if (confirmModal.mode === 'subtract') {
                      handleRemoveStock(confirmModal.product, confirmModal.lot, confirmModal.qtyToRemove || 1, 'subtract');
                      setConfirmModal(null);
                    }
                  }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Procesando...' : confirmModal.mode === 'clear_slot' || confirmModal.mode === 'delete_lot' ? '🗑️ Confirmar Vaciar' : '➖ Confirmar Retiro'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
