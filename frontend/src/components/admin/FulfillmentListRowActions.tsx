import { CheckSquare, FileText, Printer, RotateCcw, Tag } from 'lucide-react';
import type { FulfillmentStageKey } from '../../utils/fulfillmentCardMeta.helper';

interface FulfillmentListRowActionsProps {
  order: any;
  stage: FulfillmentStageKey;
  pendingCae: boolean;
  requestingCaeId?: number | null;
  onPrintPickingList: (order: any) => void;
  onPrintLabels: (order: any) => void;
  onOpenFulfillmentModal: (order: any) => void;
  onRevertToPending: (orderId: number) => void;
  onRequestCae: (orderId: number) => void;
  onPrintFacturaA4: (order: any) => void;
  onPrintRemitoX: (order: any) => void;
  onPrintReceipt: (order: any) => void;
}

/**
 * Botones de acción por fila para la vista Lista de Armado y Facturación.
 */
export function FulfillmentListRowActions({
  order: o,
  stage,
  pendingCae,
  requestingCaeId,
  onPrintPickingList,
  onPrintLabels,
  onOpenFulfillmentModal,
  onRevertToPending,
  onRequestCae,
  onPrintFacturaA4,
  onPrintRemitoX,
  onPrintReceipt,
}: FulfillmentListRowActionsProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px', flexWrap: 'wrap' }}>
      {stage === 'PENDING' && (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
            onClick={() => onPrintPickingList(o)}
            title="Imprimir Hoja de Armado"
            aria-label={`Imprimir hoja de armado pedido #${o.id}`}
          >
            <Printer size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
            onClick={() => onPrintLabels(o)}
            title="Imprimir Rótulos de Bultos"
            aria-label={`Imprimir rótulos pedido #${o.id}`}
          >
            <Tag size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => onOpenFulfillmentModal(o)}
          >
            Facturar
          </button>
        </>
      )}

      {stage === 'PREPARING' && (
        <>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
            onClick={() => onRevertToPending(o.id)}
            title="Devolver a Pendientes"
            aria-label={`Devolver pedido #${o.id} a Pendientes`}
          >
            <RotateCcw size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            onClick={() => onOpenFulfillmentModal(o)}
          >
            <CheckSquare size={13} aria-hidden="true" />
            Confirmar
          </button>
        </>
      )}

      {stage === 'BILLED' && (
        <>
          {pendingCae && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={requestingCaeId === o.id}
              style={{
                padding: '4px 9px',
                fontSize: '0.74rem',
                backgroundColor: '#E30613',
                borderColor: '#E30613',
              }}
              onClick={() => onRequestCae(o.id)}
            >
              {requestingCaeId === o.id ? 'Solicitando...' : 'Solicitar CAE'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
            onClick={() => (o.billingType === 'OFFICIAL' ? onPrintFacturaA4(o) : onPrintRemitoX(o))}
            title={o.billingType === 'OFFICIAL' ? 'Factura A4' : 'Boleta A4'}
          >
            <FileText size={13} aria-hidden="true" />
            {o.billingType === 'OFFICIAL' ? 'A4' : 'Rem. X'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.74rem' }}
            onClick={() => onPrintReceipt(o)}
            title="Imprimir Ticket"
            aria-label={`Imprimir ticket pedido #${o.id}`}
          >
            <Printer size={13} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
