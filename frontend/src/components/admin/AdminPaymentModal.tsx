import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { NativeModalDialog } from '../modals/NativeModalDialog';

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
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPendingInvoices, setPaymentPendingInvoices] = useState<any[]>([]);
  const [paymentSelectedInvoiceId, setPaymentSelectedInvoiceId] = useState<number | null>(null);

  const [paymentRetencionGananciasAmount, setPaymentRetencionGananciasAmount] = useState('');
  const [paymentRetencionGananciasNumber, setPaymentRetencionGananciasNumber] = useState('');
  const [paymentRetencionIibbAmount, setPaymentRetencionIibbAmount] = useState('');
  const [paymentRetencionIibbNumber, setPaymentRetencionIibbNumber] = useState('');

  useEffect(() => {
    if (paymentModal && paymentModal.open) {
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentSelectedInvoiceId(null);
      setPaymentRetencionGananciasAmount('');
      setPaymentRetencionGananciasNumber('');
      setPaymentRetencionIibbAmount('');
      setPaymentRetencionIibbNumber('');
      api
        .getPersonaPendingInvoices(paymentModal.clientId)
        .then((res) => setPaymentPendingInvoices(res?.invoices && Array.isArray(res.invoices) ? res.invoices : []))
        .catch(() => setPaymentPendingInvoices([]));
    } else {
      setPaymentPendingInvoices([]);
    }
  }, [paymentModal]);

  if (!paymentModal || !paymentModal.open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) return setErrorMsg('Monto inválido.');
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
      const retencionesToSend = [];
      if (paymentRetencionGananciasAmount && Number(paymentRetencionGananciasAmount) > 0) {
        retencionesToSend.push({
          taxType: 'GANANCIAS' as const,
          number: paymentRetencionGananciasNumber || `RET-GAN-${Date.now()}`,
          amount: Number(paymentRetencionGananciasAmount),
        });
      }
      if (paymentRetencionIibbAmount && Number(paymentRetencionIibbAmount) > 0) {
        retencionesToSend.push({
          taxType: 'IIBB' as const,
          number: paymentRetencionIibbNumber || `RET-IIBB-${Date.now()}`,
          amount: Number(paymentRetencionIibbAmount),
        });
      }

      await api.registerPayment(paymentModal.clientId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription,
        orderId: paymentSelectedInvoiceId || undefined,
        retenciones: retencionesToSend.length > 0 ? retencionesToSend : undefined,
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
              <option value="">Cuenta general</option>
              {paymentPendingInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} (${Math.round(Number(inv.pendingAmount)).toLocaleString('es-AR')})
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
            className="input"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
            disabled={paymentLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="payment-method">Medio de pago</label>
          <select
            id="payment-method"
            name="paymentMethod"
            className="select"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={paymentLoading}
          >
            <option value="CASH">Efectivo</option>
            <option value="BANK_TRANSFER">Transferencia</option>
            <option value="CHECK">Cheque</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '12px', marginBottom: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.84rem', fontWeight: 600 }}>Retenciones</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', marginBottom: '8px' }}>
            <div>
              <label htmlFor="payment-ret-ganancias-amount" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Ganancias ($)
              </label>
              <input
                id="payment-ret-ganancias-amount"
                name="retGananciasAmount"
                type="number"
                step="0.01"
                className="input"
                style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                value={paymentRetencionGananciasAmount}
                onChange={(e) => setPaymentRetencionGananciasAmount(e.target.value)}
                disabled={paymentLoading}
              />
            </div>
            <div>
              <label htmlFor="payment-ret-ganancias-number" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Certificado
              </label>
              <input
                id="payment-ret-ganancias-number"
                name="retGananciasNumber"
                type="text"
                className="input"
                style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                value={paymentRetencionGananciasNumber}
                onChange={(e) => setPaymentRetencionGananciasNumber(e.target.value)}
                disabled={paymentLoading}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
            <div>
              <label htmlFor="payment-ret-iibb-amount" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                IIBB ($)
              </label>
              <input
                id="payment-ret-iibb-amount"
                name="retIibbAmount"
                type="number"
                step="0.01"
                className="input"
                style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                value={paymentRetencionIibbAmount}
                onChange={(e) => setPaymentRetencionIibbAmount(e.target.value)}
                disabled={paymentLoading}
              />
            </div>
            <div>
              <label htmlFor="payment-ret-iibb-number" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Certificado
              </label>
              <input
                id="payment-ret-iibb-number"
                name="retIibbNumber"
                type="text"
                className="input"
                style={{ padding: '6px 8px', fontSize: '0.8rem' }}
                value={paymentRetencionIibbNumber}
                onChange={(e) => setPaymentRetencionIibbNumber(e.target.value)}
                disabled={paymentLoading}
              />
            </div>
          </div>
        </div>

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
          <button
            type="submit"
            className="btn btn-primary"
            disabled={paymentLoading || !paymentAmount || Number(paymentAmount) <= 0}
          >
            {paymentLoading ? 'Guardando...' : 'Cobrar'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
