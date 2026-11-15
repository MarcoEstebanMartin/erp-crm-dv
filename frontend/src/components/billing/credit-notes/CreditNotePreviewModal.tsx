import { Printer, X } from 'lucide-react';
import { formatCompanyPhone, getCompanyProfile } from '../../../utils/companyProfile';

interface CreditNotePreviewModalProps {
  creditNote: any | null;
  onClose: () => void;
}

export function CreditNotePreviewModal({ creditNote, onClose }: CreditNotePreviewModalProps) {
  if (!creditNote) return null;

  const company = getCompanyProfile();
  const phoneDisplay = formatCompanyPhone(company.telefono);
  const isOfficial = creditNote.billingType === 'OFFICIAL';
  const hasCae = Boolean(creditNote.cae);
  const formattedDate = creditNote.createdAt
    ? new Date(creditNote.createdAt).toLocaleDateString('es-AR')
    : new Date().toLocaleDateString('es-AR');

  const isA = String(creditNote.creditNoteType || '').includes('_A');
  const isB = String(creditNote.creditNoteType || '').includes('_B');
  const letter = isA ? 'A' : isB ? 'B' : 'X';
  const code = isA ? 'COD. 003' : isB ? 'COD. 008' : 'COD. 000';

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '850px',
          width: '90vw',
          maxHeight: '90vh',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Visualización de Comprobante</h2>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px' }}
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          <div
            id="invoice-print-section"
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #1D1D1F',
              padding: '24px',
              borderRadius: '6px',
              color: '#000000',
              fontSize: '0.8rem',
              lineHeight: '1.4',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 0.4fr 1.2fr',
                borderBottom: '2px solid #000',
                paddingBottom: '14px',
                marginBottom: '14px',
              }}
            >
              <div>
                <div style={{ fontSize: '1.08rem', fontWeight: 900, textTransform: 'uppercase' }}>
                  {company.nombreFantasia}
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 600 }}>{company.razonSocial}</div>
                <div style={{ fontSize: '0.72rem', color: '#555', marginTop: '4px' }}>
                  {company.direccion && <div>{company.direccion}</div>}
                  {phoneDisplay && <div>Teléfono: {phoneDisplay}</div>}
                  {company.email && <div>Email: {company.email}</div>}
                  <div>IVA Responsable Inscripto</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    border: '2px solid #000',
                    width: '45px',
                    height: '45px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    fontWeight: 900,
                    backgroundColor: '#fff',
                  }}
                >
                  {letter}
                  <span style={{ fontSize: '0.5rem', fontWeight: 600, marginTop: '-2px' }}>{code}</span>
                </div>
              </div>

              <div style={{ paddingLeft: '20px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>NOTA DE CRÉDITO</div>
                <div style={{ fontSize: '0.76rem', marginTop: '6px' }}>
                  <div>
                    <strong>
                      Número: {creditNote.creditNoteNumber || `NCI-${String(creditNote.id).padStart(5, '0')}`}
                    </strong>
                  </div>
                  <div>Fecha: {formattedDate}</div>
                  <div>CUIT: {company.cuit}</div>
                  {company.iibb && <div>Ingresos Brutos: {company.iibb}</div>}
                </div>
              </div>
            </div>

            <div
              style={{
                border: '1px solid #000',
                padding: '10px',
                marginBottom: '14px',
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr',
              }}
            >
              <div>
                <div>
                  <strong>Cliente:</strong> {creditNote.persona?.name || 'Consumidor Final'}
                </div>
                <div>
                  <strong>Domicilio:</strong> {creditNote.persona?.address || 'S/D'}
                </div>
              </div>
              <div>
                <div>
                  <strong>CUIT:</strong> {creditNote.persona?.cuit || 'S/D'}
                </div>
                <div>
                  <strong>IVA:</strong> {isA ? 'Responsable Inscripto' : 'Consumidor Final'}
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f9f9fb',
                padding: '8px 12px',
                border: '1px dashed #777',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>
                <strong>Concepto / Motivo de la Acreditación:</strong> {creditNote.reason}
              </span>
              {creditNote.orderId && <span>Asociado a Pedido #{creditNote.orderId}</span>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', backgroundColor: '#eee' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Producto</th>
                  <th style={{ padding: '6px', textAlign: 'right', width: '80px' }}>Cant</th>
                  <th style={{ padding: '6px', textAlign: 'right', width: '80px' }}>Kilos</th>
                  <th style={{ padding: '6px', textAlign: 'right', width: '100px' }}>P. Unit</th>
                  <th style={{ padding: '6px', textAlign: 'right', width: '110px' }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {creditNote.items &&
                  creditNote.items.map((item: any, index: number) => {
                    const displayPrice = isA ? item.unitPrice / 1.21 : item.unitPrice;
                    const subtotal = item.weight
                      ? item.weight * item.unitPrice
                      : item.quantity * item.unitPrice;
                    const displaySubtotal = isA ? subtotal / 1.21 : subtotal;

                    return (
                      <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '6px' }}>
                          <strong>{item.product?.name || `Producto #${item.productId}`}</strong>
                          <div style={{ fontSize: '0.7rem', color: '#666' }}>SKU: {item.product?.sku}</div>
                        </td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>{item.weight || '-'}</td>
                        <td style={{ padding: '6px', textAlign: 'right' }}>
                          ${Number(displayPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>
                          ${Number(displaySubtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
              <div style={{ padding: '10px', fontSize: '0.74rem' }}>
                {isOfficial ? (
                  hasCae ? (
                    <>
                      <div>
                        <strong>Comprobante Autorizado Oficialmente por AFIP / ARCA</strong>
                      </div>
                      <div>CAE N°: {creditNote.cae}</div>
                      <div>
                        Vto. CAE:{' '}
                        {creditNote.caeDueDate
                          ? new Date(creditNote.caeDueDate).toLocaleDateString('es-AR')
                          : 'S/D'}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        backgroundColor: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        color: '#92400E',
                        padding: '8px',
                        borderRadius: '4px',
                        fontWeight: 700,
                      }}
                    >
                      PENDIENTE DE APROBACIÓN / SOLICITUD DE CAE AFIP
                    </div>
                  )
                ) : (
                  <div style={{ color: '#777', fontWeight: 600, textAlign: 'center', paddingTop: '10px' }}>
                    COMPROBANTE INTERNO - NO VÁLIDO COMO FACTURA
                  </div>
                )}
              </div>

              <div
                style={{
                  border: '1px solid #000',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {isOfficial ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Neto Gravado:</span>
                      <span>
                        ${Number(creditNote.netAmount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>IVA 21%:</span>
                      <span>
                        ${Number(creditNote.taxAmount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Subtotal Neto:</span>
                    <span>
                      ${Number(creditNote.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    borderTop: '2px solid #000',
                    paddingTop: '8px',
                    marginTop: '4px',
                  }}
                >
                  <span>TOTAL BONIFICADO:</span>
                  <span>
                    -${Number(creditNote.totalAmount).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0 0' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-primary)',
              color: '#fff',
              borderColor: 'var(--color-primary)',
            }}
          >
            <Printer size={16} /> Imprimir Comprobante
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
