import React from 'react';
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
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        ⚙️ Configuración del Comprobante
      </h3>

      <div className="form-group">
        <label>Tipo de Facturación</label>
        <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
            <input
              type="radio"
              name="directBillingType"
              value="INTERNAL"
              checked={directInvoiceForm.billingType === 'INTERNAL'}
              onChange={() => setDirectInvoiceForm((prev) => ({ ...prev, billingType: 'INTERNAL' }))}
            />
            Interno (Presupuesto X)
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
            Oficial AFIP (A / B)
          </label>
        </div>
        {invalidOfficialCuit && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: '4px' }}>
            * El cliente no posee CUIT válido registrado para facturación oficial.
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginTop: '8px' }}>
        <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>💳 Condición de Cobro</label>
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
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>💵 Cobro en el Acto</span>
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
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>📝 Queda en Cuenta Corriente</span>
          </label>
        </div>
      </div>

      {directInvoiceForm.immediatePayment && (
        <div style={{ backgroundColor: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Método de Pago</label>
            <select
              className="select"
              value={directInvoiceForm.paymentMethod}
              onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
            >
              <option value="CASH">Efectivo (Caja Chica)</option>
              <option value="BANK_TRANSFER">Transferencia / MercadoPago</option>
              <option value="CHECK">Cheque de Terceros</option>
            </select>
          </div>

          {directInvoiceForm.paymentMethod === 'CASH' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>Caja Operativa</label>
              {activeDrawers.length === 0 ? (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.78rem', marginTop: '4px', fontWeight: 600 }}>
                  ⚠️ No hay cajas abiertas. Abra la Caja Grande en Configuración.
                </div>
              ) : (
                <select
                  className="select"
                  value={directInvoiceForm.cashDrawerId}
                  onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, cashDrawerId: e.target.value }))}
                  required
                >
                  {activeDrawers.map((d) => (
                    <option key={d.id} value={d.id}>
                      Caja #{d.id} - {d.branch} ({d.user?.name || 'Administración'})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {directInvoiceForm.paymentMethod === 'BANK_TRANSFER' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>Cuenta de Destino</label>
              <select
                className="select"
                value={directInvoiceForm.bankAccountId}
                onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}
                required
              >
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} - CBU: {b.cbu || 'N/A'} (Saldo: ${Number(b.balance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {directInvoiceForm.paymentMethod === 'CHECK' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Nro de Cheque</label>
                  <input
                    type="text"
                    className="input"
                    value={directInvoiceForm.checkNumber}
                    onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, checkNumber: e.target.value }))}
                    placeholder="Nro Cheque"
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Emisor / Librador</label>
                  <input
                    type="text"
                    className="input"
                    value={directInvoiceForm.checkIssuer}
                    onChange={(e) => setDirectInvoiceForm((prev) => ({ ...prev, checkIssuer: e.target.value }))}
                    placeholder="Nombre Emisor"
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
                <label htmlFor="isEcheq" style={{ cursor: 'pointer', margin: 0, fontSize: '0.8rem' }}>¿Es un Cheque Electrónico (Echeq)?</label>
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
