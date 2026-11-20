import { useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { api } from '../../utils/api';
import { BillingType } from '../../utils/types';
import {
  formatBigIntARS,
  resolveOrderFiscalChannelBadge,
  sumOrdersTotalInt,
  toOrderIntegerPesosBigInt,
} from '../../utils/fulfillmentCardMeta.helper';
import { resolveOrderClientName } from '../../utils/orderSearchAndStatus.helper';
import { NativeModalDialog } from './NativeModalDialog';
import {
  buildBatchOrderWeightItems,
  hasBatchOrderWeightWarning,
  summarizeBatchInvoiceResults,
  type BatchInvoiceResult,
} from './fulfillmentQueue.helper';

interface OrderBatchInvoiceModalProps {
  orders: any[];
  onClose: () => void;
  onComplete: () => void;
}

type BatchPhase = 'REVIEW' | 'RUNNING' | 'DONE';

export default function OrderBatchInvoiceModal({
  orders,
  onClose,
  onComplete,
}: OrderBatchInvoiceModalProps) {
  const [checkedIds, setCheckedIds] = useState<number[]>(() => orders.map((o) => o.id));
  const [deferCae, setDeferCae] = useState(false);
  const [phase, setPhase] = useState<BatchPhase>('REVIEW');
  const [processedCount, setProcessedCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [results, setResults] = useState<BatchInvoiceResult[]>([]);
  const stopRequestedRef = useRef(false);

  const selectedOrders = useMemo(() => {
    const idSet = new Set(checkedIds);
    return orders.filter((o) => idSet.has(o.id));
  }, [orders, checkedIds]);

  const selectedTotal = useMemo(() => sumOrdersTotalInt(selectedOrders), [selectedOrders]);
  const hasOfficialInSelection = useMemo(
    () => selectedOrders.some((o) => o.billingType === BillingType.OFFICIAL),
    [selectedOrders],
  );
  const allChecked = orders.length > 0 && checkedIds.length === orders.length;
  const summary = useMemo(() => summarizeBatchInvoiceResults(results), [results]);

  const toggleId = (id: number) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    setCheckedIds(allChecked ? [] : orders.map((o) => o.id));
  };

  const runBatch = async () => {
    if (selectedOrders.length === 0) return;
    stopRequestedRef.current = false;
    setPhase('RUNNING');
    setTargetCount(selectedOrders.length);
    setProcessedCount(0);
    setResults([]);

    const batchResults: BatchInvoiceResult[] = [];

    for (const order of selectedOrders) {
      if (stopRequestedRef.current) break;

      const clientName = resolveOrderClientName(order, 'Consumidor Final');
      const billingType: BillingType = order.billingType || BillingType.INTERNAL;

      try {
        const weightItems = buildBatchOrderWeightItems(order);
        await api.confirmOrderArmado(order.id, weightItems);
        const invoiced = await api.invoiceOrder(
          order.id,
          billingType,
          undefined,
          undefined,
          undefined,
          billingType === BillingType.OFFICIAL ? deferCae : false,
        );

        batchResults.push({
          orderId: order.id,
          clientName,
          status: 'INVOICED',
          billingType,
          invoiceNumber: invoiced?.invoiceNumber ?? null,
          totalAmount: invoiced?.totalAmount ?? order.totalAmount,
        });
      } catch (err: any) {
        batchResults.push({
          orderId: order.id,
          clientName,
          status: 'ERROR',
          billingType,
          errorMessage: err?.message || 'Error al facturar',
        });
      }

      setProcessedCount(batchResults.length);
      setResults([...batchResults]);
    }

    setPhase('DONE');
  };

  const handleClose = () => {
    if (phase === 'RUNNING') return;
    if (results.some((r) => r.status === 'INVOICED')) {
      onComplete();
    } else {
      onClose();
    }
  };

  const progressPct = targetCount > 0 ? Math.round((processedCount / targetCount) * 100) : 0;

  return (
    <NativeModalDialog
      isOpen
      onClose={handleClose}
      ariaLabelledBy="batch-invoice-title"
      style={{ width: '92vw', maxWidth: '860px', maxHeight: '85vh' }}
    >
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '85vh' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <h2 id="batch-invoice-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
              Facturar lote
            </h2>
            {phase === 'REVIEW' && (
              <span className="tabular-nums" style={{ fontSize: '0.84rem', color: '#6B7280', fontWeight: 600 }}>
                {selectedOrders.length} · {formatBigIntARS(selectedTotal)}
              </span>
            )}
          </div>
          {phase !== 'RUNNING' && (
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={handleClose}
              style={{ padding: '4px', borderRadius: '6px' }}
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>

        {phase === 'REVIEW' && (
          <>
            <div
              className="table-container"
              tabIndex={0}
              role="region"
              aria-label="Pedidos del lote"
              style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: 0 }}
            >
              <table style={{ width: '100%', fontSize: '0.86rem' }}>
                <thead style={{ position: 'sticky', insetBlockStart: 0, zIndex: 1, backgroundColor: 'var(--background-alt)' }}>
                  <tr>
                    <th scope="col" style={{ width: '36px', textAlign: 'center', padding: '9px 10px' }}>
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleAll}
                        aria-label="Seleccionar todos"
                        style={{ accentColor: '#111827', cursor: 'pointer' }}
                      />
                    </th>
                    <th scope="col" style={{ padding: '9px 10px' }}>#</th>
                    <th scope="col" style={{ padding: '9px 10px' }}>Cliente</th>
                    <th scope="col" style={{ padding: '9px 10px', textAlign: 'center' }}>Ítems</th>
                    <th scope="col" style={{ padding: '9px 10px', textAlign: 'center' }}>Canal</th>
                    <th scope="col" style={{ padding: '9px 10px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const checked = checkedIds.includes(o.id);
                    const channel = resolveOrderFiscalChannelBadge(o);
                    const weightWarning = hasBatchOrderWeightWarning(o);
                    return (
                      <tr
                        key={o.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          opacity: checked ? 1 : 0.48,
                        }}
                      >
                        <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleId(o.id)}
                            aria-label={`Incluir pedido #${o.id}`}
                            style={{ accentColor: '#111827', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap' }}>#{o.id}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>
                          <span>{resolveOrderClientName(o, 'Consumidor Final')}</span>
                          {weightWarning && (
                            <span className="badge-minimal badge-minimal--danger" style={{ marginLeft: '8px' }}>
                              Revisar kg
                            </span>
                          )}
                        </td>
                        <td className="tabular-nums" style={{ padding: '8px 10px', textAlign: 'center', color: '#6B7280' }}>
                          {o.items?.length || 0}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span className={channel.isOfficial ? 'badge-minimal badge-minimal--solid' : 'badge-minimal'}>
                            {channel.code}
                          </span>
                        </td>
                        <td className="tabular-nums" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                          {formatBigIntARS(toOrderIntegerPesosBigInt(o.totalAmount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '0.82rem', color: '#6B7280', fontWeight: 600 }}>Cuenta Corriente</span>
                {hasOfficialInSelection && (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#111827', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={deferCae}
                      onChange={(e) => setDeferCae(e.target.checked)}
                      style={{ accentColor: '#111827' }}
                    />
                    Diferir CAE
                  </label>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={selectedOrders.length === 0}
                  onClick={() => void runBatch()}
                  style={{
                    backgroundColor: '#E30613',
                    borderColor: '#E30613',
                    fontWeight: 700,
                    padding: '8px 18px',
                  }}
                >
                  Facturar {selectedOrders.length}
                </button>
              </div>
            </div>
          </>
        )}

        {phase === 'RUNNING' && (
          <div style={{ padding: '24px 8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Facturando {processedCount} / {targetCount}
              </span>
              <span className="tabular-nums" style={{ color: '#6B7280', fontSize: '0.85rem', fontWeight: 600 }}>
                {progressPct}%
              </span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#F3F4F6', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: '#111827', transition: 'width 0.15s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  stopRequestedRef.current = true;
                }}
              >
                Detener
              </button>
            </div>
          </div>
        )}

        {phase === 'DONE' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span className="badge-minimal badge-minimal--solid tabular-nums" style={{ padding: '5px 10px', fontSize: '0.84rem' }}>
                <CheckCircle2 size={14} aria-hidden="true" />
                {summary.invoicedCount} facturados · {formatBigIntARS(summary.invoicedTotalPesos)}
              </span>
              {summary.errorCount > 0 && (
                <span className="badge-minimal badge-minimal--danger tabular-nums" style={{ padding: '5px 10px', fontSize: '0.84rem' }}>
                  <AlertCircle size={14} aria-hidden="true" />
                  {summary.errorCount} con error
                </span>
              )}
            </div>

            {summary.errorCount > 0 && (
              <div
                className="table-container"
                tabIndex={0}
                role="region"
                aria-label="Errores del lote"
                style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid #FECACA', borderRadius: '8px', marginTop: 0 }}
              >
                <table style={{ width: '100%', fontSize: '0.84rem' }}>
                  <thead>
                    <tr>
                      <th scope="col" style={{ padding: '8px 10px' }}>#</th>
                      <th scope="col" style={{ padding: '8px 10px' }}>Cliente</th>
                      <th scope="col" style={{ padding: '8px 10px' }}>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results
                      .filter((r) => r.status === 'ERROR')
                      .map((r) => (
                        <tr key={r.orderId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>#{r.orderId}</td>
                          <td style={{ padding: '8px 10px' }}>{r.clientName}</td>
                          <td style={{ padding: '8px 10px', color: '#E30613' }}>{r.errorMessage}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                autoFocus
                onClick={handleClose}
                style={{ backgroundColor: '#111827', borderColor: '#111827', padding: '9px 20px', fontWeight: 700 }}
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </NativeModalDialog>
  );
}
