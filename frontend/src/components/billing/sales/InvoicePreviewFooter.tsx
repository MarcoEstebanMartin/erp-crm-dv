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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
      <div
        style={{
          border: '1px solid #000',
          padding: '12px',
          fontSize: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          justifyContent: 'center',
        }}
      >
        {isOfficial ? (
          hasCae ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: '#000',
                    color: '#fff',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                  }}
                >
                  AFIP
                </div>
                <div>
                  <strong>Comprobante Autorizado por AFIP / ARCA</strong>
                  <div style={{ fontSize: '0.65rem', color: '#555' }}>
                    La autenticidad de este comprobante puede verificarse en los servicios oficiales de ARCA.
                  </div>
                </div>
              </div>
              <div>
                <strong>CAE Nº:</strong> {invoice.cae}
              </div>
              <div>
                <strong>Fecha de Vto. de CAE:</strong>{' '}
                {invoice.caeDueDate ? new Date(invoice.caeDueDate).toLocaleDateString('es-AR') : 'S/D'}
              </div>
            </>
          ) : (
            <div
              style={{
                backgroundColor: '#FEF3C7',
                border: '1px solid #F59E0B',
                color: '#92400E',
                padding: '10px 12px',
                borderRadius: '4px',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              COMPROBANTE PRE-FACTURA — PENDIENTE DE SOLICITUD DE CAE EN AFIP / ARCA
              <div style={{ fontSize: '0.68rem', fontWeight: 500, marginTop: '4px' }}>
                Autorización electrónica pendiente. Solicite el CAE desde Armado o Facturación.
              </div>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', color: '#777', fontWeight: 600 }}>
            DOCUMENTO NO VÁLIDO COMO FACTURA
            <div style={{ fontSize: '0.65rem', fontWeight: 400, marginTop: '4px' }}>
              Este presupuesto de venta interna se emite únicamente a fines administrativos e informativos de stock.
            </div>
          </div>
        )}
      </div>

      <div style={{ border: '2px solid #000', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {isOfficial ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Importe Neto Gravado:</span>
              <span style={{ fontWeight: 600 }}>
                ${Number(invoice.netAmount || 0).toLocaleString('es-AR', decimalOptions)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IVA Inscripto (21%):</span>
              <span style={{ fontWeight: 600 }}>
                ${Number(invoice.taxAmount || 0).toLocaleString('es-AR', decimalOptions)}
              </span>
            </div>
            {Number(invoice.percepcionAmount || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C0392B' }}>
                <span>
                  Percep. IIBB (
                  {persona?.province || (persona?.address?.includes('CABA') ? 'CABA' : 'Bs.As.')}):
                </span>
                <span style={{ fontWeight: 600 }}>
                  ${Number(invoice.percepcionAmount).toLocaleString('es-AR', decimalOptions)}
                </span>
              </div>
            )}
            {Number(invoice.percepcionIvaAmount || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C0392B' }}>
                <span>Percep. IVA RG 5329:</span>
                <span style={{ fontWeight: 600 }}>
                  ${Number(invoice.percepcionIvaAmount).toLocaleString('es-AR', decimalOptions)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal Neto:</span>
            <span>
              ${Number(invoice.totalAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '1.2rem',
            fontWeight: 800,
            borderTop: '2px solid #000',
            paddingTop: '8px',
            marginTop: '4px',
          }}
        >
          <span>TOTAL COMPROBANTE:</span>
          <span>
            ${Number(invoice.totalAmount || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </div>
  );
}
