import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CatalogCombo,
  CatalogStudioProduct,
} from '../../../utils/api/catalog-studio.api';

interface CatalogComboDialogProps {
  open: boolean;
  editingCombo: CatalogCombo | null;
  products: CatalogStudioProduct[];
  nextComboNumber: number;
  onClose: () => void;
  onSave: (combo: CatalogCombo) => void;
}

const CONDITION_CHIPS = ['1 BULTO', '2 BULTOS', '1 UNIDAD', '2 UNIDADES'];

export function CatalogComboDialog({
  open,
  editingCombo,
  products,
  nextComboNumber,
  onClose,
  onSave,
}: CatalogComboDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [comboNum, setComboNum] = useState('COMBO 1');
  const [title, setTitle] = useState('OFERTA COMBO');

  const [q1, setQ1] = useState('');
  const [sku1, setSku1] = useState('');
  const [name1, setName1] = useState('');
  const [price1, setPrice1] = useState('');
  const [uxb1, setUxb1] = useState('');
  const [cond1, setCond1] = useState('1 BULTO');
  const [img1, setImg1] = useState<string | null>(null);

  const [q2, setQ2] = useState('');
  const [sku2, setSku2] = useState('');
  const [name2, setName2] = useState('');
  const [price2, setPrice2] = useState('');
  const [uxb2, setUxb2] = useState('');
  const [cond2, setCond2] = useState('1 BULTO');
  const [img2, setImg2] = useState<string | null>(null);
  const [isFree2, setIsFree2] = useState(false);
  const [freeLabel2, setFreeLabel2] = useState('SIN CARGO');

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open) {
      if (editingCombo) {
        setComboNum(editingCombo.comboNum);
        setTitle(editingCombo.title);
        setSku1(editingCombo.product1.sku || '');
        setName1(editingCombo.product1.name);
        setPrice1(String(Math.round(editingCombo.product1.price)));
        setUxb1(editingCombo.product1.uxb || '');
        setCond1(editingCombo.product1.condition);
        setImg1(editingCombo.product1.imageUrl || null);

        setSku2(editingCombo.product2.sku || '');
        setName2(editingCombo.product2.name);
        setPrice2(String(Math.round(editingCombo.product2.price)));
        setUxb2(editingCombo.product2.uxb || '');
        setCond2(editingCombo.product2.condition);
        setImg2(editingCombo.product2.imageUrl || null);
        setIsFree2(Boolean(editingCombo.product2.isFree));
        setFreeLabel2(editingCombo.product2.freeLabel || 'SIN CARGO');
      } else {
        setComboNum(`COMBO ${nextComboNumber}`);
        setTitle('OFERTA COMBO');
        setQ1('');
        setSku1('');
        setName1('');
        setPrice1('');
        setUxb1('');
        setCond1('1 BULTO');
        setImg1(null);
        setQ2('');
        setSku2('');
        setName2('');
        setPrice2('');
        setUxb2('');
        setCond2('1 BULTO');
        setImg2(null);
        setIsFree2(false);
        setFreeLabel2('SIN CARGO');
      }
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [open, editingCombo, nextComboNumber]);

  const filtered1 = useMemo(() => {
    const term = q1.trim().toLowerCase();
    const list = products.filter((p) => p.isActive);
    if (!term) return list.slice(0, 60);
    return list
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .slice(0, 60);
  }, [products, q1]);

  const filtered2 = useMemo(() => {
    const term = q2.trim().toLowerCase();
    const list = products.filter((p) => p.isActive);
    if (!term) return list.slice(0, 60);
    return list
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term))
      .slice(0, 60);
  }, [products, q2]);

  const selectProd = (side: 1 | 2, sku: string) => {
    const found = products.find((p) => p.sku === sku);
    if (!found) return;
    if (side === 1) {
      setSku1(found.sku);
      setName1(found.name);
      setPrice1(String(Math.round(found.price)));
      setUxb1(found.unitsPerBox > 1 ? `${found.unitsPerBox} u.` : '');
      setImg1(found.imageUrl || null);
    } else {
      setSku2(found.sku);
      setName2(found.name);
      setPrice2(isFree2 ? '0' : String(Math.round(found.price)));
      setUxb2(found.unitsPerBox > 1 ? `${found.unitsPerBox} u.` : '');
      setImg2(found.imageUrl || null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name1.trim() || !name2.trim()) return;
    onSave({
      id: editingCombo?.id || `combo-${Date.now()}`,
      comboNum: comboNum.trim() || `COMBO ${nextComboNumber}`,
      title: title.trim() || 'OFERTA COMBO',
      category: 'COMBOS',
      product1: {
        sku: sku1 || null,
        name: name1.trim(),
        price: Math.max(0, Number(price1) || 0),
        uxb: uxb1.trim() || null,
        condition: cond1.trim() || '1 BULTO',
        imageUrl: img1,
      },
      product2: {
        sku: sku2 || null,
        name: name2.trim(),
        price: isFree2 ? 0 : Math.max(0, Number(price2) || 0),
        uxb: uxb2.trim() || null,
        condition: cond2.trim() || '1 BULTO',
        imageUrl: img2,
        isFree: isFree2,
        freeLabel: isFree2 ? freeLabel2.trim() || 'SIN CARGO' : null,
      },
    });
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="cs-dialog cs-dialog-wide"
      aria-labelledby="cs-combo-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit}>
        <div className="cs-dialog-header">
          <h1 id="cs-combo-dialog-title" className="cs-dialog-title">
            {editingCombo ? 'Editar combo' : 'Nuevo combo'}
          </h1>
          <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="cs-dialog-body">
          <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 10 }}>
            <div className="cs-field">
              <label htmlFor="cs-combo-num">Etiqueta</label>
              <input
                id="cs-combo-num"
                className="cs-input"
                value={comboNum}
                onChange={(e) => setComboNum(e.target.value)}
                required
              />
            </div>
            <div className="cs-field">
              <label htmlFor="cs-combo-title">Título</label>
              <input
                id="cs-combo-title"
                className="cs-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="cs-combo-grid">
            {/* Producto 1 */}
            <div className="cs-combo-side">
              <strong style={{ fontSize: 12 }}>Producto 1</strong>
              <input
                className="cs-input"
                placeholder="Buscar por nombre o SKU..."
                value={q1}
                onChange={(e) => setQ1(e.target.value)}
              />
              <select
                className="cs-select"
                value={sku1}
                onChange={(e) => selectProd(1, e.target.value)}
              >
                <option value="">Elegir producto</option>
                {filtered1.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </select>
              <input
                className="cs-input"
                placeholder="Nombre en combo"
                value={name1}
                onChange={(e) => setName1(e.target.value)}
                required
              />
              <div className="cs-combo-price-row">
                <input
                  type="number"
                  min={0}
                  className="cs-input"
                  placeholder="Precio promo"
                  value={price1}
                  onChange={(e) => setPrice1(e.target.value)}
                  required
                />
                <input
                  className="cs-input"
                  placeholder="UxB"
                  value={uxb1}
                  onChange={(e) => setUxb1(e.target.value)}
                />
              </div>
              <input
                className="cs-input"
                placeholder="Condición"
                value={cond1}
                onChange={(e) => setCond1(e.target.value)}
                required
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {CONDITION_CHIPS.map((c) => (
                  <button key={c} type="button" className="cs-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => setCond1(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Producto 2 */}
            <div className="cs-combo-side">
              <strong style={{ fontSize: 12 }}>Producto 2</strong>
              <input
                className="cs-input"
                placeholder="Buscar por nombre o SKU..."
                value={q2}
                onChange={(e) => setQ2(e.target.value)}
              />
              <select
                className="cs-select"
                value={sku2}
                onChange={(e) => selectProd(2, e.target.value)}
              >
                <option value="">Elegir producto</option>
                {filtered2.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </select>
              <input
                className="cs-input"
                placeholder="Nombre en combo"
                value={name2}
                onChange={(e) => setName2(e.target.value)}
                required
              />
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#059669', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isFree2}
                  onChange={(e) => setIsFree2(e.target.checked)}
                />
                <span>Sin cargo / de regalo</span>
              </label>
              {isFree2 ? (
                <input
                  className="cs-input"
                  value={freeLabel2}
                  onChange={(e) => setFreeLabel2(e.target.value)}
                  placeholder="SIN CARGO"
                />
              ) : (
                <div className="cs-combo-price-row">
                  <input
                    type="number"
                    min={0}
                    className="cs-input"
                    placeholder="Precio promo"
                    value={price2}
                    onChange={(e) => setPrice2(e.target.value)}
                    required
                  />
                  <input
                    className="cs-input"
                    placeholder="UxB"
                    value={uxb2}
                    onChange={(e) => setUxb2(e.target.value)}
                  />
                </div>
              )}
              <input
                className="cs-input"
                placeholder="Condición"
                value={cond2}
                onChange={(e) => setCond2(e.target.value)}
                required
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {CONDITION_CHIPS.map((c) => (
                  <button key={c} type="button" className="cs-btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => setCond2(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="cs-dialog-footer">
          <button type="button" className="cs-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="cs-btn cs-btn-dark">
            Guardar combo
          </button>
        </div>
      </form>
    </dialog>
  );
}
