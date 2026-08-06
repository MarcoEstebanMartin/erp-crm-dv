import React, { useState, useEffect, useCallback } from 'react';
import { X, Package, Check, Layers, Plus, Box, Layers3, RotateCcw, ShieldCheck, Tag } from 'lucide-react';
import { api } from '../utils/api';

interface Rack3DViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  allProducts: any[];
  onRefresh: () => Promise<void>;
}

export default function Rack3DViewerModal({
  isOpen,
  onClose,
  slot,
  allProducts: parentProducts,
  onRefresh
}: Rack3DViewerModalProps) {
  const [selectedSubLevel, setSelectedSubLevel] = useState<string>('A');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewAngle, setViewAngle] = useState<'3d' | 'front'>('3d');
  
  // Productos y lotes locales cargados directamente de la DB en tiempo real
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
      console.error('Error al actualizar productos en modal 3D:', err);
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
      fetchFreshProducts();
    }
  }, [isOpen, slot, fetchFreshProducts]);

  if (!isOpen || !slot) return null;

  const getSubLevelsList = (nivelStr: string): string[] => {
    if (nivelStr === 'A-B-C-D-E-F') return ['F', 'E', 'D', 'C', 'B', 'A']; // De arriba hacia abajo
    if (nivelStr === 'A-B-C') return ['C', 'B', 'A'];
    if (nivelStr === 'A-B') return ['B', 'A'];
    return ['A'];
  };

  const levelsList = getSubLevelsList(slot.nivel || 'A');
  const activeProductsSource = localProducts.length > 0 ? localProducts : parentProducts;

  // Filtrado de lotes para un nivel específico
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
              (lvl === 'A' && loc === targetSlotCode) ||
              loc.startsWith(targetLvlCode)
            ) {
              matching.push({ product: p, lot: l });
            }
          }
        });
      } else if (p.stock > 0) {
        const defLoc = (p.defaultLocation || '').toUpperCase().trim();
        if (defLoc === targetLvlCode || (lvl === 'A' && defLoc === targetSlotCode)) {
          matching.push({ product: p, lot: { lotNumber: 'S/L', stock: p.stock } });
        }
      }
    });

    return matching;
  };

  const currentLevelProducts = getProductsInLevel(selectedSubLevel);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) {
      setErrorMsg('Por favor seleccioná un producto del catálogo y una cantidad válida.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalCode = slot.nivel !== 'A' ? `${slot.code}-${selectedSubLevel}` : slot.code;
      
      await api.adjustStock(
        Number(selectedProductId),
        Number(quantity),
        'Carga desde Vista 3D Rack WMS',
        lotNumber.trim() || 'S/L',
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
      }, 1500);
    } catch (err: any) {
      console.error('Error cargando stock:', err);
      setErrorMsg(err.message || 'Ocurrió un error al registrar el movimiento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(9, 13, 22, 0.88)',
      backdropFilter: 'blur(8px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1080px',
        maxHeight: '92vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #334155'
      }}>
        {/* Header Modal 3D */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #1e293b',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#0f172a', color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#2563eb', color: '#fff', borderRadius: '10px', padding: '8px 10px', boxShadow: '0 0 12px rgba(37, 99, 235, 0.5)' }}>
              <Layers3 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                  Rack Tridimensional WMS — Posición {slot.code}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '3px 8px', backgroundColor: '#3b82f6', color: '#fff' }}>
                  {slot.nivel} ({levelsList.length} Niveles de Altura)
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                📍 {slot.deposito || 'Depósito 1'} — Fila {slot.row}, Columna {slot.col} (Sector: {slot.chamber || 'GENERAL'})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Alternador de Perspectiva 3D vs 2D */}
            <button
              type="button"
              className="btn btn-sm"
              style={{
                fontSize: '0.8rem', padding: '6px 14px', borderRadius: '8px', fontWeight: 700,
                backgroundColor: viewAngle === '3d' ? '#2563eb' : '#1e293b',
                color: '#ffffff', border: viewAngle === '3d' ? '1.5px solid #60a5fa' : '1px solid #475569',
                display: 'flex', alignItems: 'center', gap: '6px',
                boxShadow: viewAngle === '3d' ? '0 0 14px rgba(37, 99, 235, 0.4)' : 'none'
              }}
              onClick={() => setViewAngle(viewAngle === '3d' ? 'front' : '3d')}
            >
              <RotateCcw size={15} />
              <span>Perspectiva: {viewAngle === '3d' ? '🧊 3D Isométrica' : '📐 Vista Frontal 2D'}</span>
            </button>

            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo Modal */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* VISTA 3D ISOMÉTRICA DE RACK (IZQUIERDA) */}
          <div style={{
            flex: 1.3, backgroundColor: '#090d16', padding: '30px 20px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative', borderRight: '1px solid #1e293b', perspective: '1200px'
          }}>
            
            <div style={{ position: 'absolute', top: '16px', left: '20px', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💡 Hacé clic en cualquier estante 3D para seleccionarlo</span>
              {loadingProducts && <span style={{ color: '#60a5fa' }}>(Cargando datos...)</span>}
            </div>

            {/* Estructura del Rack 3D Isométrico */}
            <div style={{
              width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '16px',
              transform: viewAngle === '3d' ? 'rotateX(38deg) rotateZ(-22deg) scale(0.92)' : 'none',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: '10px'
            }}>
              {levelsList.map((lvl) => {
                const prodsInLvl = getProductsInLevel(lvl);
                const hasProds = prodsInLvl.length > 0;
                const isSelected = selectedSubLevel === lvl;

                let shelfBorderColor = isSelected ? '#3b82f6' : hasProds ? '#10b981' : '#334155';
                let shelfBg = isSelected ? 'rgba(37, 99, 235, 0.25)' : hasProds ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.7)';

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
                        ? '0 0 25px rgba(59, 130, 246, 0.5), inset 0 0 15px rgba(59, 130, 246, 0.2)' 
                        : hasProds 
                        ? '0 0 15px rgba(16, 185, 129, 0.3)' 
                        : '0 4px 8px rgba(0, 0, 0, 0.5)',
                      transition: 'all 0.3s ease',
                      position: 'relative',
                      transform: isSelected && viewAngle === '3d' ? 'translateZ(25px) scale(1.04)' : 'translateZ(0px)',
                      userSelect: 'none'
                    }}
                  >
                    {/* Estructura Metálica 3D Viga Frontal */}
                    <div style={{
                      height: '4px', backgroundColor: isSelected ? '#60a5fa' : hasProds ? '#34d399' : '#475569',
                      borderRadius: '2px', marginBottom: '10px', boxShadow: isSelected ? '0 0 10px #60a5fa' : 'none'
                    }} />

                    {/* Cabecera del Estante / Viga */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          backgroundColor: isSelected ? '#2563eb' : hasProds ? '#059669' : '#334155',
                          color: '#ffffff', fontWeight: 800, fontSize: '0.78rem', padding: '3px 9px', borderRadius: '6px'
                        }}>
                          VIGA {lvl} {lvl === 'A' ? '(PISO)' : ''}
                        </span>
                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: isSelected ? '#93c5fd' : '#f8fafc' }}>
                          {slot.code}-{lvl}
                        </span>
                      </div>

                      <span style={{
                        fontSize: '0.72rem', fontWeight: 800, padding: '3px 9px', borderRadius: '12px',
                        backgroundColor: hasProds ? 'rgba(16, 185, 129, 0.25)' : 'rgba(148, 163, 184, 0.12)',
                        color: hasProds ? '#34d399' : '#94a3b8', border: '1px solid ' + (hasProds ? '#059669' : '#475569')
                      }}>
                        {hasProds ? `🟢 ${prodsInLvl.reduce((acc, curr) => acc + (curr.lot.stock || 0), 0)} u. Almacenadas` : '⚪ Viga Disponible'}
                      </span>
                    </div>

                    {/* Renderizado 3D de Pallets de Madera y Cajas Stackeadas */}
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

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#34d399', display: 'block' }}>
                                {lot.stock} un.
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Pallet Asignado</span>
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
                        <span>Espacio libre en Viga {lvl}. Hacé clic para seleccionar y cargar pallet.</span>
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
                  ? `Esta viga contiene ${currentLevelProducts.length} lote(s) almacenado(s). Podés ingresar stock adicional abajo.`
                  : `La viga ${selectedSubLevel} está libre. Seleccioná un producto del catálogo para posicionar la mercadería.`}
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
                    placeholder="Ej: L-240810"
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
                <span>{isSubmitting ? 'Cargando Stock...' : `💾 Cargar Pallet en Viga ${selectedSubLevel} (${slot.code}-${selectedSubLevel})`}</span>
              </button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
}
