interface InvoicePreviewFooterProps {
  invoice: any;
  isOfficial: boolean;
  decimalOptions: { minimumFractionDigits: number; maximumFractionDigits: number };
}

export function InvoicePreviewFooter({
  invoice,
  isOfficial,
  decimalOptions
}: InvoicePreviewFooterProps) {
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
          justifyContent: 'center'
        }}
      >
        {isOfficial ? (
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
                  fontSize: '1rem'
                }}
              >
                AFIP
              </div>
              <div>
                <strong>Comprobante Autorizado por AFIP Web Services</strong>
                <div style={{ fontSize: '0.65rem', color: '#555' }}>
                  La autenticidad de este comprobante puede ser verificada en el sitio oficial.
                </div>
              </div>
            </div>
            <div><strong>CAE Nº:</strong> {invoice.cae || '86251033241354'}</div>
            <div>
              <strong>Fecha de Vto. de CAE:</strong>{' '}
              {invoice.caeDueDate ? new Date(invoice.caeDueDate).toLocaleDateString('es-AR') : '04/07/2026'}
            </div>
          </>
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
                  {invoice.persona?.province || (invoice.persona?.address?.includes('CABA') ? 'CABA' : 'Bs.As.')}):
                </span>
                <span style={{ fontWeight: 600 }}>
                  ${Number(invoice.percepcionAmount).toLocaleString('es-AR', decimalOptions)}
                </span>
              </div>
            )}
            {Number(invoice.percepcionIvaAmount || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C0392B' }}>
                <span>Percep. IVA RG 5329 (3%):</span>
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
            marginTop: '4px'
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
