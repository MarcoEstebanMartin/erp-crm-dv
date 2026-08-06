import json

with open('scripts/depositomapa_layout.json', 'r', encoding='utf-8') as f:
    layout_data = json.load(f)

with open('scripts/depositomapa_slots.json', 'r', encoding='utf-8') as f:
    slots_data = json.load(f)

# Generar el componente ExcelSpatialMapModal.tsx basado en depositomapa.xlsx
modal_code = '''import React, { useState } from 'react';
import { X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Package, Plus, Check, Layers } from 'lucide-react';

interface ExcelSpatialMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: any[];
  onAssignStock: (slotCode: string, productId: number, lotNumber: string, expirationDate: string, quantity: number) => Promise<void>;
}

const layoutData = ''' + json.dumps(layout_data, ensure_ascii=False) + ''';
const slotsInfo = ''' + json.dumps(slots_data['all_slots'], ensure_ascii=False) + ''';

export default function ExcelSpatialMapModal({
  isOpen,
  onClose,
  allProducts,
  onAssignStock
}: ExcelSpatialMapModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [selectedSubLevel, setSelectedSubLevel] = useState<string>('A');

  // Formulario de Carga
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCellClick = (r: number, c: number, val: string) => {
    if (['A', 'A-B', 'A-B-C', 'A-B-C-D-E-F'].includes(val)) {
      const foundSlot = slotsInfo.find((s: any) => s.row === r && s.col === c);
      if (foundSlot) {
        setSelectedSlot(foundSlot);
        setSelectedSubLevel('A');
        setSuccessMessage(null);
        setSelectedProductId('');
        setLotNumber('');
        setExpirationDate('');
        setQuantity(1);
      }
    }
  };

  const getSubLevelsList = (nivelStr: string): string[] => {
    if (nivelStr === 'A-B-C-D-E-F') return ['A', 'B', 'C', 'D', 'E', 'F'];
    if (nivelStr === 'A-B-C') return ['A', 'B', 'C'];
    if (nivelStr === 'A-B') return ['A', 'B'];
    return ['A'];
  };

  const handleSaveProductToSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !selectedProductId || quantity <= 0) return;

    setIsSubmitting(true);
    try {
      const finalSlotCode = selectedSlot.nivel !== 'A' 
        ? `${selectedSlot.code}-NIVEL-${selectedSubLevel}` 
        : selectedSlot.code;

      await onAssignStock(
        finalSlotCode,
        Number(selectedProductId),
        lotNumber || 'S/L',
        expirationDate,
        Number(quantity)
      );
      setSuccessMessage('¡Stock asignado exitosamente a ' + finalSlotCode + '!');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error guardando stock en slot:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoomCellStyle = (cell: any) => {
    const val = cell.val;
    const isSlot = cell.is_storage;

    let bg = '#ffffff';
    let color = '#334155';
    let border = '1px solid #e2e8f0';

    if (val.includes('BAÑO')) {
      bg = '#fce7f3'; color = '#881337'; border = '2px solid #f43f5e';
    } else if (val.includes('CAMARA 2')) {
      bg = '#e0f2fe'; color = '#0369a1'; border = '2px solid #0284c7';
    } else if (val.includes('CAMARA 1')) {
      bg = '#ecfeff'; color = '#0e7490'; border = '2px solid #0891b2';
    } else if (val.includes('CAMARA 3')) {
      bg = '#f3e8ff'; color = '#6b21a8'; border = '2px solid #7e22ce';
    }

    if (isSlot) {
      if (val === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
      else if (val === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
      else if (val === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
      else if (val === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
    }

    return { bg, color, border };
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: isFullscreen ? '0' : '16px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: isFullscreen ? '0' : '12px',
        width: isFullscreen ? '100vw' : '97vw',
        height: isFullscreen ? '100vh' : '95vh',
        maxWidth: isFullscreen ? 'none' : '1700px',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header Modal */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🗺️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Plano Gráfico Fiel (Basado en depositomapa.xlsx)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Disposición espacial limpia sin áreas administrativas. Hacé clic en cualquier celda A, A-B o A-B-C para gestionar el stock.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px' }}>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.15))} title="Alejar">
                <ZoomOut size={14} />
              </button>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0 6px', minWidth: '45px', textAlign: 'center', color: '#1e293b' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.15))} title="Acercar">
                <ZoomIn size={14} />
              </button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.78rem' }} onClick={() => setZoomLevel(1)} title="Restablecer Zoom">
                <RotateCcw size={14} />
              </button>
            </div>

            <button type="button" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '6px 12px' }} onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isFullscreen ? 'Salir' : 'Pantalla Completa'}</span>
            </button>

            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px', borderRadius: '50%' }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo Principal: Canvas + Panel Lateral */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          <div style={{ flex: 1, overflow: 'auto', padding: '20px', backgroundColor: '#f1f5f9' }}>
            <div style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
              transition: 'transform 0.15s ease',
              display: 'inline-block',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)'
            }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: '2px', fontSize: '0.68rem', fontFamily: 'sans-serif' }}>
                <tbody>
                  {layoutData.matrix.map((row: any[], rIdx: number) => (
                    <tr key={rIdx}>
                      {row.map((cell: any, cIdx: number) => {
                        const isSlot = cell.is_storage;
                        const cellText = cell.val;
                        const styleInfo = getRoomCellStyle(cell);
                        
                        let hasStock = false;
                        let foundSlotObj: any = null;
                        if (isSlot) {
                          foundSlotObj = slotsInfo.find((s: any) => s.row === (rIdx + 1) && s.col === (cIdx + 1));
                          if (foundSlotObj) {
                            allProducts.forEach(p => {
                              if (p.lots && p.lots.length > 0) {
                                p.lots.forEach((l: any) => {
                                  if ((l.location === foundSlotObj.code || l.location.startsWith(foundSlotObj.code)) && l.stock > 0) hasStock = true;
                                });
                              } else if (p.defaultLocation === foundSlotObj.code && p.stock > 0) {
                                hasStock = true;
                              }
                            });
                          }
                        }

                        const isSelected = selectedSlot && foundSlotObj && selectedSlot.code === foundSlotObj.code;

                        return (
                          <td
                            key={cIdx}
                            onClick={() => handleCellClick(rIdx + 1, cIdx + 1, cellText)}
                            style={{
                              border: isSlot 
                                ? (isSelected ? '2.5px solid #007AFF' : hasStock ? '2px solid #22c55e' : styleInfo.border) 
                                : styleInfo.border,
                              backgroundColor: isSelected ? '#e0f2fe' : hasStock ? '#dcfce7' : styleInfo.bg,
                              color: isSelected ? '#007AFF' : hasStock ? '#15803d' : styleInfo.color,
                              fontWeight: isSlot || cellText.length > 2 ? 'bold' : 'normal',
                              padding: '4px 6px',
                              textAlign: 'center',
                              minWidth: isSlot ? '38px' : '26px',
                              height: '30px',
                              cursor: isSlot ? 'pointer' : 'default',
                              userSelect: 'none',
                              whiteSpace: 'nowrap',
                              borderRadius: isSlot ? '4px' : '2px'
                            }}
                            title={isSlot && foundSlotObj ? `${foundSlotObj.code} (${foundSlotObj.deposito})` : cellText}
                          >
                            {isSlot ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                <span>{cellText}</span>
                                {hasStock && <span style={{ color: '#22c55e', fontSize: '0.65rem' }}>🟢</span>}
                              </div>
                            ) : (
                              cellText
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel Lateral de Carga de Productos */}
          <div style={{ width: '400px', backgroundColor: '#ffffff', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} color="var(--color-primary)" />
                <span>Gestión de Slot Seleccionado</span>
              </h4>
            </div>

            {selectedSlot ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ backgroundColor: '#f1f5f9', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {selectedSlot.code}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                    📍 {selectedSlot.deposito}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Fila {selectedSlot.row}, Columna {selectedSlot.col} de depositomapa.xlsx. Nivel: <strong>{selectedSlot.nivel}</strong>.
                  </div>
                </div>

                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Layers size={15} />
                    <span>Niveles de Altura ({selectedSlot.nivel})</span>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#92400e', lineHeight: '1.35' }}>
                    {selectedSlot.nivel === 'A' && 'Este slot es de 1 nivel (Piso A).'}
                    {selectedSlot.nivel === 'A-B' && 'Este rack tiene 2 niveles: Nivel A (Piso) y Nivel B (Viga 1).' }
                    {selectedSlot.nivel === 'A-B-C' && 'Este rack tiene 3 niveles: Nivel A (Piso), Nivel B (Viga 1) y Nivel C (Viga 2).' }
                    {selectedSlot.nivel === 'A-B-C-D-E-F' && 'Esta estantería tiene 6 niveles (Estantes A, B, C, D, E, F).' }
                  </div>
                </div>

                {selectedSlot.nivel !== 'A' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Elegir Nivel de Altura a Cargar:
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {getSubLevelsList(selectedSlot.nivel).map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          className={`btn ${selectedSubLevel === lvl ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '6px', fontWeight: 700 }}
                          onClick={() => setSelectedSubLevel(lvl)}
                        >
                          Nivel {lvl} {lvl === 'A' ? '(Piso)' : `(Viga / Estante ${lvl})`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '10px 12px', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={16} />
                    <span>{successMessage}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProductToSlot} style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', backgroundColor: '#fafafa' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} color="var(--color-primary)" />
                    <span>Asignar Stock en {selectedSlot.code} {selectedSlot.nivel !== 'A' ? `(Nivel ${selectedSubLevel})` : ''}</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Seleccionar Producto del Catálogo:
                    </label>
                    <select
                      className="form-control"
                      style={{ fontSize: '0.82rem', padding: '8px' }}
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : '')}
                      required
                    >
                      <option value="">-- Buscar / Seleccionar Producto --</option>
                      {allProducts.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          [{p.sku}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Número de Lote (Opcional):
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: L-240810"
                      style={{ fontSize: '0.82rem', padding: '8px' }}
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Fecha de Vencimiento (Opcional):
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      style={{ fontSize: '0.82rem', padding: '8px' }}
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Cantidad (Cajas / Bultos / Unidades):
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      style={{ fontSize: '0.82rem', padding: '8px' }}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || !selectedProductId}
                    style={{ marginTop: '6px', fontSize: '0.82rem', padding: '8px 14px', borderRadius: '6px', fontWeight: 600 }}
                  >
                    {isSubmitting ? 'Guardando Stock...' : `💾 Guardar en Nivel ${selectedSubLevel}`}
                  </button>
                </form>

              </div>
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👆</div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Ningún slot seleccionado</div>
                <div style={{ fontSize: '0.8rem', marginTop: '6px', lineHeight: '1.4' }}>
                  Hacé clic en cualquier recuadro <strong>A, A-B o A-B-C</strong> del plano para seleccionar el nivel de altura a cargar.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
'''

with open('frontend/src/components/ExcelSpatialMapModal.tsx', 'w', encoding='utf-8') as f:
    f.write(modal_code)

print("EXITO: ExcelSpatialMapModal.tsx creado con el mapa limpio de depositomapa.xlsx.")
