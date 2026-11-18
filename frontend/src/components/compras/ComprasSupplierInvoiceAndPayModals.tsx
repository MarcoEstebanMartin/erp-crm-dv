import { useMemo, useState, type FC, type FormEvent } from 'react';
import { Trash2, X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { formatCentsArs, formatCuitDisplay, parseExactCents } from './providersHelpers';
import { ComprasPayInvoiceModal } from './ComprasPayInvoiceModal';

export interface ManualInvoiceItem {
  productId: number;
  name: string;
  sku: string;
  quantity: number;
  costPrice: number;
}

const RECEPTION_OPTS: Array<{ value: 'NONE' | 'IN_TRANSIT' | 'IMMEDIATE'; label: string }> = [
  { value: 'NONE', label: 'Sin mercadería' },
  { value: 'IN_TRANSIT', label: 'En tránsito' },
  { value: 'IMMEDIATE', label: 'Ingresar ahora' },
];

export const ComprasSupplierInvoiceAndPayModals: FC<{
  showSupplierModal: boolean;
  setShowSupplierModal: (v: boolean) => void;
  providers: any[];
  products: any[];
  supplierForm: any;
  setSupplierForm: React.Dispatch<React.SetStateAction<any>>;
  onSupplierFieldChange: (patch: Record<string, any>) => void;
  manualInvoiceItems: ManualInvoiceItem[];
  setManualInvoiceItems: React.Dispatch<React.SetStateAction<ManualInvoiceItem[]>>;
  autoCalculatedTotal: string;
  onNetChange: (v: string) => void;
  onSupplierInvoiceSubmit: (e: FormEvent) => void;
  payInvoiceModal: { open: boolean; invoice: any | null };
  setPayInvoiceModal: (v: { open: boolean; invoice: any | null }) => void;
  paymentForm: any;
  setPaymentForm: React.Dispatch<React.SetStateAction<any>>;
  paymentItems: Array<{ amount: string; paymentMethod: string; bankAccountId: string }>;
  setPaymentItems: React.Dispatch<React.SetStateAction<Array<{ amount: string; paymentMethod: string; bankAccountId: string }>>>;
  bankAccounts: any[];
  onPayInvoiceSubmit: (e: FormEvent) => void;
  errorMsg?: string | null;
  setErrorMsg?: (v: string | null) => void;
}> = (p) => {
  const [prodQuery, setProdQuery] = useState('');
  const [draftProduct, setDraftProduct] = useState<any | null>(null);
  const [draftQty, setDraftQty] = useState('1');
  const [draftCost, setDraftCost] = useState('');

  const matchingProducts = useMemo(() => {
    const q = prodQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return p.products.filter((pr) => pr.name?.toLowerCase().includes(q) || pr.sku?.toLowerCase().includes(q)).slice(0, 10);
  }, [prodQuery, p.products]);

  const closeSupplierModal = () => { p.setErrorMsg?.(null); p.setShowSupplierModal(false); };
  const handleAddItem = () => {
    const qty = Math.trunc(Number(draftQty));
    const cost = Number(draftCost);
    if (!draftProduct || qty <= 0 || cost < 0) return;
    p.setManualInvoiceItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === draftProduct.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty, costPrice: cost };
        return next;
      }
      return [...prev, { productId: draftProduct.id, name: draftProduct.name, sku: draftProduct.sku, quantity: qty, costPrice: cost }];
    });
    setDraftProduct(null); setProdQuery(''); setDraftQty('1'); setDraftCost('');
  };

  return (
    <>
      <NativeModalDialog isOpen={p.showSupplierModal} onClose={closeSupplierModal} ariaLabelledBy="sup-inv-modal-title" style={{ maxWidth: '580px', width: '94vw', padding: '24px' }}>
        <div className="modal-header">
          <h3 id="sup-inv-modal-title" style={{ margin: 0 }}>Nueva factura de compra</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={closeSupplierModal} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </div>
        {p.errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{p.errorMsg}</div>}
        <form onSubmit={p.onSupplierInvoiceSubmit}>
          <div className="form-group">
            <label htmlFor="sup-inv-provider">Proveedor *</label>
            <select id="sup-inv-provider" className="select" value={p.supplierForm.personaId} onChange={(e) => p.onSupplierFieldChange({ personaId: e.target.value })} required>
              <option value="">Seleccione un proveedor...</option>
              {p.providers.map((pr) => {
                const cuit = formatCuitDisplay(pr.cuit);
                return <option key={pr.id} value={pr.id}>{cuit ? `${pr.name} (${cuit})` : pr.name}</option>;
              })}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div className="form-group">
              <label htmlFor="sup-inv-type">Tipo</label>
              <select id="sup-inv-type" className="select" value={p.supplierForm.invoiceType} onChange={(e) => p.onSupplierFieldChange({ invoiceType: e.target.value })}>
                <option value="FACTURA_A">Factura A</option>
                <option value="FACTURA_B">Factura B</option>
                <option value="FACTURA_C">Factura C</option>
                <option value="NOTA_CREDITO_A">Nota de Crédito A</option>
                <option value="NOTA_CREDITO_B">Nota de Crédito B</option>
                <option value="NOTA_CREDITO_C">Nota de Crédito C</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="sup-inv-number">Nro Comprobante</label>
              <input id="sup-inv-number" type="text" className="input" placeholder="0001-00012345" value={p.supplierForm.invoiceNumber} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, invoiceNumber: e.target.value }))} autoCorrect="off" autoCapitalize="none" spellCheck={false} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group">
              <label htmlFor="sup-inv-issue">Emisión</label>
              <input id="sup-inv-issue" type="date" className="input" value={p.supplierForm.issueDate} onChange={(e) => p.onSupplierFieldChange({ issueDate: e.target.value })} required />
            </div>
            <div className="form-group">
              <label htmlFor="sup-inv-due">Vencimiento</label>
              <input id="sup-inv-due" type="date" className="input" value={p.supplierForm.dueDate} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, dueDate: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label htmlFor="sup-inv-branch">Sucursal</label>
              <select id="sup-inv-branch" className="select" value={p.supplierForm.billingType} onChange={(e) => p.onSupplierFieldChange({ billingType: e.target.value })}>
                <option value="OFFICIAL">Sucursal A</option>
                <option value="INTERNAL">Sucursal X</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label htmlFor="sup-inv-net">Neto Gravado ($)</label><input id="sup-inv-net" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.netAmount} onChange={(e) => p.onNetChange(e.target.value)} required /></div>
            <div className="form-group"><label htmlFor="sup-inv-iva">IVA Crédito ($)</label><input id="sup-inv-iva" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.taxAmount} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, taxAmount: e.target.value }))} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label htmlFor="sup-inv-pampa">IIBB La Pampa ($)</label><input id="sup-inv-pampa" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.percepcionPampa} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionPampa: e.target.value }))} /></div>
            <div className="form-group"><label htmlFor="sup-inv-bsas">IIBB Bs As ($)</label><input id="sup-inv-bsas" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.percepcionBsAs} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionBsAs: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label htmlFor="sup-inv-perc-iva">Perc. IVA RG 3337 ($)</label><input id="sup-inv-perc-iva" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.percepcionIva} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionIva: e.target.value }))} /></div>
            <div className="form-group"><label htmlFor="sup-inv-perc-5329">Perc. IVA RG 5329 ($)</label><input id="sup-inv-perc-5329" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.percepcionIva5329} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionIva5329: e.target.value }))} /></div>
            <div className="form-group"><label htmlFor="sup-inv-int">Imp. Internos ($)</label><input id="sup-inv-int" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.impuestosInternos} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, impuestosInternos: e.target.value }))} /></div>
          </div>
          <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
            <legend style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0 4px' }}>Ingreso de mercadería</legend>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {RECEPTION_OPTS.map((opt) => (
                <label key={opt.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input type="radio" name="manual-reception-mode" value={opt.value} checked={p.supplierForm.receptionMode === opt.value} onChange={() => p.setSupplierForm((prev: any) => ({ ...prev, receptionMode: opt.value }))} />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
            {p.supplierForm.receptionMode !== 'NONE' && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <input type="text" aria-label="Buscar producto" className="input" placeholder="Buscar producto por SKU o nombre..." value={draftProduct ? `${draftProduct.name} (${draftProduct.sku})` : prodQuery} onChange={(e) => { setDraftProduct(null); setProdQuery(e.target.value); }} />
                  {matchingProducts.length > 0 && !draftProduct && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '38px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', maxHeight: '140px', overflowY: 'auto', zIndex: 50 }}>
                      {matchingProducts.map((pr) => (
                        <button key={pr.id} type="button" style={{ width: '100%', textAlign: 'left', padding: '6px 10px', border: 'none', borderBottom: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', fontSize: '0.78rem' }} onClick={() => { setDraftProduct(pr); setDraftCost(String(pr.costPrice || 0)); setProdQuery(''); }}>
                          <strong>{pr.sku}</strong> · {pr.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {draftProduct && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                    <div><label htmlFor="sup-item-qty" style={{ fontSize: '0.72rem' }}>Cant.</label><input id="sup-item-qty" type="number" min={1} className="input tabular-nums" value={draftQty} onChange={(e) => setDraftQty(e.target.value)} /></div>
                    <div><label htmlFor="sup-item-cost" style={{ fontSize: '0.72rem' }}>Costo ($)</label><input id="sup-item-cost" type="number" step="0.01" className="input tabular-nums" value={draftCost} onChange={(e) => setDraftCost(e.target.value)} /></div>
                    <button type="button" className="btn btn-secondary" onClick={handleAddItem}>Agregar</button>
                  </div>
                )}
                {p.manualInvoiceItems.map((it) => (
                  <div key={it.productId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 8px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
                    <span className="tabular-nums">{it.name} · <strong>{it.quantity} u.</strong> · {formatCentsArs(parseExactCents(it.costPrice))}</span>
                    <button type="button" className="btn btn-ghost" style={{ padding: '2px', color: 'var(--color-danger)' }} aria-label={`Quitar ${it.name}`} onClick={() => p.setManualInvoiceItems((prev) => prev.filter((x) => x.productId !== it.productId))}><Trash2 size={14} aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
          <div className="form-group">
            <label htmlFor="sup-inv-total" className="tabular-nums">Total ($) — Calculado: ${p.autoCalculatedTotal}</label>
            <input id="sup-inv-total" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.totalAmount} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, totalAmount: e.target.value }))} required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeSupplierModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar factura</button>
          </div>
        </form>
      </NativeModalDialog>

      <ComprasPayInvoiceModal
        payInvoiceModal={p.payInvoiceModal} setPayInvoiceModal={p.setPayInvoiceModal}
        paymentForm={p.paymentForm} setPaymentForm={p.setPaymentForm}
        paymentItems={p.paymentItems} setPaymentItems={p.setPaymentItems}
        bankAccounts={p.bankAccounts} onPayInvoiceSubmit={p.onPayInvoiceSubmit}
        errorMsg={p.errorMsg} setErrorMsg={p.setErrorMsg}
      />
    </>
  );
};
