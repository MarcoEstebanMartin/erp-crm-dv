import { formatCompanyPhone, getCompanyProfile } from '../../../utils/companyProfile';
import { resolveOrderPersona } from '../../../utils/orderSearchAndStatus.helper';
import { InvoicePreviewFooter } from './InvoicePreviewFooter';

interface OfficialInvoiceViewProps {
  invoice: any;
}

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

export function OfficialInvoiceView({ invoice }: OfficialInvoiceViewProps) {
  const company = getCompanyProfile();
  const phoneDisplay = formatCompanyPhone(company.telefono);
  const client = resolveOrderPersona(invoice);
  const issueDateStr = invoice.issueDate || invoice.createdAt;
  const formattedDate = issueDateStr
    ? new Date(issueDateStr).toLocaleDateString('es-AR')
    : new Date().toLocaleDateString('es-AR');

  const isFacturaA = invoice.invoiceType === 'FACTURA_A';
  const isFacturaAOfficial = invoice.billingType === 'OFFICIAL' && isFacturaA;
  const decimalOptions: Intl.NumberFormatOptions = isFacturaAOfficial
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

  const letter = isFacturaA
    ? 'A'
    : invoice.invoiceType === 'FACTURA_B'
      ? 'B'
      : invoice.invoiceType === 'FACTURA_C'
        ? 'C'
        : 'A';

  const code = isFacturaA
    ? 'COD. 001'
    : invoice.invoiceType === 'FACTURA_B'
      ? 'COD. 006'
      : 'COD. 011';

  const posStr = String(invoice.puntoVenta || company.puntoVenta || 1).padStart(4, '0');
  const compNro = invoice.invoiceNumber?.includes('-')
    ? invoice.invoiceNumber
    : `${posStr}-${invoice.invoiceNumber || String(invoice.id || 0).padStart(8, '0')}`;

  const clientName = client?.name || invoice.clientName || 'Consumidor Final';
  const clientAddress = client?.address || 'Retiro en Local';
  const clientCuit = client?.cuit || 'S/D';
  const clientIva = client?.taxCondition || (isFacturaA ? 'Responsable Inscripto' : 'Consumidor Final');
  const outstandingBalance = Math.round(Number(client?.outstandingBalance ?? 0));
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <div
      id="print-area"
      className="invoice-container-box"
      style={{
        backgroundColor: '#ffffff',
        padding: '20px 24px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#111827',
        fontSize: '0.8rem',
        lineHeight: 1.38,
      }}
    >
      {/* Header Oficial Minimalista: Logo + Empresa | Letra AFIP | Comprobante y Datos Fiscales */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          gap: '16px',
          alignItems: 'start',
          paddingBottom: '14px',
          marginBottom: '14px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {/* Emisor */}
        <div>
          <img
            src="/logo.png"
            alt={company.nombreFantasia}
            style={{
              maxHeight: '46px',
              maxWidth: '180px',
              objectFit: 'contain',
              marginBottom: '8px',
              display: 'block',
            }}
          />
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#111827' }}>
            {company.razonSocial}
          </div>
          {company.direccion && (
            <div style={{ fontSize: '0.76rem', color: '#4b5563', marginTop: '2px' }}>
              {company.direccion}
            </div>
          )}
          {(phoneDisplay || company.email) && (
            <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: '2px' }}>
              {phoneDisplay ? `Tel: ${phoneDisplay}` : ''}
              {phoneDisplay && company.email ? ' · ' : ''}
              {company.email || ''}
            </div>
          )}
          <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: '2px' }}>
            IVA: Responsable Inscripto
          </div>
        </div>

        {/* Letra AFIP Central */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '2px',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '8px',
              border: '1.5px solid #111827',
              backgroundColor: '#ffffff',
              color: '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.35rem',
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {letter}
          </div>
          <div
            style={{
              fontSize: '0.62rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: '#6b7280',
              marginTop: '5px',
            }}
          >
            {code}
          </div>
        </div>

        {/* Datos del Comprobante */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: '#111827',
            }}
          >
            Factura {letter}
          </div>
          <div
            style={{
              fontSize: '0.92rem',
              fontWeight: 600,
              color: '#111827',
              marginTop: '2px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            N° {compNro}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>
            Emisión: {formattedDate}
          </div>
          <div
            style={{
              fontSize: '0.74rem',
              color: '#4b5563',
              marginTop: '8px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div>
              <strong style={{ color: '#111827' }}>CUIT:</strong> {company.cuit}
            </div>
            {company.iibb && (
              <div>
                <strong style={{ color: '#111827' }}>IIBB:</strong> {company.iibb}
              </div>
            )}
            {company.inicioActividades && (
              <div>
                <strong style={{ color: '#111827' }}>Inicio Act.:</strong> {company.inicioActividades}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Datos del Receptor y Condición de Venta */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.35fr 1fr',
          gap: '14px',
          padding: '10px 14px',
          marginBottom: '14px',
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
          </div>
          <div style={{ fontSize: '0.76rem', color: '#6b7280', marginTop: '2px' }}>
            CUIT: {clientCuit} · {clientIva}
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
            Condición de Venta
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
            Saldo CC: ${outstandingBalance.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Tabla de artículos */}
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '14px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th
                scope="col"
                style={{
                  padding: '8px 8px 8px 10px',
                  textAlign: 'left',
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '56px',
                }}
              >
                SKU
              </th>
              <th
                scope="col"
                style={{
                  padding: '8px',
                  textAlign: 'left',
                  fontSize: '0.66rem',
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
                  padding: '8px',
                  textAlign: 'right',
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '48px',
                }}
              >
                Cant.
              </th>
              <th
                scope="col"
                style={{
                  padding: '8px',
                  textAlign: 'right',
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '54px',
                }}
              >
                Kilos
              </th>
              <th
                scope="col"
                style={{
                  padding: '8px',
                  textAlign: 'right',
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '90px',
                  lineHeight: 1.25,
                }}
              >
                P. Unit
                {isFacturaAOfficial && (
                  <>
                    <br />
                    <span style={{ fontWeight: 500, color: '#9ca3af' }}>(s/ IVA)</span>
                  </>
                )}
              </th>
              <th
                scope="col"
                style={{
                  padding: '8px 10px 8px 8px',
                  textAlign: 'right',
                  fontSize: '0.66rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#6b7280',
                  width: '96px',
                  lineHeight: 1.25,
                }}
              >
                Importe
                {isFacturaAOfficial && (
                  <>
                    <br />
                    <span style={{ fontWeight: 500, color: '#9ca3af' }}>(s/ IVA)</span>
                  </>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, idx: number) => {
              const isLast = idx === items.length - 1;
              const displayPrice = isFacturaAOfficial
                ? Number(item.unitPrice || 0) / 1.21
                : Number(item.unitPrice || 0);
              const displaySubtotal = isFacturaAOfficial
                ? Number(item.subtotal || 0) / 1.21
                : Number(item.subtotal || 0);

              return (
                <tr
                  key={idx}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                  }}
                >
                  <td
                    style={{
                      padding: '6px 8px 6px 10px',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: '0.74rem',
                      color: '#6b7280',
                    }}
                  >
                    {item.product?.sku || 'S/D'}
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 500, color: '#111827' }}>
                    {item.product?.name || item.productName || 'Artículo general'}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    {item.quantity}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    {item.weight || '-'}
                  </td>
                  <td
                    style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    ${displayPrice.toLocaleString('es-AR', decimalOptions)}
                  </td>
                  <td
                    style={{
                      padding: '6px 10px 6px 8px',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: '#111827',
                    }}
                  >
                    ${displaySubtotal.toLocaleString('es-AR', decimalOptions)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <InvoicePreviewFooter invoice={invoice} isOfficial={true} decimalOptions={decimalOptions} />
    </div>
  );
}
