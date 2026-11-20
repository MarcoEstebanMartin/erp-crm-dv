import { CheckCircle, FileText, Printer, X } from 'lucide-react';
import { BillingType } from '../../utils/types';
import { formatBigIntARS } from '../../utils/fulfillmentCardMeta.helper';
import { formatIntegerARS } from '../../utils/currency';
import {
  printFacturaOficialA4,
  printRemitoX,
} from '../../utils/printHelpers';
import { NativeModalDialog } from './NativeModalDialog';
import {
  summarizeFulfillmentQueue,
  type FulfillmentQueueResult,
} from './fulfillmentQueue.helper';

interface OrderFulfillmentQueueSummaryProps {
  results: FulfillmentQueueResult[];
  totalPlanned: number;
  onClose: () => void;
}

export default function OrderFulfillmentQueueSummary({
  results,
  totalPlanned,
  onClose,
}: OrderFulfillmentQueueSummaryProps) {
  const summary = summarizeFulfillmentQueue(results);
  const remainingUnprocessed = Math.max(0, totalPlanned - results.length);

  return (
    <NativeModalDialog
      isOpen
      onClose={onClose}
      ariaLabelledBy="fulfillment-queue-summary-title"
      style={{ width: '92vw', maxWidth: '820px', maxHeight: '85vh' }}
    >
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={22} aria-hidden="true" style={{ color: '#111827' }} />
            <h2 id="fulfillment-queue-summary-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Resumen de Facturación
            </h2>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Cerrar resumen"
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '6px' }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
          }}
        >
          <div style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div style={{ fontSize: '0.76rem', color: '#6B7280', fontWeight: 600 }}>Facturados</div>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
              {summary.invoicedCount}
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div style={{ fontSize: '0.76rem', color: '#6B7280', fontWeight: 600 }}>Saltados</div>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#6B7280', marginTop: '2px' }}>
              {summary.skippedCount + remainingUnprocessed}
            </div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: '8px', border: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
            <div style={{ fontSize: '0.76rem', color: '#6B7280', fontWeight: 600 }}>Total facturado</div>
            <div className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800, color: '#111827', marginTop: '2px' }}>
              {formatBigIntARS(summary.invoicedTotalPesos)}
            </div>
          </div>
        </div>

        <div
          className="table-container"
          tabIndex={0}
          role="region"
          aria-label="Detalle de pedidos procesados"
          style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: 0 }}
        >
          <table style={{ width: '100%', fontSize: '0.88rem' }}>
            <thead style={{ position: 'sticky', insetBlockStart: 0, zIndex: 1, backgroundColor: 'var(--background-alt)' }}>
              <tr>
                <th scope="col" style={{ padding: '10px 12px' }}>Pedido</th>
                <th scope="col" style={{ padding: '10px 12px' }}>Cliente</th>
                <th scope="col" style={{ padding: '10px 12px' }}>Estado</th>
                <th scope="col" style={{ padding: '10px 12px', textAlign: 'right' }}>Total</th>
                <th scope="col" style={{ padding: '10px 12px', textAlign: 'right' }}>Imprimir</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                    No se facturó ningún pedido.
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.orderId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>#{r.orderId}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.clientName}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.status === 'INVOICED' ? (
                        <span className="badge-minimal badge-minimal--solid">
                          {r.invoiceNumber || 'Facturado'}
                        </span>
                      ) : (
                        <span className="badge-minimal">Saltado</span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                      {r.status === 'INVOICED' ? formatIntegerARS(r.totalAmount ?? 0) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.status === 'INVOICED' && r.invoicedOrder ? (
                        r.billingType === BillingType.OFFICIAL ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ height: '28px', padding: '0 8px', fontSize: '0.76rem' }}
                            onClick={() => printFacturaOficialA4(r.invoicedOrder)}
                          >
                            <FileText size={13} aria-hidden="true" /> A4
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ height: '28px', padding: '0 8px', fontSize: '0.76rem' }}
                            onClick={() => printRemitoX(r.invoicedOrder)}
                          >
                            <Printer size={13} aria-hidden="true" /> Remito X
                          </button>
                        )
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-primary"
            autoFocus
            style={{ backgroundColor: '#111827', borderColor: '#111827', padding: '10px 20px', fontWeight: 700 }}
            onClick={onClose}
          >
            Cerrar y actualizar
          </button>
        </div>
      </div>
    </NativeModalDialog>
  );
}
