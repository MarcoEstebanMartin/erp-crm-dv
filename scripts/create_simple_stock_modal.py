import json
import re

modal_code = '''import React, { useState, useEffect } from 'react';
import { X, Package, Check, Layers, Plus } from 'lucide-react';

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

  useEffect(() => {
    if (slot) {
      setSelectedSubLevel('A');
      setSelectedProductId('');
      setLotNumber('');
      setExpirationDate('');
      setQuantity(1);
      setSuccessMsg(null);
    }
  }, [slot]);

  if (!isOpen || !slot) return null;

  const getSubLevelsList = (nivelStr: string): string[] => {
    if (nivelStr === 'A-B-C-D-E-F') return ['A', 'B', 'C', 'D', 'E', 'F'];
    if (nivelStr === 'A-B-C') return ['A', 'B', 'C'];
    if (nivelStr === 'A-B') return ['A', 'B'];
    return ['A'];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || quantity <= 0) return;

    setIsSubmitting(true);
    try {
      const finalCode = slot.nivel !== 'A' ? `${slot.code}-NIVEL-${selectedSubLevel}` : slot.code;
      await onSaveStock(
        finalCode,
        Number(selectedProductId),
        lotNumber || 'S/L',
        expirationDate,
        Number(quantity)
      );
      setSuccessMsg(`¡Stock cargado con éxito en ${finalCode}!`);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error cargando stock:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(3px)',
      zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden',
        border: '1px solid var(--border-color)'
      }}>
        {/* Header simple y efectivo */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: '#007AFF', color: '#fff', borderRadius: '8px', padding: '6px' }}>
              <Package size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Cargar Mercadería en Slot
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600 }}>
                {slot.code} — Fila {slot.row}, Col {slot.col} ({slot.deposito || 'Depósito 1'})
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '6px', borderRadius: '50%' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {successMsg && (
            <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', color: '#15803d', padding: '10px 14px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Selector de Nivel de Altura */}
          {slot.nivel !== 'A' && (
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                <Layers size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Seleccionar Nivel de Altura ({slot.nivel}):
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {getSubLevelsList(slot.nivel).map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    className={`btn ${selectedSubLevel === lvl ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '6px', fontWeight: 700 }}
                    onClick={() => setSelectedSubLevel(lvl)}
                  >
                    Nivel {lvl} {lvl === 'A' ? '(Piso)' : `(Viga ${lvl})`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Producto */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Producto:
            </label>
            <select
              className="form-control"
              style={{ fontSize: '0.85rem', padding: '9px 12px', borderRadius: '6px' }}
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
            style={{ width: '100%', marginTop: '8px', fontSize: '0.88rem', padding: '10px', borderRadius: '8px', fontWeight: 700 }}
          >
            {isSubmitting ? 'Guardando...' : `💾 Cargar Mercadería ${slot.nivel !== 'A' ? `(Nivel ${selectedSubLevel})` : ''}`}
          </button>
        </form>
      </div>
    </div>
  );
}
'''

with open('frontend/src/components/SimpleStockLoadModal.tsx', 'w', encoding='utf-8') as f:
    f.write(modal_code)

print("EXITO: SimpleStockLoadModal.tsx creado con éxito.")
