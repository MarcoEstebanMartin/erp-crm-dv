import { useState, useMemo, type FC, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { formatCentsArs, formatCuitDisplay, parseExactCents } from './providersHelpers';
import { WMS_LOCATION_GROUPS } from '../deposito/depositoHelpers';

export const ComprasCreateReceiveModals: FC<{
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  providers: any[];
  products: any[];
  selectedProviderId: string;
  setSelectedProviderId: (v: string) => void;
  cart: { productId: number; name: string; sku: string; quantity: number; costPrice: number }[];
  setCart: React.Dispatch<React.SetStateAction<{ productId: number; name: string; sku: string; quantity: number; costPrice: number }[]>>;
  onCreateSubmit: (e: FormEvent) => void;
  showReceiveModal: any | null;
  setShowReceiveModal: (v: any | null) => void;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  receiveForm: { billingType: 'OFFICIAL' | 'INTERNAL'; invoiceType: string };
  setReceiveForm: React.Dispatch<React.SetStateAction<{ billingType: 'OFFICIAL' | 'INTERNAL'; invoiceType: string }>>;
  receivedQuantities: Record<number, number>;
  setReceivedQuantities: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  lotAssignments: Record<number, { lotNumber: string; expirationDate: string; location: string }>;
  onLotAssignmentChange: (productId: number, field: 'lotNumber' | 'expirationDate' | 'location', val: string) => void;
  onReceiveSubmit: (e: FormEvent) => void;
  viewDetailsModal: any | null;
  setViewDetailsModal: (v: any | null) => void;
  errorMsg?: string | null;
  setErrorMsg?: (v: string | null) => void;
}> = (p) => {
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<any | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState('10');
  const [costPriceToAdd, setCostPriceToAdd] = useState('');
  const [cartError, setCartError] = useState<string | null>(null);

  const filteredProductsForAdd = useMemo(() => {
    if (!searchProductQuery) return [];
    const q = searchProductQuery.toLowerCase();
    return p.products.filter((pr) => pr.name.toLowerCase().includes(q) || pr.sku.toLowerCase().includes(q)).slice(0, 12);
  }, [searchProductQuery, p.products]);

  const cartTotalCents = p.cart.reduce((acc, item) => acc + item.quantity * parseExactCents(item.costPrice), 0);

  const handleAddToCart = () => {
    if (!selectedProductToAdd || !quantityToAdd || !costPriceToAdd) return;
    const qty = Math.trunc(Number(quantityToAdd));
    const cost = Number(costPriceToAdd);
    if (qty <= 0 || cost <= 0) { setCartError('Cantidad y costo deben ser mayores a 0.'); return; }
    setCartError(null);
    const existingIdx = p.cart.findIndex((i) => i.productId === selectedProductToAdd.id);
    if (existingIdx !== -1) {
      const updated = [...p.cart];
      updated[existingIdx] = { ...updated[existingIdx], quantity: updated[existingIdx].quantity + qty, costPrice: cost };
      p.setCart(updated);
    } else {
      p.setCart((prev) => [...prev, { productId: selectedProductToAdd.id, name: selectedProductToAdd.name, sku: selectedProductToAdd.sku, quantity: qty, costPrice: cost }]);
    }
    setSelectedProductToAdd(null); setQuantityToAdd('10'); setCostPriceToAdd(''); setSearchProductQuery('');
  };

  const closeCreate = () => { setCartError(null); p.setErrorMsg?.(null); p.setShowCreateModal(false); };
  const closeReceive = () => { p.setErrorMsg?.(null); p.setShowReceiveModal(null); };
  const activeError = cartError || p.errorMsg;
  const linkedInv = p.showReceiveModal?.supplierInvoice;

  return (
    <>
      <NativeModalDialog isOpen={p.showCreateModal} onClose={closeCreate} ariaLabelledBy="po-create-title" style={{ maxWidth: '750px', width: '94vw', padding: '24px' }}>
        <div className="modal-header">
          <h3 id="po-create-title" style={{ margin: 0 }}>Ingreso sin factura</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={closeCreate} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </div>
        {activeError && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{activeError}</div>}
        <form onSubmit={p.onCreateSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label htmlFor="po-provider-select">Proveedor</label>
                <select id="po-provider-select" className="select" value={p.selectedProviderId} onChange={(e) => p.setSelectedProviderId(e.target.value)} required>
                  <option value="">Seleccione proveedor...</option>
                  {p.providers.map((pr) => {
                    const cuit = formatCuitDisplay(pr.cuit);
                    return <option key={pr.id} value={pr.id}>{cuit ? `${pr.name} (${cuit})` : pr.name}</option>;
                  })}
                </select>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <label htmlFor="po-product-search">Buscar producto</label>
                <input id="po-product-search" type="text" className="input" placeholder="SKU o nombre..." value={searchProductQuery} onChange={(e) => setSearchProductQuery(e.target.value)} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                {filteredProductsForAdd.length > 0 && (
                  <div style={{ position: 'absolute', left: 0, right: 0, top: '65px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto', zIndex: 100 }}>
                    {filteredProductsForAdd.map((pr) => (
                      <button key={pr.id} type="button" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f0f0f0', padding: '8px 12px', cursor: 'pointer', fontSize: '0.8rem' }} onClick={() => { setSelectedProductToAdd(pr); setCostPriceToAdd(String(pr.costPrice)); setSearchProductQuery(''); }}>
                        <strong>{pr.sku}</strong> · {pr.name} ({formatCentsArs(parseExactCents(pr.costPrice))})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProductToAdd && (
                <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>{selectedProductToAdd.name} ({selectedProductToAdd.sku})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group"><label htmlFor="po-add-qty">Cantidad</label><input id="po-add-qty" type="number" className="input" value={quantityToAdd} onChange={(e) => setQuantityToAdd(e.target.value)} /></div>
                    <div className="form-group"><label htmlFor="po-add-cost">Costo unitario ($)</label><input id="po-add-cost" type="number" step="0.01" className="input" value={costPriceToAdd} onChange={(e) => setCostPriceToAdd(e.target.value)} /></div>
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '10px', fontSize: '0.8rem' }} onClick={handleAddToCart}>Agregar artículo</button>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '8px' }}>Artículos a recibir</div>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', minHeight: '220px', maxHeight: '260px', overflowY: 'auto' }}>
                {p.cart.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>Sin artículos agregados.</div>
                ) : (
                  p.cart.map((item) => (
                    <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f0f0f0', fontSize: '0.8rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{item.quantity} u. · {formatCentsArs(parseExactCents(item.costPrice))}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="tabular-nums" style={{ fontWeight: 700 }}>{formatCentsArs(item.quantity * parseExactCents(item.costPrice))}</span>
                        <button type="button" className="btn btn-ghost" style={{ padding: '2px', color: 'var(--color-danger)' }} onClick={() => p.setCart((prev) => prev.filter((i) => i.productId !== item.productId))} aria-label={`Quitar ${item.name}`}><Trash2 size={14} aria-hidden="true" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {p.cart.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', fontWeight: 700, fontSize: '0.95rem' }}>
                  <span>Total neto:</span>
                  <span className="tabular-nums">{formatCentsArs(cartTotalCents)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={closeCreate}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={p.cart.length === 0}>Guardar</button>
          </div>
        </form>
      </NativeModalDialog>

      <NativeModalDialog isOpen={Boolean(p.showReceiveModal)} onClose={closeReceive} ariaLabelledBy="po-receive-title" style={{ maxWidth: '780px', width: '95vw', padding: '24px' }}>
        {p.showReceiveModal && (
          <>
            <div className="modal-header">
              <h3 id="po-receive-title" style={{ margin: 0 }}>Recibir mercadería #{p.showReceiveModal.id}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={closeReceive} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
            </div>
            {p.errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{p.errorMsg}</div>}
            <form onSubmit={p.onReceiveSubmit}>
              {linkedInv ? (
                <div style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', marginBottom: '12px', fontSize: '0.84rem' }}>
                  Comprobante vinculado: <strong className="tabular-nums">{linkedInv.invoiceNumber}</strong>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="po-receive-invoice">Comprobante / Remito</label>
                    <input id="po-receive-invoice" type="text" className="input" placeholder="Opcional" value={p.invoiceNumber} onChange={(e) => p.setInvoiceNumber(e.target.value)} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="po-receive-branch">Sucursal</label>
                    <select id="po-receive-branch" className="select" value={p.receiveForm.billingType} onChange={(e) => p.setReceiveForm((prev) => ({ ...prev, billingType: e.target.value as 'OFFICIAL' | 'INTERNAL' }))}>
                      <option value="OFFICIAL">Sucursal A</option>
                      <option value="INTERNAL">Sucursal X</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label htmlFor="po-receive-type">Tipo</label>
                    <select id="po-receive-type" className="select" value={p.receiveForm.invoiceType} onChange={(e) => p.setReceiveForm((prev) => ({ ...prev, invoiceType: e.target.value }))}>
                      <option value="FACTURA_A">Factura A</option>
                      <option value="FACTURA_B">Factura B</option>
                      <option value="FACTURA_C">Factura C</option>
                      <option value="REMITO_X">Remito X</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {p.showReceiveModal.items.map((item: any) => (
                  <div key={item.productId} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', fontSize: '0.8rem' }}>
                    <div className="tabular-nums" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      {item.product?.name || `Producto #${item.productId}`} · Esperado: {item.quantity} u.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr 135px 1.2fr', gap: '8px' }}>
                      <div>
                        <label htmlFor={`po-qty-${item.productId}`} style={{ fontSize: '0.72rem' }}>Cant. recibida</label>
                        <input id={`po-qty-${item.productId}`} type="number" min={0} className="input tabular-nums" value={p.receivedQuantities[item.productId] ?? item.quantity} onChange={(e) => p.setReceivedQuantities((prev) => ({ ...prev, [item.productId]: Math.max(0, Math.trunc(Number(e.target.value || 0))) }))} />
                      </div>
                      <div>
                        <label htmlFor={`po-lot-${item.productId}`} style={{ fontSize: '0.72rem' }}>Lote</label>
                        <input id={`po-lot-${item.productId}`} type="text" className="input" placeholder="S/L" value={p.lotAssignments[item.productId]?.lotNumber || ''} onChange={(e) => p.onLotAssignmentChange(item.productId, 'lotNumber', e.target.value)} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                      </div>
                      <div>
                        <label htmlFor={`po-exp-${item.productId}`} style={{ fontSize: '0.72rem' }}>Vencimiento</label>
                        <input id={`po-exp-${item.productId}`} type="date" className="input" value={p.lotAssignments[item.productId]?.expirationDate || ''} onChange={(e) => p.onLotAssignmentChange(item.productId, 'expirationDate', e.target.value)} />
                      </div>
                      <div>
                        <label htmlFor={`po-loc-${item.productId}`} style={{ fontSize: '0.72rem' }}>Ubicación WMS</label>
                        <select id={`po-loc-${item.productId}`} className="select" value={p.lotAssignments[item.productId]?.location || 'S/U'} onChange={(e) => p.onLotAssignmentChange(item.productId, 'location', e.target.value)}>
                          <option value="S/U">Sin Ubicar (S/U)</option>
                          {WMS_LOCATION_GROUPS.map((g) => (
                            <optgroup key={g.chamber} label={g.label}>
                              {g.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.value}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={closeReceive}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Confirmar ingreso</button>
              </div>
            </form>
          </>
        )}
      </NativeModalDialog>

      <NativeModalDialog isOpen={Boolean(p.viewDetailsModal)} onClose={() => p.setViewDetailsModal(null)} ariaLabelledBy="po-details-title" style={{ maxWidth: '550px', width: '94vw', padding: '24px' }}>
        {p.viewDetailsModal && (
          <>
            <div className="modal-header">
              <h3 id="po-details-title" style={{ margin: 0 }}>Recepción #{p.viewDetailsModal.id}</h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => p.setViewDetailsModal(null)} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div><strong>Proveedor:</strong> {p.viewDetailsModal.persona?.name}</div>
              {p.viewDetailsModal.supplierInvoice?.invoiceNumber && (
                <div className="tabular-nums"><strong>Comprobante:</strong> {p.viewDetailsModal.supplierInvoice.invoiceNumber}</div>
              )}
              <div className="table-container" role="region" aria-label="Artículos de la recepción" tabIndex={0} style={{ borderRadius: '6px' }}>
                <table style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr><th scope="col">Artículo</th><th scope="col" style={{ textAlign: 'right' }}>Cant</th><th scope="col" style={{ textAlign: 'right' }}>Costo</th><th scope="col" style={{ textAlign: 'right' }}>Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {p.viewDetailsModal.items?.map((item: any) => (
                      <tr key={item.id}>
                        <td>{item.product?.name || `Producto #${item.productId}`}</td>
                        <td className="tabular-nums" style={{ textAlign: 'right' }}>{item.quantity} u.</td>
                        <td className="tabular-nums" style={{ textAlign: 'right' }}>{formatCentsArs(parseExactCents(item.costPrice))}</td>
           