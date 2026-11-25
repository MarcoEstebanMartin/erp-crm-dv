import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type {
  CatalogBadgeType,
  CatalogStudioProduct,
} from '../../../utils/api/catalog-studio.api';

interface CatalogProductEditDialogProps {
  product: CatalogStudioProduct | null;
  categories: string[];
  onClose: () => void;
  onSave: (
    productId: number,
    payload: {
      catalogBadge: CatalogBadgeType;
      catalogVarieties: string | null;
      catalogMinQtyLabel: string | null;
      catalogShowOldPrice: boolean;
      catalogOldPrice: number | null;
      catalogVisible: boolean;
      commercialCategory: string;
    },
  ) => Promise<void>;
}

const MIN_QTY_PRESETS = ['3 UNID.', '6 UNID.', '12 UNID.', '3 CAJA', '1 BULTO'];

export function CatalogProductEditDialog({
  product,
  categories,
  onClose,
  onSave,
}: CatalogProductEditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [badge, setBadge] = useState<CatalogBadgeType>(null);
  const [category, setCategory] = useState('Almacén');
  const [minQty, setMinQty] = useState('');
  const [varieties, setVarieties] = useState('');
  const [showOldPrice, setShowOldPrice] = useState(false);
  const [oldPrice, setOldPrice] = useState('');
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (product) {
      setBadge(product.badge);
      setCategory(product.category);
      setMinQty(product.minQty || '');
      setVarieties(product.varieties || '');
      setShowOldPrice(product.showOldPrice);
      setOldPrice(product.oldPrice ? String(Math.round(product.oldPrice)) : '');
      setVisible(product.catalogVisible);
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSaving(true);
    try {
      const parsedOld = oldPrice.trim() ? Number(oldPrice) : null;
      await onSave(product.id, {
        catalogBadge: badge,
        catalogVarieties: varieties.trim() || null,
        catalogMinQtyLabel: minQty.trim() || null,
        catalogShowOldPrice: showOldPrice,
        catalogOldPrice: parsedOld && Number.isFinite(parsedOld) ? parsedOld : null,
        catalogVisible: visible,
        commercialCategory: category,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const selectableCategories = categories.filter((c) => c !== 'COMBOS');

  return (
    <dialog
      ref={dialogRef}
      className="cs-dialog"
      aria-labelledby="cs-edit-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {product && (
        <form onSubmit={handleSubmit}>
          <div className="cs-dialog-header">
            <h1 id="cs-edit-dialog-title" className="cs-dialog-title">
              {product.sku} · {product.name}
            </h1>
            <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>

          <div className="cs-dialog-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fafafa', borderRadius: 8, border: '1px solid #e4e4e7' }}>
              <span style={{ fontSize: 12, color: '#52525b', fontWeight: 600 }}>Precio ERP</span>
              <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                ${Math.round(product.price).toLocaleString('es-AR')}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="cs-field">
                <label htmlFor="cs-edit-cat">Sección</label>
                <select
                  id="cs-edit-cat"
                  className="cs-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {selectableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cs-field">
                <label htmlFor="cs-edit-badge">Destaque</label>
                <select
                  id="cs-edit-badge"
                  className="cs-select"
                  value={badge || ''}
                  onChange={(e) => setBadge((e.target.value || null) as CatalogBadgeType)}
                >
                  <option value="">Normal</option>
                  <option value="OFERTON">Ofertón!</option>
                  <option value="DESTACADO">Destacado</option>
                </select>
              </div>
            </div>

            <div className="cs-field">
              <label htmlFor="cs-edit-minqty">Mínimo (círculo en PDF)</label>
              <input
                id="cs-edit-minqty"
                className="cs-input"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                placeholder="Ej: 3 UNID. o 3 CAJA"
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {MIN_QTY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="cs-btn"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => setMinQty(preset)}
                  >
                    {preset}
                  </button>
                ))}
                {minQty && (
                  <button
                    type="button"
                    className="cs-btn"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={() => setMinQty('')}
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>

            <div className="cs-field">
              <label htmlFor="cs-edit-varieties">Sabores / Variedades</label>
              <input
                id="cs-edit-varieties"
                className="cs-input"
                value={varieties}
                onChange={(e) => setVarieties(e.target.value)}
                placeholder="Ej: FRUTILLA - VAINILLA"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showOldPrice}
                  onChange={(e) => setShowOldPrice(e.target.checked)}
                />
                <span>Precio tachado</span>
              </label>

              {showOldPrice && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="cs-input"
                    style={{ width: 110 }}
                    value={oldPrice}
                    onChange={(e) => setOldPrice(e.target.value)}
                    placeholder="Anterior"
                  />
                  {product.previousListPrice && product.previousListPrice > product.price && (
                    <button
                      type="button"
                      className="cs-btn"
                      style={{ padding: '5px 8px', fontSize: 11 }}
                      onClick={() => setOldPrice(String(Math.round(product.previousListPrice!)))}
                    >
                      Usar ${Math.round(product.previousListPrice).toLocaleString('es-AR')}
                    </button>
                  )}
                </div>
              )}
            </div>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
              />
              <span>Visible en PDF</span>
            </label>
          </div>

          <div className="cs-dialog-footer">
            <button type="button" className="cs-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="cs-btn cs-btn-dark" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
