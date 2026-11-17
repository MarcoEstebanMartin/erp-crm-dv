import { resolveOrderPersona } from '../../../utils/orderSearchAndStatus.helper';

interface PresupuestoXViewProps {
  invoice: any;
}

const WHOLE_PESO_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

function formatPaymentMethodLabel(paymentMethod?: string): string {
  switch (paymentMethod) {
    case 'BANK_TRANSFER':
      return 'Transferencia';
    case 'CHECK':
      return 'Cheque';
    case 'CASH':
      return 'Efectivo';
    default:
      return 'Cuenta Corriente';
  }
}

export function PresupuestoXView({ invoice }: PresupuestoXViewProps) {
  const client = resolveOrderPersona(invoice);
  const issueDateStr = invoice.issueDate || invoice.createdAt;
  const formattedDate = issueDateStr
    ? new Date(issueDateStr).toLocaleDateString('es-AR')
    : new Date().toLocaleDateString('es-AR');

  const compNro = invoice.invoiceNumber
    ? String(invoice.invoiceNumber)
    : `INT-${String(invoice.id || 0).padStart(5, '0')}`;

  const clientName = client?.name || invoice.clientName || 'Consumidor Final';
  const clientAddress = client?.address || 'Retiro en Local';
  const clientCuit = client?.cuit && client.cuit !== 'S/D' ? client.cuit : null;
  const outstandingBalance = Math.round(Number(client?.outstandingBalance ?? 0));
  const totalAmount = Number(invoice.totalAmount || 0);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div
      id="print-area"
      className="invoice-container-box"
      style={{
        backgroundColor: '#ffffff',
        padding: '32px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#111827',
        fontSize: '0.84rem',
        lineHeight: 1.45,
      }}
    >
      {/* Header minimalista sin datos de la distribuidora */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '20px',
          marginBottom: '20px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: '#111827',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          N° {compNro}
        </div>

        <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#6b7280' }}>
          {formattedDate}
        </div>
      </div>

      {/* Datos del cliente y condición */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.35fr 1fr',
          gap: '16px',
          padding: '14px 18px',
          marginBottom: '20px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#6b7280',
              marginBottom: '4px',
            }}
          >
            Cliente
          </div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
            {clientName}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '2px' }}>
            {clientAddress}
            {clientCuit ? ` · CUIT/DNI ${clientCuit}` : ''}
          </div>
        </div>

        <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '18px' }}>
          <div
            style={{
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#6b7280',
              marginBottom: '4px',
            }}
          >
            Condición
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#111827' }}>
            {formatPaymentMethodLabel(invoice.paymentMethod)}
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: '#6b7280',
              marginTop: '2px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Saldo CC: ${outstandingBalance.toLocaleString('es-AR', WHOLE_PESO_FORMAT)}
          </div>
        </div>
      </div>

      {/* Tabla de artículos */}
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th
                scope="col"
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '84px',
                }}
              >
                SKU
              </th>
              <th
                scope="col"
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                }}
              >
                Artículo
              </th>
              <th
                scope="col"
                style={{
                  padding: '10px 12px',
                  textAlign: 'right',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '64px',
                }}
              >
                Cant.
              </th>
              <th
                scope="col"
                style={{
                  padding: '10px 12px',
                  textAlign: 'right',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '72px',
                }}
              >
                Kilos
              </th>
              <th
                scope="col"
                style={{
                  padding: '10px 12px',
                  textAlign: 'right',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '96px',
                }}
              >
                P. Unit
              </th>
              <th
                scope="col"
                style={{
                  padding: '10px 12px',
                  textAlign: 'right',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '108px',
                }}
              >
                Importe
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => {
              const isLast = idx === items.length - 1;
              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                  }}
                >
                  <td
                    style={{
                      padding: '10px 12px',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.76rem',
                      color: '#6b7280',
                    }}
                  >
                    {item.product?.sku || 'S/D'}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 500, color: '#111827' }}>
                    {item.product?.name || item.productName || 'Artículo general'}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    {item.weight || '-'}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    ${Number(item.unitPrice || 0).toLocaleString('es-AR', WHOLE_PESO_FORMAT)}
                  </td>
                  <td
                    style={{
                      padding: '10px 12px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: '#111827',
                    }}
                  >
                    ${Number(item.subtotal || 0).toLocaleString('es-AR', WHOLE_PESO_FORMAT)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer minimalista */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '20px',
        }}
      >
        <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
          Documento no válido como factura
        </div>

        <div
          style={{
            minWidth: '250px',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: '#4b5563',
              marginBottom: '8px',
            }}
          >
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              ${totalAmount.toLocaleString('es-AR', WHOLE_PESO_FORMAT)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: '1px solid #e5e7eb',
              paddingTop: '8px',
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#111827',
            }}
          >
            <span>Total</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              ${totalAmount.toLocaleString('es-AR', WHOLE_PESO_FORMAT)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
