import React, { useState, useEffect } from 'react';
import { Calculator, Check, X } from 'lucide-react';

interface SupplierCostCalculatorModalProps {
  product: any | null;
  onClose: () => void;
  onSaveProduct: (updatedProduct: any) => Promise<void>;
}

export const SupplierCostCalculatorModal: React.FC<SupplierCostCalculatorModalProps> = ({
  product,
  onClose,
  onSaveProduct,
}) => {
  if (!product) return null;

  const initialMarginPct =
    product.profitMargin !== null && product.profitMargin !== undefined
      ? Math.round((Number(product.profitMargin) > 2 ? Number(product.profitMargin) : (Number(product.profitMargin) - 1) * 100) * 100) / 100
      : product.rubro?.profitMargin
        ? Math.round((Number(product.rubro.profitMargin) - 1) * 100 * 100) / 100
        : 25;

  const [mode, setMode] = useState<'MARGIN' | 'MANUAL_PRICE'>('MARGIN');
  const [costPrice, setCostPrice] = useState<string>(String(product.costPrice || 0));
  const [marginPct, setMarginPct] = useState<string>(String(initialMarginPct));
  const [manualPrice4, setManualPrice4] = useState<string>(String(Math.round(Number(product.listPrice || 0))));
  const [listPriceB, setListPriceB] = useState<string>(String(Math.round(Number(product.listPriceB || 0))));
  const [reason, setReason] = useState<string>('Actualización de costo / Lista 4');

  const [showCalc, setShowCalc] = useState(false);
  const [rawSupplierPrice, setRawSupplierPrice] = useState<string>('');
  const [discountPct, setDiscountPct] = useState<string>('0');
  const [calcIvaPct, setCalcIvaPct] = useState<string>('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleApplyCalculator = () => {
    const raw = Number(rawSupplierPrice || 0);
    const disc = Number(discountPct || 0);
    const iva = Number(calcIvaPct || 0);
    if (raw <= 0) {
      setError('Ingresá un precio bruto de factura mayor a 0.');
      return;
    }
    setError(null);
    const afterDiscount = raw * (1 - disc / 100);
    const netCost = Math.round(afterDiscount * (1 + iva / 100) * 100) / 100;
    setCostPrice(String(netCost));
    setShowCalc(false);
  };

  const numCost = Number(costPrice) || 0;
  const numMargin = Number(marginPct) || 0;
  const previewPrice4 =
    mode === 'MANUAL_PRICE'
      ? Math.round(Number(manualPrice4) || 0)
      : Math.round(numCost * (1 + numMargin / 100));

  const previewMargin =
    mode === 'MANUAL_PRICE' && numCost > 0
      ? ((previewPrice4 / numCost - 1) * 100).toFixed(2)
      : numMargin.toFixed(2);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const effectiveMarginFactor = Number((1 + Number(previewMargin) / 100).toFixed(4));
      await onSaveProduct({
        ...product,
        costPrice: numCost,
        listPrice: previewPrice4,
        listPriceB: Number(listPriceB) || 0,
        profitMargin: effectiveMarginFactor,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el costo y precio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 2500 }} onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: '#E30613' }}>
              SKU {product.sku} • {product.provider?.name || product.rubro?.name || 'Catálogo Oficial'}
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 700 }}>{product.name}</h3>
          </div>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              1. Costo Neto de Reposición ($)
            </label>
            <button
              type="button"
              onClick={() => setShowCalc(!showCalc)}
              style={{ background: 'none', border: 'none', color: '#E30613', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Calculator size={14} />
              <span>{showCalc ? 'Ocultar Mini-Calculadora' : 'Abrir Mini-Calculadora de Factura'}</span>
            </button>
          </div>

          {showCalc && (
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                Calculadora de Factura Proveedor (Bruto - % Bonif + % IVA)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Precio Factura $</label>
                  <input type="number" step="0.01" className="input" style={{ padding: '6px 8px', fontSize: '0.8rem' }} value={rawSupplierPrice} onChange={(e) => setRawSupplierPrice(e.target.value)} placeholder="Ej: 10000" />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>% Bonif / Desc</label>
                  <input type="number" step="0.01" className="input" style={{ padding: '6px 8px', fontSize: '0.8rem' }} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>+ % IVA</label>
                  <select className="select" style={{ padding: '6px 8px', fontSize: '0.8rem', height: '33px' }} value={calcIvaPct} onChange={(e) => setCalcIvaPct(e.target.value)}>
                    <option value="0">0% (Incluido)</option>
                    <option value="21">+21%</option>
                    <option value="10.5">+10.5%</option>
                  </select>
                </div>
              </div>
              <button type="button" className="btn btn-primary" style={{ width: '100%', padding: '6px', fontSize: '0.78rem' }} onClick={handleApplyCalculator}>
                Pasar resultado al Costo Neto
              </button>
            </div>
          )}

          <input
            type="number"
            step="0.01"
            required
            autoFocus
            className="input"
            style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              className={`btn ${mode === 'MARGIN' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '8px' }}
              onClick={() => setMode('MARGIN')}
            >
              Calcular por % Margen
            </button>
            <button
              type="button"
              className={`btn ${mode === 'MANUAL_PRICE' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '8px' }}
              onClick={() => setMode('MANUAL_PRICE')}
            >
              Fijar Lista 4 Manual ($)
            </button>
          </div>

          {mode === 'MARGIN' ? (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>% Margen sobre Costo</label>
              <input type="number" step="0.01" className="input" style={{ fontFamily: 'monospace' }} value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Precio Lista 4 Oficial (Pesos Enteros $)</label>
              <input type="number" step="1" className="input" style={{ fontFamily: 'monospace' }} value={manualPrice4} onChange={(e) => setManualPrice4(e.target.value)} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Precio Caja Cerrada ($ opc.)</label>
              <input type="number" step="1" className="input" style={{ fontSize: '0.82rem', fontFamily: 'monospace' }} value={listPriceB} onChange={(e) => setListPriceB(e.target.value)} placeholder={`>= ${product.unitsPerBox || 1} u.`} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Motivo Auditoría</label>
              <input type="text" className="input" style={{ fontSize: '0.82rem' }} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Margen Real: </span>
              <strong style={{ fontFamily: 'monospace' }}>{previewMargin}%</strong>
            </div>
            <div style={{ fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Nueva Lista 4 (Entero): </span>
              <strong style={{ fontFamily: 'monospace', fontSize: '1.05rem', color: '#059669' }}>${previewPrice4.toLocaleString('es-AR')}</strong>
            </div>
          </div>

          {error && <div style={{ fontSize: '0.8rem', color: '#E30613', fontWeight: 600 }}>{error}</div>}

          <div className="modal-footer" style={{ paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar (Esc)</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#E30613', borderColor: '#E30613', display: 'inline-flex', alignItems: 'center', gap: '6px' }} disabled={saving}>
              <Check size={15} />
              <span>{saving ? 'Guardando...' : 'Confirmar y Guardar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default SupplierCostCalculatorModal;
