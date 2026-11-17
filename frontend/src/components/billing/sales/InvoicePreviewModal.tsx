import { Printer, X } from 'lucide-react';
import { isOfficialInvoice } from './salesBilling.helpers';
import { OfficialInvoiceView } from './OfficialInvoiceView';
import { PresupuestoXView } from './PresupuestoXView';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

interface InvoicePreviewModalProps {
  invoice: any | null;
  onClose: () => void;
}

export function InvoicePreviewModal({ invoice, onClose }: InvoicePreviewModalProps) {
  if (!invoice) return null;

  const isOfficial = isOfficialInvoice(invoice);

  return (
    <NativeModalDialog
      isOpen={Boolean(invoice)}
      onClose={onClose}
      ariaLabelledBy="invoice-preview-modal-title"
      className="print-modal"
      style={{ maxWidth: '850px', width: '90vw', padding: '24px' }}
    >
      <div
        className="print-content-box"
        style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}
      >
        <div className="modal-header no-print">
          <h3 id="invoice-preview-modal-title">Vista Previa del Comprobante</h3>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px' }}
            onClick={onClose}
            aria-label="Cerrar vista previa"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="print-modal-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {isOfficial ? (
            <OfficialInvoiceView invoice={invoice} />
          ) : (
            <PresupuestoXView invoice={invoice} />
          )}
        </div>

        <div
          className="modal-footer no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: '14px',
            marginTop: '12px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            <Printer size={16} aria-hidden="true" /> Imprimir Comprobante
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </NativeModalDialog>
  );
}
