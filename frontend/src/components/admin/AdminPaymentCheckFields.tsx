import React from 'react';

interface AdminPaymentCheckFieldsProps {
  checkNumber: string;
  checkBank: string;
  checkDueDate: string;
  isEcheq: boolean;
  disabled: boolean;
  onCheckNumberChange: (val: string) => void;
  onCheckBankChange: (val: string) => void;
  onCheckDueDateChange: (val: string) => void;
  onIsEcheqChange: (val: boolean) => void;
}

export const AdminPaymentCheckFields: React.FC<AdminPaymentCheckFieldsProps> = ({
  checkNumber,
  checkBank,
  checkDueDate,
  isEcheq,
  disabled,
  onCheckNumberChange,
  onCheckBankChange,
  onCheckDueDateChange,
  onIsEcheqChange,
}) => (
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
        onChange={(e) => onCheckNumberChange(e.target.value)}
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        disabled={disabled}
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
          onChange={(e) => onCheckBankChange(e.target.value)}
          disabled={disabled}
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
          onChange={(e) => onCheckDueDateChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '2px' }}>
      <input
        id="payment-check-echeq"
        name="isEcheq"
        type="checkbox"
        checked={isEcheq}
        onChange={(e) => onIsEcheqChange(e.target.checked)}
        disabled={disabled}
        style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
      />
      <label htmlFor="payment-check-echeq" style={{ fontSize: '0.84rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
        eCheq
      </label>
    </div>
  </fieldset>
);
