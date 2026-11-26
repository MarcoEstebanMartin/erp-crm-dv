import React from 'react';
import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { AdminPaymentCheckFields } from './AdminPaymentCheckFields';
import { AdminPaymentAllocationPreview } from './AdminPaymentAllocationPreview';
import { AdminPaymentInvoiceSelector } from './AdminPaymentInvoiceSelector';
import { useAdminPaymentModal, type ClientPaymentMethod } from './useAdminPaymentModal';

interface AdminPaymentModalProps {
  paymentModal: { open: boolean; clientId: number; clientName: string } | null;
  clientProfileModal: { open: boolean; client: any; ledger: any[] } | null;
  onClose: () => void;
  onSuccess: (clientId: number) => Promise<void>;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export const AdminPaymentModal: React.FC<AdminPaymentModalProps> = ({
  paymentModal,
  clientProfileModal,
  onClose,
  onSuccess,
  setErrorMsg,
  setSuccessMsg,
}) => {
  const {
    creditCheckboxRef,
    paymentAmount,
    setPaymentAmount,
    paymentMethod,
    handlePaymentMethodChange,
    paymentDescription,
    setPaymentDescription,
    checkNumber,
    setCheckNumber,
    checkBank,
    setCheckBank,
    checkDueDate,
    setCheckDueDate,
    isEcheq,
    setIsEcheq,
    paymentLoading,
    paymentPendingInvoices,
    unbilledBalance,
    includeUnbilledBalance,
    availableCredit,
    outstandingBalance,
    paymentSelectedInvoiceIds,
    allowCreditOnAccount,
    setAllowCreditOnAccount,
    modalError,
    setModalError,
    effectiveDebt,
    fillTargetAmount,
    excessAmount,
    showCreditToggle,
    handleToggleInvoice,
    handleToggleUnbilledBalance,
    handleToggleAllInvoices,
    handleSubmit,
  } = useAdminPaymentModal({
    paymentModal,
    clientProfileModal,
    onClose,
    onSuccess,
    setErrorMsg,
    setSuccessMsg,
  });

  if (!paymentModal || !paymentModal.open) return null;

  return (
    <NativeModalDialog
      isOpen={Boolean(paymentModal?.open)}
      onClose={onClose}
      ariaLabelledBy="admin-payment-modal-title"
      style={{ width: '440px', maxWidth: '94vw', height: 'min(640px, 90dvh)', padding: 0, overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="modal-header" style={{ flexShrink: 0, padding: '18px 24px 12px', marginBottom: 0, borderBottom: '1px solid var(--border-color)' }}>
          <h3 id="admin-payment-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
            Cobrar · {paymentModal.clientName}
          </h3>
          <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
          <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, padding: '16px 24px 12px' }}>
        <div style={{ marginBottom: '12px', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {outstandingBalance !== null && outstandingBalance < 0 ? 'Saldo a favor' : 'Deuda actual'}
            </span>
            <strong
              style={{
                color:
                  outstandingBalance === null
                    ? 'var(--text-secondary)'
                    : outstandingBalance > 0
                      ? '#dc2626'
                      : '#15803d',
              }}
            >
              {outstandingBalance === null
                ? '...'
                : outstandingBalance < 0
                  ? `$${Math.abs(outstandingBalance).toLocaleString('es-AR')}`
                  : outstandingBalance === 0
                    ? '$0 (Sin deuda)'
                    : `$${outstandingBalance.toLocaleString('es-AR')}`}
            </strong>
          </div>
          {availableCredit > 0 && (outstandingBalance === null || outstandingBalance >= 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Saldo a favor</span>
              <strong style={{ color: '#15803d' }}>${availableCredit.toLocaleString('es-AR')}</strong>
            </div>
          )}
        </div>

        <AdminPaymentInvoiceSelector
          pendingInvoices={paymentPendingInvoices}
          selectedInvoiceIds={paymentSelectedInvoiceIds}
          unbilledBalance={unbilledBalance}
          includeUnbilledBalance={includeUnbilledBalance}
          disabled={paymentLoading}
          onToggleInvoice={handleToggleInvoice}
          onToggleUnbilledBalance={handleToggleUnbilledBalance}
          onToggleAll={handleToggleAllInvoices}
        />

        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label htmlFor="payment-amount" style={{ marginBottom: 0 }}>Monto ($)</label>
            {fillTargetAmount > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={paymentLoading}
                onClick={() => { setPaymentAmount(String(fillTargetAmount)); if (modalError) setModalError(null); }}
                style={{ padding: '2px 10px', fontSize: '0.76rem', fontWeight: 600, minHeight: '24px' }}
              >
                Completar
              </button>
            )}
          </div>
          <input
            id="payment-amount"
            name="amount"
            type="number"
            min="1"
            step="any"
            className="input"
            value={paymentAmount}
            onChange={(e) => {
              setPaymentAmount(e.target.value);
              if (modalError) setModalError(null);
            }}
            required
            disabled={paymentLoading}
          />
        </div>

        <AdminPaymentAllocationPreview
          paymentAmount={paymentAmount}
          pendingInvoices={paymentPendingInvoices}
          selectedInvoiceIds={paymentSelectedInvoiceIds}
          unbilledBalance={unbilledBalance}
          includeUnbilledBalance={includeUnbilledBalance}
        />

        {showCreditToggle && (
          <div
            role="status"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '14px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '0.82rem',
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {excessAmount > 0 && effectiveDebt <= 0
                ? `Estás cargando $${excessAmount.toLocaleString('es-AR')} de más (sin deuda).`
                : excessAmount > 0
                  ? `Estás cargando $${excessAmount.toLocaleString('es-AR')} de más (deuda: $${effectiveDebt.toLocaleString('es-AR')}).`
                  : 'El importe supera la deuda actual.'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                ref={creditCheckboxRef}
                id="payment-allow-credit"
                name="allowCreditOnAccount"
                type="checkbox"
                checked={allowCreditOnAccount}
                aria-invalid={Boolean(modalError && !allowCreditOnAccount)}
                onChange={(e) => {
                  setAllowCreditOnAccount(e.target.checked);
                  if (e.target.checked) setModalError(null);
                }}
                disabled={paymentLoading}
                style={{ width: '16px', height: '16px', accentColor: '#111827', cursor: 'pointer' }}
              />
              <label
                htmlFor="payment-allow-credit"
                style={{ fontSize: '0.84rem', fontWeight: 600, color: '#111827', cursor: 'pointer' }}
              >
                Dejar plata a favor
              </label>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="payment-method">Medio de pago</label>
          <select
            id="payment-method"
            name="paymentMethod"
            className="select"
            value={paymentMethod}
            onChange={(e) => handlePaymentMethodChange(e.target.value as ClientPaymentMethod)}
            disabled={paymentLoading}
          >
            <option value="CASH">Efectivo</option>
            <option value="BANK_TRANSFER">Transferencia</option>
            <option value="CHECK">Cheque</option>
          </select>
        </div>

        {paymentMethod === 'CHECK' && (
          <AdminPaymentCheckFields
            checkNumber={checkNumber}
            checkBank={checkBank}
            checkDueDate={checkDueDate}
            isEcheq={isEcheq}
            disabled={paymentLoading}
            onCheckNumberChange={setCheckNumber}
            onCheckBankChange={setCheckBank}
            onCheckDueDateChange={setCheckDueDate}
            onIsEcheqChange={setIsEcheq}
          />
        )}

        <div className="form-group">
          <label htmlFor="payment-notes">Notas</label>
          <input
            id="payment-notes"
            name="description"
            type="text"
            className="input"
            value={paymentDescription}
            onChange={(e) => setPaymentDescription(e.target.value)}
            disabled={paymentLoading}
          />
        </div>

        {modalError && (
          <div
            role="alert"
            style={{
              marginTop: '10px',
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: '0.84rem',
            }}
          >
            {modalError}
          </div>
        )}

          </div>

          <div
            className="modal-footer"
            style={{
              flexShrink: 0,
              marginTop: 0,
              padding: '12px 24px 18px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={paymentLoading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={paymentLoading}>
              {paymentLoading ? 'Guardando...' : 'Cobrar'}
            </button>
          </div>
        </form>
      </div>
    </NativeModalDialog>
  );
};
