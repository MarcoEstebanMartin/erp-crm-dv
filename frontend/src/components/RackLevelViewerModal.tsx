import React, { useState, useEffect, useCallback } from 'react';
import { X, Package, Check, Layers, Plus, Box, Trash2, MinusCircle, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';

interface RackLevelViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  allProducts: any[];
  onRefresh: () => Promise<void>;
}

export default function RackLevelViewerModal({
  isOpen,
  onClose,
  slot,
  allProducts: parentProducts,
  onRefresh
}: RackLevelViewerModalProps) {
  const [selectedSubLevel, setSelectedSubLevel] = useState<string>('A');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal personalizado para vaciar o restar stock (Reemplazo de window.confirm/prompt)
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    mode: 'subtract' | 'delete';
    product: any;
    lot: any;
    qtyToRemove: number;
  } | null>(null);
  
  // Productos y lotes locales sincronizados en tiempo real con PostgreSQL
  const [localProducts, setLocalProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fetchFreshProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const prods = await api.getProducts('', true);
      if (Array.isArray(prods)) {
        setLocalProducts(prods);
      }
    } catch (err) {
      console.error('Error al actualizar productos en modal de viga:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && slot) {
      setSelectedSubLevel('A');
      setSelectedProductId('');
      setLotNumber('');
      setExpirationDate('');
      setQuantity(1);
      setSuccessMsg(null);
      setErrorMsg(null);
      setActionModal(null);
      fetchFreshProducts();
    }
  }, [isOpen, slot, fetchFreshProducts]);

  if (!isOpen || !slot) return null;

  const getSubLevelsList = (nivelStr: string): string[] => {
    if (nivelStr === 'A-B-C-D-E-F') return ['F', 'E', 'D', 'C', 'B', 'A'];
    if (nivelStr === 'A-B-C') return ['C', 'B', 'A'];
    if (nivelStr === 'A-B') return ['B', 'A'];
    return ['A'];
  };

  const levelsList = getSubLevelsList(slot.nivel || 'A');
  const activeProductsSource = localProducts.length > 0 ? localProducts : parentProducts;

  // Filtrado de lotes para un nivel específico con normalización de claves
  const getProductsInLevel = (lvl: string) => {
    const matching: { product: any; lot: any }[] = [];
    const targetLvlCode = `${slot.code}-${lvl}`.toUpperCase().trim();
    const targetSlotCode = slot.code.toUpperCase().trim();

    activeProductsSource.forEach(p => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach((l: any) => {
          const loc = (l.location || '').toUpperCase().trim();
          if (l.stock > 0) {
            if (
              loc === targetLvlCode ||
              loc === `${targetSlotCode}-${lvl}` ||
              loc === targetSlotCode ||
              loc.startsWith(targetLvlCode) ||
              loc.startsWith(targetSlotCode)
            ) {
              matching.push({ product: p, lot: l });
            }
          }
        });
      }
    });

    return matching;
  };

  const currentLevelProducts = getProductsInLevel(selectedSubLevel);

  // Cargar stock nuevo
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) {
      setErrorMsg('Por favor seleccioná un producto del catálogo y una cantidad válida.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Normalización garantizada de código de nivel (ej. D1-R05-C07-A)
      const finalCode = `${slot.code}-${selectedSubLevel}`;
      
      let finalLotNumber = lotNumber.trim();
      if (!finalLotNumber) {
        finalLotNumber = `L-${finalCode}-${Date.now().toString().slice(-4)}`;
      }
      
      await api.adjustStock(
        Number(selectedProductId),
        Number(quantity),
        'Carga desde Estantería WMS',
        finalLotNumber,
        expirationDate,
        finalCode
      );

      await fetchFreshProducts();
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
      console.error('Error cargando stock:', err);
      setErrorMsg(err.message || 'Ocurrió un error al registrar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Abrir modal personalizado de confirmación de retiro/eliminación
  const openActionModal = (product: any, lot: any, mode: 'subtract' | 'delete') => {
    setActionModal({
      open: true,
      mode,
      product,
      lot,
      qtyToRemove: mode === 'delete' ? lot.stock : 1
    });
  };

  // Ejecutar retiro de stock sin bloqueos de servidor
  const confirmExecuteRemoveStock = async () => {
    if (!actionModal) return;
    const { product, lot, mode, qtyToRemove } = actionModal;
    
    if (qtyToRemove <= 0) {
      setErrorMsg('La cantidad a retirar debe ser mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const numQtyToSub = Number(qtyToRemove) > 0 ? Number(qtyToRemove) : 1;
      const locToSub = lot.location || `${slot.code}-${selectedSubLevel}`;
      const lotNumToSub = lot.lotNumber || 'S/L';

      await api.adjustStock(
        product.id,
        -numQtyToSub,
        mode === 'delete' ? 'Eliminación completa de lote desde Estantería WMS' : 'Retiro parcial de stock desde Estantería WMS',
        lotNumToSub,
        lot.expirationDate,
        locToSub
      );

      await fetchFreshProducts();
      await onRefresh();

      setActionModal(null);
      setSuccessMsg(`¡Se retiraron ${numQtyToSub} u. del lote ${lotNumToSub} exitosamente!`);
      setTimeout(() => setSuccessMsg(null), 1400);
    } catch (err: any) {
      console.error('Error al retirar stock:', err);
      setErrorMsg(err.message || 'Ocurrió un error al retirar la mercadería.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(5px)',
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
        {/* Header Unificado Modal de Estantería */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#0f172a', color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#2563eb', color: '#fff', borderRadius: '10px', padding: '8px 10px' }}>
              <Package size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                  Estantería WMS — Posición {slot.code}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#3b82f6', color: '#fff' }}>
                  Niveles: {slot.nivel} ({levelsList.length} Niveles de Altura)
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                📍 {slot.deposito || 'Depósito 1'} — Fila {slot.row}, Columna {slot.col} (Sector: {slot.chamber || 'GENERAL'})
              </div>
            </div>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo Modal: Estantería 2D (Izquierda) + Formulario (Derecha) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* ESTRUCTURA VISUAL 2D DE VIGAS Y NIVELES */}
          <div style={{
            flex: 1.3, backgroundColor: '#090d16', padding: '24px 20px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
            position: 'relative', borderRight: '1px solid #1e293b'
          }}>
            
            <div style={{ width: '100%', marginBottom: '16px', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>💡 Seleccioná una viga para inspeccionar, añadir o eliminar bultos</span>
              {loadingProducts && <span style={{ color: '#60a5fa' }}>(Actualizando stock...)</span>}
            </div>

            {/* Estructura del Rack 2D Elevación Limpia */}
            <div style={{
              width: '100%', maxWidth: '460px', display: 'flex', flexDirection: 'column', gap: '14px'
            }}>
              {levelsList.map((lvl) => {
                const prodsInLvl = getProductsInLevel(lvl);
                const hasProds = prodsInLvl.length > 0;
                const isSelected = selectedSubLevel === lvl;

                let shelfBorderColor = isSelected ? '#3b82f6' : hasProds ? '#10b981' : '#334155';
                let shelfBg = isSelected ? 'rgba(37, 99, 235, 0.2)' : hasProds ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.7)';

                return (
                  <div
                    key={lvl}
                    onClick={() => setSelectedSubLevel(lvl)}
                    style={{
                      border: `2px solid ${shelfBorderColor}`,
                      backgroundColor: shelfBg,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      boxShadow: isSelected 
                        ? '0 0 20px rgba(59, 130, 246, 0.4)' 
                        : hasProds 
                        ? '0 0 12px rgba(16, 185, 129, 0.25)' 
                        : '0 4px 6px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      userSelect: 'none'
                    }}
                  >
                    {/* Viga Frontal Superior */}
                    <div style={{
                      height: '4px', backgroundColor: isSelected ? '#60a5fa' : hasProds ? '#34d399' : '#475569',
                      borderRadius: '2px', marginBottom: '10px'
                    }} />

                    {/* Titulo de Viga / Sub-Nivel */}
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
                        {hasProds ? `🟢 ${prodsInLvl.reduce((acc, curr) => acc + (curr.lot.stock || 0), 0)} u. Almacenadas` : '⚪ Viga Libre'}
                      </span>
                    </div>

                    {/* Lista de Mercadería Almacenada en la Viga con Botones de Eliminación */}
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
                                  {lot.expirationDate && <span>| Vence: <strong style={{ color: '#fbbf24' }}>{new Date(lot.expirationDate).toLocaleDateString()}</strong></span>}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#34d399' }}>
                                {lot.stock} un.
                              </span>
                              
                              {/* Botones de Retiro y Eliminacion de Lote (Abre Modal Premium) */}
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  title="Restar bultos"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 6px', fontSize: '0.7rem', backgroundColor: '#1e293b', color: '#f59e0b', border: '1px solid #d97706', borderRadius: '4px' }}
                                  onClick={(e) => { e.stopPropagation(); openActionModal(product, lot, 'subtract'); }}
                                >
                                  <MinusCircle size={14} />
                                </button>

                                <button
                                  type="button"
                                  title="Vaciar / Eliminar lote completo"
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '4px 6px', fontSize: '0.7rem', backgroundColor: '#881337', color: '#ffe4e6', border: '1px solid #e11d48', borderRadius: '4px' }}
                                  onClick={(e) => { e.stopPropagation(); openActionModal(product, lot, 'delete'); }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        border: '1.5px dashed #334155', borderRadius: '8px', padding: '14px', textAlign: 'center',
                        color: '#64748b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}>
                        <Plus size={15} />
                        <span>Espacio libre en Viga {lvl}. Hacé clic para seleccionar y cargar mercadería.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FORMULARIO Y CONTROL DE CARGA (DERECHA) */}
          <div style={{ flex: 1, padding: '24px', backgroundColor: '#ffffff', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} color="#2563eb" />
                <span>Viga Seleccionada: Nivel {selectedSubLevel} ({slot.code}-{selectedSubLevel})</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: '1.4' }}>
                {currentLevelProducts.length > 0
                  ? `Esta viga contiene actualmente ${currentLevelProducts.length} lote(s) guardado(s). Podés ingresar bultos adicionales o usar los botones de basura/restar para modificar.`
                  : `La viga ${selectedSubLevel} está disponible. Seleccioná un producto del catálogo para ubicar la mercadería.`}
              </div>
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
                  1. Seleccionar Producto del Catálogo:
                </label>
                <select
                  className="form-control"
                  style={{ fontSize: '0.86rem', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                  required
                >
                  <option value="">-- Buscar / Seleccionar Producto --</option>
                  {activeProductsSource.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (Stock Total: {p.stock} u.)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    2. Número de Lote:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej: L-240810 (Opcional)"
                    style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '8px' }}
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    3. Vencimiento:
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

        {/* MODAL DE CONFIRMACIÓN / RETIRO PREMIUM (REEMPLAZO DE WINDOW.CONFIRM / PROMPT) */}
        {actionModal && actionModal.open && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
                  backgroundColor: actionModal.mode === 'delete' ? '#ffe4e6' : '#fef3c7',
                  color: actionModal.mode === 'delete' ? '#e11d48' : '#d97706'
                }}>
                  {actionModal.mode === 'delete' ? <AlertTriangle size={24} /> : <MinusCircle size={24} />}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    {actionModal.mode === 'delete' ? 'Confirmar Vaciar Lote' : 'Restar Bultos de Estantería'}
                  </h4>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                    [{actionModal.product.sku}] {actionModal.product.name}
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.84rem' }}>
                <div>Lote: <strong style={{ color: '#2563eb' }}>{actionModal.lot.lotNumber}</strong></div>
                <div>Stock Actual en Viga: <strong style={{ color: '#059669' }}>{actionModal.lot.stock} unidades</strong></div>
              </div>

              {actionModal.mode === 'subtract' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                    Cantidad de bultos a retirar:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={actionModal.lot.stock}
                    className="form-control"
                    style={{ fontSize: '0.9rem', padding: '10px 12px', borderRadius: '8px' }}
                    value={actionModal.qtyToRemove}
                    onChange={(e) => setActionModal({ ...actionModal, qtyToRemove: Math.min(actionModal.lot.stock, Math.max(1, Number(e.target.value))) })}
                  />
                </div>
              ) : (
                <div style={{ fontSize: '0.84rem', color: '#b91c1c', fontWeight: 600 }}>
                  ⚠️ Se retirarán las <strong>{actionModal.lot.stock} unidades</strong> de este lote y la viga quedará liberada.
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '0.86rem', fontWeight: 700 }}
                  onClick={() => setActionModal(null)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: '9px 18px', borderRadius: '8px', fontSize: '0.86rem', fontWeight: 800,
                    backgroundColor: actionModal.mode === 'delete' ? '#e11d48' : '#2563eb',
                    color: '#ffffff', border: 'none'
                  }}
                  onClick={confirmExecuteRemoveStock}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Procesando...' : actionModal.mode === 'delete' ? '🗑️ Vaciar Lote' : '➖ Confirmar Retiro'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
