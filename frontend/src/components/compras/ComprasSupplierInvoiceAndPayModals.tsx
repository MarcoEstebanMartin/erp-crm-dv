import type { FC, FormEvent } from 'react';
import { X, CreditCard, Trash2, Check } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

export const ComprasSupplierInvoiceAndPayModals: FC<{
  showSupplierModal: boolean;
  setShowSupplierModal: (v: boolean) => void;
  providers: any[];
  supplierForm: any;
  setSupplierForm: React.Dispatch<React.SetStateAction<any>>;
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
  const closeSupplierModal = () => { p.setErrorMsg?.(null); p.setShowSupplierModal(false); };
  const closePayModal = () => { p.setErrorMsg?.(null); p.setPayInvoiceModal({ open: false, invoice: null }); };
  const inv = p.payInvoiceModal.invoice;

  return (
    <>
      <NativeModalDialog isOpen={p.showSupplierModal} onClose={closeSupplierModal} ariaLabelledBy="sup-inv-modal-title" style={{ maxWidth: '500px', width: '94vw', padding: '24px' }}>
        <div className="modal-header">
          <h3 id="sup-inv-modal-title" style={{ margin: 0 }}>Nueva Factura de Proveedor</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={closeSupplierModal} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
        </div>
        {p.errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{p.errorMsg}</div>}
        <form onSubmit={p.onSupplierInvoiceSubmit}>
          <div className="form-group">
            <label htmlFor="sup-inv-provider">Proveedor *</label>
            <select id="sup-inv-provider" className="select" value={p.supplierForm.personaId} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, personaId: e.target.value }))} required>
              <option value="">Seleccione un proveedor...</option>
              {p.providers.map((pr) => (<option key={pr.id} value={pr.id}>{pr.name} (CUIT: {pr.cuit})</option>))}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div className="form-group">
              <label htmlFor="sup-inv-type">Tipo</label>
              <select id="sup-inv-type" className="select" value={p.supplierForm.invoiceType} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, invoiceType: e.target.value }))}>
                <option value="FACTURA_A">Factura A</option>
                <option value="FACTURA_B">Factura B</option>
                <option value="FACTURA_C">Factura C</option>
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
              <input id="sup-inv-issue" type="date" className="input" value={p.supplierForm.issueDate} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, issueDate: e.target.value, dueDate: new Date(new Date(e.target.value).getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0] }))} required />
            </div>
            <div className="form-group">
              <label htmlFor="sup-inv-due">Vencimiento</label>
              <input id="sup-inv-due" type="date" className="input" value={p.supplierForm.dueDate} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, dueDate: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label htmlFor="sup-inv-branch">Sucursal</label>
              <select id="sup-inv-branch" className="select" value={p.supplierForm.billingType} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, billingType: e.target.value }))}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="form-group"><label htmlFor="sup-inv-perc-iva">Percepción IVA ($)</label><input id="sup-inv-perc-iva" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.percepcionIva} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionIva: e.target.value }))} /></div>
            <div className="form-group"><label htmlFor="sup-inv-int">Imp. Internos ($)</label><input id="sup-inv-int" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.impuestosInternos} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, impuestosInternos: e.target.value }))} /></div>
          </div>
          <div className="form-group">
            <label htmlFor="sup-inv-total" className="tabular-nums">Total ($) — Calculado: ${p.autoCalculatedTotal}</label>
            <input id="sup-inv-total" type="number" step="0.01" className="input tabular-nums" value={p.supplierForm.totalAmount} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, totalAmount: e.target.value }))} required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeSupplierModal}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Guardar Compra</button>
          </div>
        </form>
      </NativeModalDialog>

      <NativeModalDialog isOpen={p.payInvoiceModal.open && Boolean(inv)} onClose={closePayModal} ariaLabelledBy="sup-pay-modal-title" style={{ maxWidth: '520px', width: '94vw', padding: '20px' }}>
        {inv && (
          <>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h3 id="sup-pay-modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                <CreditCard size={18} color="#10b981" aria-hidden="true" /> Registrar Pago
              </h3>
              <button type="button" className="btn btn-ghost" onClick={closePayModal} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
            </div>
            {p.errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{p.errorMsg}</div>}
            <form onSubmit={p.onPayInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
                <div><strong>Proveedor:</strong> {inv.persona?.name}</div>
                <div className="tabular-nums"><strong>Comprobante:</strong> {inv.invoiceNumber}</div>
                <div className="tabular-nums" style={{ color: 'var(--color-danger)', fontWeight: 700, marginTop: '4px' }}>
                  Saldo Pendiente: ${(Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0)).toLocaleString('es-AR')}
                </div>
              </div>
              <div>
                <label htmlFor="sup-pay-branch" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sucursal</label>
                <select id="sup-pay-branch" className="select" value={p.paymentForm.branch} onChange={(e) => p.setPaymentForm({ ...p.paymentForm, branch: e.target.value })}>
                  <option value="A">Sucursal A (Oficial)</option>
                  <option value="X">Sucursal X (Interna)</option>
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Formas de Pago</span>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => {
                    const pending = Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0);
                    const sum = p.paymentItems.reduce((a, i) => a + (Number(i.amount) || 0), 0);
                    p.setPaymentItems([...p.paymentItems, { amount: Math.max(0, pending - sum).toFixed(2), paymentMethod: 'BANK_TRANSFER', bankAccountId: p.bankAccounts[0]?.id ? String(p.bankAccounts[0].id) : '' }]);
                  }}>
                    + Agregar medio
                  </button>
                </div>
                {p.paymentItems.map((item, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <input type="number" step="0.01" required aria-label={`Monto medio ${idx + 1}`} className="input tabular-nums" value={item.amount} onChange={(e) => { const n = [...p.paymentItems]; n[idx].amount = e.target.value; p.setPaymentItems(n); }} />
                      <select aria-label={`Medio de pago ${idx + 1}`} className="select" value={item.paymentMethod} onChange={(e) => { const n = [...p.paymentItems]; n[idx].paymentMethod = e.target.value; p.setPaymentItems(n); }}>
                        <option value="CASH">Efectivo</option>
                        <option value="BANK_TRANSFER">Transferencia</option>
                        <option value="CHECK">Cheque</option>
                      </select>
                      {p.paymentItems.length > 1 && (
                        <button type="button" className="btn btn-ghost" onClick={() => p.setPaymentItems(p.paymentItems.filter((_, i) => i !== idx))} aria-label={`Quitar medio ${idx + 1}`}><Trash2 size={15} color="#ef4444" aria-hidden="true" /></button>
                      )}
                    </div>
                    {(item.paymentMethod === 'BANK_TRANSFER' || item.paymentMethod === 'CHECK') && (
                      <select aria-label={`Cuenta bancaria ${idx + 1}`} className="select" style={{ marginTop: '6px' }} value={item.bankAccountId} onChange={(e) => { const n = [...p.paymentItems]; n[idx].bankAccountId = e.target.value; p.setPaymentItems(n); }}>
                        <option value="">Seleccione cuenta...</option>
                        {p.bankAccounts.map((b: any) => (<option key={b.id} value={b.id}>{b.name || b.bankName} (${Number(b.balance || 0).toLocaleString('es-AR')})</option>))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <label htmlFor="sup-pay-desc" className="visually-hidden">Referencia</label>
                <input id="sup-pay-desc" type="text" className="input" placeholder="Referencia" value={p.paymentForm.description} onChange={(e) => p.setPaymentForm({ ...p.paymentForm, description: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closePayModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={15} aria-hidden="true" /> Confirmar Pago
                </button>
              </div>
            </form>
          </>
        )}
      </NativeModalDialog>
    </>
  );
};
