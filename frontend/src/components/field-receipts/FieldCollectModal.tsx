import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Plus, WifiOff, X } from 'lucide-react';
import {
  fieldReceiptsApi,
  type FieldReceiptDTO,
  type OfflineBundleBankAccount,
  type OfflineBundleClient,
  type SyncFieldReceiptPayload,
} from '../../api/fieldReceipts.api';
import {
  enqueueOfflineReceipt,
  generateProvisionalCode,
} from '../../utils/offlineReceiptQueue';
import {
  captureCurrentGpsSilently,
  getFreshCachedGps,
  warmUpGpsSilently,
} from '../../utils/geoUtils';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { AdminPaymentAllocationPreview } from '../admin/AdminPaymentAllocationPreview';
import { AdminPaymentInvoiceSelector } from '../admin/AdminPaymentInvoiceSelector';
import {
  createEmptyPayment,
  FieldCollectPaymentRow,
  type PaymentDraft,
} from './FieldCollectPaymentRow';
import {
  buildFieldAllocationPayload,
  compressFieldReceiptImage,
  useFieldCollectReceivables,
  validateAndMapFieldPayments,
} from './useFieldCollectReceivables';

export interface FieldCollectSuccessInfo {
  offline: boolean;
  receiptNumber?: string | null;
  provisionalCode: string;
  totalAmount: number;
  whatsappStatus?: string;
  receipt?: FieldReceiptDTO;
}

interface FieldCollectModalProps {
  client: OfflineBundleClient | null;
  collectorUserId: number;
  bankAccounts: OfflineBundleBankAccount[];
  deliveryRouteId?: number | null;
  suggestedAmount?: number | null;
  onClose: () => void;
  onSuccess: (info: FieldCollectSuccessInfo) => void;
}

