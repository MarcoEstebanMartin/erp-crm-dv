import React from 'react';

export type CashSourceOption = 'CAJA_GRANDE' | 'CAJA_OFICINA';

interface QuickExpensePaymentFieldsProps {
  idPrefix: string;
  paymentMethod: string;
  onPaymentMethodChange: (value: string) => void;
  cashSource: CashSourceOption;
  onCashSourceChange: (value: CashSourceOption) => void;
  billingType: string;
  onBillingTypeChange: (value: string) => void;
  bankAccountId: string;
  onBankAccountIdChange: (value: string) => void;
  bankAccounts: Array<{ id: number; name?: string; bankName?: string; accountNumber?: string | null; balance?: number | string }>;
  optionalToggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
}

export function QuickExpensePaymentFields({
  idPrefix,
  paymentMethod,
  onPaymentMethodChange,
  cashSource,
  onCashSourceChange,
  billingType,
  onBillingTypeChange,
  bankAccountId,
  onBankAccountIdChange,
  bankAccounts,
  optionalToggle,
}: QuickExpensePaymentFieldsProps) {
  const showFields = optionalToggle ? optionalToggle.checked : true;

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', backgroundColor: 'var(--bg-light, #f5f5f7)', marginBottom: '12px' }}>
      {optionalToggle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: showFields ? '10px' : 0 }}>
          <input
            type="checkbox"
            id={`${idPrefix}-affect-finance`}
            name="affectFinance"
            checked={optionalToggle.checked}
            onChange={(e) => optionalToggle.onChange(e.target.checked)}
          />
          <label htmlFor={`${idPrefix}-affect-finance`} style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Imputar en caja/banco
          </label>
        </div>
      )}

      {showFields && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label htmlFor={`${idPrefix}-payment-method`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Medio de pago
              </label>
              <select
                id={`${idPrefix}-payment-method`}
                name="paymentMethod"
                className="select"
                value={paymentMethod}
                onChange={(e) => onPaymentMethodChange(e.target.value)}
              >
                <option value="CASH">Efectivo</option>
                <option value="BANK_TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>

            <div>
              <label htmlFor={`${idPrefix}-billing-type`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Sucursal
              </label>
              <select
                id={`${idPrefix}-billing-type`}
                name="billingType"
                className="select"
                value={billingType}
                onChange={(e) => onBillingTypeChange(e.target.value)}
              >
                <option value="INTERNAL">Sucursal X</option>
                <option value="OFFICIAL">Sucursal A</option>
              </select>
            </div>
          </div>

          {paymentMethod === 'CASH' && (
            <div>
              <label htmlFor={`${idPrefix}-cash-source`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Caja
              </label>
              <select
                id={`${idPrefix}-cash-source`}
                name="cashSource"
                className="select"
                value={cashSource}
                onChange={(e) => onCashSourceChange(e.target.value as CashSourceOption)}
              >
                <option value="CAJA_GRANDE">Caja Grande</option>
                <option value="CAJA_OFICINA">Caja Oficina</option>
              </select>
            </div>
          )}

          {(paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHECK') && (
            <div>
              <label htmlFor={`${idPrefix}-bank-account`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Cuenta bancaria
              </label>
              <select
                id={`${idPrefix}-bank-account`}
                name="bankAccountId"
                required={paymentMethod === 'BANK_TRANSFER'}
                className="select"
                value={bankAccountId}
                onChange={(e) => onBankAccountIdChange(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {bankAccounts.map((b) => {
                  const label = b.name || b.bankName || `Cuenta #${b.id}`;
                  const suffix = b.accountNumber ? ` · ${b.accountNumber}` : '';
                  return (
                    <option key={b.id} value={b.id}>
                      {label}{suffix}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
