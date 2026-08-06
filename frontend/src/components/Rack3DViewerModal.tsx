import React, { useState, useEffect } from 'react';
import { X, Package, Check, Layers, Plus, Box, Layers3, AlertTriangle, ArrowUpRight, RotateCcw } from 'lucide-react';
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
  allProducts,
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

  useEffect(() => {
    if (slot) {
      setSelectedSubLevel('A');
      setSelectedProductId('');
      setLotNumber('');
      setExpirationDate('');
      setQuantity(1);
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [slot]);

  if (!isOpen || !slot) return null;

  const getSubLevelsList = (nivelStr: string): string[] => {
    if (nivelStr === 'A-B-C-D-E-F') return ['F', 'E', 'D', 'C', 'B', 'A']; // De arriba hacia abajo
    if (nivelStr === 'A-B-C') return ['C', 'B', 'A'];
    if (nivelStr === 'A-B') return ['B', 'A'];
    return ['A'];
  };

  const levelsList = getSubLevelsList(slot.nivel || 'A');

  // Obtener productos cargados en un nivel específico (A, B, C...)
  const getProductsInLevel = (lvl: string) => {
    const matching: { product: any; lot: any }[] = [];
    const lvlCode = `${slot.code}-${lvl}`;

    allProducts.forEach(p => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach((l: any) => {
          const loc = l.location || '';
          if (l.stock > 0 && (loc === lvlCode || (lvl === 'A' && loc === slot.code) || loc.startsWith(lvlCode))) {
            matching.push({ product: p, lot: l });
          }
        });
      } else if (p.stock > 0 && (p.defaultLocation === lvlCode || (lvl === 'A' && p.defaultLocation === slot.code))) {
        matching.push({ product: p, lot: { lotNumber: 'S/L', stock: p.stock } });
      }
    });

    return matching;
  };

  const currentLevelProducts = getProductsInLevel(selectedSubLevel);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) {
      setErrorMsg('Por favor seleccioná un producto del catálogo y la cantidad.');
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

      await onRefresh();

      setSuccessMsg(`¡Pallet cargado con éxito en ${finalCode}!`);
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
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(6px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '92vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--border-color)'
      }}>
        {/* Header Modal 3D */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#0f172a', color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#2563eb', color: '#fff', borderRadius: '10px', padding: '8px 10px' }}>
              <Layers3 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  Rack Tridimensional WMS — Posición {slot.code}
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '3px 8px' }}>
                  {slot.nivel} ({levelsList.length} Niveles de Altura)
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
                📍 {slot.deposito || 'Depósito 1'} — Fila {slot.row}, Columna {slot.col} (Sector: {slot.chamber || 'GENERAL'})
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', padding: '5px 11px', display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }}
              onClick={() => setViewAngle(viewAngle === '3d' ? 'front' : '3d')}
            >
              <RotateCcw size={14} />
              <span>Perspectiva: {viewAngle === '3d' ? '3D Isométrica' : 'Vista Frontal 2D'}</span>
            </button>

            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #334155' }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo Modal: Estructura 3D del Rack (Izquierda) + Formulario e Inspección (Derecha) */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* VISUALIZADOR 3D ISOMÉTRICO DE ESTANTERÍA Y VIGAS */}
          <div style={{
            flex: 1.2, backgroundColor: '#090d16', padding: '24px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            position: 'relative', borderRight: '1px solid #1e293b'
          }}>
            <div style={{ position: 'absolute', top: '16px', left: '20px', fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💡 Hacé clic en cualquier viga 3D para seleccionarla</span>
            </div>

            {/* Estructura del Rack */}
            <div style={{
              width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px',
              transform: viewAngle === '3d' ? 'perspective(800px) rotateX(12deg) rotateY(-8deg)' : 'none',
              transition: 'transform 0.4s ease'
            }}>
              {levelsList.map((lvl) => {
                const prodsInLvl = getProductsInLevel(lvl);
                const hasProds = prodsInLvl.length > 0;
                const isSelected = selectedSubLevel === lvl;

                let shelfBorderColor = isSelected ? '#3b82f6' : hasProds ? '#10b981' : '#334155';
                let shelfBg = isSelected ? 'rgba(59, 130, 246, 0.15)' : hasProds ? 'rgba(16, 185, 129, 0.12)' : 'rgba(30, 41, 59, 0.5)';

                return (
                  <div
                    key={lvl}
                    onClick={() => setSelectedSubLevel(lvl)}
                    style={{
                      border: `2px solid ${shelfBorderColor}`,
                      backgroundColor: shelfBg,
                      borderRadius: '10px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 20px rgba(59, 130, 246, 0.35)' : '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      transform: isSelected ? 'translateZ(15px) scale(1.02)' : 'translateZ(0px)',
                      userSelect: 'none'
                    }}
                  >
                    {/* Indicador de Nivel / Viga */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          backgroundColor: isSelected ? '#2563eb' : hasProds ? '#059669' : '#334155',
                          color: '#ffffff', fontWeight: 800, fontSize: '0.78rem', padding: '3px 9px', borderRadius: '6px'
                        }}>
                          VIGA {lvl} {lvl === 'A' ? '(PISO)' : ''}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? '#60a5fa' : '#f8fafc' }}>
                          {slot.code}-{lvl}
                        </span>
                      </div>

                      <span style={{
                        fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px',
                        backgroundColor: hasProds ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                        color: hasProds ? '#34d399' : '#94a3b8', border: '1px solid ' + (hasProds ? '#059669' : '#475569')
                      }}>
                        {hasProds ? `🟢 ${prodsInLvl.reduce((acc, curr) => acc + (curr.lot.stock || 0), 0)} u. Almacenadas` : '⚪ Viga Disponible'}
                      </span>
                    </div>

                    {/* Representación 3D de Pallet / Cajas en el Estante */}
                    {hasProds ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {prodsInLvl.map(({ product, lot }, pIdx) => (
                          <div
                            key={pIdx}
                            style={{
                              backgroundColor: 'rgba(15, 23, 42, 0.85)',
                              border: '1px solid #059669',
                              borderRadius: '6px',
                              padding: '8px 10px',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Box size={16} color="#34d399" />
                              <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                                  [{product.sku}] {product.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  Lote: <strong style={{ color: '#38bdf8' }}>{lot.lotNumber}</strong> {lot.expirationDate ? `| Vence: ${new Date(lot.expirationDate).toLocaleDateString()}` : ''}
                                </div>
                              </div>
                            </div>

                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#34d399' }}>
                              {lot.stock} un.
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        border: '1.5px dashed #334155', borderRadius: '6px', padding: '12px', textAlign: 'center',
                        color: '#64748b', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}>
                        <Plus size={14} />
                        <span>Espacio libre en Viga {lvl}. Hacé clic para seleccionar y cargar.</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FORMULARIO Y REGISTRO DE STOCK (Derecha) */}
          <div style={{ flex: 1, padding: '24px', backgroundColor: '#ffffff', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} color="#2563eb" />
                <span>Nivel Seleccionado: Viga {selectedSubLevel} ({slot.code}-{selectedSubLevel})</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: '1.4' }}>
                {currentLevelProducts.length > 0
                  ? `Esta viga contiene actualmente ${currentLevelProducts.length} producto(s) asignado(s). Podés añadir más bultos abajo.`
                  : `La viga ${selectedSubLevel} está libre. Seleccioná un producto del catálogo para ubicar la mercadería.`}
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
                  {allProducts.map((p: any) => (
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
                  width: '100%', marginTop: '10px', fontSize: '0.9rem', padding: '12px', borderRadius: '8px', fontWeight: 800,
                  backgroundColor: '#2563eb', border: 'none', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
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