export const FieldCollectModal: React.FC<FieldCollectModalProps> = ({
  client,
  collectorUserId,
  bankAccounts,
  deliveryRouteId = null,
  suggestedAmount = null,
  onClose,
  onSuccess,
}) => {
  const submittingRef = useRef(false);
  const userEditedAmountRef = useRef(false);
  const suggestedAmountRef = useRef(suggestedAmount);
  suggestedAmountRef.current = suggestedAmount;
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [allowCreditOnAccount, setAllowCreditOnAccount] = useState(false);
  const [needsCreditOverride, setNeedsCreditOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const receivables = useFieldCollectReceivables({
    client,
    onApplySuggestedAmount: (amount, fromUserToggle) => {
      if (
        !fromUserToggle &&
        (userEditedAmountRef.current ||
          (suggestedAmountRef.current !== null &&
            suggestedAmountRef.current !== undefined &&
            suggestedAmountRef.current > 0))
      ) {
        return;
      }
      setPayments((prev) => {
        if (prev.length !== 1) return prev;
        return [{ ...prev[0], amount: amount > 0 ? String(amount) : '' }];
      });
      if (fromUserToggle) setError(null);
    },
  });

  useEffect(() => {
    if (!client) return;
    userEditedAmountRef.current = false;
    const realBalance = Math.max(0, Math.round(client.outstandingBalance));
    const preferred =
      suggestedAmount !== null && suggestedAmount !== undefined && suggestedAmount > 0
        ? Math.min(Math.round(suggestedAmount), realBalance)
        : realBalance;
    const initialAmt = preferred > 0 ? String(preferred) : '';
    setPayments([createEmptyPayment(initialAmt)]);
    setNotes('');
    setAllowCreditOnAccount(false);
    setNeedsCreditOverride(false);
    setError(null);
    warmUpGpsSilently();
  }, [client, suggestedAmount]);

  if (!client) return null;

  const totalAmount = payments.reduce((sum, p) => {
    const n = Math.round(Number(p.amount) || 0);
    return sum + (n > 0 ? n : 0);
  }, 0);

  const effectiveOutstandingBalance =
    receivables.outstandingBalance ?? Math.round(client.outstandingBalance);
  const balanceAfter = effectiveOutstandingBalance - totalAmount;
  const effectiveLocalDebt = Math.max(0, effectiveOutstandingBalance);
  const excessAmount = totalAmount > effectiveLocalDebt ? totalAmount - effectiveLocalDebt : 0;
  const isOverpaying = totalAmount > 0 && excessAmount > 0;
  const showCreditToggle = isOverpaying || needsCreditOverride;
  const blockedByOverpayment = showCreditToggle && !allowCreditOnAccount;

  const updatePayment = (id: string, patch: Partial<PaymentDraft>) => {
    if ('amount' in patch) {
      userEditedAmountRef.current = true;
    }
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handlePhotoSelect = async (
    id: string,
    field: 'proofImageUrl' | 'checkFrontImageUrl',
    file?: File,
  ) => {
    if (!file) return;
    try {
      const compressed = await compressFieldReceiptImage(file);
      updatePayment(id, { [field]: compressed });
    } catch {
      setError('No se pudo procesar la foto seleccionada.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    if (totalAmount <= 0) {
      setError('Ingresá un importe mayor a $0.');
      return;
    }

    const mappedResult = validateAndMapFieldPayments(payments);
    if (!mappedResult.ok) {
      setError(mappedResult.error);
      return;
    }
    const { mappedPayments } = mappedResult;

    submittingRef.current = true;
    const provisionalCode = generateProvisionalCode(collectorUserId);
    setSubmitting(true);
    try {
      const gps = getFreshCachedGps() ?? (await captureCurrentGpsSilently(450));
      const allocationPayload = buildFieldAllocationPayload({
        hasUnbilled: receivables.hasUnbilled,
        includeUnbilledBalance: receivables.includeUnbilledBalance,
        selectedInvoiceIds: receivables.selectedInvoiceIds,
        selectedInvoicesTotal: receivables.selectedInvoicesTotal,
        totalAmount,
      });
      const payload: SyncFieldReceiptPayload = {
        provisionalCode,
        personaId: client.id,
        deliveryRouteId: deliveryRouteId ?? null,
        billingType: 'INTERNAL',
        notes: notes.trim() || null,
        gpsLat: gps?.lat ?? null,
        gpsLng: gps?.lng ?? null,
        capturedAt: new Date().toISOString(),
        allowCreditOnAccount: showCreditToggle ? allowCreditOnAccount : false,
        ...allocationPayload,
        payments: mappedPayments,
      };
      if (navigator.onLine) {
        try {
          const res = await fieldReceiptsApi.syncReceipt(payload);
          onSuccess({
            offline: false,
            receiptNumber: res.receipt.receiptNumber,
            provisionalCode,
            totalAmount,
            whatsappStatus: res.receipt.whatsappStatus,
            receipt: res.receipt,
          });
          return;
        } catch (err: any) {
          if (typeof err?.status === 'number') {
            const msg = String(
              err.message ||
                (err.status >= 500
                  ? 'No se pudo registrar el cobro en el servidor. Intentá nuevamente.'
                  : 'Datos inválidos en el cobro.'),
            );
            if (err.status === 409 && msg.toLowerCase().includes('favor')) {
              setNeedsCreditOverride(true);
            }
            setError(msg);
            return;
          }
        }
      }

      await enqueueOfflineReceipt({
        ...payload,
        customerName: client.name,
        totalAmount,
        queuedAt: new Date().toISOString(),
      });
      onSuccess({ offline: true, provisionalCode, totalAmount });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <NativeModalDialog
      isOpen={Boolean(client)}
      onClose={onClose}
      ariaLabelledBy="field-collect-modal-title"
      style={{
        width: 'min(520px, 95vw)',
        height: 'min(640px, 90dvh)',
        maxHeight: '90dvh',
        borderRadius: '14px',
        padding: 0,
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px 18px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <h3
              id="field-collect-modal-title"
              style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {client.name}
            </h3>
            <span className="tabular-nums" style={{ fontSize: '0.84rem', color: '#6b7280' }}>
              Saldo: <strong style={{ color: effectiveOutstandingBalance > 0 ? '#dc2626' : '#059669' }}>${effectiveOutstandingBalance.toLocaleString('es-AR')}</strong>
              {receivables.availableCredit > 0 && effectiveOutstandingBalance >= 0 && (
                <> · A favor: <strong style={{ color: '#059669' }}>${receivables.availableCredit.toLocaleString('es-AR')}</strong></>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '4px', flexShrink: 0 }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!navigator.onLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#fef3c7', color: '#92400e', fontSize: '0.84rem' }}>
              <WifiOff size={16} aria-hidden="true" />
              <span>Sin señal: se guarda provisorio y se sincroniza al volver internet.</span>
            </div>
          )}

          {receivables.loading && (
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Cargando comprobantes...</div>
          )}

          <AdminPaymentInvoiceSelector
            idPrefix="field-collect-invoice"
            rowMinHeight="44px"
            pendingInvoices={receivables.pendingInvoices}
            selectedInvoiceIds={receivables.selectedInvoiceIds}
            unbilledBalance={receivables.unbilledBalance}
            includeUnbilledBalance={receivables.includeUnbilledBalance}
            disabled={submitting}
            onToggleInvoice={receivables.handleToggleInvoice}
            onToggleUnbilledBalance={receivables.handleToggleUnbilledBalance}
            onToggleAll={receivables.handleToggleAllInvoices}
          />

          {payments.map((p, idx) => (
            <FieldCollectPaymentRow
              key={p.id}
              payment={p}
              index={idx}
              canRemove={payments.length > 1}
              bankAccounts={bankAccounts}
              onUpdate={updatePayment}
              onRemove={(id) => setPayments((prev) => prev.filter((item) => item.id !== id))}
              onPhotoSelect={(id, field, file) => void handlePhotoSelect(id, field, file)}
            />
          ))}

          <button
            type="button"
            onClick={() => setPayments((prev) => [...prev, createEmptyPayment()])}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 10px',
              borderRadius: '8px',
              border: '1px dashed #9ca3af',
              background: '#fff',
              color: '#374151',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} aria-hidden="true" />
            <span>Agregar otro medio</span>
          </button>

          <AdminPaymentAllocationPreview
            paymentAmount={String(totalAmount)}
            pendingInvoices={receivables.pendingInvoices}
            selectedInvoiceIds={receivables.selectedInvoiceIds}
            unbilledBalance={receivables.unbilledBalance}
            includeUnbilledBalance={receivables.includeUnbilledBalance}
          />

          <input
            type="text"
            aria-label="Observación"
            placeholder="Observación (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box' }}
          />

          {showCreditToggle && (
            <div
              role="status"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                color: '#92400e',
                fontSize: '0.84rem',
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {excessAmount > 0
                  ? `Estás cargando $${excessAmount.toLocaleString('es-AR')} de más`
                  : 'El importe supera la deuda actual'}
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#111827', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowCreditOnAccount}
                  onChange={(e) => {
                    setAllowCreditOnAccount(e.target.checked);
                    if (e.target.checked) setError(null);
                  }}
                  style={{ width: '16px', height: '16px', accentColor: '#111827', cursor: 'pointer' }}
                />
                <span>Dejar plata a favor</span>
              </label>
            </div>
          )}

          {error && (
            <div role="alert" style={{ padding: '9px 12px', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0, background: '#ffffff' }}>
          <div>
            <div className="tabular-nums" style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
              Total: ${totalAmount.toLocaleString('es-AR')}
            </div>
            <div className="tabular-nums" style={{ fontSize: '0.78rem', color: balanceAfter < 0 ? '#059669' : '#6b7280', fontWeight: balanceAfter < 0 ? 600 : 400 }}>
              {balanceAfter < 0
                ? `A favor: $${Math.abs(balanceAfter).toLocaleString('es-AR')}`
                : `Restante: $${balanceAfter.toLocaleString('es-AR')}`}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || totalAmount <= 0 || blockedByOverpayment}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px 18px',
              minHeight: '42px',
              borderRadius: '8px',
              border: 'none',
              background: '#E30613',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: submitting || blockedByOverpayment ? 'not-allowed' : 'pointer',
              opacity: submitting || blockedByOverpayment ? 0.55 : 1,
            }}
          >
            <CheckCircle2 size={17} aria-hidden="true" />
            <span>{submitting ? 'Guardando...' : 'Confirmar Cobro'}</span>
          </button>
        </div>
      </form>
    </NativeModalDialog>
  );
};
