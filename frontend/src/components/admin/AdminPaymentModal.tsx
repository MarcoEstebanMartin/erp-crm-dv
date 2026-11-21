import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { NativeModalDialog } from '../modals/NativeModalDialog';

type ClientPaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK';

interface PendingInvoiceOption {
  id: number;
  invoiceNumber: string;
  pendingAmount: number;
  status?: 'PENDING' | 'PARTIAL' | 'PAID';
}

interface PreviewLine {
  key: string;
  label: string;
  amount: number;
  badge: string;
  isCredit?: boolean;
}

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
  const confirm = useConfirm();
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
  const [paymentSelectedInvoiceId, setPaymentSelectedInvoiceId] = useState<number | null>(null);

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
      api
        .getPersonaPendingInvoices(paymentModal.clientId)
        .then((res) => {
          setPaymentPendingInvoices(res?.invoices && Array.isArray(res.invoices) ? res.invoices : []);
          setAvailableCredit(Math.round(Number(res?.totalAvailableCredit || 0)));
        })
        .catch(() => {
          setPaymentPendingInvoices([]);
          setAvailableCredit(0);
        });
    } else {
      setPaymentPendingInvoices([]);
      setAvailableCredit(0);
    }
  }, [paymentModal]);

  const allocationPreview = useMemo<PreviewLine[]>(() => {
    const parsed = Math.round(Number(paymentAmount));
    if (!Number.isFinite(parsed) || parsed <= 0 || paymentPendingInvoices.length === 0) return [];

    const ordered = paymentSelectedInvoiceId
      ? [
          ...paymentPendingInvoices.filter((i) => i.id === paymentSelectedInvoiceId),
          ...paymentPendingInvoices.filter((i) => i.id !== paymentSelectedInvoiceId),
        ]
      : paymentPendingInvoices;

    let remaining = parsed;
    const lines: PreviewLine[] = [];

    for (const inv of ordered) {
      if (remaining <= 0) break;
      const pending = Math.round(Number(inv.pendingAmount));
      if (pending <= 0) continue;
      const applied = Math.min(remaining, pending);
      const leftAfter = pending - applied;
      remaining -= applied;
      lines.push({
        key: String(inv.id),
        label: inv.invoiceNumber,
        amount: applied,
        badge: leftAfter === 0 ? 'Saldada' : `Resta $${leftAfter.toLocaleString('es-AR')}`,
      });
    }

    if (remaining > 0) {
      lines.push({
        key: 'credit',
        label: 'Saldo a favor',
        amount: remaining,
        badge: 'Próxima factura',
        isCredit: true,
      });
    }

    return lines;
  }, [paymentAmount, paymentPendingInvoices, paymentSelectedInvoiceId]);

  if (!paymentModal || !paymentModal.open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) return setErrorMsg('Monto inválido.');
    if (paymentMethod === 'CHECK' && !checkNumber.trim()) {
      return setErrorMsg('Ingresá el número de cheque o eCheq.');
    }
    if (paymentLoading) return;

    if (clientProfileModal && clientProfileModal.client.id === paymentModal.clientId) {
      const balance = Number(clientProfileModal.client.outstandingBalance || 0);
      const parsedAmount = Number(paymentAmount);
      if (parsedAmount > balance) {
        const ok = await confirm(
          `El cobro ($${parsedAmount.toLocaleString('es-AR')}) supera el saldo ($${balance.toLocaleString('es-AR')}). ¿Continuar?`,
          { type: 'warning' },
        );
        if (!ok) return;
      }
    }

    try {
      setPaymentLoading(true);
      setErrorMsg(null);

      await api.registerPayment(paymentModal.clientId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription.trim() || undefined,
        orderId: paymentSelectedInvoiceId || undefined,
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
      setErrorMsg(err.message || 'Error al registrar cobro.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <NativeModalDialog
      isOpen={Boolean(paymentModal?.open)}
      onClose={onClose}
      ariaLabelledBy="admin-payment-modal-title"
      style={{ maxWidth: '420px', width: '94vw', padding: '20px 24px' }}
    >
      <div className="modal-header" style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 id="admin-payment-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
          Cobrar · {paymentModal.clientName}
        </h3>
        <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {availableCredit > 0 && (
          <div
            style={{
              marginBottom: '12px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              fontSize: '0.82rem',
              display: 'flex',
              justifyContent: 'space-between',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ color: 'var(--text-secondary)' }}>Saldo a favor</span>
            <strong style={{ color: '#15803d' }}>${availableCredit.toLocaleString('es-AR')}</strong>
          </div>
        )}

        {paymentPendingInvoices.length > 0 && (
          <div className="form-group">
            <label htmlFor="payment-invoice">Imputar</label>
            <select
              id="payment-invoice"
              name="orderId"
              className="select"
              value={paymentSelectedInvoiceId || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setPaymentSelectedInvoiceId(null);
                  setPaymentAmount(
                    clientProfileModal?.client?.id === paymentModal.clientId
                      ? String(Math.round(Number(clientProfileModal.client.outstandingBalance)))
                      : '',
                  );
                } else {
                  const invId = Number(val);
                  setPaymentSelectedInvoiceId(invId);
                  const inv = paymentPendingInvoices.find((i) => i.id === invId);
                  if (inv) setPaymentAmount(String(Math.round(Number(inv.pendingAmount))));
                }
              }}
            >
              <option value="">Automático (más viejas primero)</option>
              {paymentPendingInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber}
                  {inv.status === 'PARTIAL' ? ' · Parcial' : ''} ($
                  {Math.round(Number(inv.pendingAmount)).toLocaleString('es-AR')})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="payment-amount">Monto ($)</label>
          <input
            id="payment-amount"
            name="amount"
            type="number"
            min="1"
            step="any"
            className="input"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
            disabled={paymentLoading}
          />
        </div>

        {allocationPreview.length > 0 && (
          <output
            htmlFor="payment-amount payment-invoice"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              marginBottom: '14px',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-subtle, #f8fafc)',
              fontSize: '0.8rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {allocationPreview.map((line) => (
              <div
                key={line.key}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
              >
                <span style={{ color: line.isCredit ? '#15803d' : 'var(--text-primary)', fontWeight: 500 }}>
                  {line.label}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong>${line.amount.toLocaleString('es-AR')}</strong>
                  <span style={{ color: line.badge === 'Saldada' || line.isCredit ? '#15803d' : 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {line.badge}
                  </span>
                </span>
              </div>
            ))}
          </output>
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
          <fieldset
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <legend style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0 6px' }}>
              Datos del cheque
            </legend>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="payment-check-number">
                N° de cheque / eCheq <span aria-hidden="true">*</span>
              </label>
              <input
                id="payment-check-number"
                name="checkNumber"
                type="text"
                className="input"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={paymentLoading}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="payment-check-bank">Banco / Emisor</label>
                <input
                  id="payment-check-bank"
                  name="checkBank"
                  type="text"
                  className="input"
                  value={checkBank}
                  onChange={(e) => setCheckBank(e.target.value)}
                  disabled={paymentLoading}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="payment-check-due">Vencimiento</label>
                <input
                  id="payment-check-due"
                  name="checkDueDate"
                  type="date"
                  className="input"
                  value={checkDueDate}
                  onChange={(e) => setCheckDueDate(e.target.value)}
                  disabled={paymentLoading}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px' }}>
              <input
                id="payment-check-echeq"
                name="isEcheq"
                type="checkbox"
                checked={isEcheq}
                onChange={(e) => setIsEcheq(e.target.checked)}
                disabled={paymentLoading}
                style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
              />
              <label htmlFor="payment-check-echeq" style={{ fontSize: '0.84rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                eCheq
              </label>
            </div>
          </fieldset>
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

        <div className="modal-footer" style={{ marginTop: '18px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={paymentLoading}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={paymentLoading}>
            {paymentLoading ? 'Guardando...' : 'Cobrar'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
