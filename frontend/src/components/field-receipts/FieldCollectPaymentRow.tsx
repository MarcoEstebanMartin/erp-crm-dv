import React from 'react';
import { Camera, Trash2 } from 'lucide-react';
import type {
  FieldPaymentMethod,
  OfflineBundleBankAccount,
} from '../../api/fieldReceipts.api';

export interface PaymentDraft {
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

export function findDefaultTransferBankId(bankAccounts: OfflineBundleBankAccount[]): string {
  const mpAccount = bankAccounts.find((b) => {
    const n = b.name.toLowerCase();
    return n.includes('mp') || n.includes('mercado pago') || n.includes('mercadopago');
  });
  const target = mpAccount ?? bankAccounts[0];
  return target ? String(target.id) : '';
}

export function createEmptyPayment(defaultAmount = ''): PaymentDraft {
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

interface FieldCollectPaymentRowProps {
  payment: PaymentDraft;
  index: number;
  canRemove: boolean;
  bankAccounts: OfflineBundleBankAccount[];
  onUpdate: (id: string, patch: Partial<PaymentDraft>) => void;
  onRemove: (id: string) => void;
  onPhotoSelect: (id: string, field: 'proofImageUrl' | 'checkFrontImageUrl', file?: File) => void;
}

const inputBaseStyle: React.CSSProperties = {
  minWidth: 0,
  width: '100%',
  padding: '9px 10px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  background: '#ffffff',
  fontSize: '16px',
  boxSizing: 'border-box',
};

export const FieldCollectPaymentRow: React.FC<FieldCollectPaymentRowProps> = ({
  payment,
  index,
  canRemove,
  bankAccounts,
  onUpdate,
  onRemove,
  onPhotoSelect,
}) => {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        background: '#fafafa',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: canRemove ? 'minmax(0, 1fr) minmax(112px, 136px) auto' : 'minmax(0, 1fr) minmax(112px, 140px)',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <select
          aria-label={`Medio de pago ${index + 1}`}
          value={payment.paymentMethod}
          onChange={(e) => {
            const nextMethod = e.target.value as FieldPaymentMethod;
            onUpdate(payment.id, {
              paymentMethod: nextMethod,
              bankAccountId:
                nextMethod === 'BANK_TRANSFER' && !payment.bankAccountId
                  ? findDefaultTransferBankId(bankAccounts)
                  : payment.bankAccountId,
            });
          }}
          style={{ ...inputBaseStyle, fontWeight: 600 }}
        >
          <option value="CASH">Efectivo</option>
          <option value="BANK_TRANSFER">Transferencia</option>
          <option value="CHECK">Cheque / eCheq</option>
        </select>

        <input
          type="number"
          inputMode="numeric"
          min={1}
          aria-label={`Importe ${index + 1}`}
          placeholder="Importe $"
          value={payment.amount}
          onChange={(e) => onUpdate(payment.id, { amount: e.target.value })}
          className="tabular-nums"
          style={{ ...inputBaseStyle, fontWeight: 700, textAlign: 'right' }}
        />

        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(payment.id)}
            aria-label={`Quitar pago ${index + 1}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'transparent',
              border: '1px solid #fecaca',
              color: '#dc2626',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      {payment.paymentMethod === 'BANK_TRANSFER' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
            <select
              aria-label="Cuenta destino"
              value={payment.bankAccountId}
              onChange={(e) => onUpdate(payment.id, { bankAccountId: e.target.value })}
              style={inputBaseStyle}
            >
              <option value="">Cuenta destino...</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              aria-label="Número de operación o referencia"
              placeholder="N° Operación / Ref"
              value={payment.transferReference}
              onChange={(e) => onUpdate(payment.id, { transferReference: e.target.value })}
              style={inputBaseStyle}
            />
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              color: '#374151',
              cursor: 'pointer',
              width: 'fit-content',
            }}
          >
            <Camera size={16} aria-hidden="true" />
            <span>{payment.proofImageUrl ? 'Foto adjuntada (Cambiar)' : 'Adjuntar comprobante'}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => onPhotoSelect(payment.id, 'proofImageUrl', e.target.files?.[0])}
            />
          </label>
        </div>
      )}

      {payment.paymentMethod === 'CHECK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            <input
              type="text"
              aria-label="Banco del cheque"
              placeholder="Banco"
              value={payment.checkBank}
              onChange={(e) => onUpdate(payment.id, { checkBank: e.target.value })}
              style={inputBaseStyle}
            />
            <input
              type="text"
              aria-label="Número de cheque"
              placeholder="N° de Cheque"
              value={payment.checkNumber}
              onChange={(e) => onUpdate(payment.id, { checkNumber: e.target.value })}
              style={inputBaseStyle}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="date"
              aria-label="Fecha de vencimiento del cheque"
              value={payment.checkDueDate}
              onChange={(e) => onUpdate(payment.id, { checkDueDate: e.target.value })}
              style={{ ...inputBaseStyle, flex: '1 1 160px' }}
            />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={payment.isEcheq}
                onChange={(e) => onUpdate(payment.id, { isEcheq: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#111827' }}
              />
              <span>eCheq</span>
            </label>
          </div>

          {!payment.isEcheq && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                color: '#374151',
                cursor: 'pointer',
                width: 'fit-content',
              }}
            >
              <Camera size={16} aria-hidden="true" />
              <span>{payment.checkFrontImageUrl ? 'Foto cheque adjuntada (Cambiar)' : 'Foto del cheque'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => onPhotoSelect(payment.id, 'checkFrontImageUrl', e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
};
