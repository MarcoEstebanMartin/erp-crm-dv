import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';

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
          `El monto a cobrar ($${parsedAmount.toLocaleString()}) supera el saldo pendiente del cliente ($${balance.toLocaleString()}). El cliente quedará con saldo a favor. ¿Deseas continuar?`,
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
        retencionesToSend.push({ taxType: 'GANANCIAS' as const, number: paymentRetencionGananciasNumber || `RET-GAN-${Date.now()}`, amount: Number(paymentRetencionGananciasAmount) });
      }
      if (paymentRetencionIibbAmount && Number(paymentRetencionIibbAmount) > 0) {
        retencionesToSend.push({ taxType: 'IIBB' as const, number: paymentRetencionIibbNumber || `RET-IIBB-${Date.now()}`, amount: Number(paymentRetencionIibbAmount) });
      }

      await api.registerPayment(paymentModal.clientId, {
        amount: Number(paymentAmount),
        paymentMethod,
        description: paymentDescription,
        orderId: paymentSelectedInvoiceId || undefined,
        retenciones: retencionesToSend.length > 0 ? retencionesToSend : undefined,
      });

      setSuccessMsg('Cobro registrado exitosamente en cuenta corriente.');
      await onSuccess(paymentModal.clientId);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al registrar cobro.');
    } finally {
      setPaymentLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>Registrar Cobro CC</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ fontSize: '0.85rem', marginBottom: '14px', padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '6px' }}>
            Registrando pago para: <strong>{paymentModal.clientName}</strong>
          </div>

          {paymentPendingInvoices.length > 0 && (
            <div className="form-group">
              <label>Imputar a Factura</label>
              <select
                className="select"
                value={paymentSelectedInvoiceId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setPaymentSelectedInvoiceId(null);
                    setPaymentAmount(clientProfileModal?.client?.id === paymentModal.clientId ? String(Math.round(Number(clientProfileModal.client.outstandingBalance))) : '');
                  } else {
                    const invId = Number(val);
                    setPaymentSelectedInvoiceId(invId);
                    const inv = paymentPendingInvoices.find((i) => i.id === invId);
                    if (inv) setPaymentAmount(String(Math.round(Number(inv.pendingAmount))));
                  }
                }}
              >
                <option value="">Entrega a cuenta general (sin factura específica)</option>
                {paymentPendingInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} (Pendiente: ${Math.round(Number(inv.pendingAmount)).toLocaleString('es-AR')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Monto del Cobro ($)</label>
            <input type="number" className="input" placeholder="Monto" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required disabled={paymentLoading} />
          </div>
          <div className="form-group">
            <label>Método de Pago</label>
            <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} disabled={paymentLoading}>
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia Bancaria</option>
              <option value="CHECK">Cheque</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>

          <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '14px', paddingTop: '10px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 600 }}>🏷️ Retenciones Recibidas (Opcional)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Monto Ganancias ($)</label>
                <input type="number" step="0.01" className="input" placeholder="Monto" style={{ padding: '6px 8px', fontSize: '0.8rem' }} value={paymentRetencionGananciasAmount} onChange={(e) => setPaymentRetencionGananciasAmount(e.target.value)} disabled={paymentLoading} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nro Cert. Ganancias</label>
                <input type="text" className="input" placeholder="Nro Certificado" style={{ padding: '6px 8px', fontSize: '0.8rem' }} value={paymentRetencionGananciasNumber} onChange={(e) => setPaymentRetencionGananciasNumber(e.target.value)} disabled={paymentLoading} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Monto IIBB BsAs ($)</label>
                <input type="number" step="0.01" className="input" placeholder="Monto" style={{ padding: '6px 8px', fontSize: '0.8rem' }} value={paymentRetencionIibbAmount} onChange={(e) => setPaymentRetencionIibbAmount(e.target.value)} disabled={paymentLoading} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nro Cert. IIBB BsAs</label>
                <input type="text" className="input" placeholder="Nro Certificado" style={{ padding: '6px 8px', fontSize: '0.8rem' }} value={paymentRetencionIibbNumber} onChange={(e) => setPaymentRetencionIibbNumber(e.target.value)} disabled={paymentLoading} />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Descripción / Observaciones</label>
            <input type="text" className="input" placeholder="ej: Cobro factura" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)} disabled={paymentLoading} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={paymentLoading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }} disabled={paymentLoading || !paymentAmount || Number(paymentAmount) <= 0}>
              {paymentLoading ? 'Procesando...' : 'Confirmar Cobro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
