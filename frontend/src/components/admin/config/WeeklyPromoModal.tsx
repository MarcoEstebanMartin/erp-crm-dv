import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { api } from '../../../utils/api';
import PromoProductPicker from './PromoProductPicker';
import {
  type CatalogProduct,
  type WeeklyPromo,
  type WeeklyPromoType,
  formatArsInteger,
  getDefaultPromoDates,
  parseIntegerPeso,
} from './weeklyPromo.helpers';

interface WeeklyPromoModalProps {
  open: boolean;
  products: CatalogProduct[];
  onClose: () => void;
  onCreated: (created: WeeklyPromo) => void;
}

interface ComboRowDraft {
  key: number;
  productId: number | null;
  search: string;
  minQuantity: string;
  promoUnitPrice: string;
}

const PROMO_TYPE_OPTIONS: Array<{ id: WeeklyPromoType; label: string }> = [
  { id: 'OFFER_PRICE', label: 'Precio Oferta' },
  { id: 'BUY_X_GET_Y', label: 'Promo 3+1 (N+M)' },
  { id: 'COMBO', label: 'Combo' },
];

export default function WeeklyPromoModal({ open, products, onClose, onCreated }: WeeklyPromoModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const nextRowKey = useRef(3);

  const [type, setType] = useState<WeeklyPromoType>('OFFER_PRICE');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(() => getDefaultPromoDates().startDate);
  const [endDate, setEndDate] = useState(() => getDefaultPromoDates().endDate);
  const [singleSearch, setSingleSearch] = useState('');
  const [singleProductId, setSingleProductId] = useState<number | null>(null);
  const [minQty, setMinQty] = useState('1');
  const [freeQty, setFreeQty] = useState('1');
  const [offerPrice, setOfferPrice] = useState('');
  const [comboRows, setComboRows] = useState<ComboRowDraft[]>([
    { key: 1, productId: null, search: '', minQuantity: '1', promoUnitPrice: '' },
    { key: 2, productId: null, search: '', minQuantity: '1', promoUnitPrice: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selectedSingle = singleProductId ? productById.get(singleProductId) : undefined;

  const resetForm = () => {
    const defaults = getDefaultPromoDates();
    setType('OFFER_PRICE');
    setName('');
    setStartDate(defaults.startDate);
    setEndDate(defaults.endDate);
    setSingleSearch('');
    setSingleProductId(null);
    setMinQty('1');
    setFreeQty('1');
    setOfferPrice('');
    setComboRows([
      { key: 1, productId: null, search: '', minQuantity: '1', promoUnitPrice: '' },
      { key: 2, productId: null, search: '', minQuantity: '1', promoUnitPrice: '' },
    ]);
    setLocalError('');
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      resetForm();
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Respaldo light-dismiss cuando el navegador no soporta closedby="any"
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;
    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      if (e.target !== dialog) return false;
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const onDown = (e: PointerEvent) => { pressedOutside = isOutside(e); };
    const onUp = (e: PointerEvent) => {
      const dismiss = pressedOutside && isOutside(e);
      pressedOutside = false;
      if (dismiss) dialog.close();
    };
    const onCancel = () => { pressedOutside = false; };
    dialog.addEventListener('pointerdown', onDown);
    dialog.addEventListener('pointerup', onUp);
    dialog.addEventListener('pointercancel', onCancel);
    return () => {
      dialog.removeEventListener('pointerdown', onDown);
      dialog.removeEventListener('pointerup', onUp);
      dialog.removeEventListener('pointercancel', onCancel);
    };
  }, []);

  const handleTypeChange = (nextType: WeeklyPromoType) => {
    setType(nextType);
    setLocalError('');
    if (nextType === 'BUY_X_GET_Y') {
      if (selectedSingle?.isPesable) {
        setSingleProductId(null);
        setSingleSearch('');
      }
      if (parseIntegerPeso(minQty) <= 1) setMinQty('3');
      if (parseIntegerPeso(freeQty) < 1) setFreeQty('1');
    } else if (nextType === 'OFFER_PRICE') {
      setMinQty('1');
    }
  };

  const comboTotals = useMemo(() => {
    let promoTotal = 0;
    let listTotal = 0;
    let complete = comboRows.length >= 2;
    for (const row of comboRows) {
      const prod = row.productId ? productById.get(row.productId) : undefined;
      const qty = parseIntegerPeso(row.minQuantity);
      const unitPromo = parseIntegerPeso(row.promoUnitPrice);
      if (!prod || qty < 1 || unitPromo <= 0) {
        complete = false;
        continue;
      }
      promoTotal += qty * unitPromo;
      listTotal += qty * parseIntegerPeso(prod.listPrice);
    }
    return { complete, promoTotal, listTotal, savings: listTotal - promoTotal };
  }, [comboRows, productById]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!startDate) return setLocalError('Indicá la fecha de inicio.');
    if (endDate && endDate < startDate) return setLocalError('La fecha Hasta debe ser posterior a Desde.');

    let items: Array<{ productId: number; minQuantity: number; freeQuantity?: number; promoUnitPrice?: number | null }>;
    if (type === 'COMBO') {
      const usedIds = new Set<number>();
      items = [];
      for (const row of comboRows) {
        if (!row.productId) return setLocalError('Seleccioná todos los productos del combo.');
        if (usedIds.has(row.productId)) return setLocalError('No repitas un mismo producto dentro del combo.');
        usedIds.add(row.productId);
        const qty = parseIntegerPeso(row.minQuantity);
        const price = parseIntegerPeso(row.promoUnitPrice);
        if (qty < 1) return setLocalError('La cantidad de cada producto del combo debe ser al menos 1.');
        if (price <= 0) return setLocalError('Ingresá un precio promocional válido para cada producto.');
        items.push({ productId: row.productId, minQuantity: qty, freeQuantity: 0, promoUnitPrice: price });
      }
      if (items.length < 2) return setLocalError('Un combo debe incluir al menos 2 productos.');
    } else if (type === 'BUY_X_GET_Y') {
      if (!singleProductId) return setLocalError('Seleccioná un producto.');
      const paid = parseIntegerPeso(minQty);
      const free = parseIntegerPeso(freeQty);
      if (paid < 1 || free < 1) return setLocalError('Indicá cantidades válidas (ej. pagás 3 y llevás 1 gratis).');
      items = [{ productId: singleProductId, minQuantity: paid, freeQuantity: free, promoUnitPrice: null }];
    } else {
      if (!singleProductId) return setLocalError('Seleccioná un producto.');
      const min = parseIntegerPeso(minQty);
      const price = parseIntegerPeso(offerPrice);
      if (min < 1) return setLocalError('La cantidad mínima debe ser al menos 1.');
      if (price <= 0) return setLocalError('Ingresá un precio de oferta mayor a $0.');
      items = [{ productId: singleProductId, minQuantity: min, freeQuantity: 0, promoUnitPrice: price }];
    }

    setSaving(true);
    try {
      const created = await api.createWeeklyPromo({ type, name: name.trim() || undefined, startDate, endDate: endDate || undefined, items });
      onCreated(created);
      dialogRef.current?.close();
    } catch (err: any) {
      setLocalError(err?.message || 'No se pudo guardar la oferta semanal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{`
        dialog.weekly-promo-dialog { border: none; }
        dialog.weekly-promo-dialog[open] {
          display: flex; flex-direction: column; width: min(620px, calc(100vw - 24px));
          max-height: min(88vh, 760px); padding: 0; margin: auto; border: 1px solid #E5E7EB;
          border-radius: 12px; background: #FFFFFF; color: #111827;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
        }
        dialog.weekly-promo-dialog:modal { overscroll-behavior: contain; }
        dialog.weekly-promo-dialog::backdrop {
          background: rgba(17, 24, 39, 0.45); backdrop-filter: blur(2px);
          overflow: hidden; overscroll-behavior: contain;
        }
        .wp-label { display: block; font-size: 0.78rem; font-weight: 600; color: #374151; margin-bottom: 5px; }
        .wp-box-btn { border: none; background: #F3F4F6; color: #111827; border-radius: 4px; padding: 2px 7px; font-size: 0.72rem; font-weight: 600; cursor: pointer; }
      `}</style>
      <dialog ref={dialogRef} aria-labelledby={titleId} {...({ closedby: 'any' } as Record<string, unknown>)} onClose={onClose} className="weekly-promo-dialog">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #E5E7EB' }}>
          <h3 id={titleId} style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: '#111827' }}>Nueva oferta semanal</h3>
          <button type="button" className="btn btn-ghost btn-sm" aria-label="Cerrar" onClick={() => dialogRef.current?.close()} style={{ padding: '4px', color: '#6B7280' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px 22px', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', background: '#F3F4F6', padding: '4px', borderRadius: '8px' }}>
            {PROMO_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleTypeChange(opt.id)}
                style={{
                  border: 'none', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                  background: type === opt.id ? '#FFFFFF' : 'transparent', color: type === opt.id ? '#111827' : '#6B7280',
                  boxShadow: type === opt.id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {localError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '9px 12px', borderRadius: '8px', fontSize: '0.82rem' }}>{localError}</div>}

          {type !== 'COMBO' ? (
            <>
              <div>
                <label className="wp-label">Producto</label>
                <PromoProductPicker
                  products={products}
                  selectedProductId={singleProductId}
                  searchValue={singleSearch}
                  excludePesable={type === 'BUY_X_GET_Y'}
                  placeholder={type === 'BUY_X_GET_Y' ? 'Buscar producto por unidad (no pesable)...' : 'Buscar por nombre o SKU...'}
                  onSearchChange={(val) => {
                    setSingleSearch(val);
                    if (selectedSingle && val !== selectedSingle.name) setSingleProductId(null);
                  }}
                  onSelect={(p) => { setSingleProductId(p.id); setSingleSearch(p.name); }}
                />
              </div>
              {type === 'OFFER_PRICE' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="wp-label">Precio oferta ($)</label>
                    <input type="number" min="1" step="1" className="input" placeholder="Ej: 2500" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <label className="wp-label" style={{ marginBottom: 0 }}>Cantidad mínima (u.)</label>
                      {selectedSingle?.unitsPerBox && selectedSingle.unitsPerBox > 1 && (
                        <button type="button" className="wp-box-btn" onClick={() => setMinQty(String(selectedSingle.unitsPerBox))}>1 caja ({selectedSingle.unitsPerBox} u.)</button>
                      )}
                    </div>
                    <input type="number" min="1" step="1" className="input" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <label className="wp-label" style={{ marginBottom: 0 }}>Pagás (N unidades)</label>
                      {selectedSingle?.unitsPerBox && selectedSingle.unitsPerBox > 1 && (
                        <button type="button" className="wp-box-btn" onClick={() => setMinQty(String(selectedSingle.unitsPerBox))}>1 caja ({selectedSingle.unitsPerBox} u.)</button>
                      )}
                    </div>
                    <input type="number" min="1" step="1" className="input" value={minQty} onChange={(e) => setMinQty(e.target.value)} />
                  </div>
                  <div>
                    <label className="wp-label">Llevás sin cargo (M)</label>
                    <input type="number" min="1" step="1" className="input" value={freeQty} onChange={(e) => setFreeQty(e.target.value)} />
                  </div>
                </div>
              )}
              {selectedSingle && type === 'OFFER_PRICE' && parseIntegerPeso(offerPrice) > 0 && (
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '9px 12px', fontSize: '0.8rem', color: '#374151' }}>
                  Lista actual: <strong>{formatArsInteger(selectedSingle.listPrice)}</strong> → Ahorro por unidad:{' '}
                  <strong>{formatArsInteger(parseIntegerPeso(selectedSingle.listPrice) - parseIntegerPeso(offerPrice))}</strong>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {comboRows.map((row, idx) => {
                const selectedProd = row.productId ? productById.get(row.productId) : undefined;
                const excludeIds = comboRows.filter((r) => r.key !== row.key && r.productId).map((r) => r.productId as number);
                return (
                  <div key={row.key} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Producto #{idx + 1}</span>
                      {comboRows.length > 2 && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setComboRows((prev) => prev.filter((r) => r.key !== row.key))} style={{ padding: '2px 6px', color: '#DC2626' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <PromoProductPicker
                      products={products}
                      selectedProductId={row.productId}
                      searchValue={row.search}
                      excludeProductIds={excludeIds}
                      onSearchChange={(val) => setComboRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, search: val, productId: selectedProd && val === selectedProd.name ? r.productId : null } : r)))}
                      onSelect={(p) => setComboRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, productId: p.id, search: p.name } : r)))}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <label className="wp-label" style={{ marginBottom: 0 }}>Cantidad (u.)</label>
                          {selectedProd?.unitsPerBox && selectedProd.unitsPerBox > 1 && (
                            <button type="button" className="wp-box-btn" onClick={() => setComboRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, minQuantity: String(selectedProd.unitsPerBox) } : r)))}>
                              1 caja ({selectedProd.unitsPerBox} u.)
                            </button>
                          )}
                        </div>
                        <input type="number" min="1" step="1" className="input" value={row.minQuantity} onChange={(e) => setComboRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, minQuantity: e.target.value } : r)))} />
                      </div>
                      <div>
                        <label className="wp-label">Precio combo c/u ($)</label>
                        <input type="number" min="1" step="1" className="input" placeholder="Ej: 1950" value={row.promoUnitPrice} onChange={(e) => setComboRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, promoUnitPrice: e.target.value } : r)))} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { const key = nextRowKey.current++; setComboRows((prev) => [...prev, { key, productId: null, search: '', minQuantity: '1', promoUnitPrice: '' }]); }} style={{ alignSelf: 'flex-start', border: '1px dashed #D1D5DB', fontSize: '0.8rem' }}>
                <Plus size={14} /> Agregar producto al combo
              </button>
              {comboTotals.complete && (
                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '9px 12px', fontSize: '0.8rem', color: '#374151' }}>
                  Total del combo: <strong>{formatArsInteger(comboTotals.promoTotal)}</strong> (Lista: {formatArsInteger(comboTotals.listTotal)} · Ahorro: <strong>{formatArsInteger(comboTotals.savings)}</strong>)
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '12px' }}>
            <div><label className="wp-label">Vigencia desde</label><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label className="wp-label">Hasta</label><input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>

          <div>
            <label className="wp-label">Nombre visible (opcional)</label>
            <input type="text" className="input" maxLength={120} placeholder="Se genera automáticamente si lo dejás vacío" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #E5E7EB', paddingTop: '14px' }}>
            <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Publicar oferta'}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
