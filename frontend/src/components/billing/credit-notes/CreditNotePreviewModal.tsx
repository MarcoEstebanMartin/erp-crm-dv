import { Printer, X } from 'lucide-react';
import { NativeModalDialog } from '../../modals/NativeModalDialog';
import { OfficialInvoiceView } from '../sales/OfficialInvoiceView';
import { PresupuestoXView } from '../sales/PresupuestoXView';

interface CreditNotePreviewModalProps {
  creditNote: any | null;
  onClose: () => void;
}

export function CreditNotePreviewModal({ creditNote, onClose }: CreditNotePreviewModalProps) {
  if (!creditNote) return null;

  const isOfficial = creditNote.billingType === 'OFFICIAL';
  const adaptedDocument = {
    ...creditNote,
    invoiceType: creditNote.creditNoteType,
    invoiceNumber:
      creditNote.creditNoteNumber ||
      (isOfficial ? undefined : `NCI-${String(creditNote.id || 0).padStart(5, '0')}`),
    items: Array.isArray(creditNote.items)
      ? creditNote.items.map((item: any) => ({
          ...item,
          subtotal:
            item.subtotal != null
              ? Number(item.subtotal)
              : item.weight
                ? Number(item.weight) * Number(item.unitPrice || 0)
                : Number(item.quantity || 0) * Number(item.unitPrice || 0),
        }))
      : [],
  };

  return (
    <NativeModalDialog
      isOpen={Boolean(creditNote)}
      onClose={onClose}
      ariaLabelledBy="cn-preview-modal-title"
      className="print-modal"
      style={{ maxWidth: '850px', width: '90vw', padding: '24px' }}
    >
      <div
        className="print-content-box"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div className="modal-header no-print">
          <h3 id="cn-preview-modal-title">Vista Previa del Comprobante</h3>
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
            <OfficialInvoiceView invoice={adaptedDocument} documentKind="CREDIT_NOTE" />
          ) : (
            <PresupuestoXView invoice={adaptedDocument} documentKind="CREDIT_NOTE" />
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
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
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
