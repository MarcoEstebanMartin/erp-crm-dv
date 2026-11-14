import { CheckCircle, DollarSign } from 'lucide-react';
import { BillingType, PaymentMethod } from '../../utils/types';

interface OrderFulfillmentBillingPanelProps {
  clientName?: string | null;
  clientCuit?: string | null;
  billingType: BillingType;
  onBillingTypeChange: (value: BillingType) => void;
  deferCae: boolean;
  onDeferCaeChange: (value: boolean) => void;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (value: PaymentMethod) => void;
  checkNumber: string;
  onCheckNumberChange: (value: string) => void;
  bankAccounts: any[];
  selectedBankId: string;
  onSelectedBankIdChange: (value: string) => void;
  loading: boolean;
  onConfirmAndInvoice: () => void;
}

const labelCapsStyle = {
  fontSize: '0.82rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  color: 'var(--text-secondary)',
  fontWeight: 600,
};

const selectInputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: '0.95rem',
  marginTop: '6px',
};

export default function OrderFulfillmentBillingPanel({
  clientName,
  clientCuit,
  billingType,
  onBillingTypeChange,
  deferCae,
  onDeferCaeChange,
  paymentMethod,
  onPaymentMethodChange,
  checkNumber,
  onCheckNumberChange,
  bankAccounts,
  selectedBankId,
  onSelectedBankIdChange,
  loading,
  onConfirmAndInvoice,
}: OrderFulfillmentBillingPanelProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--background-alt)',
        padding: '22px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
      }}
    >
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <h3 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <DollarSign size={20} style={{ color: '#E30613' }} /> Facturación y Cobro
        </h3>
      </div>

      <div>
        <span style={labelCapsStyle}>Cliente</span>
        <div style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
          {clientName || 'Consumidor Final'}
        </div>
        {clientCuit && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            CUIT: {clientCuit}
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="fulfillment-billing-type" style={labelCapsStyle}>
          Canal de Facturación
        </label>
        <select
          id="fulfillment-billing-type"
          className="select"
          style={selectInputStyle}
          value={billingType}
          onChange={(e) => onBillingTypeChange(e.target.value as BillingType)}
        >
          <option value="OFFICIAL">Sucursal A</option>
          <option value="INTERNAL">Sucursal X</option>
        </select>
      </div>

      {billingType === 'OFFICIAL' && (
        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', fontWeight: 800 }}>
            Modo de Emisión AFIP / ARCA
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer', fontWeight: !deferCae ? 700 : 500, color: !deferCae ? '#16a34a' : '#475569' }}>
              <input type="radio" name="deferCae" checked={!deferCae} onChange={() => onDeferCaeChange(false)} />
              Solicitar CAE Inmediato (AFIP Directo)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', cursor: 'pointer', fontWeight: deferCae ? 700 : 500, color: deferCae ? '#d97706' : '#475569' }}>
              <input type="radio" name="deferCae" checked={deferCae} onChange={() => onDeferCaeChange(true)} />
              Pre-Facturar A (Diferir CAE / Borrador)
            </label>
          </div>
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="fulfillment-payment-method" style={labelCapsStyle}>
          Medio de Pago / Condición
        </label>
        <select
          id="fulfillment-payment-method"
          className="select"
          style={{ ...selectInputStyle, fontWeight: 600 }}
          value={paymentMethod}
          onChange={(e) => onPaymentMethodChange(e.target.value as PaymentMethod)}
        >
          <option value="OTHER">Cuenta Corriente</option>
          <option value="CASH">Efectivo</option>
          <option value="BANK_TRANSFER">Transferencia</option>
          <option value="CHECK">Cheque</option>
        </select>
      </div>

      {paymentMethod === 'CHECK' && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="fulfillment-check-number" style={labelCapsStyle}>
            Número de Cheque
          </label>
          <input
            id="fulfillment-check-number"
            type="text"
            className="input"
            style={selectInputStyle}
            placeholder="Ej: CH-0012948"
            value={checkNumber}
            onChange={(e) => onCheckNumberChange(e.target.value)}
          />
        </div>
      )}

      {paymentMethod === 'BANK_TRANSFER' && bankAccounts.length > 0 && (
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="fulfillment-bank-id" style={labelCapsStyle}>
            Cuenta Bancaria Destino
          </label>
          <select
            id="fulfillment-bank-id"
            className="select"
            style={selectInputStyle}
            value={selectedBankId}
            onChange={(e) => onSelectedBankIdChange(e.target.value)}
          >
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ flexGrow: 1, minHeight: '8px' }} />

      <button
        type="button"
        className="btn btn-primary"
        style={{
          width: '100%',
          padding: '14px',
          fontSize: '1.05rem',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#E30613',
          color: '#fff',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={onConfirmAndInvoice}
        disabled={loading}
      >
        {loading ? 'Procesando...' : (
          <>
            <CheckCircle size={20} /> Confirmar y Facturar
          </>
        )}
      </button>
    </div>
  );
}
