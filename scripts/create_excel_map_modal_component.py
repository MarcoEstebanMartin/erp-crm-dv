import json
import re

with open('scripts/excel_layout_exact.json', 'r', encoding='utf-8') as f:
    layout_data = json.load(f)

with open('scripts/exact_slots_intuitive.json', 'r', encoding='utf-8') as f:
    slots_data = json.load(f)

modal_tsx = '''import React, { useState } from 'react';
import { X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Package, Plus, Check } from 'lucide-react';

interface ExcelSpatialMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProducts: any[];
  onAssignStock: (slotCode: string, productId: number, lotNumber: string, expirationDate: string, quantity: number) => Promise<void>;
}

const matrixData = ''' + json.dumps(layout_data['matrix'], ensure_ascii=False) + ''';
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
      // Buscar información del slot
      const foundSlot = slotsInfo.find((s: any) => s.row === r && s.col === c);
      if (foundSlot) {
        setSelectedSlot(foundSlot);
        setSuccessMessage(null);
        // Reset form
        setSelectedProductId('');
        setLotNumber('');
        setExpirationDate('');
        setQuantity(1);
      }
    }
  };

  const handleSaveProductToSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !selectedProductId || quantity <= 0) return;

    setIsSubmitting(true);
    try {
      await onAssignStock(
        selectedSlot.code,
        Number(selectedProductId),
        lotNumber || 'S/L',
        expirationDate,
        Number(quantity)
      );
      setSuccessMessage('¡Stock asignado exitosamente al slot ' + selectedSlot.code + '!');
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      console.error('Error guardando stock en slot:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isFullscreen ? '0' : '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: isFullscreen ? '0' : '12px',
        width: isFullscreen ? '100vw' : '96vw',
        height: isFullscreen ? '100vh' : '94vh',
        maxWidth: isFullscreen ? 'none' : '1600px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header Modal */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🗺️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Plano Gráfico de Depósito (95-100% Fiel a mapa deposito.xlsx)
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Disposición geométrica exacta de celdas. Hacé clic en cualquier slot (A, A-B, A-B-C) para consultar o cargar productos.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Controles de Zoom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                onClick={() => setZoomLevel(prev => Math.max(0.7, prev - 0.15))}
                title="Alejar"
              >
                <ZoomOut size={14} />
              </button>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, padding: '0 6px', minWidth: '45px', textAlign: 'center' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                onClick={() => setZoomLevel(prev => Math.min(1.8, prev + 0.15))}
                title="Acercar"
              >
                <ZoomIn size={14} />
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                style={{ padding: '4px 8px', fontSize: '0.78rem' }}
                onClick={() => setZoomLevel(1)}
                title="Restablecer Zoom"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '6px 12px' }}
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}</span>
            </button>

            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              style={{ padding: '6px', borderRadius: '50%' }}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Cuerpo Principal: Matriz Visual + Panel de Carga Lateral */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Visor Gráfico de Celdas con Scroll y Zoom */}
          <div style={{ flex: 1, overflow: 'auto', padding: '24px', backgroundColor: '#f1f5f9' }}>
            <div style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
              transition: 'transform 0.15s ease',
              display: 'inline-block',
              backgroundColor: '#ffffff',
              border: '2px solid #cbd5e1',
              borderRadius: '8px',
              padding: '16px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
            }}>
              {/* Tabla Matriz Fiel 33 filas x 45 cols */}
              <table style={{ borderCollapse: 'collapse', fontSize: '0.68rem', fontFamily: 'monospace' }}>
                <tbody>
                  {matrixData.map((row: any[], rIdx: number) => (
                    <tr key={rIdx}>
                      {row.map((cell: any, cIdx: number) => {
                        const isSlot = cell.is_storage;
                        const cellText = cell.val;
                        
                        // Verificar si el slot tiene producto asignado
                        let hasStock = false;
                        let foundSlotObj: any = null;
                        if (isSlot) {
                          foundSlotObj = slotsInfo.find((s: any) => s.row === (rIdx + 1) && s.col === (cIdx + 1));
                          if (foundSlotObj) {
                            allProducts.forEach(p => {
                              if (p.lots && p.lots.length > 0) {
                                p.lots.forEach((l: any) => {
                                  if (l.location === foundSlotObj.code && l.stock > 0) hasStock = true;
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
                              border: isSlot ? (isSelected ? '2px solid #007AFF' : hasStock ? '1.5px solid #22c55e' : '1px solid #94a3b8') : '1px stroke #e2e8f0',
                              backgroundColor: isSelected ? '#e0f2fe' : hasStock ? '#dcfce7' : (cell.fill !== '#ffffff' ? cell.fill : '#ffffff'),
                              color: isSelected ? '#007AFF' : hasStock ? '#15803d' : '#1e293b',
                              fontWeight: isSlot || cellText.length > 3 ? 'bold' : 'normal',
                              padding: '4px 6px',
                              textAlign: 'center',
                              minWidth: isSlot ? '36px' : '28px',
                              height: '28px',
                              cursor: isSlot ? 'pointer' : 'default',
                              position: 'relative',
                              userSelect: 'none',
                              whiteSpace: 'nowrap'
                            }}
                            title={isSlot && foundSlotObj ? `${foundSlotObj.code} - ${foundSlotObj.sector}` : cellText}
                          >
                            {isSlot ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                <span>{cellText}</span>
                                {hasStock && <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>🟢</span>}
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

          {/* Panel Lateral de Carga de Productos y Detalle del Slot */}
          <div style={{ width: '380px', backgroundColor: '#ffffff', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} color="var(--color-primary)" />
                <span>Gestión de Slot Seleccionado</span>
              </h4>
            </div>

            {selectedSlot ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Info Card de la Posición */}
                <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {selectedSlot.code}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                    📍 Sector: {selectedSlot.sector}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {selectedSlot.deposito} (Fila {selectedSlot.row}, Columna {selectedSlot.col} de Excel). Nivel: <strong>{selectedSlot.nivel}</strong>.
                  </div>
                </div>

                {/* Mensaje de éxito */}
                {successMessage && (
                  <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '10px 12px', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={16} />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Formulario de Carga Directa a este Slot */}
                <form onSubmit={handleSaveProductToSlot} style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', backgroundColor: '#fafafa' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} color="var(--color-primary)" />
                    <span>Cargar / Asignar Producto a este Slot</span>
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
                    {isSubmitting ? 'Guardando Stock...' : '💾 Asignar Mercadería a Slot'}
                  </button>
                </form>

              </div>
            ) : (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👆</div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Ningún slot seleccionado</div>
                <div style={{ fontSize: '0.8rem', marginTop: '6px', lineHeight: '1.4' }}>
                  Hacé clic en cualquier recuadro <strong>A, A-B o A-B-C</strong> del plano de la izquierda para ver o ingresar productos.
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
    f.write(modal_tsx)

print("EXITO: ExcelSpatialMapModal.tsx creado con éxito.")
