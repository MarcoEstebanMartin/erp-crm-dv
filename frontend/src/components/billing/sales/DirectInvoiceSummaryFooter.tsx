import type { DirectBillingTotals } from './sales.types';

interface DirectInvoiceSummaryFooterProps {
  billingType: string;
  selectedDirectClient: any;
  directBillingTotals: DirectBillingTotals;
  modalError: string | null;
  isSubmitting: boolean;
  isCartEmpty: boolean;
  onCancel: () => void;
}

export function DirectInvoiceSummaryFooter({
  billingType,
  selectedDirectClient,
  directBillingTotals,
  modalError,
  isSubmitting,
  isCartEmpty,
  onCancel
}: DirectInvoiceSummaryFooterProps) {
  return (
    <>
      <div
        style={{
          marginTop: 'auto',
          backgroundColor: '#F8F9FA',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          padding: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
          <span>Subtotal / Bruto:</span>
          <span style={{ fontWeight: 600 }}>
            ${(directBillingTotals.net + directBillingTotals.tax).toLocaleString('es-AR')}
          </span>
        </div>

        {billingType === 'OFFICIAL' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
              <span>Neto Gravado (Exento de IVA):</span>
              <span>${directBillingTotals.net.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
              <span>IVA (21%):</span>
              <span>${directBillingTotals.tax.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {directBillingTotals.percepcion > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--color-warning)' }}>
                <span>Percep. IIBB ({selectedDirectClient?.province || 'Bs.As.'}):</span>
                <span>+${directBillingTotals.percepcion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {directBillingTotals.percepcionIva > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--color-warning)' }}>
                <span>Percep. IVA RG 5329:</span>
                <span>+${directBillingTotals.percepcionIva.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
          </>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '1.1rem',
            fontWeight: 800,
            borderTop: '1px solid var(--border-color)',
            paddingTop: '10px',
            marginTop: '10px',
            color: 'var(--accent-color)'
          }}
        >
          <span>TOTAL GENERAL:</span>
          <span>${directBillingTotals.total.toLocaleString('es-AR')}</span>
        </div>
      </div>

      {modalError && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '0.83rem',
            fontWeight: 600,
            marginTop: '12px'
          }}
        >
          ⚠️ {modalError}
        </div>
      )}

      <div className="modal-footer" style={{ border: 0, padding: 0, marginTop: '16px' }}>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} disabled={isSubmitting} onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ flex: 1.5, backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)', fontWeight: 700 }}
          disabled={isSubmitting || isCartEmpty}
        >
          {isSubmitting ? 'Procesando Factura...' : 'Facturar y Confirmar'}
        </button>
      </div>
    </>
  );
}
