interface InvoicePreviewFooterProps {
  invoice: any;
  isOfficial: boolean;
  decimalOptions: { minimumFractionDigits: number; maximumFractionDigits: number };
}

export function InvoicePreviewFooter({
  invoice,
  isOfficial,
  decimalOptions,
}: InvoicePreviewFooterProps) {
  const persona = invoice.persona || invoice.client;
  const hasCae = Boolean(invoice.cae);

  if (!isOfficial) {
    return null;
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        gap: '16px',
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          border: hasCae ? '1px solid #e5e7eb' : '1px solid #fcd34d',
          backgroundColor: hasCae ? '#f9fafb' : '#fffbeb',
          borderRadius: '8px',
          padding: '14px 16px',
          fontSize: '0.78rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        {hasCae ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #111827',
                  color: '#111827',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  letterSpacing: '0.06em',
                }}
              >
                ARCA
              </span>
              <span style={{ fontWeight: 600, color: '#111827' }}>
                Comprobante Autorizado
              </span>
            </div>
            <small style={{ fontSize: '0.68rem', color: '#6b7280', lineHeight: 1.3, marginBottom: '2px' }}>
              Orientación al Consumidor Provincia de Buenos Aires - Linea 148
            </small>
            <div style={{ color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
              <strong style={{ color: '#111827' }}>CAE N°:</strong> {invoice.cae}
            </div>
            <div style={{ color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
              <strong style={{ color: '#111827' }}>Vto. CAE:</strong>{' '}
              {invoice.caeDueDate ? new Date(invoice.caeDueDate).toLocaleDateString('es-AR') : 'S/D'}
            </div>
          </>
        ) : (
          <div style={{ color: '#92400e', fontWeight: 600, textAlign: 'center' }}>
            Comprobante pendiente de autorización CAE (AFIP / ARCA)
          </div>
        )}
      </div>

      <div
        style={{
          border: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontSize: '0.82rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
          <span>Importe Neto Gravado</span>
          <span style={{ fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            ${Number(invoice.netAmount || 0).toLocaleString('es-AR', decimalOptions)}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4b5563' }}>
          <span>IVA Inscripto (21%)</span>
          <span style={{ fontWeight: 600, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
            ${Number(invoice.taxAmount || 0).toLocaleString('es-AR', decimalOptions)}
          </span>
        </div>

        {Number(invoice.percepcionAmount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
            <span>
              Percep. IIBB ({persona?.province || (persona?.address?.includes('CABA') ? 'CABA' : 'Bs.As.')})
            </span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              ${Number(invoice.percepcionAmount).toLocaleString('es-AR', decimalOptions)}
            </span>
          </div>
        )}

        {Number(invoice.percepcionIvaAmount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
            <span>Percep. IVA RG 5329</span>
            <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              ${Number(invoice.percepcionIvaAmount).toLocaleString('es-AR', decimalOptions)}
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: '1.15rem',
            fontWeight: 700,
            color: '#111827',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '8px',
            marginTop: '4px',
          }}
        >
          <span>Total</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            ${Number(invoice.totalAmount || 0).toLocaleString('es-AR', decimalOptions)}
          </span>
        </div>
      </div>
    </div>
  );
}
