import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Plus, Trash2, WifiOff, X } from 'lucide-react';
import {
  fieldReceiptsApi,
  type FieldPaymentMethod,
  type OfflineBundleBankAccount,
  type OfflineBundleClient,
  type SyncFieldReceiptPaymentPayload,
  type SyncFieldReceiptPayload,
} from '../../api/fieldReceipts.api';
import {
  enqueueOfflineReceipt,
  generateProvisionalCode,
} from '../../utils/offlineReceiptQueue';

interface PaymentDraft {
  id: string;
  paymentMethod: FieldPaymentMethod;
  amount: string;
  bankAccountId: string;
  transferReference: string;
  proofImageUrl: string;
  checkBank: string;
  checkNumber: string;
  checkDueDate: string;
  checkFrontImageUrl: string;
  isEcheq: boolean;
}

interface FieldCollectModalProps {
  client: OfflineBundleClient | null;
  collectorUserId: number;
  bankAccounts: OfflineBundleBankAccount[];
  onClose: () => void;
  onSuccess: (info: {
    offline: boolean;
    receiptNumber?: string | null;
    provisionalCode: string;
    totalAmount: number;
    whatsappStatus?: string;
  }) => void;
}

function createEmptyPayment(defaultAmount = ''): PaymentDraft {
  return {
    id: Math.random().toString(36).slice(2, 9),
    paymentMethod: 'CASH',
    amount: defaultAmount,
    bankAccountId: '',
    transferReference: '',
    proofImageUrl: '',
    checkBank: '',
    checkNumber: '',
    checkDueDate: '',
    checkFrontImageUrl: '',
    isEcheq: false,
  };
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido'));
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const FieldCollectModal: React.FC<FieldCollectModalProps> = ({
  client,
  collectorUserId,
  bankAccounts,
  onClose,
  onSuccess,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (client) {
      const initialAmt = client.outstandingBalance > 0 ? String(Math.round(client.outstandingBalance)) : '';
      setPayments([createEmptyPayment(initialAmt)]);
      setNotes('');
      setError(null);
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [client]);

  if (!client) return null;

  const totalAmount = payments.reduce((sum, p) => {
    const n = Math.round(Number(p.amount) || 0);
    return sum + (n > 0 ? n : 0);
  }, 0);

  const balanceAfter = Math.round(client.outstandingBalance) - totalAmount;

  const updatePayment = (id: string, patch: Partial<PaymentDraft>) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const handlePhotoSelect = async (
    id: string,
    field: 'proofImageUrl' | 'checkFrontImageUrl',
    file?: File,
  ) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      updatePayment(id, { [field]: compressed });
    } catch {
      setError('No se pudo procesar la foto seleccionada.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (totalAmount <= 0) {
      setError('Ingresá un importe mayor a $0.');
      return;
    }

    const mappedPayments: SyncFieldReceiptPaymentPayload[] = [];
    for (const p of payments) {
      const amt = Math.round(Number(p.amount) || 0);
      if (amt <= 0) {
        setError('Todos los medios de pago deben tener importe mayor a $0.');
        return;
      }
      if (p.paymentMethod === 'CHECK' && (!p.checkBank.trim() || !p.checkNumber.trim() || !p.checkDueDate)) {
        setError('Completá banco, número y fecha de vencimiento del cheque.');
        return;
      }
      mappedPayments.push({
        paymentMethod: p.paymentMethod,
        amount: amt,
        bankAccountId: p.bankAccountId ? Number(p.bankAccountId) : null,
        transferReference: p.transferReference.trim() || null,
        proofImageUrl: p.proofImageUrl || null,
        checkBank: p.checkBank.trim() || null,
        checkNumber: p.checkNumber.trim() || null,
        checkDueDate: p.checkDueDate || null,
        checkFrontImageUrl: p.checkFrontImageUrl || null,
        isEcheq: p.isEcheq,
      });
    }

    const provisionalCode = generateProvisionalCode(collectorUserId);
    const payload: SyncFieldReceiptPayload = {
      provisionalCode,
      personaId: client.id,
      billingType: 'INTERNAL',
      notes: notes.trim() || null,
      capturedAt: new Date().toISOString(),
      payments: mappedPayments,
    };

    setSubmitting(true);
    try {
      if (navigator.onLine) {
        try {
          const res = await fieldReceiptsApi.syncReceipt(payload);
          onSuccess({
            offline: false,
            receiptNumber: res.receipt.receiptNumber,
            provisionalCode,
            totalAmount,
            whatsappStatus: res.receipt.whatsappStatus,
          });
          return;
        } catch (err: any) {
          // Si es error de red/servidor caído, encola offline; si es validación 400, muestra el error.
          if (err?.status && err.status >= 400 && err.status < 500) {
            setError(err.message || 'Datos inválidos en el cobro.');
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
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      style={{
        width: 'min(540px, 95vw)',
        maxHeight: '90vh',
        borderRadius: '14px',
        border: '1px solid #e5e7eb',
        padding: 0,
        boxShadow: '0 20px 45px rgba(0,0,0,0.18)',
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>{client.name}</h3>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Saldo actual: <strong>${Math.round(client.outstandingBalance).toLocaleString('es-AR')}</strong>
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!navigator.onLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#fef3c7', color: '#92400e', fontSize: '0.85rem' }}>
              <WifiOff size={16} />
              <span>Sin señal: se emitirá comprobante provisorio y se enviará al volver internet.</span>
            </div>
          )}

          {payments.map((p, idx) => (
            <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <select
                  value={p.paymentMethod}
                  onChange={(e) => updatePayment(p.id, { paymentMethod: e.target.value as FieldPaymentMethod })}
                  style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontWeight: 600 }}
                >
                  <option value="CASH">Efectivo</option>
                  <option value="BANK_TRANSFER">Transferencia</option>
                  <option value="CHECK">Cheque / eCheq</option>
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Importe $"
                  value={p.amount}
                  onChange={(e) => updatePayment(p.id, { amount: e.target.value })}
                  style={{ width: '130px', padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontWeight: 700, textAlign: 'right' }}
                />
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPayments((prev) => prev.filter((item) => item.id !== p.id))}
                    aria-label={`Quitar pago ${idx + 1}`}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>

              {p.paymentMethod === 'BANK_TRANSFER' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={p.bankAccountId}
                      onChange={(e) => updatePayment(p.id, { bankAccountId: e.target.value })}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    >
                      <option value="">Cuenta destino...</option>
                      {bankAccounts.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="N° Operación / Ref"
                      value={p.transferReference}
                      onChange={(e) => updatePayment(p.id, { transferReference: e.target.value })}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#374151', cursor: 'pointer' }}>
                    <Camera size={16} />
                    <span>{p.proofImageUrl ? 'Foto adjuntada (Cambiar)' : 'Sacar foto comprobante (opcional)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => void handlePhotoSelect(p.id, 'proofImageUrl', e.target.files?.[0])}
                    />
                  </label>
                </div>
              )}

              {p.paymentMethod === 'CHECK' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Banco"
                      value={p.checkBank}
                      onChange={(e) => updatePayment(p.id, { checkBank: e.target.value })}
                      style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                    <input
                      type="text"
                      placeholder="N° de Cheque"
                      value={p.checkNumber}
                      onChange={(e) => updatePayment(p.id, { checkNumber: e.target.value })}
                      style={{ padding: '7px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="date"
                      value={p.checkDueDate}
                      onChange={(e) => updatePayment(p.id, { checkDueDate: e.target.value })}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={p.isEcheq}
                        onChange={(e) => updatePayment(p.id, { isEcheq: e.target.checked })}
                      />
                      eCheq
                    </label>
                  </div>
                  {!p.isEcheq && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#374151', cursor: 'pointer' }}>
                      <Camera size={16} />
                      <span>{p.checkFrontImageUrl ? 'Foto cheque adjuntada (Cambiar)' : 'Sacar foto cheque (opcional)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        onChange={(e) => void handlePhotoSelect(p.id, 'checkFrontImageUrl', e.target.files?.[0])}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPayments((prev) => [...prev, createEmptyPayment()])}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', borderRadius: '8px', border: '1px dashed #9ca3af', background: '#fff', color: '#374151', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <Plus size={15} /> Agregar otro medio de pago
          </button>

          <input
            type="text"
            placeholder="Observación (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
          />

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: '8px', background: '#fee2e2', color: '#991b1b', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827' }}>
              Total: ${totalAmount.toLocaleString('es-AR')}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              Saldo restante: ${balanceAfter.toLocaleString('es-AR')}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || totalAmount <= 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#E30613',
              color: '#fff',
              fontWeight: 700,
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            <CheckCircle2 size={17} />
            {submitting ? 'Guardando...' : 'Confirmar Cobro'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
