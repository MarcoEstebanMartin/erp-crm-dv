import { useEffect, useRef } from 'react';
import { CheckCircle, FileText, Printer } from 'lucide-react';
import { BillingType } from '../../utils/types';
import { formatIntegerARS } from '../../utils/currency';
import {
  printFacturaOficialA4,
  printOrderReceipt,
  printRemitoX,
} from '../../utils/printHelpers';

interface OrderFulfillmentSuccessViewProps {
  orderId: number;
  billingType: BillingType;
  invoicedOrder: any;
  fallbackTotal: number;
  onSuccess: () => void;
}

export default function OrderFulfillmentSuccessView({
  orderId,
  billingType,
  invoicedOrder,
  fallbackTotal,
  onSuccess,
}: OrderFulfillmentSuccessViewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open && typeof el.showModal === 'function') {
      el.showModal();
    }
  }, []);

  const printableOrder = invoicedOrder || {
    id: orderId,
    totalAmount: fallbackTotal,
    billingType,
  };
  const displayInvoiceNumber = invoicedOrder?.invoiceNumber;
  const displayCae = invoicedOrder?.cae;

  return (
    <dialog
      ref={dialogRef}
      className="app-native-dialog"
      aria-labelledby="fulfillment-success-title"
      onClose={onSuccess}
      {...({ closedby: 'any' } as any)}
      style={{ width: '90vw', maxWidth: '580px' }}
    >
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#F3F4F6',
            color: '#111827',
            border: '1px solid #E5E7EB',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px auto',
          }}
        >
          <CheckCircle size={36} aria-hidden="true" />
        </div>

        <h2
          id="fulfillment-success-title"
          style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}
        >
          Pedido #{orderId} Facturado con Éxito
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '24px' }}>
          {displayInvoiceNumber ? `Comprobante ${displayInvoiceNumber}` : 'Comprobante generado'}
          {displayCae ? ` · CAE ${displayCae}` : ''} · Total {formatIntegerARS(printableOrder.totalAmount ?? fallbackTotal)}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {billingType === BillingType.OFFICIAL ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.98rem',
                fontWeight: 700,
                backgroundColor: '#111827',
                color: '#FFFFFF',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
              onClick={() => printFacturaOficialA4(printableOrder)}
            >
              <FileText size={18} aria-hidden="true" /> Imprimir Factura (Sucursal A)
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.98rem',
                fontWeight: 700,
                backgroundColor: '#111827',
                color: '#FFFFFF',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
              onClick={() => printRemitoX(printableOrder)}
            >
              <FileText size={18} aria-hidden="true" /> Imprimir Remito (Sucursal X)
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.96rem',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              borderColor: '#E5E7EB',
              color: '#111827',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
            }}
            onClick={() => printOrderReceipt(printableOrder)}
          >
            <Printer size={18} aria-hidden="true" /> Imprimir Ticket
          </button>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%', padding: '10px', fontSize: '0.95rem', fontWeight: 600 }}
          onClick={onSuccess}
          autoFocus
        >
          Finalizar
        </button>
      </div>
    </dialog>
  );
}
