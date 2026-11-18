import React from 'react';
import { Store, Truck } from 'lucide-react';
import type { DirectBillingTotals, DirectInvoiceFormState } from './sales.types';
import { DirectInvoiceSummaryFooter } from './DirectInvoiceSummaryFooter';

interface DirectInvoicePaymentPanelProps {
  directInvoiceForm: DirectInvoiceFormState;
  setDirectInvoiceForm: React.Dispatch<React.SetStateAction<DirectInvoiceFormState>>;
  selectedDirectClient: any;
  activeDrawers: any[];
  bankAccounts: any[];
  directBillingTotals: DirectBillingTotals;
  modalError: string | null;
  isSubmitting: boolean;
  isCartEmpty: boolean;
  onCancel: () => void;
}

export function DirectInvoicePaymentPanel({
  directInvoiceForm,
  setDirectInvoiceForm,
  selectedDirectClient,
  activeDrawers,
  bankAccounts,
  directBillingTotals,
  modalError,
  isSubmitting,
  isCartEmpty,
  onCancel
}: DirectInvoicePaymentPanelProps) {
  const invalidOfficialCuit =
    selectedDirectClient && (!selectedDirectClient.cuit || selectedDirectClient.cuit.length < 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', overflowY: 'auto' }}>
      <div className="form-group">
        <label>Comprobante</label>
        <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
            <input
              type="radio"
              name="directBillingType"
              value="INTERNAL"
              checked={directInvoiceForm.billingType === 'INTERNAL'}
              onChange={() => setDirectInvoiceForm((prev) => ({ ...prev, billingType: 'INTERNAL' }))}
            />
            Interno
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
            <input
              type="radio"
              name="directBillingType"
              value="OFFICIAL"
              disabled={Boolean(invalidOfficialCuit)}
              checked={directInvoiceForm.billingType === 'OFFICIAL'}
              onChange={() => setDirectInvoiceForm((prev) => ({ ...prev, billingType: 'OFFICIAL' }))}
            />
            AFIP
          </label>
        </div>
        {invalidOfficialCuit && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '4px' }}>
            Sin CUIT para AFIP
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Entrega</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={() => setDirectInvoiceForm((prev) => ({ ...prev, deliveryMethod: 'PICKUP' }))}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              backgroundColor: directInvoiceForm.deliveryMethod === 'PICKUP' ? '#111827' : '#FFFFFF',
              color: directInvoiceForm.deliveryMethod === 'PICKUP' ? '#FFFFFF' : '#374151',
              border: `1px solid ${directInvoiceForm.deliveryMethod === 'PICKUP' ? '#111827' : '#D1D5DB'}`,
            }}
          >
            <Store size={14} aria-hidden="true" /> Retiro local
          </button>
          <button
            type="button"
            onClick={() => setDirectInvoiceForm((prev) => ({ ...prev, deliveryMethod: 'DELIVERY' }))}
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              backgroundColor: directInvoiceForm.deliveryMethod === 'DELIVERY' ? '#111827' : '#FFFFFF',
              color: directInvoiceForm.deliveryMethod === 'DELIVERY' ? '#FFFFFF' : '#374151',
              border: `1px solid ${directInvoiceForm.deliveryMethod === 'DELIVERY' ? '#111827' : '#D1D5DB'}`,
            }}
          >
            <Truck size={14} aria-hidden="true" /> Reparto
          </button>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: '8px' }}>
        <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>Cobro</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
            border: directInvoiceForm.immediatePayment ? '2px solid var(--color-success, #10b981)' : '1px solid var(--border-color)',
            borderRadius: '6px', backgroundColor: directInvoiceForm.immediatePayment ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-app)',
            cursor: 'pointer', transition: 'all 0.15s ease'
          }}>
            <input
              type="radio"
              name="directPaymentCondition"
              checked={directInvoiceForm.immediatePayment}
              onChange={() => setDirectInvoiceForm((prev) => ({ ...prev, immediatePayment: true }))}
              style={{ width: '15px', height: '15px' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Contado</span>
          </label>

          <label style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
            border: !directInvoiceForm.immediatePayment ? '2px solid #f59e0b' : '1px solid var(--border-color)',
            borderRadius: '6px', backgroundColor: !directInvoiceForm.immediatePayment ? 'rgba(245, 158, 11, 0.06)' : 'var(--bg-app)',
            cursor: 'pointer', transition: 'all 0.15s ease'
          }}>
            <input
              type="radio"
              name="directPaymentCondition"
              checked={!directInvoiceForm.immediatePayment}
              onChange={() => setDirectInvoiceForm((prev) => ({ ...prev, immediatePayment: false }))}
              style={{ width: '15px', height: '15px' }}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Cta. Cte.</span>
          </label>
        </div>
      </div>

      {directInvoiceForm.immediatePayment && (
        <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="direct-payment-method">Medio</label>
            <select
              id="direct-payment-method"
              className="select"
              value={directInvoiceForm.paymentMethod}
              onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
            >
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CHECK">Cheque</option>
            </select>
          </div>

          {directInvoiceForm.paymentMethod === 'CASH' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="direct-cash-drawer">Caja</label>
              {activeDrawers.length === 0 ? (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
                  <span role="alert">Sin cajas abiertas</span>
                </div>
              ) : (
                <select
                  id="direct-cash-drawer"
                  className="select"
                  value={directInvoiceForm.cashDrawerId}
                  onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, cashDrawerId: e.target.value }))}
                  required
                >
                  {activeDrawers.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.id} · {d.branch}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {directInvoiceForm.paymentMethod === 'BANK_TRANSFER' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="direct-bank-account">Cuenta</label>
              <select
                id="direct-bank-account"
                className="select"
                value={directInvoiceForm.bankAccountId}
                onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                required
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.bankName || `Cuenta #${b.id}`} · ${Number(b.balance).toLocaleString('es-AR')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {directInvoiceForm.paymentMethod === 'CHECK' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="direct-check-number">N° Cheque</label>
                  <input
                    id="direct-check-number"
                    type="text"
                    className="input"
                    value={directInvoiceForm.checkNumber}
                    onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, checkNumber: e.target.value }))}
                    placeholder="Número"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="direct-check-issuer">Emisor</label>
                  <input
                    id="direct-check-issuer"
                    type="text"
                    className="input"
                    value={directInvoiceForm.checkIssuer}
                    onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, checkIssuer: e.target.value }))}
                    placeholder="Titular"
                    required
                  />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  id="isEcheq"
                  checked={directInvoiceForm.isEcheq}
                  onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, isEcheq: e.target.checked }))}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="isEcheq" style={{ cursor: 'pointer', margin: 0, fontSize: '0.8rem' }}>Echeq</label>
              </div>
            </div>
          )}
        </div>
      )}

      <DirectInvoiceSummaryFooter
        billingType={directInvoiceForm.billingType}
        selectedDirectClient={selectedDirectClient}
        directBillingTotals={directBillingTotals}
        modalError={modalError}
        isSubmitting={isSubmitting}
        isCartEmpty={isCartEmpty}
        onCancel={onCancel}
      />
    </div>
  );
}
