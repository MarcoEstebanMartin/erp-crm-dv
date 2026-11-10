import React from 'react';
import { X, CreditCard, Trash2, Check } from 'lucide-react';

export const ComprasSupplierInvoiceAndPayModals: React.FC<{
  showSupplierModal: boolean;
  setShowSupplierModal: (v: boolean) => void;
  providers: any[];
  supplierForm: any;
  setSupplierForm: React.Dispatch<React.SetStateAction<any>>;
  autoCalculatedTotal: string;
  onNetChange: (v: string) => void;
  onSupplierInvoiceSubmit: (e: React.FormEvent) => void;
  payInvoiceModal: { open: boolean; invoice: any | null };
  setPayInvoiceModal: (v: { open: boolean; invoice: any | null }) => void;
  paymentForm: any;
  setPaymentForm: React.Dispatch<React.SetStateAction<any>>;
  paymentItems: Array<{ amount: string; paymentMethod: string; bankAccountId: string }>;
  setPaymentItems: React.Dispatch<React.SetStateAction<Array<{ amount: string; paymentMethod: string; bankAccountId: string }>>>;
  bankAccounts: any[];
  onPayInvoiceSubmit: (e: React.FormEvent) => void;
}> = (p) => {
  return (
    <>
      {p.showSupplierModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Ingresar Factura de Proveedor</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => p.setShowSupplierModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={p.onSupplierInvoiceSubmit}>
              <div className="form-group">
                <label>Proveedor *</label>
                <select className="select" value={p.supplierForm.personaId} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, personaId: e.target.value }))} required>
                  <option value="">Seleccione un proveedor...</option>
                  {p.providers.map((pr) => (<option key={pr.id} value={pr.id}>{pr.name} (CUIT: {pr.cuit})</option>))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Tipo</label>
                  <select className="select" value={p.supplierForm.invoiceType} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, invoiceType: e.target.value }))}>
                    <option value="FACTURA_A">Factura A</option>
                    <option value="FACTURA_B">Factura B</option>
                    <option value="FACTURA_C">Factura C</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Nro Comprobante</label>
                  <input type="text" className="input" placeholder="0001-00012345" value={p.supplierForm.invoiceNumber} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, invoiceNumber: e.target.value }))} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Emisión</label>
                  <input type="date" className="input" value={p.supplierForm.issueDate} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, issueDate: e.target.value, dueDate: new Date(new Date(e.target.value).getTime() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0] }))} required />
                </div>
                <div className="form-group">
                  <label>Vencimiento</label>
                  <input type="date" className="input" value={p.supplierForm.dueDate} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, dueDate: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Sucursal</label>
                  <select className="select" value={p.supplierForm.billingType} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, billingType: e.target.value }))}>
                    <option value="OFFICIAL">Sucursal A</option>
                    <option value="INTERNAL">Sucursal X</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group"><label>Neto Gravado ($)</label><input type="number" step="0.01" className="input" value={p.supplierForm.netAmount} onChange={(e) => p.onNetChange(e.target.value)} required /></div>
                <div className="form-group"><label>IVA Crédito Fiscal ($)</label><input type="number" step="0.01" className="input" value={p.supplierForm.taxAmount} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, taxAmount: e.target.value }))} required /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group"><label>IIBB La Pampa ($)</label><input type="number" step="0.01" className="input" value={p.supplierForm.percepcionPampa} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionPampa: e.target.value }))} /></div>
                <div className="form-group"><label>IIBB Bs As ($)</label><input type="number" step="0.01" className="input" value={p.supplierForm.percepcionBsAs} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionBsAs: e.target.value }))} /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group"><label>Percepción IVA ($)</label><input type="number" step="0.01" className="input" value={p.supplierForm.percepcionIva} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, percepcionIva: e.target.value }))} /></div>
                <div className="form-group"><label>Impuestos Internos ($)</label><input type="number" step="0.01" className="input" value={p.supplierForm.impuestosInternos} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, impuestosInternos: e.target.value }))} /></div>
              </div>

              <div className="form-group">
                <label>Total Factura ($) — Calculado: ${p.autoCalculatedTotal}</label>
                <input type="number" step="0.01" className="input" value={p.supplierForm.totalAmount} onChange={(e) => p.setSupplierForm((prev: any) => ({ ...prev, totalAmount: e.target.value }))} required />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => p.setShowSupplierModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>Registrar Compra</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {p.payInvoiceModal.open && p.payInvoiceModal.invoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', padding: '20px' }}>
            <div className="modal-header" style={{ marginBottom: '12px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}><CreditCard size={18} color="#10b981" /> Registrar Pago de Factura</h3>
              <button className="btn btn-ghost" onClick={() => p.setPayInvoiceModal({ open: false, invoice: null })}><X size={18} /></button>
            </div>
            <form onSubmit={p.onPayInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
                <div><strong>Proveedor:</strong> {p.payInvoiceModal.invoice.persona?.name}</div>
                <div><strong>Comprobante:</strong> {p.payInvoiceModal.invoice.invoiceNumber}</div>
                <div style={{ color: 'var(--color-danger)', fontWeight: 700, marginTop: '4px' }}>
                  Saldo Pendiente: ${(Number(p.payInvoiceModal.invoice.totalAmount || 0) - Number(p.payInvoiceModal.invoice.paidAmount || 0)).toLocaleString('es-AR')}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sucursal Imputación</label>
                <select className="select" value={p.paymentForm.branch} onChange={(e) => p.setPaymentForm({ ...p.paymentForm, branch: e.target.value })}>
                  <option value="A">Sucursal A (Oficial)</option>
                  <option value="X">Sucursal X (Interna)</option>
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600 }}>Formas de Pago</label>
                  <button
                    type="button" style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      const pending = Number(p.payInvoiceModal.invoice?.totalAmount || 0) - Number(p.payInvoiceModal.invoice?.paidAmount || 0);
                      const sum = p.paymentItems.reduce((a, i) => a + (Number(i.amount) || 0), 0);
                      p.setPaymentItems([...p.paymentItems, { amount: Math.max(0, pending - sum).toFixed(2), paymentMethod: 'BANK_TRANSFER', bankAccountId: p.bankAccounts[0]?.id ? String(p.bankAccounts[0].id) : '' }]);
                    }}
                  >
                    + Agregar forma de pago
                  </button>
                </div>

                {p.paymentItems.map((item, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                      <input type="number" step="0.01" required className="input" value={item.amount} onChange={(e) => { const n = [...p.paymentItems]; n[idx].amount = e.target.value; p.setPaymentItems(n); }} />
                      <select className="select" value={item.paymentMethod} onChange={(e) => { const n = [...p.paymentItems]; n[idx].paymentMethod = e.target.value; p.setPaymentItems(n); }}>
                        <option value="CASH">Efectivo</option>
                        <option value="BANK_TRANSFER">Transferencia</option>
                        <option value="CHECK">Cheque</option>
                      </select>
                      {p.paymentItems.length > 1 && (
                        <button type="button" className="btn btn-ghost" onClick={() => p.setPaymentItems(p.paymentItems.filter((_, i) => i !== idx))}><Trash2 size={15} color="#ef4444" /></button>
                      )}
                    </div>
                    {(item.paymentMethod === 'BANK_TRANSFER' || item.paymentMethod === 'CHECK') && (
                      <select className="select" style={{ marginTop: '6px' }} value={item.bankAccountId} onChange={(e) => { const n = [...p.paymentItems]; n[idx].bankAccountId = e.target.value; p.setPaymentItems(n); }}>
                        <option value="">Seleccione cuenta bancaria...</option>
                        {p.bankAccounts.map((b: any) => (<option key={b.id} value={b.id}>{b.name || b.bankName} (Saldo: ${Number(b.balance || 0).toLocaleString('es-AR')})</option>))}
                      </select>
                    )}
                  </div>
                ))}
              </div>

              <input type="text" className="input" placeholder="Detalle / Referencia" value={p.paymentForm.description} onChange={(e) => p.setPaymentForm({ ...p.paymentForm, description: e.target.value })} />

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => p.setPayInvoiceModal({ open: false, invoice: null })}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={15} /> Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
