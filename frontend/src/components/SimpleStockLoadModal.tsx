import React, { useState, useEffect } from 'react';
import { X, Package, Check, Layers, Plus, Box } from 'lucide-react';

interface SimpleStockLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: any | null;
  allProducts: any[];
  onSaveStock: (slotCode: string, productId: number, lotNumber: string, expirationDate: string, quantity: number) => Promise<void>;
}

export default function SimpleStockLoadModal({
  isOpen,
  onClose,
  slot,
  allProducts,
  onSaveStock
}: SimpleStockLoadModalProps) {
  const [selectedSubLevel, setSelectedSubLevel] = useState<string>('A');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [lotNumber, setLotNumber] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    if (nivelStr === 'A-B-C-D-E-F') return ['A', 'B', 'C', 'D', 'E', 'F'];
    if (nivelStr === 'A-B-C') return ['A', 'B', 'C'];
    if (nivelStr === 'A-B') return ['A', 'B'];
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
          if (l.stock > 0 && (loc === lvlCode || loc === slot.code || loc.startsWith(lvlCode))) {
            matching.push({ product: p, lot: l });
          }
        });
      } else if (p.stock > 0 && (p.defaultLocation === lvlCode || p.defaultLocation === slot.code)) {
        matching.push({ product: p, lot: { lotNumber: 'S/L', stock: p.stock } });
      }
    });

    return matching;
  };

  const currentLevelProducts = getProductsInLevel(selectedSubLevel);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) {
      setErrorMsg('Por favor seleccioná un producto y una cantidad válida.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const finalCode = slot.nivel !== 'A' ? `${slot.code}-${selectedSubLevel}` : slot.code;
      
      await onSaveStock(
        finalCode,
        Number(selectedProductId),
        lotNumber.trim() || 'S/L',
        expirationDate,
        Number(quantity)
      );

      setSuccessMsg(`¡Mercadería cargada con éxito en ${finalCode}!`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Error cargando stock:', err);
      setErrorMsg(err.message || 'Ocurrió un error al guardar la mercadería.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '540px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)'
      }}>
        {/* Header con Código y Ubicación */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#007AFF', color: '#fff', borderRadius: '8px', padding: '8px' }}>
              <Package size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Cargar Mercadería en Slot
              </h3>
              <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 700 }}>
                {slot.code} — Fila {slot.row}, Col {slot.col} ({slot.deposito || 'Depósito 1'})
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px', borderRadius: '50%' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Formulario e Inspección de Nivel */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
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

          {/* Selector de Nivel de Altura (Vigas A, B, C...) */}
          {slot.nivel !== 'A' && (
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={15} color="#2563eb" />
                  <span>Seleccionar Nivel de Altura ({slot.nivel}):</span>
                </label>
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Nivel Activo: {selectedSubLevel}</span>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {levelsList.map(lvl => {
                  const prodsInLvl = getProductsInLevel(lvl);
                  const hasProds = prodsInLvl.length > 0;
                  const isSelected = selectedSubLevel === lvl;

                  return (
                    <button
                      key={lvl}
                      type="button"
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        fontSize: '0.8rem', padding: '7px 13px', borderRadius: '6px', fontWeight: 700,
                        backgroundColor: isSelected ? '#007AFF' : hasProds ? '#ecfdf5' : '#ffffff',
                        color: isSelected ? '#ffffff' : hasProds ? '#047857' : '#334155',
                        border: isSelected ? '1.5px solid #007AFF' : hasProds ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                        display: 'flex', alignItems: 'center', gap: '5px'
                      }}
                      onClick={() => setSelectedSubLevel(lvl)}
                    >
                      <span>Nivel {lvl} {lvl === 'A' ? '(Piso)' : `(Viga ${lvl})`}</span>
                      {hasProds && <span style={{ fontSize: '0.65rem' }}>🟢</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ficha Visual del Nivel Seleccionado (Productos Existentes) */}
          <div style={{ backgroundColor: currentLevelProducts.length > 0 ? '#f0fdf4' : '#fafafa', border: '1px solid ' + (currentLevelProducts.length > 0 ? '#bbf7d0' : '#e2e8f0'), padding: '10px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: currentLevelProducts.length > 0 ? '#166534' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Box size={14} />
              <span>Estado Nivel {selectedSubLevel}: {currentLevelProducts.length > 0 ? `${currentLevelProducts.length} producto(s) ocupando este nivel` : 'Nivel Vacío (Disponible)'}</span>
            </div>

            {currentLevelProducts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                {currentLevelProducts.map(({ product, lot }, idx) => (
                  <div key={idx} style={{ fontSize: '0.78rem', backgroundColor: '#ffffff', padding: '6px 8px', borderRadius: '4px', border: '1px solid #d1fae5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#15803d' }}>[{product.sku}] {product.name}</span>
                    <span style={{ fontWeight: 700, color: '#047857' }}>{lot.stock} un. (Lote: {lot.lotNumber})</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                No hay stock registrado en el Nivel {selectedSubLevel}. Completá el formulario abajo para añadir productos.
              </div>
            )}
          </div>

          {/* Producto */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Seleccionar Producto del Catálogo:
            </label>
            <select
              className="form-control"
              style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
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

          {/* Lote y Vencimiento */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Número de Lote:
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ej: L-240810"
                style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '6px' }}
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Vencimiento:
              </label>
              <input
                type="date"
                className="form-control"
                style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '6px' }}
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Cantidad de Cajas / Bultos:
            </label>
            <input
              type="number"
              min="1"
              className="form-control"
              style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '6px' }}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </div>

          {/* Botón de Guardado */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !selectedProductId}
            style={{
              width: '100%', marginTop: '8px', fontSize: '0.88rem', padding: '11px', borderRadius: '8px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <Plus size={16} />
            <span>{isSubmitting ? 'Guardando...' : `💾 Cargar Mercadería en Nivel ${selectedSubLevel}`}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
