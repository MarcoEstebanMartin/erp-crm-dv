import { Printer, X } from 'lucide-react';
import { isOfficialInvoice } from './salesBilling.helpers';
import { InvoicePreviewFooter } from './InvoicePreviewFooter';

interface InvoicePreviewModalProps {
  invoice: any | null;
  onClose: () => void;
}

export function InvoicePreviewModal({ invoice, onClose }: InvoicePreviewModalProps) {
  if (!invoice) return null;

  const isOfficial = isOfficialInvoice(invoice);
  const issueDateStr = invoice.issueDate || invoice.createdAt;
  const decimalOptions =
    invoice.billingType === 'OFFICIAL' && invoice.invoiceType === 'FACTURA_A'
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

  const letter =
    invoice.invoiceType === 'FACTURA_A'
      ? 'A'
      : invoice.invoiceType === 'FACTURA_B'
        ? 'B'
        : invoice.invoiceType === 'FACTURA_C'
          ? 'C'
          : 'X';

  const code =
    invoice.invoiceType === 'FACTURA_A'
      ? 'COD. 001'
      : invoice.invoiceType === 'FACTURA_B'
        ? 'COD. 006'
        : invoice.invoiceType === 'FACTURA_C'
          ? 'COD. 011'
          : 'COD. 000';

  return (
    <div className="modal-overlay print-modal">
      <div className="modal-content print-content-box" style={{ maxWidth: '850px', width: '90vw' }}>
        <div className="modal-header no-print">
          <h3>Vista Previa del Comprobante</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div
          id="print-area"
          className="invoice-container-box"
          style={{ backgroundColor: '#fff', padding: '30px', border: '1px solid #ddd', fontFamily: 'Arial, sans-serif', color: '#000', fontSize: '0.85rem' }}
        >
          <div style={{ display: 'flex', border: '2px solid #000', marginBottom: '20px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-2px', left: '50%', transform: 'translateX(-50%)', width: '44px', height: '44px', backgroundColor: '#fff', border: '2px solid #000', borderTop: '0', textAlign: 'center', fontSize: '1.6rem', fontWeight: 800, zIndex: 2 }}>
              {letter}
              <div style={{ fontSize: '0.5rem', fontWeight: 600, marginTop: '-4px' }}>{code}</div>
            </div>

            <div style={{ width: '50%', padding: '16px', borderRight: '1px solid #000' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>DISTRIBUIDORA DV</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px', fontWeight: 600 }}>Ruta 5 - Km 320, General Villegas, Buenos Aires</div>
              <div style={{ fontSize: '0.75rem', color: '#444', marginTop: '2px' }}>Tel: (03388) 15-429304 | E-mail: contacto@distribuidoradv.com</div>
              <div style={{ fontSize: '0.75rem', color: '#444' }}>IVA: Responsable Inscripto</div>
            </div>

            <div style={{ width: '50%', padding: '16px', paddingLeft: '32px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>
                {isOfficial ? 'Factura Oficial' : 'Presupuesto de Venta Interna'}
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>Comp. Nro: {invoice.invoiceNumber?.split('-')[1] || invoice.invoiceNumber || '00000000'}</strong>
              </div>
              <div>Fecha de Emisión: {new Date(issueDateStr).toLocaleDateString('es-AR')}</div>
              <div style={{ fontSize: '0.75rem', marginTop: '8px' }}>
                <div>CUIT: 30-71490283-9</div>
                <div>Ingresos Brutos: 30-71490283-9 (Convenio Multilateral)</div>
                <div>Inicio de Actividades: 01/03/2018</div>
              </div>
            </div>
          </div>

          <div style={{ border: '2px solid #000', padding: '16px', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
            <div>
              <div><strong>Nombre / Razón Social:</strong> {invoice.persona?.name || 'Consumidor Final'}</div>
              <div><strong>Domicilio:</strong> {invoice.persona?.address || 'Retiro en Local'}</div>
              <div><strong>CUIT / DNI:</strong> {invoice.persona?.cuit || 'S/D'}</div>
              <div><strong>Categoría de IVA:</strong> {invoice.invoiceType === 'FACTURA_A' ? 'Responsable Inscripto' : 'Consumidor Final'}</div>
            </div>
            <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '16px' }}>
              <div><strong>Condición de Venta:</strong></div>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase' }}>
                {invoice.paymentMethod === 'BANK_TRANSFER'
                  ? 'TRANSFERENCIA'
                  : invoice.paymentMethod === 'CHECK'
                    ? 'CHEQUE'
                    : invoice.paymentMethod === 'CASH'
                      ? 'EFECTIVO'
                      : 'CUENTA CORRIENTE'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#555', marginTop: '6px' }}>
                Saldo CC Histórico del Cliente: ${Number(invoice.persona?.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#eee', borderBottom: '2px solid #000' }}>
                <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'left' }}>Código / SKU</th>
                <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'left' }}>Descripción del Artículo</th>
                <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right', width: '70px' }}>Cant</th>
                <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right', width: '80px' }}>Kilos</th>
                <th style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right', width: '100px' }}>P. Unit</th>
                <th style={{ padding: '8px', textAlign: 'right', width: '110px' }}>Importe</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items &&
                invoice.items.map((item: any, idx: number) => {
                  const isFacturaAOfficial = invoice.billingType === 'OFFICIAL' && invoice.invoiceType === 'FACTURA_A';
                  const displayPrice = isFacturaAOfficial ? item.unitPrice / 1.21 : item.unitPrice;
                  const displaySubtotal = isFacturaAOfficial ? item.subtotal / 1.21 : item.subtotal;

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #000' }}>
                      <td style={{ padding: '8px', borderRight: '1px solid #000', fontFamily: 'monospace' }}>{item.product?.sku || 'S/D'}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #000', fontWeight: 600 }}>{item.product?.name || item.productName || 'Artículo general'}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right' }}>{item.weight || '-'}</td>
                      <td style={{ padding: '8px', borderRight: '1px solid #000', textAlign: 'right' }}>
                        ${Number(displayPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>
                        ${Number(displaySubtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          <InvoicePreviewFooter invoice={invoice} isOfficial={isOfficial} decimalOptions={decimalOptions} />
        </div>

        <div className="modal-footer no-print" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--color-primary)', color: '#fff', borderColor: 'var(--color-primary)' }}
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
