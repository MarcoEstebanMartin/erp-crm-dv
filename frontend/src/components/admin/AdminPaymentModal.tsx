import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { AdminPaymentCheckFields } from './AdminPaymentCheckFields';
import {
  AdminPaymentAllocationPreview,
  formatInvoiceShortDate,
  type PendingInvoiceOption,
} from './AdminPaymentAllocationPreview';

type ClientPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK';

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
  const creditCheckboxRef = useRef<HTMLInputElement>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<ClientPaymentMethod>('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkBank, setCheckBank] = useState('');
  const [checkDueDate, setCheckDueDate] = useState('');
  const [isEcheq, setIsEcheq] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPendingInvoices, setPaymentPendingInvoices] = useState<PendingInvoiceOption[]>([]);
  const [availableCredit, setAvailableCredit] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(null);
  const [paymentSelectedInvoiceId, setPaymentSelectedInvoiceId] = useState<number | null>(null);
  const [allowCreditOnAccount, setAllowCreditOnAccount] = useState(false);
  const [needsCreditOverride, setNeedsCreditOverride] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentModal && paymentModal.open) {
      setPaymentAmount('');
      setPaymentMethod('CASH');
      setPaymentDescription('');
      setCheckNumber('');
      setCheckBank('');
      setCheckDueDate('');
      setIsEcheq(false);
      setPaymentSelectedInvoiceId(null);
      setAllowCreditOnAccount(false);
      setNeedsCreditOverride(false);
      setModalError(null);
      const profileBalance =
        clientProfileModal?.client?.id === paymentModal.clientId
          ? Math.round(Number(clientProfileModal.client.outstandingBalance || 0))
          : null;
      setOutstandingBalance(profileBalance);
      api
        .getPersonaPendingInvoices(paymentModal.clientId)
        .then((res) => {
          const rawInvoices: PendingInvoiceOption[] =
            res?.invoices && Array.isArray(res.invoices) ? res.invoices : [];
          const sortedInvoices = [...rawInvoices].sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return ta !== tb ? ta - tb : a.id - b.id;
          });
          setPaymentPendingInvoices(sortedInvoices);
          setPaymentSelectedInvoiceId(sortedInvoices.length > 0 ? sortedInvoices[0].id : null);
          setAvailableCredit(Math.round(Number(res?.totalAvailableCredit || 0)));
          if (res?.outstandingBalance !== undefined && res?.outstandingBalance !== null) {
            setOutstandingBalance(Math.round(Number(res.outstandingBalance)));
          } else if (res?.netBalance !== undefined && res?.netBalance !== null) {
            setOutstandingBalance(Math.round(Number(res.netBalance)));
          }
        })
        .catch(() => {
          setPaymentPendingInvoices([]);
          setAvailableCredit(0);
        });
    } else {
      setPaymentPendingInvoices([]);
      setAvailableCredit(0);
      setOutstandingBalance(null);
      setAllowCreditOnAccount(false);
      setNeedsCreditOverride(false);
      setModalError(null);
    }
  }, [paymentModal, clientProfileModal]);

  if (!paymentModal || !paymentModal.open) return null;

  const parsedAmount = Math.round(Number(paymentAmount) || 0);
  const selectedInvoice = paymentSelectedInvoiceId
    ? paymentPendingInvoices.find((i) => i.id === paymentSelectedInvoiceId) || null
    : null;
  const effectiveDebt = Math.max(0, outstandingBalance ?? 0);
  const fillTargetAmount = selectedInvoice ? Math.max(0, Math.round(Number(selectedInvoice.pendingAmount))) : effectiveDebt;
  const excessAmount =
    parsedAmount > 0 && outstandingBalance !== null && parsedAmount > effectiveDebt
      ? parsedAmount - effectiveDebt
      : 0;
  const showCreditToggle = excessAmount > 0 || needsCreditOverride;
  const isOverflowingOldestIntoFifo =
    selectedInvoice !== null &&
    paymentPendingInvoices[0]?.id === selectedInvoice.id &&
    parsedAmount > Math.round(Number(selectedInvoice.pendingAmount));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setModalError('Monto inválido.');
      return;
    }
    if (paymentMethod === 'CHECK' && !checkNumber.trim()) {
      setModalError('Ingresá el número de cheque o eCheq.');
      return;
    }
    if (showCreditToggle && !allowCreditOnAccount) {
      setModalError('Tildá "Dejar plata a favor" para continuar.');
      creditCheckboxRef.current?.focus();
      return;
    }
    if (paymentLoading) return;

    try {
      setPaymentLoading(true);
      setModalError(null);
      setErrorMsg(null);

      await api.registerPayment(paymentModal.clientId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription.trim() || undefined,
        orderId: isOverflowingOldestIntoFifo ? undefined : paymentSelectedInvoiceId || undefined,
        allowCreditOnAccount: showCreditToggle ? allowCreditOnAccount : false,
        ...(paymentMethod === 'CHECK'
          ? {
              checkNumber: checkNumber.trim(),
              checkBank: checkBank.trim() || undefined,
              checkDueDate: checkDueDate || undefined,
              isEcheq,
            }
          : {}),
      });

      setSuccessMsg('Cobro registrado.');
      await onSuccess(paymentModal.clientId);
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Error al registrar cobro.';
      if (msg.includes('Dejar plata a favor')) {
        setNeedsCreditOverride(true);
      }
      setModalError(msg);
    } finally {
      setPaymentLoading(false);
    }
  };

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

        {paymentPendingInvoices.length > 0 && (
          <div className="form-group">
            <label htmlFor="payment-invoice">Imputar</label>
            <select
              id="payment-invoice"
              name="orderId"
              className="select"
              value={paymentSelectedInvoiceId ?? paymentPendingInvoices[0].id}
              onChange={(e) => {
                const invId = Number(e.target.value);
                setPaymentSelectedInvoiceId(invId);
                const inv = paymentPendingInvoices.find((i) => i.id === invId);
                if (inv) setPaymentAmount(String(Math.round(Number(inv.pendingAmount))));
              }}
            >
              {paymentPendingInvoices.map((inv) => {
                const dateStr = formatInvoiceShortDate(inv.createdAt);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber}
                    {dateStr ? ` · ${dateStr}` : ''}
                    {inv.status === 'PARTIAL' ? ' · Parcial' : ''} — $
                    {Math.round(Number(inv.pendingAmount)).toLocaleString('es-AR')}
                  </option>
                );
              })}
            </select>
          </div>
        )}

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
          selectedInvoiceId={paymentSelectedInvoiceId}
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
            onChange={(e) => {
              const next = e.target.value as ClientPaymentMethod;
              setPaymentMethod(next);
              if (next !== 'CHECK') {
                setCheckNumber('');
                setCheckBank('');
                setCheckDueDate('');
                setIsEcheq(false);
              }
            }}
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
