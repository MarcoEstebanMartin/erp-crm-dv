import { CheckCircle, Store, Truck } from 'lucide-react';
import { BillingType, PaymentMethod } from '../../utils/types';

interface OrderFulfillmentBillingPanelProps {
  clientName?: string | null;
  clientCuit?: string | null;
  billingType: BillingType;
  onBillingTypeChange: (value: BillingType) => void;
  deliveryMethod: 'DELIVERY' | 'PICKUP';
  onDeliveryMethodChange: (value: 'DELIVERY' | 'PICKUP') => void;
  markPickedUpNow: boolean;
  onMarkPickedUpNowChange: (value: boolean) => void;
  deliveryLocked?: boolean;
  assignedRouteLabel?: string | null;
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
  submitLabel?: string;
  shortcutHint?: string;
}

const labelCapsStyle = {
  fontSize: '0.82rem',
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
  deliveryMethod,
  onDeliveryMethodChange,
  markPickedUpNow,
  onMarkPickedUpNowChange,
  deliveryLocked = false,
  assignedRouteLabel = null,
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
  submitLabel = 'Facturar',
  shortcutHint,
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
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {clientName || 'Consumidor Final'}
        </div>
        {clientCuit && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {clientCuit}
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="fulfillment-billing-type" style={labelCapsStyle}>
          Canal
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
        <div style={{ backgroundColor: '#F9FAFB', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', fontWeight: !deferCae ? 700 : 500, color: !deferCae ? '#111827' : '#4B5563' }}>
            <input type="radio" name="deferCae" checked={!deferCae} onChange={() => onDeferCaeChange(false)} />
            CAE ahora
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', cursor: 'pointer', fontWeight: deferCae ? 700 : 500, color: deferCae ? '#111827' : '#4B5563' }}>
            <input type="radio" name="deferCae" checked={deferCae} onChange={() => onDeferCaeChange(true)} />
            Diferir CAE
          </label>
        </div>
      )}

      <div className="form-group" style={{ marginBottom: 0 }}>
        <span style={labelCapsStyle}>Entrega</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
          <button
            type="button"
            disabled={deliveryLocked}
            onClick={() => onDeliveryMethodChange('DELIVERY')}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: deliveryLocked ? 'not-allowed' : 'pointer',
              backgroundColor: deliveryMethod === 'DELIVERY' ? '#111827' : '#FFFFFF',
              color: deliveryMethod === 'DELIVERY' ? '#FFFFFF' : '#374151',
              border: `1px solid ${deliveryMethod === 'DELIVERY' ? '#111827' : '#D1D5DB'}`,
            }}
          >
            <Truck size={15} aria-hidden="true" /> Reparto
          </button>
          <button
            type="button"
            disabled={deliveryLocked}
            onClick={() => onDeliveryMethodChange('PICKUP')}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: deliveryLocked ? 'not-allowed' : 'pointer',
              backgroundColor: deliveryMethod === 'PICKUP' ? '#111827' : '#FFFFFF',
              color: deliveryMethod === 'PICKUP' ? '#FFFFFF' : '#374151',
              border: `1px solid ${deliveryMethod === 'PICKUP' ? '#111827' : '#D1D5DB'}`,
            }}
          >
            <Store size={15} aria-hidden="true" /> Retiro local
          </button>
        </div>
        {deliveryMethod === 'DELIVERY' && assignedRouteLabel && (
          <div style={{ fontSize: '0.78rem', color: '#4B5563', fontWeight: 600, marginTop: '6px' }}>
            {assignedRouteLabel}
          </div>
        )}
        {deliveryMethod === 'PICKUP' && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              color: '#111827',
              marginTop: '8px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={markPickedUpNow}
              disabled={deliveryLocked}
              onChange={(e) => onMarkPickedUpNowChange(e.target.checked)}
            />
            Entregar en el acto
          </label>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="fulfillment-payment-method" style={labelCapsStyle}>
          Pago
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
            placeholder="CH-0012948"
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
            <CheckCircle size={20} aria-hidden="true" />
            <span>{submitLabel}</span>
            {shortcutHint && (
              <kbd
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  color: '#FFFFFF',
                  marginLeft: '4px',
                }}
              >
                {shortcutHint}
              </kbd>
            )}
          </>
        )}
      </button>
    </div>
  );
}
