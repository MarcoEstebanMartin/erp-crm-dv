import type { FC, FormEvent } from 'react';
import { X, CreditCard, Trash2, Check } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { formatCentsArs, parseExactCents } from './providersHelpers';

export const ComprasPayInvoiceModal: FC<{
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
}> = ({
  payInvoiceModal,
  setPayInvoiceModal,
  paymentForm,
  setPaymentForm,
  paymentItems,
  setPaymentItems,
  bankAccounts,
  onPayInvoiceSubmit,
  errorMsg,
  setErrorMsg,
}) => {
  const closePayModal = () => {
    setErrorMsg?.(null);
    setPayInvoiceModal({ open: false, invoice: null });
  };
  const inv = payInvoiceModal.invoice;
  const pendingCents = inv ? Math.max(0, parseExactCents(inv.totalAmount) - parseExactCents(inv.paidAmount)) : 0;
  const payingCents = paymentItems.reduce((acc, item) => acc + Math.max(0, parseExactCents(item.amount)), 0);
  const exceedsPending = inv ? payingCents > pendingCents + 1 : false;

  return (
    <NativeModalDialog isOpen={payInvoiceModal.open && Boolean(inv)} onClose={closePayModal} ariaLabelledBy="sup-pay-modal-title" style={{ maxWidth: '520px', width: '94vw', padding: '20px' }}>
      {inv && (
        <>
          <div className="modal-header" style={{ marginBottom: '12px' }}>
            <h3 id="sup-pay-modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
              <CreditCard size={18} aria-hidden="true" /> Registrar pago
            </h3>
            <button type="button" className="btn btn-ghost" onClick={closePayModal} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
          </div>
          {errorMsg && <div role="alert" className="alert alert-danger" style={{ marginBottom: '12px' }}>{errorMsg}</div>}
          <form onSubmit={onPayInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
              <div><strong>Proveedor:</strong> {inv.persona?.name}</div>
              <div className="tabular-nums"><strong>Comprobante:</strong> {inv.invoiceNumber}</div>
              <div className="tabular-nums" style={{ color: 'var(--color-danger)', fontWeight: 700, marginTop: '4px' }}>
                Saldo pendiente: {formatCentsArs(pendingCents)}
              </div>
            </div>
            <div>
              <label htmlFor="sup-pay-branch" style={{ fontSize: '0.78rem', fontWeight: 600 }}>Sucursal</label>
              <select id="sup-pay-branch" className="select" value={paymentForm.branch} onChange={(e) => setPaymentForm({ ...paymentForm, branch: e.target.value })}>
                <option value="A">Sucursal A (Oficial)</option>
                <option value="X">Sucursal X (Interna)</option>
              </select>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Formas de pago</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.76rem', fontWeight: 600, padding: '2px 6px', color: 'var(--text-primary)' }}
                  onClick={() => {
                    const remainingCents = Math.max(0, pendingCents - payingCents);
                    setPaymentItems([...paymentItems, { amount: (remainingCents / 100).toFixed(2), paymentMethod: 'BANK_TRANSFER', bankAccountId: bankAccounts[0]?.id ? String(bankAccounts[0].id) : '' }]);
                  }}
                >
                  + Agregar medio
                </button>
              </div>
              {paymentItems.map((item, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                    <input type="number" step="0.01" required aria-label={`Monto medio ${idx + 1}`} className="input tabular-nums" value={item.amount} onChange={(e) => { const n = [...paymentItems]; n[idx] = { ...n[idx], amount: e.target.value }; setPaymentItems(n); }} />
                    <select aria-label={`Medio de pago ${idx + 1}`} className="select" value={item.paymentMethod} onChange={(e) => { const n = [...paymentItems]; n[idx] = { ...n[idx], paymentMethod: e.target.value }; setPaymentItems(n); }}>
                      <option value="CASH">Efectivo</option>
                      <option value="BANK_TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                    </select>
                    {paymentItems.length > 1 && (
                      <button type="button" className="btn btn-ghost" onClick={() => setPaymentItems(paymentItems.filter((_, i) => i !== idx))} aria-label={`Quitar medio ${idx + 1}`}><Trash2 size={15} color="var(--color-danger)" aria-hidden="true" /></button>
                    )}
                  </div>
                  {(item.paymentMethod === 'BANK_TRANSFER' || item.paymentMethod === 'CHECK') && (
                    <select aria-label={`Cuenta bancaria ${idx + 1}`} className="select" style={{ marginTop: '6px' }} value={item.bankAccountId} onChange={(e) => { const n = [...paymentItems]; n[idx] = { ...n[idx], bankAccountId: e.target.value }; setPaymentItems(n); }}>
                      <option value="">Seleccione cuenta...</option>
                      {bankAccounts.map((b: any) => (<option key={b.id} value={b.id}>{b.name || b.bankName} ({formatCentsArs(parseExactCents(b.balance))})</option>))}
                    </select>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 8px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total a imputar</span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: exceedsPending ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                  {formatCentsArs(payingCents)}
                </span>
              </div>
              {exceedsPending && (
                <div role="alert" style={{ fontSize: '0.76rem', color: 'var(--color-danger)', marginTop: '4px' }}>
                  El monto supera el saldo pendiente de {formatCentsArs(pendingCents)}.
                </div>
              )}
            </div>
            <div>
              <label htmlFor="sup-pay-desc" className="visually-hidden">Referencia</label>
              <input id="sup-pay-desc" type="text" className="input" placeholder="Referencia" value={paymentForm.description} onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closePayModal}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={exceedsPending || payingCents <= 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Check size={15} aria-hidden="true" /> Confirmar pago
              </button>
            </div>
          </form>
        </>
      )}
    </NativeModalDialog>
  );
};
